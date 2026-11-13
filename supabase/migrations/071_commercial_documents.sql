-- 071: Commercial proposals and agreements in the new hub (branch claude/new-portal). Commercial → Documents.
-- * hub_next_number        also numbers commercial quotes and agreements: one counter per year ('comm_2026'), shared
--                          by quotes (CC-2026-CCQ043) and agreements made without a quote (CC-2026-CCA044). Never reused.
--                          The 2026 counter starts at 42 (42 quotes already sent this year), so the first is CCQ043.
-- * scope_presets          the 6 preset scopes for the proposal form (Office, Medical clinic, ...). Editable rows.
-- * proposals              commercial and specialist proposals. The form lives in `body`; the lifecycle has its own
--                          columns. The client's accept link uses `code` (a new one on each resend). Soft delete.
-- * agreements             commercial service agreements (CCA) and specialist works agreements (CCW). Made when a
--                          proposal is accepted (already sent, scope copied in `snap`) or from a client record. The
--                          client signs on a public page matched by `code`. Signed rows are locked.
-- * client_files           documents filed under a client (signed before the hub, insurance, site forms...), in the
--                          private client-files bucket. Soft delete.
-- * hub_accept_proposal / hub_sign_agreement   the client's Accept and Sign (server only, after matching the code).
-- Staff (admin/manager) read and write everything here; nobody else can read it directly. Additive, safe to re-run.

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
  if p_key not in ('quote_res', 'quote_eol', 'agree_res', 'agree_eol') and p_key !~ '^comm_20[0-9]{2}$' then
    raise exception 'bad_key' using errcode = '22023';
  end if;
  insert into public.hub_counters as c (key, n) values (p_key, 1)
  on conflict (key) do update set n = c.n + 1
  returning n into v;
  return v;
end;
$$;
revoke all on function public.hub_next_number(text) from public, anon;
grant execute on function public.hub_next_number(text) to authenticated, service_role;

-- 42 commercial quotes were already sent in 2026 from the old hub
insert into public.hub_counters as c (key, n) values ('comm_2026', 42)
on conflict (key) do update set n = greatest(c.n, 42);

