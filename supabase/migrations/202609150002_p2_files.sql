begin;

create function public.safety_reserve_file(version uuid, filename text, mime_type text, byte_size integer, sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.safety_document_versions; d public.safety_documents; f public.safety_files; file_id uuid := gen_random_uuid();
begin
  select * into v from public.safety_document_versions where id = version;
  if not found or not app_private.safety_document_access(v.document_id, 'write') then raise exception 'access_denied'; end if;
  select * into d from public.safety_documents where id = v.document_id for update;
  -- Re-read after locking so concurrent confirmation cannot race with reservation.
  select * into v from public.safety_document_versions where id = version;
  if v.confirmed_at is not null or v.number <> (select max(number) from public.safety_document_versions where document_id = d.id) then raise exception 'invalid_state'; end if;
  if (select count(*) from public.safety_files where version_id = v.id) >= 10 then raise exception 'file_limit'; end if;
  insert into public.safety_files(id, document_id, version_id, organization_id, workplace_id, filename, mime_type, byte_size, sha256, object_path, uploaded_by)
    values(file_id, d.id, v.id, d.organization_id, d.workplace_id, filename, mime_type, byte_size, sha256,
      d.organization_id::text || '/' || d.workplace_id::text || '/' || d.id::text || '/' || v.id::text || '/' || file_id::text, auth.uid()) returning * into f;
  perform app_private.safety_audit(d.id, 'file_reserved', f.id);
  return to_jsonb(f);
end;
$$;
create function public.safety_complete_upload(file uuid, succeeded boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.safety_files;
begin
  select * into f from public.safety_files where id = file for update;
  if not found or f.uploaded_by <> auth.uid() or not app_private.safety_document_access(f.document_id, 'write') then raise exception 'access_denied'; end if;
  if f.state <> 'reserved' then raise exception 'invalid_state'; end if;
  update public.safety_files set state = case when succeeded then 'quarantined' else 'failed' end where id = f.id;
  perform app_private.safety_audit(f.document_id, 'file_upload_recorded', f.id);
end;
$$;
-- Only the separately configured trusted inspection worker may release a file.
-- It must validate bytes, malware, encryption, format, resource limits and the original hash.
create function public.safety_record_file_inspection(file uuid, clean boolean, observed_sha256 text, observed_size integer, scanner_version text)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.safety_files;
begin
  select * into f from public.safety_files where id = file for update;
  if not found or f.state <> 'quarantined' then raise exception 'invalid_state'; end if;
  if clean is null or length(btrim(scanner_version)) < 1 or scanner_version is null then raise exception 'inspection_required'; end if;
  if observed_sha256 is distinct from f.sha256 or observed_size is distinct from f.byte_size then clean := false; end if;
  update public.safety_files set state = case when clean then 'clean' else 'rejected' end,
    scanner_version = safety_record_file_inspection.scanner_version, inspected_at = now() where id = f.id;
  perform app_private.safety_audit(f.document_id, 'file_inspected', f.id);
end;
$$;
create function public.safety_prepare_download(file uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare f public.safety_files;
begin
  select * into f from public.safety_files where id = file;
  if not found or not app_private.safety_document_access(f.document_id) then raise exception 'access_denied'; end if;
  if f.state <> 'clean' then raise exception 'file_inspection_pending'; end if;
  perform app_private.safety_audit(f.document_id, 'file_download_requested', f.id);
  insert into app_private.safety_download_tickets values (f.id, auth.uid(), now() + interval '15 seconds')
    on conflict (file_id, user_id) do update set expires_at = excluded.expires_at;
  return to_jsonb(f);
end;
$$;
create function app_private.safety_file_upload(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.safety_files f where f.object_path = path and f.uploaded_by = auth.uid()
    and f.state = 'reserved' and f.created_at > now() - interval '10 minutes'
    and app_private.safety_document_access(f.document_id, 'write'));
$$;
create function app_private.safety_file_download(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.safety_files f join app_private.safety_download_tickets t on t.file_id = f.id
    where f.object_path = path and f.state = 'clean' and t.user_id = auth.uid() and t.expires_at > now()
      and app_private.safety_document_access(f.document_id));
$$;

-- Create the private bucket through the documented setup script/API, not by changing storage metadata.
create policy safety_file_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'safety-evidence' and app_private.safety_file_upload(name));
create policy safety_file_select on storage.objects for select to authenticated
  using (bucket_id = 'safety-evidence' and storage.allow_only_operation('object.get_authenticated') and app_private.safety_file_download(name));
-- No UPDATE/DELETE policy: originals cannot be overwritten or deleted by clients.

revoke all on function public.safety_reserve_file(uuid, text, text, integer, text),
  public.safety_complete_upload(uuid, boolean), public.safety_prepare_download(uuid) from public, anon;
grant execute on function public.safety_reserve_file(uuid, text, text, integer, text),
  public.safety_complete_upload(uuid, boolean), public.safety_prepare_download(uuid) to authenticated;
revoke all on function public.safety_record_file_inspection(uuid, boolean, text, integer, text) from public, anon, authenticated;
grant execute on function public.safety_record_file_inspection(uuid, boolean, text, integer, text) to service_role;
revoke all on function app_private.safety_file_upload(text), app_private.safety_file_download(text) from public, anon;
grant execute on function app_private.safety_file_upload(text), app_private.safety_file_download(text) to authenticated;

commit;
