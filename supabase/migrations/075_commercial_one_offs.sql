-- 075: One-off commercial cleans.
-- hub_create_client(p) now also takes p.oneoff = true: a new client booked for a single clean.
-- Each site's service is saved with no regular cleaning days, and its one clean goes into one_offs
-- (the same table extra cleans use), so it shows on the timetable, in the cleaner app and in the client portal.
-- Everything else is unchanged from 063: one call, all or nothing, same checks.
-- Booking a one-off for an existing client and cancelling it use one_offs directly (RLS: admin and manager).
-- Safe to re-run.

create or replace function public.hub_create_client(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_role   text := public.app_user_role();
  v_name   text := btrim(regexp_replace(coalesce(p->>'business_name', ''), '\s+', ' ', 'g'));
  v_multi  boolean := coalesce((p->>'multi')::boolean, false);
  v_client uuid;
  v_site   uuid;
  v_svc    uuid;
  v_status text;
  v_once   boolean := coalesce((p->>'oneoff')::boolean, false);
  sv       jsonb;
  ad       jsonb;
  cl       text;
  n        int;
  i        int;
begin
  if v_role is null or v_role not in ('admin', 'manager') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(v_name) < 2 then raise exception 'bad_name' using errcode = '22023'; end if;

  select status into v_status from public.clients where lower(btrim(business_name)) = lower(v_name) limit 1;
  if found then raise exception 'duplicate_client' using errcode = '23505', detail = coalesce(v_status, 'active'); end if;

  n := jsonb_array_length(coalesce(p->'services', '[]'::jsonb));
  if n < 1 or n > 20 or (v_multi and n < 2) or (not v_multi and n <> 1) then
    raise exception 'bad_sites' using errcode = '22023';
  end if;

  insert into public.clients (business_name, contact_name, contact_phone, contact_email, address, suburb, state, postcode, is_multi_site, status)
  values (v_name, nullif(btrim(p->>'contact_name'), ''), nullif(btrim(p->>'contact_phone'), ''), nullif(btrim(p->>'contact_email'), ''),
          nullif(btrim(p->>'street'), ''), nullif(btrim(p->>'suburb'), ''), coalesce(nullif(p->>'state', ''), 'QLD'), nullif(btrim(p->>'postcode'), ''),
          v_multi, 'active')
  returning id into v_client;

  for i in 0 .. n - 1 loop
    sv := p->'services'->i;

    -- a regular clean needs its days; a one-off has none (its single clean goes in one_offs below)
    if v_once then
      if jsonb_array_length(coalesce(sv->'days', '[]'::jsonb)) <> 0 or (sv->>'start_time') is null then raise exception 'bad_days' using errcode = '22023'; end if;
    elsif jsonb_array_length(coalesce(sv->'days', '[]'::jsonb)) < 1 then raise exception 'bad_days' using errcode = '22023'; end if;
    if (sv->>'price')::numeric <= 0 or (sv->>'cost')::numeric <= 0 or (sv->>'price')::numeric <= (sv->>'cost')::numeric then
      raise exception 'bad_price' using errcode = '22023';
    end if;
    if (sv->>'first_clean') is null or (sv->>'first_clean')::date < (now() at time zone 'Australia/Brisbane')::date then
      raise exception 'bad_first_clean' using errcode = '22023';
    end if;

    insert into public.client_sites (client_id, site_name, address, suburb, state, postcode, sort_order)
    values (v_client,
            case when v_multi then btrim(sv->'site'->>'name') else v_name end,
            nullif(btrim(case when v_multi then sv->'site'->>'street' else p->>'street' end), ''),
            nullif(btrim(case when v_multi then sv->'site'->>'suburb' else p->>'suburb' end), ''),
            coalesce(nullif(p->>'state', ''), 'QLD'),
            nullif(btrim(case when v_multi then sv->'site'->>'postcode' else p->>'postcode' end), ''),
            i)
    returning id into v_site;

    insert into public.client_services (client_id, site_id, sort_order, days, every, anchor, first_clean, start_time, finish_time, price, cost, access)
    values (v_client, v_site, i,
            array(select jsonb_array_elements_text(sv->'days')),
            coalesce(sv->>'every', 'weekly'),
            case when v_once or coalesce(sv->>'every', 'weekly') = 'weekly' then null else (sv->>'first_clean')::date end,
            (sv->>'first_clean')::date,
            (sv->>'start_time')::time,
            nullif(sv->>'finish_time', '')::time,
            (sv->>'price')::numeric, (sv->>'cost')::numeric,
            nullif(btrim(coalesce(sv->>'access', '')), ''))
    returning id into v_svc;

    if v_once then
      insert into public.one_offs (client_id, service_id, clean_date, start_time, finish_time, price, cost, note)
      values (v_client, v_svc, (sv->>'first_clean')::date, (sv->>'start_time')::time, nullif(sv->>'finish_time', '')::time,
              (sv->>'price')::numeric, (sv->>'cost')::numeric, 'One-off clean');
    end if;

    for cl in select jsonb_array_elements_text(coalesce(sv->'cleaners', '[]'::jsonb)) loop
      if not exists (select 1 from public.profiles pr where pr.id = cl::uuid and pr.role = 'cleaner' and pr.pack_signed_at is not null) then
        raise exception 'cleaner_not_allowed' using errcode = '22023';
      end if;
      insert into public.client_service_cleaners (service_id, cleaner_id) values (v_svc, cl::uuid) on conflict do nothing;
    end loop;

    for ad in select * from jsonb_array_elements(coalesce(sv->'addons', '[]'::jsonb)) loop
      if (ad->>'price')::numeric <= 0 or (ad->>'cost')::numeric <= 0 or (ad->>'price')::numeric <= (ad->>'cost')::numeric then
        raise exception 'bad_addon_price' using errcode = '22023';
      end if;
      insert into public.client_addons (service_id, name, freq, price, cost)
      values (v_svc, btrim(ad->>'name'), ad->>'freq', (ad->>'price')::numeric, (ad->>'cost')::numeric);
    end loop;
  end loop;

  return v_client;
end;
$$;

revoke execute on function public.hub_create_client(jsonb) from public, anon;
grant execute on function public.hub_create_client(jsonb) to authenticated;
