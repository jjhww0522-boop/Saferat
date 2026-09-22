begin;

-- UI position only. No business facts or document contents are stored here.
create table app_private.safety_journey_positions (
  user_id uuid not null references auth.users(id), workplace_id uuid not null references public.safety_workplaces(id),
  resource text not null, cursor text not null, updated_at timestamptz not null default now(),
  primary key(user_id, workplace_id, resource)
);
revoke all on app_private.safety_journey_positions from public, anon, authenticated;

create function public.safety_journey_state(workplace uuid, resource text, cursor text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare result text; target public.safety_tasks;
begin
  if not app_private.safety_member(workplace) then raise exception 'access_denied'; end if;
  if resource not in ('profile', 'welcome') then
    if resource is null or resource !~ '^[0-9a-fA-F-]{36}$' then raise exception 'invalid_state'; end if;
    select * into target from public.safety_tasks where id = resource::uuid and workplace_id = workplace and definition_id = 'REVIEW-003';
    if target.id is null or not app_private.safety_member(workplace, false, target.sensitive)
      or (target.document_id is not null and not app_private.safety_document_access(target.document_id)) then raise exception 'access_denied'; end if;
  end if;
  if resource is null then raise exception 'invalid_state'; end if;
  if cursor is not null then
    if (resource = 'profile' and cursor !~ '^profile:[0-3]$') or (resource = 'welcome' and cursor not in ('welcome:seen','welcome:new'))
      or (resource not in ('profile','welcome') and cursor !~ '^risk:[0-6]:[0-2]$') then raise exception 'invalid_state'; end if;
    insert into app_private.safety_journey_positions(user_id, workplace_id, resource, cursor) values(auth.uid(), workplace, resource, cursor)
      on conflict on constraint safety_journey_positions_pkey do update set cursor = excluded.cursor, updated_at = now();
  end if;
  select p.cursor into result from app_private.safety_journey_positions p where p.user_id = auth.uid() and p.workplace_id = workplace and p.resource = safety_journey_state.resource;
  return result;
end;
$$;

create function app_private.safety_journey_texts(value jsonb, fields text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(coalesce(app_private.safety_summary_text(value->field), '') <> ''), false) from unnest(fields) field;
$$;

-- Same seven record-readiness checks as riskProgress; never a legal-completion score.
create function app_private.safety_journey_risk(content text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare record jsonb; r jsonb; h jsonb; field text; v text;
  identified boolean; assessed boolean; acted boolean; verified boolean; needed boolean;
  unknown_count integer := 0; ready boolean[]; empty_result constant jsonb := '{"definition_version":1,"ready_steps":null,"unknown_count":null}';
begin
  if content is null then return empty_result; end if;
  begin record := content::jsonb; exception when invalid_text_representation then return empty_result; end;
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

create or replace function public.safety_task_action_sources(workplace uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; organization uuid;
begin
  if not (app_private.safety_member(workplace) or app_private.safety_reviewer(workplace)) then raise exception 'access_denied'; end if;
  select organization_id into organization from public.safety_workplaces where id = workplace;
  if organization is null then raise exception 'access_denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('task_id', t.id, 'version', v.number, 'confirmed_at', v.confirmed_at,
    'risk', app_private.safety_task_risk_source(v.content), 'journey', app_private.safety_journey_risk(v.content),
    'task_snapshot', jsonb_build_object('revision',t.revision,'owner',t.owner,'target_date',t.target_date,'review_status',coalesce(d.review_status,'not_requested'))) order by t.id), '[]'::jsonb) into result
    from public.safety_tasks t
    left join public.safety_documents d on d.id = t.document_id
    left join lateral (select number, confirmed_at, content from public.safety_document_versions where document_id = t.document_id order by number desc limit 1) v on true
    where t.workplace_id = workplace and (app_private.safety_member(t.workplace_id, false, t.sensitive) or app_private.safety_reviewer(t.workplace_id, t.sensitive))
      and (t.document_id is null or app_private.safety_document_access(t.document_id));
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id, details)
    values(organization, workplace, auth.uid(), 'task_action_sources_read', workplace, jsonb_build_object('task_count', jsonb_array_length(result)));
  return result;
end;
$$;
revoke all on function app_private.safety_journey_texts(jsonb,text[]), app_private.safety_journey_risk(text) from public, anon, authenticated;
revoke all on function public.safety_journey_state(uuid,text,text) from public, anon;
grant execute on function public.safety_journey_state(uuid,text,text) to authenticated;
commit;