-- ── preset scopes ────────────────────────────────────────────
create table if not exists public.scope_presets (
  id         text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name       text not null check (length(btrim(name)) between 1 and 80),
  note       text not null default '' check (length(note) <= 200),
  sow        jsonb not null default '[]'::jsonb check (jsonb_typeof(sow) = 'array'),
  sort       integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.scope_presets enable row level security;
drop policy if exists staff_all on public.scope_presets;
create policy staff_all on public.scope_presets for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
insert into public.scope_presets (id, name, note, sow, sort) values
  ('office', 'Office', 'Your standard template scope', '[{"heading":"Reception & Throughout","items":["Floors vacuumed & mopped","All surfaces wiped down","Computer screens cleaned","Bins emptied & relined"]},{"heading":"Kitchenette","items":["Benchtops & sink cleaned","Exterior of appliances wiped","Floors mopped"]},{"heading":"Bathrooms","items":["Toilets cleaned & sanitised","Vanity, mirrors & sinks","Floors mopped"]}]'::jsonb, 1),
  ('clinic', 'Medical or allied health clinic', 'GP, physio, dental, consulting rooms', '[{"heading":"Reception & Waiting Room","items":["Floors vacuumed & mopped","Counters, chairs & surfaces wiped down","High-touch points sanitised (handles, switches, EFTPOS, rails)","Bins emptied & relined"]},{"heading":"Consulting & Treatment Rooms","items":["Treatment beds & chairs wiped with disinfectant","Hand basins & tapware cleaned","Floors mopped with disinfectant","General waste emptied (no clinical or sharps waste)"]},{"heading":"Kitchenette","items":["Benchtops & sink cleaned","Exterior of appliances wiped","Floors mopped"]},{"heading":"Bathrooms","items":["Toilets cleaned & sanitised","Vanity, mirrors & sinks","Floors mopped"]}]'::jsonb, 2),
  ('childcare', 'Childcare or early learning', 'Play rooms, nappy change, kitchen', '[{"heading":"Play Rooms","items":["Floors vacuumed & mopped","Tables & chairs wiped & sanitised","Low surfaces & door handles sanitised","Bins emptied & relined"]},{"heading":"Nappy Change & Children’s Bathrooms","items":["Toilets & basins cleaned & sanitised","Change benches sanitised","Floors mopped with disinfectant"]},{"heading":"Kitchenette","items":["Benchtops & sink cleaned","Exterior of appliances wiped","Floors mopped"]},{"heading":"Bathrooms","items":["Toilets cleaned & sanitised","Vanity, mirrors & sinks","Floors mopped"]}]'::jsonb, 3),
  ('gym', 'Gym or fitness studio', 'Gym floor, change rooms, showers', '[{"heading":"Gym Floor","items":["Floors vacuumed & mopped","Equipment touch points wiped (handles, seats, benches)","Mirrors cleaned","Bins emptied & relined"]},{"heading":"Change Rooms & Showers","items":["Showers cleaned & sanitised","Benches & lockers wiped down","Floors mopped with disinfectant"]},{"heading":"Bathrooms","items":["Toilets cleaned & sanitised","Vanity, mirrors & sinks","Floors mopped"]}]'::jsonb, 4),
  ('warehouse', 'Warehouse or industrial', 'Offices, lunchroom, amenities', '[{"heading":"Offices","items":["Desks & surfaces wiped down","Floors vacuumed & mopped","Bins emptied & relined"]},{"heading":"Lunchroom","items":["Benchtops & sink cleaned","Tables & chairs wiped","Exterior of appliances wiped","Floors mopped"]},{"heading":"Amenities","items":["Toilets & urinals cleaned & sanitised","Basins & mirrors cleaned","Floors mopped"]},{"heading":"Warehouse Floor","items":["Accessible floor areas swept (outside racking)"]}]'::jsonb, 5),
  ('retail', 'Retail shop', 'Shop floor and back of house', '[{"heading":"Shop Floor","items":["Floors vacuumed & mopped","Counters & displays dusted (stock not handled)","Entry glass & doors cleaned","Bins emptied & relined"]},{"heading":"Back of House","items":["Staff room benchtops & sink cleaned","Floors mopped"]},{"heading":"Bathrooms","items":["Toilets cleaned & sanitised","Vanity, mirrors & sinks","Floors mopped"]}]'::jsonb, 6)
on conflict (id) do nothing;

-- ── proposals ────────────────────────────────────────────────
create table if not exists public.proposals (
  id             uuid primary key default gen_random_uuid(),
  ptype          text not null default 'comm' check (ptype in ('comm','spec')),
  ref            text not null unique check (ref ~ '^CC-20[0-9]{2}-CCQ[0-9]{3,}$'),
  code           text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  status         text not null default 'draft' check (status in ('draft','sent','revision','accepted','declined')),
  biz            text not null check (length(btrim(biz)) between 1 and 200),
  contact        text check (contact is null or length(contact) <= 200),
  email          text check (email is null or length(email) <= 320),
  address        text check (address is null or length(address) <= 300),
  body           jsonb not null default '{}'::jsonb,
  lead_id        uuid references public.cold_leads(id) on delete set null,
  client_id      uuid references public.clients(id) on delete set null,
  request_id     uuid references public.client_requests(id) on delete set null,
  created_on     date not null default ((now() at time zone 'Australia/Brisbane')::date),
  sent_to        text check (sent_to is null or length(sent_to) <= 320),
  sent_at        date,
  revision_at    date,
  revision_note  text check (revision_note is null or length(revision_note) <= 2000),
  declined_at    date,
  decline_reason text check (decline_reason is null or length(decline_reason) <= 200),
  decline_note   text check (decline_note is null or length(decline_note) <= 2000),
  accepted_at    date,
  accepted_by    text check (accepted_by is null or length(accepted_by) <= 200),
  works_date     date,
  setup_client_id uuid references public.clients(id) on delete set null,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists proposals_status_idx on public.proposals (status) where deleted_at is null;
create index if not exists proposals_request_idx on public.proposals (request_id) where request_id is not null;
drop trigger if exists set_proposals_updated_at on public.proposals;
create trigger set_proposals_updated_at before update on public.proposals for each row execute procedure handle_updated_at();
alter table public.proposals enable row level security;
drop policy if exists staff_all on public.proposals;
create policy staff_all on public.proposals for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

-- An accepted proposal stays on record: it can't be deleted (soft or hard) or changed back.
create or replace function public.proposals_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'accepted' then raise exception 'accepted_locked' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status = 'accepted' and (new.status <> 'accepted' or new.deleted_at is not null or new.body is distinct from old.body
     or new.ref <> old.ref or new.biz <> old.biz) then
    raise exception 'accepted_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists proposals_guard_upd on public.proposals;
create trigger proposals_guard_upd before update on public.proposals for each row execute procedure public.proposals_guard();
drop trigger if exists proposals_guard_del on public.proposals;
create trigger proposals_guard_del before delete on public.proposals for each row execute procedure public.proposals_guard();

-- ── agreements ───────────────────────────────────────────────
create table if not exists public.agreements (
  id           uuid primary key default gen_random_uuid(),
  atype        text not null default 'service' check (atype in ('service','spec')),
  ref          text not null unique check (ref ~ '^CC-20[0-9]{2}-CC[AW][0-9]{3,}(-R[0-9]+)?$'),
  code         text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  status       text not null default 'draft' check (status in ('draft','sent','signed')),
  client_id    uuid references public.clients(id) on delete set null,
  proposal_id  uuid references public.proposals(id) on delete set null,
  renew_of     uuid references public.agreements(id) on delete set null,
  client_name  text not null check (length(btrim(client_name)) between 1 and 200),
  start_on     date,
  term_months  integer not null default 12 check (term_months in (0, 6, 12, 24)),
  snap         jsonb,                                  -- the proposal (scope, price, add-ons) or client details, locked in
  details      jsonb,                                  -- what the client filled in when signing (incl. site access)
  created_on   date not null default ((now() at time zone 'Australia/Brisbane')::date),
  sent_to      text check (sent_to is null or length(sent_to) <= 320),
  sent_at      date,
  signed_by    text check (signed_by is null or length(signed_by) <= 200),
  signed_at    date,
  signed_ts    timestamptz,
  signed_ip    text check (signed_ip is null or length(signed_ip) <= 100),
  req_sent_at  date,                                   -- Certificate of Currency / compliance pack they asked for, sent
  portal       jsonb,                                  -- client portal login made for them: { email, first, sentAt }
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint agreements_sent_has_snap check (status = 'draft' or snap is not null),
  constraint agreements_signed_has_name check (status <> 'signed' or (signed_by is not null and signed_at is not null))
);
create index if not exists agreements_client_idx on public.agreements (client_id);
create index if not exists agreements_prop_idx on public.agreements (proposal_id);
drop trigger if exists set_agreements_updated_at on public.agreements;
create trigger set_agreements_updated_at before update on public.agreements for each row execute procedure handle_updated_at();
alter table public.agreements enable row level security;
drop policy if exists staff_all on public.agreements;
create policy staff_all on public.agreements for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

-- A signed agreement can't be deleted, and what was signed can't change. Linking it to the client record (Set up as
-- client), noting the documents they asked for were sent, and their portal login can still be recorded.
create or replace function public.agreements_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'signed' then raise exception 'signed_locked' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status = 'signed' and (
       row(new.atype, new.ref, new.code, new.status, new.proposal_id, new.client_name, new.start_on, new.term_months, new.snap,
           new.details, new.sent_to, new.sent_at, new.signed_by, new.signed_at, new.signed_ts, new.signed_ip)
       is distinct from
       row(old.atype, old.ref, old.code, old.status, old.proposal_id, old.client_name, old.start_on, old.term_months, old.snap,
           old.details, old.sent_to, old.sent_at, old.signed_by, old.signed_at, old.signed_ts, old.signed_ip)) then
    raise exception 'signed_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists agreements_guard_upd on public.agreements;
create trigger agreements_guard_upd before update on public.agreements for each row execute procedure public.agreements_guard();
drop trigger if exists agreements_guard_del on public.agreements;
create trigger agreements_guard_del before delete on public.agreements for each row execute procedure public.agreements_guard();

-- ── files filed under a client ───────────────────────────────
create table if not exists public.client_files (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  kind        text not null check (kind in ('Signed agreement (from before the hub)','Proposal','Certificate of currency','Site induction','Other')),
  file_name   text not null check (length(btrim(file_name)) between 1 and 200),
  path        text not null check (length(path) <= 400),
  mime        text not null check (mime = 'application/pdf' or mime like 'image/%'),
  size        integer not null check (size > 0 and size <= 20971520),
  created_on  date not null default ((now() at time zone 'Australia/Brisbane')::date),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists client_files_client_idx on public.client_files (client_id) where deleted_at is null;
alter table public.client_files enable row level security;
drop policy if exists staff_all on public.client_files;
create policy staff_all on public.client_files for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('client-files', 'client-files', false, 20971520, array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp','image/gif'])
    on conflict (id) do update set public = false, file_size_limit = 20971520,
      allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp','image/gif'];
  end if;
end $$;

-- ── the client accepts (public page, server only) ────────────
-- Checks the proposal is still open and in date. A specialist quote for a current client's request books the works on
-- the date in p_book (their signed service agreement covers it); otherwise it creates the agreement, already sent, with
-- the proposal copied in (p_snap) so the signed Schedule 1 never changes. Booked works show in the timetable from
-- proposals.works_date (and signed works agreements from agreements.start_on).
create or replace function public.hub_accept_proposal(p_code text, p_snap jsonb, p_book jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p       public.proposals%rowtype;
  v_today date := (now() at time zone 'Australia/Brisbane')::date;
  v_ref   text;
  v_ag    public.agreements%rowtype;
  v_date  date;
begin
  select * into p from public.proposals where code = p_code and deleted_at is null for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p.status <> 'sent' then raise exception 'not_open' using errcode = '22023'; end if;
  if p.sent_at is null or p.sent_at + 30 < v_today then raise exception 'expired' using errcode = '22023'; end if;

  if p_book is not null then
    v_date := (p_book->>'date')::date;
    if v_date is null or v_date < v_today then raise exception 'bad_date' using errcode = '22023'; end if;
    update public.proposals set status = 'accepted', accepted_at = v_today, accepted_by = coalesce(nullif(btrim(coalesce(p.contact, '')), ''), p.biz),
           works_date = v_date where id = p.id;
    if p.client_id is not null then
      insert into public.client_history (client_id, date, text)
      values (p.client_id, v_today, left('Accepted quote ' || p.ref || '. Works booked for ' || to_char(v_date, 'FMDD Mon YYYY'), 1000));
    end if;
    return jsonb_build_object('booked', true, 'date', v_date);
  end if;

  if p_snap is null or jsonb_typeof(p_snap->'clauses') <> 'array' or jsonb_array_length(p_snap->'clauses') < 1 then
    raise exception 'bad_snap' using errcode = '22023';
  end if;
  v_ref := replace(p.ref, '-CCQ', case when p.ptype = 'spec' then '-CCW' else '-CCA' end);
  insert into public.agreements (atype, ref, status, client_id, proposal_id, client_name, start_on, term_months, snap, sent_to, sent_at)
  values (case when p.ptype = 'spec' then 'spec' else 'service' end, v_ref, 'sent', p.client_id, p.id, p.biz,
          case when p.ptype = 'spec' and nullif(p.body->>'date2', '') is not null and (p.body->>'date2')::date >= v_today then (p.body->>'date2')::date else null end,
          case when p.ptype = 'spec' then 0 else 12 end, p_snap, coalesce(p.sent_to, p.email), v_today)
  returning * into v_ag;
  update public.proposals set status = 'accepted', accepted_at = v_today, accepted_by = coalesce(nullif(btrim(coalesce(p.contact, '')), ''), p.biz)
   where id = p.id;
  return jsonb_build_object('booked', false, 'ref', v_ag.ref, 'code', v_ag.code, 'id', v_ag.id);
end;
$$;
revoke all on function public.hub_accept_proposal(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.hub_accept_proposal(text, jsonb, jsonb) to service_role;

-- ── the client signs (public page, server only) ──────────────
-- The server has checked every field (same checks as the page). Locks it with their details, name, time and IP.
-- A works agreement's works date becomes its start date, which books it in the timetable.
create or replace function public.hub_sign_agreement(p_code text, p_name text, p_details jsonb, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a       public.agreements%rowtype;
  v_name  text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_today date := (now() at time zone 'Australia/Brisbane')::date;
  v_start date;
begin
  select * into a from public.agreements where code = p_code for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if a.status <> 'sent' then raise exception 'not_open' using errcode = '22023'; end if;
  if length(v_name) < 2 or length(v_name) > 200 then raise exception 'bad_name' using errcode = '22023'; end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then raise exception 'bad_details' using errcode = '22023'; end if;
  v_start := nullif(p_details->>'start', '')::date;
  if v_start is null or v_start < v_today then raise exception 'bad_start' using errcode = '22023'; end if;


  update public.agreements
     set status = 'signed', signed_by = v_name, signed_at = v_today, signed_ts = now(), signed_ip = left(nullif(btrim(coalesce(p_ip, '')), ''), 100),
         details = p_details, start_on = v_start
   where id = a.id;
  if a.proposal_id is not null then
    update public.proposals set accepted_by = v_name, works_date = case when a.atype = 'spec' then v_start else works_date end where id = a.proposal_id;
  end if;
  if a.client_id is not null then
    insert into public.client_history (client_id, date, text)
    values (a.client_id, v_today, left('Signed agreement ' || a.ref || ' (' || v_name || ')', 1000));
  end if;
  return jsonb_build_object('id', a.id, 'ref', a.ref, 'atype', a.atype, 'client_id', a.client_id, 'proposal_id', a.proposal_id,
                            'sent_to', a.sent_to, 'start', v_start);
end;
$$;
revoke all on function public.hub_sign_agreement(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.hub_sign_agreement(text, text, jsonb, text) to service_role;
