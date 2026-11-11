-- 064: Residential (and later End of Lease) quotes in the new hub (branch claude/new-portal).
-- * home_quotes            one row per quote. Website requests arrive as drafts; Laith checks, edits and sends.
--                          The editable content (scope boxes, add-ons, price, notes...) lives in `body`;
--                          the lifecycle (sent, changes, declined, accepted) has its own columns.
-- * hub_counters           numbering for quote refs (CCQ-0001 residential, CCEQ-0001 End of Lease). Never reused.
-- * homes.windows_price / windows_freq   the windows add-on a client accepted, so invoices add it on the right cleans.
-- * hub_accept_home_quote  the client's Accept on the public quote page: sets them up as a home in one go.
-- Staff (admin/manager) read and write quotes. Nobody else can read them directly: the public quote page and
-- the website request route run on the server with the service role, matched by the quote's private code.
-- Additive only, safe to re-run.

create table if not exists public.hub_counters (
  key text primary key,
  n   integer not null default 0 check (n >= 0)
);
alter table public.hub_counters enable row level security;
-- no policies: only the service role and security definer functions touch it

create or replace function public.hub_next_number(p_key text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v integer;
begin
  -- staff, or the server itself (service role: the website request route)
  if coalesce(auth.role(), '') <> 'service_role' and coalesce(public.app_user_role(), '') not in ('admin', 'manager') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_key not in ('quote_res', 'quote_eol') then raise exception 'bad_key' using errcode = '22023'; end if;
  insert into public.hub_counters as c (key, n) values (p_key, 1)
  on conflict (key) do update set n = c.n + 1
  returning n into v;
  return v;
end;
$$;
revoke all on function public.hub_next_number(text) from public, anon;
grant execute on function public.hub_next_number(text) to authenticated, service_role;

create table if not exists public.home_quotes (
  id             uuid primary key default gen_random_uuid(),
  division       text not null default 'res' check (division in ('res','eol')),
  ref            text not null unique,
  code           text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  source         text not null default 'manual' check (source in ('website','manual')),
  status         text not null default 'draft' check (status in ('draft','sent','changes','accepted','declined')),
  name           text not null check (length(btrim(name)) between 1 and 200),
  email          text check (email is null or length(email) <= 320),
  phone          text check (phone is null or length(phone) <= 40),
  body           jsonb not null default '{}'::jsonb,
  request        jsonb,                                  -- what the website sent, shown above the editor
  created_on     date not null default ((now() at time zone 'Australia/Brisbane')::date),
  sent_to        text,
  sent_at        date,
  changed_at     date,
  change_note    text check (change_note is null or length(change_note) <= 2000),
  declined_at    date,
  decline_reason text check (decline_reason is null or length(decline_reason) <= 2000),
  accepted_at    date,
  accepted_by    text,
  home_id        uuid references public.homes(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists home_quotes_div_idx on public.home_quotes (division, status);
drop trigger if exists set_home_quotes_updated_at on public.home_quotes;
create trigger set_home_quotes_updated_at before update on public.home_quotes for each row execute procedure handle_updated_at();

alter table public.home_quotes enable row level security;
drop policy if exists staff_all on public.home_quotes;
create policy staff_all on public.home_quotes for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

alter table public.homes add column if not exists windows_price numeric(10,2) check (windows_price is null or windows_price >= 0);
alter table public.homes add column if not exists windows_freq  text check (windows_freq is null or windows_freq in ('each','monthly','quarterly','once'));
alter table public.homes add column if not exists from_quote    uuid references public.home_quotes(id) on delete set null;

-- The client accepts a sent quote on the public page. Checks it is still open, then creates the home (no time,
-- cleaner or cost yet: Laith adds those), logs it in the home's history and marks the quote accepted.
-- Called only from the server (service role) after it has matched the private code.
create or replace function public.hub_accept_home_quote(p_code text, p_street text, p_suburb text, p_postcode text, p_start date)
returns uuid
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
  freq_words jsonb := '{"each":"every clean","monthly":"once a month","quarterly":"every 3 months","once":"once only, on the first clean"}';
begin
  select * into q from public.home_quotes where code = p_code for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if q.status <> 'sent' then raise exception 'not_open' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_street, ''))) < 3 then raise exception 'bad_street' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_suburb, ''))) < 2 then raise exception 'bad_suburb' using errcode = '22023'; end if;
  if coalesce(p_postcode, '') !~ '^[0-9]{4}$' then raise exception 'bad_postcode' using errcode = '22023'; end if;
  if p_start is null or p_start <= v_today then raise exception 'bad_start' using errcode = '22023'; end if;

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

  update public.home_quotes
     set status = 'accepted', accepted_at = v_today, accepted_by = btrim(q.name), home_id = v_home,
         body = b || jsonb_build_object('street', btrim(p_street), 'suburb', btrim(p_suburb), 'postcode', p_postcode, 'start', to_char(p_start, 'YYYY-MM-DD'))
   where id = q.id;
  return v_home;
end;
$$;
revoke all on function public.hub_accept_home_quote(text, text, text, text, date) from public, anon, authenticated;
grant execute on function public.hub_accept_home_quote(text, text, text, text, date) to service_role;
