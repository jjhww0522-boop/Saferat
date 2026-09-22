begin;
create function public.safety_task_can_write(task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.safety_tasks t where id = task and app_private.safety_member(t.workplace_id, true, t.sensitive) and (t.document_id is null or app_private.safety_document_access(t.document_id, 'write')));
$$;
revoke all on function public.safety_task_can_write(uuid) from public, anon;
grant execute on function public.safety_task_can_write(uuid) to authenticated;
commit;
