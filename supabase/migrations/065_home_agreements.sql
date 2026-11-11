-- 065: Residential service agreements (CCR-0001...) in the new hub (branch claude/new-portal).
-- * home_docs                one row per agreement. Draft reads from the home; when sent, the particulars, scope and
--                            clauses are locked into `snap`. The client signs on a public page matched by `code`.
-- * hub_next_number          also numbers agreements (agree_res / agree_eol).
-- * hub_accept_home_quote    now takes the agreement snapshot too: accepting a quote sets up the home AND creates its
--                            agreement, already sent to the quote's email, in one go. Returns the home, ref and code.
-- * hub_sign_home_doc        the client's Sign on the public page (server only, after matching the code).
-- Staff (admin/manager) read and write agreements; nobody else can read them directly. Safe to re-run.

create or replace function public.hub_next_number(p_key text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and coalesce(public.app_user_role(), '') not in ('admin', 'manager') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_key not in ('quote_res', 'quote_eol', 'agree_res', 'agree_eol') then raise exception 'bad_key' using errcode = '22023'; end if;
  insert into public.hub_counters as c (key, n) values (p_key, 1)
  on conflict (key) do update set n = c.n + 1
  returning n into v;
  return v;
end;
$$;
revoke all on function public.hub_next_number(text) from public, anon;
grant execute on function public.hub_next_number(text) to authenticated, service_role;

create table if not exists public.home_docs (
  id          uuid primary key default gen_random_uuid(),
  division    text not null default 'res' check (division in ('res','eol')),
  ref         text not null unique,
  code        text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  home_id     uuid references public.homes(id) on delete cascade,
  status      text not null default 'draft' check (status in ('draft','sent','signed')),
  snap        jsonb,                                   -- locked particulars, scope and clauses (set when sent)
  created_on  date not null default ((now() at time zone 'Australia/Brisbane')::date),
  sent_to     text check (sent_to is null or length(sent_to) <= 320),
  sent_at     date,
  signed_by   text check (signed_by is null or length(signed_by) <= 200),
  signed_at   date,
  signed_ts   timestamptz,
  from_quote  uuid references public.home_quotes(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint home_docs_sent_has_snap check (status = 'draft' or snap is not null),
  constraint home_docs_signed_has_name check (status <> 'signed' or (signed_by is not null and signed_at is not null))
);
create index if not exists home_docs_home_idx on public.home_docs (home_id);
create index if not exists home_docs_div_idx on public.home_docs (division, status);
drop trigger if exists set_home_docs_updated_at on public.home_docs;
create trigger set_home_docs_updated_at before update on public.home_docs for each row execute procedure handle_updated_at();

alter table public.home_docs enable row level security;
drop policy if exists staff_all on public.home_docs;
create policy staff_all on public.home_docs for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

-- A signed agreement can't be changed or deleted by anyone, staff included (only the home being deleted removes it).
create or replace function public.home_docs_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'signed' and pg_trigger_depth() = 1 then raise exception 'signed_locked' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status = 'signed' then raise exception 'signed_locked' using errcode = '42501'; end if;
  return new;
end;
$$;
drop trigger if exists home_docs_guard_upd on public.home_docs;
create trigger home_docs_guard_upd before update on public.home_docs for each row execute procedure public.home_docs_guard();
drop trigger if exists home_docs_guard_del on public.home_docs;
create trigger home_docs_guard_del before delete on public.home_docs for each row execute procedure public.home_docs_guard();

-- Accept now also creates the agreement (sent, to the quote's email) from the snapshot the server worked out.
drop function if exists public.hub_accept_home_quote(text, text, text, text, date);
create or replace function public.hub_accept_home_quote(p_code text, p_street text, p_suburb text, p_postcode text, p_start date, p_snap jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  q       public.home_quotes%rowtype;
  b       jsonb;
  v_today date := (now() at time zone 'Australia/Brisbane')::date;
  v_home  uuid;
  v_every text;
  v_rec   boolean;
  v_dow   text;
  v_price numeric;
  v_win   boolean;
  v_car   boolean;
  v_hist  text;
  v_wf    text;
  v_n     integer;
  v_ref   text;
  v_code  text;
  freq_words jsonb := '{"each":"every clean","monthly":"once a month","quarterly":"every 3 months","once":"once only, on the first clean"}';
begin
  select * into q from public.home_quotes where code = p_code for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if q.status <> 'sent' then raise exception 'not_open' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_street, ''))) < 3 then raise exception 'bad_street' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_suburb, ''))) < 2 then raise exception 'bad_suburb' using errcode = '22023'; end if;
  if coalesce(p_postcode, '') !~ '^[0-9]{4}$' then raise exception 'bad_postcode' using errcode = '22023'; end if;
  if p_start is null or p_start <= v_today then raise exception 'bad_start' using errcode = '22023'; end if;
  if p_snap is null or jsonb_typeof(p_snap->'parts') <> 'array' or jsonb_typeof(p_snap->'clauses') <> 'array'
     or jsonb_array_length(p_snap->'clauses') < 1 then raise exception 'bad_snap' using errcode = '22023'; end if;

  b       := q.body;
  v_every := coalesce(b->>'every', 'oneoff');
  v_rec   := v_every <> 'oneoff';
  v_dow   := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from p_start)::int + 1];
  v_price := coalesce(nullif(regexp_replace(coalesce(b->>'price', ''), '[^0-9.]', '', 'g'), '')::numeric, 0);
  v_win   := coalesce((b->'windows'->>'on')::boolean, false);
  v_car   := coalesce((b->'carpet'->>'on')::boolean, false) and b->>'type' = 'deep';
  v_wf    := case when v_rec then coalesce(nullif(b->'windows'->>'freq', ''), 'monthly') else 'once' end;
  if v_price <= 0 then raise exception 'bad_price' using errcode = '22023'; end if;

  insert into public.homes (division, name, phone, email, street, suburb, postcode, state, kind, every, days, anchor, first_clean,
                            price, cost, beds, baths, carpet_rooms, hallways, notes, status, windows_price, windows_freq, from_quote)
  values (q.division, btrim(q.name), nullif(btrim(coalesce(q.phone, '')), ''), nullif(btrim(coalesce(q.email, '')), ''),
          btrim(p_street), btrim(p_suburb), p_postcode, 'QLD',
          case when v_rec then 'recurring' else 'oneoff' end,
          case when v_rec then v_every else null end,
          case when v_rec then array[v_dow] else '{}'::text[] end,
          case when v_rec and v_every <> 'weekly' then p_start else null end,
          p_start, round(v_price, 2), 0,
          least(greatest(coalesce((b->>'beds')::int, 0), 0), 12), least(greatest(coalesce((b->>'baths')::int, 0), 0), 12),
          case when v_car then least(greatest(coalesce(nullif(b->'carpet'->>'rooms', '')::int, 0), 0), 40) else 0 end,
          case when v_car then least(greatest(coalesce(nullif(b->'carpet'->>'halls', '')::int, 0), 0), 20) else 0 end,
          nullif(btrim(coalesce(b->>'notes', '')), ''), 'active',
          case when v_win then round(coalesce(nullif(regexp_replace(coalesce(b->'windows'->>'price', ''), '[^0-9.]', '', 'g'), '')::numeric, 0), 2) else null end,
          case when v_win then v_wf else null end,
          q.id)
  returning id into v_home;

  v_hist := 'Accepted quote ' || q.ref || '. ' || case when v_rec then 'First clean ' else 'Clean on ' end || to_char(p_start, 'FMDD Mon YYYY');
  if v_win then
    v_hist := v_hist || '. Windows add-on $' || to_char(coalesce(nullif(regexp_replace(coalesce(b->'windows'->>'price', ''), '[^0-9.]', '', 'g'), '')::numeric, 0), 'FM999990.00')
           || case when v_rec then ', ' || (freq_words->>v_wf) else '' end;
  end if;
  if v_car then
    v_hist := v_hist || '. Carpet steam cleaning $' || to_char(coalesce(nullif(regexp_replace(coalesce(b->'carpet'->>'price', ''), '[^0-9.]', '', 'g'), '')::numeric, 0), 'FM999990.00');
  end if;
  insert into public.home_history (home_id, date, text) values (v_home, v_today, left(v_hist, 1000));

  -- the agreement, numbered CCR-0001 (CCE- for End of Lease), already sent to the quote's email
  insert into public.hub_counters as c (key, n) values (case when q.division = 'eol' then 'agree_eol' else 'agree_res' end, 1)
  on conflict (key) do update set n = c.n + 1
  returning n into v_n;
  v_ref := case when q.division = 'eol' then 'CCE-' else 'CCR-' end || lpad(v_n::text, 4, '0');
  insert into public.home_docs (division, ref, home_id, status, snap, sent_to, sent_at, from_quote)
  values (q.division, v_ref, v_home, 'sent', p_snap, nullif(btrim(coalesce(q.email, '')), ''), v_today, q.id)
  returning code into v_code;
  insert into public.home_history (home_id, date, text) values (v_home, v_today, 'Agreement ' || v_ref || ' sent to sign');

  update public.home_quotes
     set status = 'accepted', accepted_at = v_today, accepted_by = btrim(q.name), home_id = v_home,
         body = b || jsonb_build_object('street', btrim(p_street), 'suburb', btrim(p_suburb), 'postcode', p_postcode, 'start', to_char(p_start, 'YYYY-MM-DD'))
   where id = q.id;
  return jsonb_build_object('home', v_home, 'ref', v_ref, 'code', v_code);
