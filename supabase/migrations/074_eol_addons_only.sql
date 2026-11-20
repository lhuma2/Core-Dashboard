-- 074: End of Lease quotes for add-ons only (20 Nov 2026).
-- A quote can now be just carpet steam cleaning (or other add-ons) with no end of lease clean. Its body has
-- eol.only = true and no clean price, so accepting it priced the home from the ticked add-ons instead of
-- refusing with bad_price. Everything else in hub_accept_home_quote is unchanged from 065.

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
  -- End of Lease, add-ons only (e.g. carpet steam cleaning on its own, no clean): the price is the ticked add-ons.
  if b->>'type' = 'eol' and coalesce((b->'eol'->>'only')::boolean, false) then
    select coalesce(sum(coalesce(nullif(regexp_replace(coalesce(a->>'price', ''), '[^0-9.]', '', 'g'), '')::numeric, 0)), 0) into v_price
      from jsonb_array_elements(coalesce(b->'eol'->'adds', '[]'::jsonb)) a
     where coalesce((a->>'on')::boolean, false);
  end if;
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
