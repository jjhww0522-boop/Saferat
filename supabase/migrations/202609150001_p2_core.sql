begin;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.safety_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.safety_memberships (
  organization_id uuid not null references public.safety_organizations,
  user_id uuid not null references auth.users,
  role text not null check (role in ('owner', 'member')),
  active boolean not null default true,
  primary key (organization_id, user_id)
);
create table public.safety_workplaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.safety_organizations,
  name text not null check (length(btrim(name)) between 1 and 120),
  unique (id, organization_id)
);
create table public.safety_workplace_access (
  workplace_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null,
  can_write boolean not null default false,
  can_read_sensitive boolean not null default false,
  active boolean not null default true,
  primary key (workplace_id, user_id),
  foreign key (workplace_id, organization_id) references public.safety_workplaces(id, organization_id),
  foreign key (organization_id, user_id) references public.safety_memberships(organization_id, user_id)
);
create table public.safety_reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workplace_id uuid not null,
  reviewer_id uuid not null references auth.users,
  can_review boolean not null default true,
  can_read_sensitive boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > starts_at),
  foreign key (workplace_id, organization_id) references public.safety_workplaces(id, organization_id)
);
create index safety_assignment_user on public.safety_reviewer_assignments(reviewer_id, workplace_id);
create table public.safety_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workplace_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  sensitive boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  review_status text not null default 'not_requested' check (review_status in ('not_requested', 'queued', 'changes_requested', 'reviewed', 'reopened')),
  submission_status text not null default 'needs_confirmation' check (submission_status = 'needs_confirmation'),
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  unique (id, organization_id, workplace_id),
  foreign key (workplace_id, organization_id) references public.safety_workplaces(id, organization_id)
);
create table public.safety_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  organization_id uuid not null,
  workplace_id uuid not null,
  number integer not null check (number > 0),
  content text not null check (length(btrim(content)) between 1 and 20000),
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users,
  check ((confirmed_at is null) = (confirmed_by is null)),
  unique (document_id, number),
  unique (id, document_id, organization_id, workplace_id),
  foreign key (document_id, organization_id, workplace_id) references public.safety_documents(id, organization_id, workplace_id)
);
create table public.safety_reviews (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid not null,
  organization_id uuid not null,
  workplace_id uuid not null,
  status text not null default 'queued' check (status in ('queued', 'changes_requested', 'reviewed')),
  requested_by uuid not null references auth.users,
  requested_at timestamptz not null default now(),
  reviewer_id uuid references auth.users,
  reviewed_at timestamptz,
  location text not null default '' check (length(location) <= 200),
  comment text not null default '' check (length(comment) <= 4000),
  unique (version_id),
  foreign key (version_id, document_id, organization_id, workplace_id) references public.safety_document_versions(id, document_id, organization_id, workplace_id)
);
create table public.safety_review_notes (
  review_id uuid primary key references public.safety_reviews,
  note text not null check (length(note) <= 4000)
);
create table public.safety_activity_records (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.safety_documents,
  performed_on date not null,
  note text not null check (length(btrim(note)) between 1 and 2000),
  recorded_by uuid not null references auth.users,
  recorded_at timestamptz not null default now(),
  corrects_id uuid references public.safety_activity_records
);
create table public.safety_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.safety_organizations,
  workplace_id uuid,
  document_id uuid references public.safety_documents,
  actor_id uuid references auth.users,
  action text not null,
  resource_id uuid,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (workplace_id, organization_id) references public.safety_workplaces(id, organization_id)
);
create table public.safety_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid not null,
  organization_id uuid not null,
  workplace_id uuid not null,
  filename text not null check (length(filename) between 1 and 180 and filename !~ '[/\\\x00-\x1f]'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  object_path text not null unique,
  uploaded_by uuid not null references auth.users,
  state text not null default 'reserved' check (state in ('reserved', 'quarantined', 'clean', 'rejected', 'failed')),
  scanner_version text,
  inspected_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (version_id, document_id, organization_id, workplace_id) references public.safety_document_versions(id, document_id, organization_id, workplace_id),
  check (state <> 'clean' or (scanner_version is not null and inspected_at is not null))
);
create table app_private.safety_download_tickets (
  file_id uuid not null references public.safety_files,
  user_id uuid not null references auth.users,
  expires_at timestamptz not null,
  primary key (file_id, user_id)
);
create table app_private.safety_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workplace_id uuid not null,
  email text not null,
  token_hash text not null unique,
  can_write boolean not null,
  created_by uuid not null references auth.users,
  expires_at timestamptz not null default (now() + interval '2 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  foreign key (workplace_id, organization_id) references public.safety_workplaces(id, organization_id)
);

