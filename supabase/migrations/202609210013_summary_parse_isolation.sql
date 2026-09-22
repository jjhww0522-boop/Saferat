begin;

-- A single text record that JSONB cannot represent must not break every task summary.

create or replace function app_private.safety_task_risk_source(content text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare record jsonb; risk jsonb; hazard jsonb; field text; identifiers text[] := '{}';
  improvements integer := 0; next_due text; known boolean; recorded boolean;
  unreadable constant jsonb := '{"state":"unreadable","improvement_count":0,"next_due_on":null}';
begin
  if content is null then return null; end if;
  begin record := content::jsonb; exception when invalid_text_representation or untranslatable_character or numeric_value_out_of_range then return unreadable; end;
  if jsonb_typeof(record) is distinct from 'object' then return unreadable; end if;
  if not (record ? 'risk') then return null; end if;
  risk := record->'risk';
  if record->>'format' is distinct from 'task-record-v1' or record->>'definition' is distinct from 'REVIEW-003'
    or jsonb_typeof(risk) is distinct from 'object' or risk->>'format' is distinct from 'risk-assessment-v1'
    or jsonb_typeof(risk->'hazards') is distinct from 'array' then return unreadable; end if;
  if jsonb_array_length(risk->'hazards') > 30 then return unreadable; end if;
  for hazard in select value from jsonb_array_elements(risk->'hazards') loop
    if jsonb_typeof(hazard) is distinct from 'object' or jsonb_typeof(hazard->'id') is distinct from 'string'
      or length(hazard->>'id') not between 1 and 80 or hazard->>'id' = any(identifiers)
      or coalesce(hazard->>'acceptable', '') not in ('unknown', 'yes', 'no')
      or coalesce(hazard->>'residualAcceptable', '') not in ('unknown', 'yes', 'no') then return unreadable; end if;
    identifiers := array_append(identifiers, hazard->>'id');
    foreach field in array array['measure','owner','dueOn','performedOn','performedNote','verifiedOn','verifier','verificationNote'] loop
      if jsonb_typeof(hazard->field) is distinct from 'string' then return unreadable; end if;
    end loop;
    known := hazard->>'acceptable' = 'no' or hazard->>'residualAcceptable' = 'no' or app_private.safety_summary_text(hazard->'measure') <> '';
    recorded := app_private.safety_summary_text(hazard->'measure') <> '' and app_private.safety_summary_text(hazard->'owner') <> ''
      and app_private.safety_summary_date(hazard->>'dueOn') and app_private.safety_summary_date(hazard->>'performedOn')
      and app_private.safety_summary_text(hazard->'performedNote') <> '' and app_private.safety_summary_date(hazard->>'verifiedOn')
      and hazard->>'verifiedOn' >= hazard->>'performedOn' and app_private.safety_summary_text(hazard->'verifier') <> ''
      and hazard->>'residualAcceptable' = 'yes' and app_private.safety_summary_text(hazard->'verificationNote') <> '';
    if known and not recorded then
      improvements := improvements + 1;
      if app_private.safety_summary_date(hazard->>'dueOn') and (next_due is null or hazard->>'dueOn' < next_due) then next_due := hazard->>'dueOn'; end if;
    end if;
  end loop;
  return jsonb_build_object('state', 'available', 'improvement_count', improvements, 'next_due_on', next_due);
end;
$$;

create or replace function app_private.safety_journey_risk(content text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare record jsonb; r jsonb; h jsonb; field text; v text;
  identified boolean; assessed boolean; acted boolean; verified boolean; needed boolean;
  unknown_count integer := 0; ready boolean[]; empty_result constant jsonb := '{"definition_version":1,"ready_steps":null,"unknown_count":null}';
begin
  if content is null then return empty_result; end if;
  begin record := content::jsonb; exception when invalid_text_representation or untranslatable_character or numeric_value_out_of_range then return empty_result; end;
  if app_private.safety_task_risk_source(content)->>'state' is distinct from 'available' then return empty_result; end if;
  r := record->'risk';
  -- Fields introduced in the original v1 reader retain its defaults for older records.
  r := '{"assessor":"","startedOn":"","finishedOn":"","learningStatus":"unknown","learningBasis":"","representativeRequested":"unknown","representativePeople":""}'::jsonb || r;
  foreach field in array array['reason','scope','criteria','assessor','learningBasis','learningPeople','learningNote','announcementPeople','announcementNote','participants','workerOpinion','participationException','representativePeople','sharedPeople','sharedNote','reviewTrigger','storageNote'] loop
    if jsonb_typeof(r->field) is distinct from 'string' or length(app_private.safety_summary_text(r->field)) > 1500 then return empty_result; end if;
  end loop;
  foreach field in array array['plannedOn','startedOn','finishedOn','learningOn','announcedOn','participationOn','sharedOn','nextReviewOn'] loop
    if jsonb_typeof(r->field) is distinct from 'string' or (r->>field <> '' and not app_private.safety_summary_date(r->>field)) then return empty_result; end if;
  end loop;
  if coalesce(r->>'kind','') not in ('unknown','initial','periodic','occasional') or coalesce(r->>'learningStatus','') not in ('unknown','needed','performed','sufficient')
    or coalesce(r->>'participationMethod','') not in ('unknown','walkthrough','exception') or coalesce(r->>'representativeRequested','') not in ('unknown','yes','no')
    or (r->>'startedOn' <> '' and r->>'finishedOn' <> '' and r->>'finishedOn' < r->>'startedOn') then return empty_result; end if;
  identified := jsonb_array_length(r->'hazards') > 0; assessed := identified; acted := true; verified := true;
  for h in select value from jsonb_array_elements(r->'hazards') loop
    foreach field in array array['work','location','hazard','people','existingControls','decisionReason','measure','performedNote','verificationNote','owner','verifier'] loop
      if jsonb_typeof(h->field) is distinct from 'string' or length(app_private.safety_summary_text(h->field)) > (case when field in ('owner','verifier') then 120 else 1500 end) then return empty_result; end if;
    end loop;
    foreach field in array array['dueOn','performedOn','verifiedOn'] loop
      if jsonb_typeof(h->field) is distinct from 'string' or (h->>field <> '' and not app_private.safety_summary_date(h->>field)) then return empty_result; end if;
    end loop;
    if coalesce(h->>'level','') not in ('unknown','low','medium','high') or (h->>'performedOn' <> '' and h->>'verifiedOn' <> '' and h->>'verifiedOn' < h->>'performedOn') then return empty_result; end if;
    identified := identified and app_private.safety_journey_texts(h, array['work','location','hazard','people','existingControls']);
    assessed := assessed and h->>'level' <> 'unknown' and h->>'acceptable' <> 'unknown' and app_private.safety_journey_texts(h, array['decisionReason']);
    if h->>'level' = 'unknown' or h->>'acceptable' = 'unknown' or not app_private.safety_journey_texts(h, array['decisionReason']) then unknown_count := unknown_count + 1; end if;
    needed := h->>'acceptable' <> 'yes' or app_private.safety_journey_texts(h, array['measure']) or h->>'residualAcceptable' = 'no';
    if needed then
      acted := acted and app_private.safety_journey_texts(h, array['measure','owner','dueOn','performedOn','performedNote']);
      verified := verified and app_private.safety_journey_texts(h, array['verifiedOn','verifier','verificationNote']) and h->>'residualAcceptable' = 'yes';
    end if;
  end loop;
  assessed := assessed and identified; acted := acted and assessed; verified := verified and acted;
  ready := array[
    r->>'kind' <> 'unknown' and app_private.safety_journey_texts(r, array['scope','plannedOn','criteria','assessor']) and (r->>'kind' <> 'occasional' or app_private.safety_journey_texts(r,array['reason']))
      and ((r->>'learningStatus' = 'performed' and app_private.safety_journey_texts(r,array['learningOn','learningPeople','learningNote'])) or (r->>'learningStatus' = 'sufficient' and app_private.safety_journey_texts(r,array['learningBasis']))),
    app_private.safety_journey_texts(r,array['announcedOn','announcementPeople','announcementNote','participationOn','participants','workerOpinion'])
      and (r->>'representativeRequested' = 'no' or (r->>'representativeRequested' = 'yes' and app_private.safety_journey_texts(r,array['representativePeople'])))
      and (r->>'participationMethod' = 'walkthrough' or (r->>'participationMethod' = 'exception' and app_private.safety_journey_texts(r,array['participationException']))),
    identified, assessed, acted, verified,
    verified and app_private.safety_journey_texts(r,array['startedOn','finishedOn','sharedOn','sharedPeople','sharedNote','reviewTrigger','storageNote'])
  ];
  return jsonb_build_object('definition_version',1,'ready_steps',to_jsonb(ready),'unknown_count',unknown_count);
end;
$$;

revoke all on function app_private.safety_task_risk_source(text), app_private.safety_journey_risk(text) from public, anon, authenticated;
commit;
