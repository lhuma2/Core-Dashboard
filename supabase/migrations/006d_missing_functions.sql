-- Migration 006d — functions that existed in prod (via connector) but were never
-- captured as migration files. Migration 023 hardens their search_path and the app
-- calls submit_survey() as an RPC, but nothing defines them. Reconstructed from
-- usage in src/actions/survey-email.ts and the surveys/survey_tokens schema.

-- ── submit_survey: public survey submission (SECURITY DEFINER, bypasses RLS) ──
-- Validates the emailed token, inserts the survey, marks the token used. Returns
-- jsonb: { success: true } or { error: "..." }.
create or replace function public.submit_survey(
  p_token         text,
  p_quality       integer,
  p_reliability   integer,
  p_communication integer,
  p_value         integer,
  p_loyalty       integer,
  p_comments      text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   survey_tokens%rowtype;
  v_survey_id uuid;
  v_uuid    uuid;
begin
  begin
    v_uuid := p_token::uuid;
  exception when others then
    return jsonb_build_object('error', 'Invalid survey link.');
  end;

  select * into v_token from survey_tokens where token = v_uuid;
  if not found then
    return jsonb_build_object('error', 'Survey link not found.');
  end if;
  if v_token.submitted_at is not null then
    return jsonb_build_object('error', 'This survey has already been submitted.');
  end if;

  insert into surveys (
    client_id, quality_score, reliability_score, communication_score,
    value_score, nps_score, comments, submitted_at
  ) values (
    v_token.client_id, p_quality, p_reliability, p_communication,
    p_value, p_loyalty, p_comments, now()
  ) returning id into v_survey_id;

  update survey_tokens
     set submitted_at = now(), survey_id = v_survey_id
   where id = v_token.id;

  return jsonb_build_object('success', true, 'survey_id', v_survey_id);
end;
$$;

-- Public survey form calls this with the anon key.
grant execute on function public.submit_survey(text,integer,integer,integer,integer,integer,text) to anon, authenticated, service_role;

-- ── touch_proposal_doc_updated_at: keep proposal_documents.updated_at current ─
create or replace function public.touch_proposal_doc_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$ begin
  create trigger trg_touch_proposal_doc_updated_at
    before update on public.proposal_documents
    for each row execute function public.touch_proposal_doc_updated_at();
exception when duplicate_object then null; end $$;
