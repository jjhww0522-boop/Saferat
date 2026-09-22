begin;

create or replace function public.safety_complete_upload(file uuid, succeeded boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.safety_files;
begin
  select * into f from public.safety_files where id = file;
  if not found or f.uploaded_by <> auth.uid() or not app_private.safety_document_access(f.document_id, 'write') then raise exception 'access_denied'; end if;
  -- Serialize with confirmation/recovery without blocking the inspection audit's
  -- foreign-key KEY SHARE lock while its worker holds the file row.
  perform 1 from public.safety_documents where id = f.document_id for no key update;
  select * into f from public.safety_files where id = file for update;
  if f.uploaded_by <> auth.uid() or not app_private.safety_document_access(f.document_id, 'write') then raise exception 'access_denied'; end if;
  if succeeded is null then raise exception 'invalid_state'; end if;
  if (succeeded and f.state in ('quarantined','clean','rejected')) or (not succeeded and f.state = 'failed') then return; end if;
  if f.state <> 'reserved' then raise exception 'invalid_state'; end if;
  update public.safety_files set state = case when succeeded then 'quarantined' else 'failed' end where id = f.id;
  perform app_private.safety_audit(f.document_id, 'file_upload_recorded', f.id);
end;
$$;

create function public.safety_retry_evidence_version(source_version uuid, expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.safety_document_versions; d public.safety_documents; next_version uuid; failed_files jsonb;
begin
  select * into v from public.safety_document_versions where id = source_version;
  if not found or not app_private.safety_document_access(v.document_id, 'write') then raise exception 'access_denied'; end if;
  select * into d from public.safety_documents where id = v.document_id for update;
  if not app_private.safety_document_access(d.id, 'write') then raise exception 'access_denied'; end if;
  if d.revision is distinct from expected_revision then raise exception 'revision_conflict'; end if;
  select * into v from public.safety_document_versions where id = source_version;
  if d.review_status = 'queued' then raise exception 'review_pending'; end if;
  if v.confirmed_at is not null or v.number <> (select max(number) from public.safety_document_versions where document_id = d.id) then raise exception 'invalid_state'; end if;
  select jsonb_agg(id order by id) into failed_files from public.safety_files where version_id = v.id
    and (state in ('failed','rejected') or (state = 'reserved' and created_at <= now() - interval '10 minutes'));
  if failed_files is null then raise exception 'file_retry_unavailable'; end if;
  next_version := public.safety_new_version(d.id, expected_revision, v.content);
  insert into public.safety_audit_events(organization_id, workplace_id, document_id, actor_id, action, resource_id, details)
    values(d.organization_id, d.workplace_id, d.id, auth.uid(), 'file_retry_version_created', next_version,
      jsonb_build_object('source_version_id', v.id, 'source_file_ids', failed_files));
  return jsonb_build_object('document_id', d.id, 'version_id', next_version);
end;
$$;
revoke all on function public.safety_retry_evidence_version(uuid,integer) from public, anon;
grant execute on function public.safety_retry_evidence_version(uuid,integer) to authenticated;

commit;
