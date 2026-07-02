-- Migration 027 — multi-site labour must use the SAME visit math as revenue:
-- frequency × days-per-week (weekly/fortnightly only). Previously the trigger ignored
-- days_per_week, so a 5-day site's labour was undercounted 5x and margins were wrong
-- (and disagreed with the per-site P&L view). Already applied to prod via connector.

create or replace function public.sync_multisite_client_profit()
 returns trigger
 language plpgsql
 set search_path = public
as $function$
declare
  v_client_id uuid; v_monthly_rev numeric; v_labour numeric; v_profit numeric; v_margin numeric; v_complete boolean;
begin
  v_client_id := coalesce(NEW.client_id, OLD.client_id);

  select sum(
    case when cs.cleaner_hourly_rate is not null and cs.cleaner_hours_per_visit is not null and cs.frequency is not null
      then round(
        cs.cleaner_hourly_rate * cs.cleaner_hours_per_visit
        * frequency_to_visits_per_month(cs.frequency::frequency_type)
        * case when cs.frequency in ('weekly','fortnightly') then coalesce(cs.days_per_week, 1) else 1 end,
      2)
      else 0 end
  )
  into v_labour
  from client_sites cs
  where cs.client_id = v_client_id;

  select monthly_value into v_monthly_rev from clients where id = v_client_id;

  v_profit := case when v_monthly_rev is not null and v_labour is not null and v_labour > 0 then round(v_monthly_rev - v_labour, 2) else null end;
  v_margin := case when v_monthly_rev is not null and v_monthly_rev > 0 and v_profit is not null then round((v_profit / v_monthly_rev) * 100, 1) else null end;
  v_complete := (v_monthly_rev is not null and v_labour is not null and v_labour > 0);

  update clients
  set monthly_labour_cost = case when v_labour > 0 then v_labour else null end,
      monthly_profit      = v_profit,
      margin_pct          = v_margin,
      profile_complete    = v_complete
  where id = v_client_id and is_multi_site = true;

  return NEW;
end;
$function$;
