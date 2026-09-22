begin;

-- Only a saved record's summary fields are inspected; no text leaves this RPC.
create function app_private.safety_summary_date(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or left(value, 4) = '0000' then return false; end if;
  perform make_date(left(value, 4)::integer, substring(value, 6, 2)::integer, right(value, 2)::integer);
  return true;
exception when datetime_field_overflow then return false;
end;
$$;
create function app_private.safety_summary_text(value jsonb)
returns text language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'string' then
    btrim(value #>> '{}', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
    else null end;
$$;
create function app_private.safety_task_risk_source(content text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare record jsonb; risk jsonb; hazard jsonb; field text; identifiers text[] := '{}';
  improvements integer := 0; next_due text; known boolean; recorded boolean;
  unreadable constant jsonb := '{"state":"unreadable","improvement_count":0,"next_due_on":null}';
begin
  if content is null then return null; end if;
  begin record := content::jsonb; exception when invalid_text_representation then return unreadable; end;
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

create function public.safety_task_action_sources(workplace uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; organization uuid;
begin
  if not (app_private.safety_member(workplace) or app_private.safety_reviewer(workplace)) then raise exception 'access_denied'; end if;
  select organization_id into organization from public.safety_workplaces where id = workplace;
  if organization is null then raise exception 'access_denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('task_id', t.id, 'version', v.number,
    'confirmed_at', v.confirmed_at, 'risk', app_private.safety_task_risk_source(v.content)) order by t.id), '[]'::jsonb)
    into result
    from public.safety_tasks t
    left join lateral (select number, confirmed_at, content from public.safety_document_versions
      where document_id = t.document_id order by number desc limit 1) v on true
    where t.workplace_id = workplace
      and (app_private.safety_member(t.workplace_id, false, t.sensitive) or app_private.safety_reviewer(t.workplace_id, t.sensitive))
      and (t.document_id is null or app_private.safety_document_access(t.document_id));
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id, details)
    values(organization, workplace, auth.uid(), 'task_action_sources_read', workplace, jsonb_build_object('task_count', jsonb_array_length(result)));
  return result;
end;
$$;
revoke all on function app_private.safety_summary_date(text), app_private.safety_summary_text(jsonb), app_private.safety_task_risk_source(text) from public, anon, authenticated;
revoke all on function public.safety_task_action_sources(uuid) from public, anon;
grant execute on function public.safety_task_action_sources(uuid) to authenticated;

commit;
