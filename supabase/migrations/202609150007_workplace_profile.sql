begin;

-- Existing exploration preferences are not evidence of business confirmation.
alter table public.safety_workplace_profiles
  add column facts jsonb not null default '{}'::jsonb,
  add column revision integer not null default 0 check (revision >= 0),
  add column confirmed_at timestamptz;

drop function public.safety_save_workplace_profile(uuid,text,integer,jsonb);
create function public.safety_save_workplace_profile(workplace uuid, industry text, headcount integer, work jsonb, facts jsonb, expected_revision integer, confirmed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid; previous jsonb; saved jsonb; current_revision integer; k text; v jsonb;
  normalized jsonb := '{"businessName":"","registrationIndustry":"","registrationItems":"","registeredAddress":"","actualAddress":"","actualWork":"","temporary":null,"dispatched":null,"contractors":null,"countDate":null,"countBasis":"","contractRole":"unknown","workReviewed":false}'::jsonb;
begin
  if not app_private.safety_member(workplace, true) then raise exception 'access_denied'; end if;
  -- Shared lock order with task creation also serializes the first profile save.
  select organization_id into o from public.safety_workplaces where id = workplace for update;
  select to_jsonb(p), p.revision into previous, current_revision from public.safety_workplace_profiles p where workplace_id = workplace;
  if coalesce(current_revision, 0) is distinct from expected_revision then raise exception 'revision_conflict'; end if;
  if industry is null or industry not in ('all','facility','manufacturing','construction','retail','food','hospitality','logistics','healthcare','office','education','culture','agriculture','waste','energy','mining','personal','public','other')
    or headcount < 0 or headcount > 1000000 or confirmed is null then raise exception 'invalid_state'; end if;
  if jsonb_typeof(work) is distinct from 'array' or jsonb_typeof(facts) is distinct from 'object' then raise exception 'invalid_state'; end if;
  if jsonb_array_length(work) > 14 then raise exception 'invalid_state'; end if;
  for v in select value from jsonb_array_elements(work) loop
    if jsonb_typeof(v) <> 'string' or v #>> '{}' not in ('height','confined','machine','vehicle','chemical','electric','fire','contractor','customer','night','heat','lifting','infection','publicFacility') then raise exception 'invalid_state'; end if;
  end loop;
  for k, v in select key, value from jsonb_each(facts) loop
    if k in ('businessName','registrationIndustry','registrationItems','registeredAddress','actualAddress','actualWork','countBasis') then
      if jsonb_typeof(v) <> 'string' then raise exception 'invalid_state'; end if;
      v := to_jsonb(regexp_replace(v #>> '{}', '^\s+|\s+$', '', 'g'));
      if length(v #>> '{}') > 2000 then raise exception 'invalid_state'; end if;
    elsif k in ('temporary','dispatched','contractors') then
      if v <> 'null'::jsonb then
        if jsonb_typeof(v) <> 'number' then raise exception 'invalid_state'; end if;
        if (v::text)::numeric < 0 or (v::text)::numeric > 1000000 or trunc((v::text)::numeric) <> (v::text)::numeric then raise exception 'invalid_state'; end if;
      end if;
    elsif k = 'countDate' then
      if v <> 'null'::jsonb then
        if jsonb_typeof(v) <> 'string' or v #>> '{}' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_state'; end if;
        begin
          perform (v #>> '{}')::date;
        exception when datetime_field_overflow or invalid_datetime_format then raise exception 'invalid_state';
        end;
      end if;
    elsif k = 'contractRole' then
      if jsonb_typeof(v) <> 'string' or v #>> '{}' not in ('unknown','none','client','contractor','both') then raise exception 'invalid_state'; end if;
    elsif k = 'workReviewed' then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'invalid_state'; end if;
    else
      raise exception 'invalid_state';
    end if;
    normalized := jsonb_set(normalized, array[k], v);
  end loop;
  if (normalized->>'temporary')::numeric > headcount then raise exception 'invalid_state'; end if;
  if confirmed and (normalized->>'businessName' = '' or normalized->>'actualAddress' = '' or normalized->>'actualWork' = '') then raise exception 'profile_required'; end if;
  insert into public.safety_workplace_profiles(workplace_id, industry, headcount, work, facts, revision, confirmed_at)
    values(workplace, industry, headcount, work, normalized, expected_revision + 1, case when confirmed then now() else null end)
    on conflict (workplace_id) do update set industry = excluded.industry, headcount = excluded.headcount, work = excluded.work,
      facts = excluded.facts, revision = excluded.revision, confirmed_at = excluded.confirmed_at
    returning to_jsonb(safety_workplace_profiles.*) into saved;
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, details)
    values(o, workplace, auth.uid(), 'task_profile_saved', jsonb_build_object('before', previous, 'after', saved));
end;
$$;
revoke all on function public.safety_save_workplace_profile(uuid,text,integer,jsonb,jsonb,integer,boolean) from public, anon;
grant execute on function public.safety_save_workplace_profile(uuid,text,integer,jsonb,jsonb,integer,boolean) to authenticated;

create or replace function public.safety_start_task(workplace uuid, definition text, sensitive boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.safety_tasks; o uuid; d public.safety_task_definitions; task_id uuid;
begin
  if not app_private.safety_member(workplace, true, sensitive) then raise exception 'access_denied'; end if;
  select organization_id into o from public.safety_workplaces where id = workplace for update;
  select * into t from public.safety_tasks s where s.workplace_id = workplace and s.definition_id = definition;
  if found then
    if not app_private.safety_member(workplace, true, t.sensitive) or (t.document_id is not null and not app_private.safety_document_access(t.document_id, 'write')) then raise exception 'access_denied'; end if;
    return t.id;
  end if;
  select * into d from public.safety_task_definitions where id = definition;
  if not found then raise exception 'invalid_state'; end if;
  if definition in ('FORM_REGISTRATION','REVIEW-001','REVIEW-002') or not exists (
    select 1 from public.safety_workplace_profiles p where p.workplace_id = workplace and p.confirmed_at is not null
  ) then raise exception 'profile_required'; end if;
  insert into public.safety_tasks(organization_id, workplace_id, definition_id, definition_version, title, category, sensitive)
    values(o, workplace, d.id, d.version, d.title, d.category, sensitive) returning id into task_id;
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id) values(o, workplace, auth.uid(), 'task_started', task_id);
  return task_id;
end;
$$;

commit;
