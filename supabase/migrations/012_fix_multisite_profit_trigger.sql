-- Fix compute_client_profit trigger to handle multi-site clients.
-- For multi-site, monthly_labour_cost / monthly_profit / margin_pct are
-- pre-aggregated from client_sites by the server action and must not be
-- overwritten by the trigger.

CREATE OR REPLACE FUNCTION compute_client_profit()
RETURNS TRIGGER AS $$
DECLARE
  v_visits   numeric;
  v_revenue  numeric;
  v_labour   numeric;
  v_profit   numeric;
  v_margin   numeric;
  v_complete boolean;
BEGIN
  -- Multi-site clients: costs are aggregated from client_sites by the server action
  -- and passed in directly. Skip recalculation and only derive profile_complete.
  IF NEW.is_multi_site THEN
    NEW.profile_complete := (
      NEW.monthly_profit IS NOT NULL AND
      NEW.monthly_labour_cost IS NOT NULL AND
      NEW.monthly_value IS NOT NULL
    );
    RETURN NEW;
  END IF;

  -- Single-site clients: derive everything from the scalar fields
  v_visits := CASE WHEN NEW.frequency IS NOT NULL
    THEN frequency_to_visits_per_month(NEW.frequency) ELSE 1 END;

  v_revenue := CASE WHEN NEW.rate_per_visit IS NOT NULL
    THEN ROUND(NEW.rate_per_visit * v_visits, 2) ELSE NULL END;

  v_labour := CASE WHEN NEW.cleaner_hourly_rate IS NOT NULL AND NEW.cleaner_hours_per_visit IS NOT NULL
    THEN ROUND(NEW.cleaner_hourly_rate * NEW.cleaner_hours_per_visit * v_visits, 2) ELSE NULL END;

  v_profit := CASE WHEN v_revenue IS NOT NULL AND v_labour IS NOT NULL
    THEN ROUND(v_revenue - v_labour, 2) ELSE NULL END;

  v_margin := CASE WHEN v_revenue IS NOT NULL AND v_revenue > 0 AND v_profit IS NOT NULL
    THEN ROUND((v_profit / v_revenue) * 100, 1) ELSE NULL END;

  v_complete := (
    NEW.rate_per_visit          IS NOT NULL AND
    NEW.cleaner_hourly_rate     IS NOT NULL AND
    NEW.cleaner_hours_per_visit IS NOT NULL AND
    NEW.frequency               IS NOT NULL
  );

  NEW.visits_per_month    := ROUND(v_visits, 3);
  NEW.monthly_value       := v_revenue;
  NEW.annual_value        := CASE WHEN v_revenue IS NOT NULL THEN ROUND(v_revenue * 12, 2) ELSE NULL END;
  NEW.monthly_labour_cost := v_labour;
  NEW.monthly_profit      := v_profit;
  NEW.margin_pct          := v_margin;
  NEW.profile_complete    := v_complete;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
