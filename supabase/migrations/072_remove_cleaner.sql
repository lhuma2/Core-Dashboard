-- 072: Team → Remove a cleaner (new hub).
-- Safe to re-run. Run it BEFORE the code that uses it goes live.
--   * Removing a cleaner deletes their login, but keeps their profile so past cleans, photos, problems and their
--     signed pack still show their name. profiles.removed_at marks them as off the team.
--   * profiles.user_id can now be empty, and deleting a login empties it instead of deleting the profile
--     (before this, deleting a login deleted the profile and, with it, their compliance documents and job links).
--   * hub_remove_cleaner(p, dry): takes them off every regular commercial site and every home still running, notes it
--     in each client's history, and marks them removed, all in one go. dry = true only lists what they're on.
--   * A removed cleaner can't be put back on a site or home (triggers), and their email can be added again later.

alter table public.profiles add column if not exists removed_at timestamptz;
alter table public.profiles alter column user_id drop not null;
alter table public.cleaner_packs add column if not exists removed_at timestamptz;

-- deleting a login keeps the profile
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass and confdeltype <> 'n'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass) then
    alter table public.profiles add constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- the same email can be sent the pack again once the old one is removed
drop index if exists public.cleaner_packs_email_idx;
create unique index if not exists cleaner_packs_email_live_idx on public.cleaner_packs (lower(email)) where removed_at is null;

-- a removed cleaner can't be put on a site or a home
create or replace function public.no_removed_cleaner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cleaner_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.cleaner_id is not distinct from old.cleaner_id then return new; end if;
  if exists (select 1 from public.profiles p where p.id = new.cleaner_id and p.removed_at is not null) then
    raise exception 'cleaner_removed' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists no_removed_cleaner on public.client_service_cleaners;
create trigger no_removed_cleaner before insert or update on public.client_service_cleaners for each row execute procedure public.no_removed_cleaner();
drop trigger if exists no_removed_cleaner on public.homes;
create trigger no_removed_cleaner before insert or update of cleaner_id on public.homes for each row execute procedure public.no_removed_cleaner();

create or replace function public.hub_remove_cleaner(p uuid, dry boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v       public.profiles%rowtype;
  today   date := (now() at time zone 'Australia/Brisbane')::date;
  first   text;
  v_sites jsonb;
  v_homes jsonb;
  v_ids   uuid[];
begin
  if not (coalesce(auth.role(), '') = 'service_role' or coalesce(public.app_user_role(), '') in ('admin', 'manager')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v from public.profiles where id = p and role = 'cleaner' for update;
  if not found or v.removed_at is not null then raise exception 'cleaner_gone' using errcode = 'P0002'; end if;
  first := coalesce(nullif(split_part(trim(coalesce(v.full_name, '')), ' ', 1), ''), 'The cleaner');

  -- regular commercial sites they're on (clients not ended), e.g. "Compass Cars (Geebung)"
  select coalesce(jsonb_agg(x.label order by x.label), '[]'::jsonb) into v_sites from (
    select distinct c.id as cid,
      c.business_name || case when (select count(*) from public.client_services s2 where s2.client_id = c.id) > 1 and st.site_name is not null
                              then ' (' || st.site_name || ')' else '' end as label
    from public.client_service_cleaners csc
    join public.client_services cs on cs.id = csc.service_id
    join public.clients c on c.id = cs.client_id
    left join public.client_sites st on st.id = cs.site_id
    where csc.cleaner_id = p and coalesce(c.status, 'active') <> 'ended'
  ) x;

  -- homes still running with them as the cleaner (one-offs only when still to come)
  select coalesce(array_agg(h.id), '{}'), coalesce(jsonb_agg(h.name order by h.name), '[]'::jsonb) into v_ids, v_homes
    from public.homes h
    where h.cleaner_id = p
      and case when h.kind = 'oneoff' then not h.cancelled and not h.done and h.first_clean >= today
               else h.status <> 'ended' end;

  if dry then
    return jsonb_build_object('name', v.full_name, 'sites', v_sites, 'homes', v_homes, 'login', v.user_id is not null);
  end if;

  insert into public.client_history (client_id, date, text)
    select distinct cs.client_id, today, first || ' was removed from the team and taken off ' ||
      case when (select count(*) from public.client_services s2 where s2.client_id = cs.client_id) > 1 and st.site_name is not null
           then st.site_name else 'this client' end || '. Pick a new cleaner.'
    from public.client_service_cleaners csc
    join public.client_services cs on cs.id = csc.service_id
    join public.clients c on c.id = cs.client_id
    left join public.client_sites st on st.id = cs.site_id
    where csc.cleaner_id = p and coalesce(c.status, 'active') <> 'ended';
  delete from public.client_service_cleaners where cleaner_id = p;

  insert into public.home_history (home_id, date, text)
    select id, today, first || ' was removed from the team, so this client has no cleaner now.' from unnest(v_ids) as id;
  update public.homes set cleaner_id = null where id = any(v_ids);

  -- the old hub's assignment columns
  update public.clients set assigned_cleaner_id = null where assigned_cleaner_id = p;
  update public.client_sites set assigned_cleaner_id = null where assigned_cleaner_id = p;

  update public.cleaner_packs set removed_at = now() where profile_id = p and removed_at is null;
  update public.profiles set removed_at = now(), is_team_leader = false where id = p;

  return jsonb_build_object('name', v.full_name, 'sites', v_sites, 'homes', v_homes, 'login', v.user_id is not null);
end $$;

revoke all on function public.hub_remove_cleaner(uuid, boolean) from public, anon;
grant execute on function public.hub_remove_cleaner(uuid, boolean) to authenticated, service_role;