end;
$$;
revoke all on function public.hub_accept_home_quote(text, text, text, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.hub_accept_home_quote(text, text, text, text, date, jsonb) to service_role;

-- The client signs on the public page. Only an agreement that's waiting to sign, and a name of 2+ letters.
create or replace function public.hub_sign_home_doc(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d       public.home_docs%rowtype;
  v_name  text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_today date := (now() at time zone 'Australia/Brisbane')::date;
begin
  select * into d from public.home_docs where code = p_code for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if d.status <> 'sent' then raise exception 'not_open' using errcode = '22023'; end if;
  if length(v_name) < 2 or length(v_name) > 200 then raise exception 'bad_name' using errcode = '22023'; end if;
  update public.home_docs set status = 'signed', signed_by = v_name, signed_at = v_today, signed_ts = now() where id = d.id;
  if d.home_id is not null then
    insert into public.home_history (home_id, date, text) values (d.home_id, v_today, left('Signed agreement ' || d.ref || ' (' || v_name || ')', 1000));
  end if;
  return jsonb_build_object('ref', d.ref, 'home', d.home_id, 'name', v_name, 'sent_to', d.sent_to, 'signed_at', v_today);
end;
$$;
revoke all on function public.hub_sign_home_doc(text, text) from public, anon, authenticated;
grant execute on function public.hub_sign_home_doc(text, text) to service_role;
