begin;

-- The optional suffix is the stable hazard ID, never the hazard's array position.
-- Keep legacy step/chapter cursors readable. This updates UI position only.
create or replace function public.safety_journey_state(workplace uuid, resource text, cursor text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare result text; target public.safety_tasks; risk_step integer; risk_chapter integer;
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
    if (resource = 'profile' and cursor !~ '^profile:[0-3]$') or (resource = 'welcome' and cursor not in ('welcome:seen','welcome:new')) then raise exception 'invalid_state'; end if;
    if resource not in ('profile','welcome') then
      if left(cursor, 8) !~ '^risk:[0-6]:[0-2]$' or not (char_length(cursor) = 8 or (substring(cursor from 9 for 1) = ':' and char_length(cursor) between 10 and 89)) then raise exception 'invalid_state'; end if;
      risk_step := substring(cursor from 6 for 1)::integer;
      risk_chapter := substring(cursor from 8 for 1)::integer;
      if risk_chapter >= (array[3,2,1,1,2,1,2])[risk_step + 1] then raise exception 'invalid_state'; end if;
    end if;
    insert into app_private.safety_journey_positions(user_id, workplace_id, resource, cursor) values(auth.uid(), workplace, resource, cursor)
      on conflict on constraint safety_journey_positions_pkey do update set cursor = excluded.cursor, updated_at = now();
  end if;
  select p.cursor into result from app_private.safety_journey_positions p where p.user_id = auth.uid() and p.workplace_id = workplace and p.resource = safety_journey_state.resource;
  return result;
end;
$$;

revoke all on function public.safety_journey_state(uuid,text,text) from public, anon;
grant execute on function public.safety_journey_state(uuid,text,text) to authenticated;

commit;