create function app_private.safety_member(w uuid, write_access boolean default false, sensitive_access boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.safety_workplace_access a
    join public.safety_memberships m on m.organization_id = a.organization_id and m.user_id = a.user_id
    where a.workplace_id = w and a.user_id = (select auth.uid()) and a.active and m.active
      and (not write_access or a.can_write) and (not sensitive_access or a.can_read_sensitive)
  );
$$;
create function app_private.safety_reviewer(w uuid, sensitive_access boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false) and exists (
    select 1 from public.safety_reviewer_assignments a
    where a.workplace_id = w and a.reviewer_id = (select auth.uid()) and a.can_review
      and a.revoked_at is null and a.starts_at <= now() and a.expires_at > now()
      and (not sensitive_access or a.can_read_sensitive)
  );
$$;
create function app_private.safety_document_access(d uuid, operation text default 'read')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.safety_documents v where v.id = d and (
      (operation in ('read', 'write') and app_private.safety_member(v.workplace_id, operation = 'write', v.sensitive))
      or (operation in ('read', 'review') and app_private.safety_reviewer(v.workplace_id, v.sensitive))
    )
  );
$$;
create function app_private.safety_owner(o uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.safety_memberships where organization_id = o and user_id = (select auth.uid()) and active and role = 'owner');
$$;
create function app_private.safety_audit(d uuid, event text, resource uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.safety_audit_events(organization_id, workplace_id, document_id, actor_id, action, resource_id)
  select organization_id, workplace_id, id, auth.uid(), event, resource from public.safety_documents where id = d;
$$;

alter table public.safety_organizations enable row level security;
alter table public.safety_memberships enable row level security;
alter table public.safety_workplaces enable row level security;
alter table public.safety_workplace_access enable row level security;
alter table public.safety_reviewer_assignments enable row level security;
alter table public.safety_documents enable row level security;
alter table public.safety_document_versions enable row level security;
alter table public.safety_reviews enable row level security;
alter table public.safety_review_notes enable row level security;
alter table public.safety_activity_records enable row level security;
alter table public.safety_audit_events enable row level security;
alter table public.safety_files enable row level security;
alter table app_private.safety_invitations enable row level security;
alter table app_private.safety_download_tickets enable row level security;

create policy organization_read on public.safety_organizations for select to authenticated using (
  exists (select 1 from public.safety_memberships where organization_id = id and user_id = auth.uid() and active)
);
create policy membership_read on public.safety_memberships for select to authenticated using (user_id = auth.uid() or app_private.safety_owner(organization_id));
create policy workplace_read on public.safety_workplaces for select to authenticated using (app_private.safety_member(id) or app_private.safety_reviewer(id));
create policy access_read on public.safety_workplace_access for select to authenticated using (user_id = auth.uid() or app_private.safety_owner(organization_id));
create policy assignment_read on public.safety_reviewer_assignments for select to authenticated using (reviewer_id = auth.uid() or app_private.safety_owner(organization_id));
create policy document_read on public.safety_documents for select to authenticated using (app_private.safety_document_access(id));
create policy version_read on public.safety_document_versions for select to authenticated using (app_private.safety_document_access(document_id));
create policy review_read on public.safety_reviews for select to authenticated using (app_private.safety_document_access(document_id));
create policy note_read on public.safety_review_notes for select to authenticated using (
  exists (select 1 from public.safety_reviews r where r.id = review_id and app_private.safety_document_access(r.document_id, 'review'))
);
create policy activity_read on public.safety_activity_records for select to authenticated using (app_private.safety_document_access(document_id));
create policy audit_read on public.safety_audit_events for select to authenticated using (
  (document_id is not null and app_private.safety_document_access(document_id)) or
  (document_id is null and app_private.safety_owner(organization_id))
);
create policy file_read on public.safety_files for select to authenticated using (app_private.safety_document_access(document_id));

-- Only RPCs may write. Content reads go through an audited RPC.
revoke all on public.safety_organizations, public.safety_memberships, public.safety_workplaces,
  public.safety_workplace_access, public.safety_reviewer_assignments, public.safety_documents,
  public.safety_document_versions, public.safety_reviews, public.safety_review_notes,
  public.safety_activity_records, public.safety_audit_events, public.safety_files from public, anon, authenticated;
grant select on public.safety_organizations, public.safety_memberships, public.safety_workplaces,
  public.safety_workplace_access, public.safety_reviewer_assignments, public.safety_documents,
  public.safety_reviews, public.safety_review_notes, public.safety_activity_records,
  public.safety_audit_events, public.safety_files to authenticated;
grant select (id, document_id, organization_id, workplace_id, number, created_by, created_at, confirmed_at, confirmed_by)
  on public.safety_document_versions to authenticated;

create function public.safety_create_workspace(organization_name text, workplace_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare o uuid; w uuid;
begin
  if auth.uid() is null then raise exception 'access_denied'; end if;
  perform 1 from auth.users where id = auth.uid() for update;
  if exists (select 1 from public.safety_memberships where user_id = auth.uid() and active) then
    raise exception 'already_has_organization';
  end if;
  insert into public.safety_organizations(name) values (btrim(organization_name)) returning id into o;
  insert into public.safety_memberships values (o, auth.uid(), 'owner', true);
  insert into public.safety_workplaces(organization_id, name) values (o, btrim(workplace_name)) returning id into w;
  insert into public.safety_workplace_access values (w, o, auth.uid(), true, false, true);
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action) values (o, w, auth.uid(), 'workspace_created');
  return w;
end;
$$;
create function public.safety_create_document(workplace uuid, title text, content text, sensitive boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare o uuid; d uuid;
begin
  if not app_private.safety_member(workplace, true, sensitive) then raise exception 'access_denied'; end if;
  select organization_id into o from public.safety_workplaces where id = workplace;
  insert into public.safety_documents(organization_id, workplace_id, title, sensitive, created_by)
    values (o, workplace, btrim(title), sensitive, auth.uid()) returning id into d;
  insert into public.safety_document_versions(document_id, organization_id, workplace_id, number, content, created_by)
    values (d, o, workplace, 1, content, auth.uid());
  perform app_private.safety_audit(d, 'document_created');
  return d;
end;
$$;
create function public.safety_new_version(document uuid, expected_revision integer, content text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.safety_documents; v uuid; n integer;
begin
  if not app_private.safety_document_access(document, 'write') then raise exception 'access_denied'; end if;
  select * into d from public.safety_documents where id = document for update;
  if expected_revision is distinct from d.revision then raise exception 'revision_conflict'; end if;
  if d.review_status = 'queued' then raise exception 'review_pending'; end if;
  select coalesce(max(number), 0) + 1 into n from public.safety_document_versions where document_id = document;
  insert into public.safety_document_versions(document_id, organization_id, workplace_id, number, content, created_by)
    values (d.id, d.organization_id, d.workplace_id, n, content, auth.uid()) returning id into v;
  update public.safety_documents set revision = revision + 1, review_status = 'reopened' where id = d.id;
  perform app_private.safety_audit(d.id, 'version_created', v);
  return v;
end;
$$;
create function public.safety_confirm_version(version uuid, expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.safety_document_versions; d public.safety_documents;
begin
  select * into v from public.safety_document_versions where id = version;
  if not found or not app_private.safety_document_access(v.document_id, 'write') then raise exception 'access_denied'; end if;
  select * into d from public.safety_documents where id = v.document_id for update;
  if expected_revision is distinct from d.revision then raise exception 'revision_conflict'; end if;
  if v.confirmed_at is not null or v.number <> (select max(number) from public.safety_document_versions where document_id = d.id) then raise exception 'invalid_state'; end if;
  if exists(select 1 from public.safety_files where version_id = v.id and state <> 'clean') then raise exception 'file_inspection_pending'; end if;
  update public.safety_document_versions set confirmed_at = now(), confirmed_by = auth.uid() where id = v.id;
  update public.safety_documents set revision = revision + 1 where id = d.id;
  perform app_private.safety_audit(d.id, 'version_confirmed', v.id);
end;
$$;
create function public.safety_request_review(version uuid, expected_revision integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.safety_document_versions; d public.safety_documents; r uuid;
begin
  select * into v from public.safety_document_versions where id = version;
  if not found or not app_private.safety_document_access(v.document_id, 'write') then raise exception 'access_denied'; end if;
  select * into d from public.safety_documents where id = v.document_id for update;
  select id into r from public.safety_reviews where version_id = v.id;
  if r is not null then return r; end if;
  if expected_revision is distinct from d.revision then raise exception 'revision_conflict'; end if;
  if v.confirmed_at is null or v.number <> (select max(number) from public.safety_document_versions where document_id = d.id) then raise exception 'invalid_state'; end if;
  insert into public.safety_reviews(document_id, version_id, organization_id, workplace_id, requested_by)
    values (d.id, v.id, d.organization_id, d.workplace_id, auth.uid()) returning id into r;
  update public.safety_documents set revision = revision + 1, review_status = 'queued' where id = d.id;
  perform app_private.safety_audit(d.id, 'review_requested', r);
  return r;
end;
$$;
create function public.safety_decide_review(review uuid, expected_revision integer, decision text, location text, comment text, internal_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare r public.safety_reviews; d public.safety_documents;
begin
  select * into r from public.safety_reviews where id = review;
  if not found or not app_private.safety_document_access(r.document_id, 'review') then raise exception 'access_denied'; end if;
  select * into d from public.safety_documents where id = r.document_id for update;
  if expected_revision is distinct from d.revision then raise exception 'revision_conflict'; end if;
  if r.status <> 'queued' or d.review_status <> 'queued' or decision not in ('changes_requested', 'reviewed') then raise exception 'invalid_state'; end if;
  if decision = 'changes_requested' and (length(btrim(location)) = 0 or length(btrim(comment)) = 0) then raise exception 'feedback_required'; end if;
  update public.safety_reviews set status = decision, reviewer_id = auth.uid(), reviewed_at = now(), location = btrim(safety_decide_review.location), comment = btrim(safety_decide_review.comment) where id = r.id;
  if length(btrim(internal_note)) > 0 then insert into public.safety_review_notes values (r.id, internal_note); end if;
  update public.safety_documents set revision = revision + 1, review_status = decision where id = d.id;
  perform app_private.safety_audit(d.id, 'review_decided', r.id);
end;
$$;
create function public.safety_record_activity(document uuid, expected_revision integer, performed_on date, note text, corrects uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a uuid; d public.safety_documents;
begin
  if not app_private.safety_document_access(document, 'write') then raise exception 'access_denied'; end if;
  select * into d from public.safety_documents where id = document for update;
  if expected_revision is distinct from d.revision then raise exception 'revision_conflict'; end if;
  if performed_on > (now() at time zone 'Asia/Seoul')::date then raise exception 'future_activity'; end if;
  if corrects is not null and not exists (select 1 from public.safety_activity_records where id = corrects and document_id = document) then raise exception 'invalid_correction'; end if;
  insert into public.safety_activity_records(document_id, performed_on, note, recorded_by, corrects_id)
    values (document, performed_on, btrim(note), auth.uid(), corrects) returning id into a;
  update public.safety_documents set revision = revision + 1 where id = d.id;
  perform app_private.safety_audit(document, 'activity_recorded', a);
  return a;
end;
$$;
create function public.safety_read_version(version uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.safety_document_versions;
begin
  select * into v from public.safety_document_versions where id = version;
  if not found or not app_private.safety_document_access(v.document_id) then raise exception 'access_denied'; end if;
  perform app_private.safety_audit(v.document_id, 'version_read', v.id);
  return to_jsonb(v);
end;
$$;
create function public.safety_document_permissions(document uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('read', app_private.safety_document_access(document), 'write', app_private.safety_document_access(document, 'write'), 'review', app_private.safety_document_access(document, 'review'));
$$;

-- Invites bind membership to a confirmed Auth email; knowing a business number confers no access.
create function public.safety_create_invitation(workplace uuid, email text, can_write boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o uuid; token text; invitation uuid;
begin
  select organization_id into o from public.safety_workplaces where id = workplace;
  if o is null or not app_private.safety_owner(o) or not app_private.safety_member(workplace) then raise exception 'access_denied'; end if;
  if email is null or length(email) > 254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email'; end if;
  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into app_private.safety_invitations(organization_id, workplace_id, email, token_hash, can_write, created_by)
    values(o, workplace, lower(btrim(email)), encode(sha256(convert_to(token, 'UTF8')), 'hex'), can_write, auth.uid()) returning id into invitation;
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id) values(o, workplace, auth.uid(), 'invitation_created', invitation);
  return jsonb_build_object('id', invitation, 'token', token);
end;
$$;
create function public.safety_accept_invitation(token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare i app_private.safety_invitations; confirmed_email text;
begin
  select lower(email) into confirmed_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  select * into i from app_private.safety_invitations where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex') for update;
  if not found or confirmed_email is distinct from i.email or i.expires_at <= now() or i.revoked_at is not null or i.accepted_at is not null then raise exception 'invalid_invitation'; end if;
  if not exists (select 1 from public.safety_memberships where organization_id = i.organization_id and user_id = i.created_by and active and role = 'owner') then raise exception 'invalid_invitation'; end if;
  -- Do not silently reactivate previously revoked accounts or alter an existing role.
  if exists (select 1 from public.safety_memberships where organization_id = i.organization_id and user_id = auth.uid() and not active) then raise exception 'access_denied'; end if;
  insert into public.safety_memberships values (i.organization_id, auth.uid(), 'member', true) on conflict do nothing;
  insert into public.safety_workplace_access values (i.workplace_id, i.organization_id, auth.uid(), i.can_write, false, true) on conflict do nothing;
  update app_private.safety_invitations set accepted_at = now() where id = i.id;
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id) values(i.organization_id, i.workplace_id, auth.uid(), 'invitation_accepted', i.id);
  return i.workplace_id;
end;
$$;
create function public.safety_revoke_invitation(invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i app_private.safety_invitations;
begin
  select * into i from app_private.safety_invitations where id = invitation for update;
  if not found or not app_private.safety_owner(i.organization_id) then raise exception 'access_denied'; end if;
  update app_private.safety_invitations set revoked_at = now() where id = i.id;
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id) values(i.organization_id, i.workplace_id, auth.uid(), 'invitation_revoked', i.id);
end;
$$;

-- Every membership/assignment grant or revocation is audited, including controlled admin changes.
create function app_private.safety_audit_access_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id, details)
    values(new.organization_id, (to_jsonb(new)->>'workplace_id')::uuid, auth.uid(), tg_table_name || '_' || lower(tg_op),
      coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'user_id')::uuid,
      jsonb_build_object('before', case when tg_op = 'UPDATE' then to_jsonb(old) else null end, 'after', to_jsonb(new)));
  return new;
end;
$$;
create trigger audit_membership after insert or update on public.safety_memberships for each row execute function app_private.safety_audit_access_change();
create trigger audit_workplace_access after insert or update on public.safety_workplace_access for each row execute function app_private.safety_audit_access_change();
create trigger audit_assignment after insert or update on public.safety_reviewer_assignments for each row execute function app_private.safety_audit_access_change();

-- Restrict execution of SECURITY DEFINER helpers. No client can call the audit writer.
revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.safety_member(uuid, boolean, boolean), app_private.safety_reviewer(uuid, boolean),
  app_private.safety_document_access(uuid, text), app_private.safety_owner(uuid) to authenticated;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace = 'public'::regnamespace and proname like 'safety_%' loop
    execute format('revoke all on function %s from public, anon', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

commit;
