begin;

alter table public.safety_tasks
  add column cycle_number integer not null default 1 check (cycle_number > 0),
  add column previous_task_id uuid,
  drop constraint safety_tasks_workplace_id_definition_id_key,
  add constraint safety_task_cycle_unique unique (workplace_id, definition_id, cycle_number),
  add constraint safety_task_cycle_identity unique (id, workplace_id, definition_id),
  add constraint safety_task_cycle_successor unique (previous_task_id),
  add constraint safety_task_cycle_previous foreign key (previous_task_id, workplace_id, definition_id)
    references public.safety_tasks(id, workplace_id, definition_id),
  add constraint safety_task_cycle_shape check (
    (cycle_number = 1 and previous_task_id is null)
    or (cycle_number > 1 and definition_id = 'REVIEW-003' and previous_task_id is not null and previous_task_id <> id)
  );

create or replace function public.safety_start_task(workplace uuid, definition text, sensitive boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.safety_tasks; o uuid; d public.safety_task_definitions; task_id uuid;
begin
  if not app_private.safety_member(workplace, true, sensitive) then raise exception 'access_denied'; end if;
  select organization_id into o from public.safety_workplaces where id = workplace for update;
  select * into t from public.safety_tasks s where s.workplace_id = workplace and s.definition_id = definition order by s.cycle_number desc limit 1;
  if found then
    if not public.safety_task_can_write(t.id) then raise exception 'access_denied'; end if;
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

create function public.safety_start_next_task_cycle(task uuid, expected_revision integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.safety_tasks; successor public.safety_tasks; definition public.safety_task_definitions; next_id uuid;
begin
  select * into previous from public.safety_tasks where id = task;
  if not found or not public.safety_task_can_write(task) then raise exception 'access_denied'; end if;
  -- Use the same workplace-first lock order as profile save and initial task creation.
  perform 1 from public.safety_workplaces where id = previous.workplace_id for update;
  select * into previous from public.safety_tasks where id = task for update;
  if not public.safety_task_can_write(task) then raise exception 'access_denied'; end if;
  if previous.revision is distinct from expected_revision then raise exception 'revision_conflict'; end if;
  if previous.definition_id <> 'REVIEW-003' then raise exception 'invalid_state'; end if;
  select * into successor from public.safety_tasks where previous_task_id = task;
  if found then
    if not public.safety_task_can_write(successor.id) then raise exception 'access_denied'; end if;
    return successor.id;
  end if;
  if previous.document_id is null or not exists (
    select 1 from public.safety_document_versions where document_id = previous.document_id
  ) then raise exception 'cycle_record_required'; end if;
  if not exists (select 1 from public.safety_workplace_profiles where workplace_id = previous.workplace_id and confirmed_at is not null) then raise exception 'profile_required'; end if;
  select * into definition from public.safety_task_definitions where id = previous.definition_id;
  insert into public.safety_tasks(organization_id, workplace_id, definition_id, definition_version, title, category, sensitive, cycle_number, previous_task_id)
    values(previous.organization_id, previous.workplace_id, definition.id, definition.version, definition.title, definition.category, previous.sensitive, previous.cycle_number + 1, previous.id)
    returning id into next_id;
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id, details)
    values(previous.organization_id, previous.workplace_id, auth.uid(), 'task_cycle_started', next_id,
      jsonb_build_object('previous_task_id', previous.id, 'previous_revision', previous.revision, 'cycle_number', previous.cycle_number + 1));
  return next_id;
end;
$$;
revoke all on function public.safety_start_next_task_cycle(uuid,integer) from public, anon;
grant execute on function public.safety_start_next_task_cycle(uuid,integer) to authenticated;

-- A recurring assessment gets its own record; linking an old document would
-- silently carry its confirmations, evidence and performance into the new cycle.
create or replace function public.safety_link_task_document(task uuid, document uuid, expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.safety_tasks; d public.safety_documents;
begin
  select * into t from public.safety_tasks where id = task for update;
  if not found or not app_private.safety_member(t.workplace_id, true, t.sensitive) or not app_private.safety_document_access(document, 'write') then raise exception 'access_denied'; end if;
  if t.revision is distinct from expected_revision then raise exception 'revision_conflict'; end if;
  if t.document_id is not null or t.cycle_number > 1 then raise exception 'invalid_state'; end if;
  select * into d from public.safety_documents where id = document;
  if d.workplace_id <> t.workplace_id then raise exception 'access_denied'; end if;
  if d.sensitive is distinct from t.sensitive then raise exception 'record_sensitivity_mismatch'; end if;
  update public.safety_tasks set document_id = d.id, sensitive = d.sensitive, revision = revision + 1 where id = t.id;
  insert into public.safety_audit_events(organization_id, workplace_id, document_id, actor_id, action, resource_id) values(t.organization_id, t.workplace_id, d.id, auth.uid(), 'task_document_linked', t.id);
end;
$$;

commit;
