begin;

create table app_private.safety_operators (
  user_id uuid primary key references auth.users,
  role text not null check (role in ('reviewer', 'rules_admin')),
  active boolean not null default true
);
create table app_private.safety_operator_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  actor_id uuid, action text not null, before_value jsonb, after_value jsonb,
  recorded_at timestamptz not null default now()
);
revoke all on app_private.safety_operators, app_private.safety_operator_history from public, anon, authenticated;
create function app_private.safety_operator(require_mfa boolean default true)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from app_private.safety_operators where user_id = auth.uid() and active)
    and (not require_mfa or coalesce(auth.jwt()->>'aal' = 'aal2', false));
$$;
create function app_private.safety_portal_membership_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'safety_operators' then
    if exists(select 1 from public.safety_memberships where user_id = new.user_id and active) then raise exception 'separate_operator_account_required'; end if;
    insert into app_private.safety_operator_history(user_id, actor_id, action, before_value, after_value)
      values (new.user_id, auth.uid(), tg_op, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  elsif new.active and exists(select 1 from app_private.safety_operators where user_id = new.user_id) then
    raise exception 'separate_operator_account_required';
  end if;
  return new;
end;
$$;
create trigger operator_account_guard before insert or update on app_private.safety_operators for each row execute function app_private.safety_portal_membership_guard();
create trigger member_account_guard before insert or update on public.safety_memberships for each row execute function app_private.safety_portal_membership_guard();
create or replace function app_private.safety_member(w uuid, write_access boolean default false, sensitive_access boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists(select 1 from app_private.safety_operators where user_id = auth.uid()) and exists (
    select 1 from public.safety_workplace_access a join public.safety_memberships m on m.organization_id = a.organization_id and m.user_id = a.user_id
    where a.workplace_id = w and a.user_id = auth.uid() and a.active and m.active
      and (not write_access or a.can_write) and (not sensitive_access or a.can_read_sensitive)
  );
$$;
create or replace function app_private.safety_reviewer(w uuid, sensitive_access boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.safety_operator() and exists(select 1 from app_private.safety_operators where user_id = auth.uid() and role = 'reviewer') and exists (
    select 1 from public.safety_reviewer_assignments a where a.workplace_id = w and a.reviewer_id = auth.uid() and a.can_review
      and a.revoked_at is null and a.starts_at <= now() and a.expires_at > now() and (not sensitive_access or a.can_read_sensitive)
  );
$$;
create function public.safety_portal_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('member', auth.uid() is not null and not exists(select 1 from app_private.safety_operators where user_id = auth.uid()),
    'operator', app_private.safety_operator(false), 'mfa', coalesce(auth.jwt()->>'aal' = 'aal2', false),
    'rules', app_private.safety_operator() and exists(select 1 from app_private.safety_operators where user_id = auth.uid() and role = 'rules_admin'));
$$;
drop policy assignment_read on public.safety_reviewer_assignments;
create policy assignment_read on public.safety_reviewer_assignments for select to authenticated using (reviewer_id = auth.uid() and app_private.safety_operator());

create table public.safety_task_definitions (
  id text primary key, version text not null, title text not null,
  category text not null, template text not null check (template in ('common', 'registration', 'photo', 'plan'))
);
create table public.safety_tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, workplace_id uuid not null,
  definition_id text not null references public.safety_task_definitions, definition_version text not null,
  title text not null, category text not null,
  document_id uuid unique, sensitive boolean not null default false,
  owner text not null default '' check (length(owner) <= 120), target_date date,
  revision integer not null default 1 check (revision > 0), created_at timestamptz not null default now(),
  unique (workplace_id, definition_id),
  foreign key (workplace_id, organization_id) references public.safety_workplaces(id, organization_id),
  foreign key (document_id, organization_id, workplace_id) references public.safety_documents(id, organization_id, workplace_id)
);
create table public.safety_workplace_profiles (
  workplace_id uuid primary key references public.safety_workplaces,
  industry text not null default 'all' check (length(industry) <= 40),
  headcount integer check (headcount >= 0), work jsonb not null default '[]'::jsonb check (jsonb_typeof(work) = 'array' and jsonb_array_length(work) <= 24)
);
alter table public.safety_task_definitions enable row level security;
alter table public.safety_tasks enable row level security;
alter table public.safety_workplace_profiles enable row level security;
create policy definition_read on public.safety_task_definitions for select to authenticated using (true);
create policy task_read on public.safety_tasks for select to authenticated using (
  (app_private.safety_member(workplace_id, false, sensitive) or app_private.safety_reviewer(workplace_id, sensitive))
  and (document_id is null or app_private.safety_document_access(document_id))
);
create policy profile_read on public.safety_workplace_profiles for select to authenticated using (app_private.safety_member(workplace_id) or app_private.safety_reviewer(workplace_id));
revoke all on public.safety_task_definitions, public.safety_tasks, public.safety_workplace_profiles from public, anon, authenticated;
grant select on public.safety_task_definitions, public.safety_tasks, public.safety_workplace_profiles to authenticated;

create function public.safety_start_task(workplace uuid, definition text, sensitive boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t uuid; o uuid; d public.safety_task_definitions;
begin
  if not app_private.safety_member(workplace, true, sensitive) then raise exception 'access_denied'; end if;
  select * into d from public.safety_task_definitions where id = definition;
  if not found then raise exception 'invalid_state'; end if;
  select organization_id into o from public.safety_workplaces where id = workplace;
  insert into public.safety_tasks(organization_id, workplace_id, definition_id, definition_version, title, category, sensitive)
    values (o, workplace, d.id, d.version, d.title, d.category, sensitive) on conflict (workplace_id, definition_id) do nothing returning id into t;
  if t is null then
    select id into t from public.safety_tasks s where s.workplace_id = workplace and s.definition_id = definition
      and app_private.safety_member(workplace, true, s.sensitive) and (s.document_id is null or app_private.safety_document_access(s.document_id, 'write'));
    if t is null then raise exception 'access_denied'; end if;
  else
    insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, resource_id) values(o, workplace, auth.uid(), 'task_started', t);
  end if;
  return t;
end;
$$;
create function public.safety_save_task(task uuid, expected_revision integer, document_revision integer, owner text, target_date date, content text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.safety_tasks; d uuid; current_content text;
begin
  select * into t from public.safety_tasks where id = task for update;
  if not found or not app_private.safety_member(t.workplace_id, true, t.sensitive) then raise exception 'access_denied'; end if;
  if t.revision is distinct from expected_revision then raise exception 'revision_conflict'; end if;
  d := t.document_id;
  if d is not null then
    if not app_private.safety_document_access(d, 'write') then raise exception 'access_denied'; end if;
    perform 1 from public.safety_documents where id = d and revision = document_revision for update;
    if not found then raise exception 'revision_conflict'; end if;
    select v.content into current_content from public.safety_document_versions v where document_id = d order by number desc limit 1;
    if content is not null and content is distinct from current_content then perform public.safety_new_version(d, document_revision, content); end if;
  elsif content is not null then
    d := public.safety_create_document(t.workplace_id, t.title, content, t.sensitive);
  end if;
  update public.safety_tasks set owner = btrim(safety_save_task.owner), target_date = safety_save_task.target_date, document_id = d, revision = revision + 1 where id = t.id;
  insert into public.safety_audit_events(organization_id, workplace_id, document_id, actor_id, action, resource_id, details)
    values(t.organization_id, t.workplace_id, d, auth.uid(), 'task_saved', t.id,
      jsonb_build_object('before', jsonb_build_object('owner', t.owner, 'target_date', t.target_date, 'revision', t.revision), 'after', jsonb_build_object('owner', btrim(owner), 'target_date', target_date, 'revision', t.revision + 1)));
  return d;
end;
$$;
create function public.safety_link_task_document(task uuid, document uuid, expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.safety_tasks; d public.safety_documents;
begin
  select * into t from public.safety_tasks where id = task for update;
  if not found or not app_private.safety_member(t.workplace_id, true, t.sensitive) or not app_private.safety_document_access(document, 'write') then raise exception 'access_denied'; end if;
  if t.revision is distinct from expected_revision then raise exception 'revision_conflict'; end if;
  if t.document_id is not null then raise exception 'invalid_state'; end if;
  select * into d from public.safety_documents where id = document;
  if d.workplace_id <> t.workplace_id then raise exception 'access_denied'; end if;
  if d.sensitive is distinct from t.sensitive then raise exception 'record_sensitivity_mismatch'; end if;
  update public.safety_tasks set document_id = d.id, sensitive = d.sensitive, revision = revision + 1 where id = t.id;
  insert into public.safety_audit_events(organization_id, workplace_id, document_id, actor_id, action, resource_id) values(t.organization_id, t.workplace_id, d.id, auth.uid(), 'task_document_linked', t.id);
end;
$$;
create function public.safety_save_workplace_profile(workplace uuid, industry text, headcount integer, work jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid; previous jsonb;
begin
  if not app_private.safety_member(workplace, true) then raise exception 'access_denied'; end if;
  select organization_id into o from public.safety_workplaces where id = workplace for update;
  select to_jsonb(p) into previous from public.safety_workplace_profiles p where workplace_id = workplace;
  insert into public.safety_workplace_profiles values(workplace, industry, headcount, work)
    on conflict (workplace_id) do update set industry = excluded.industry, headcount = excluded.headcount, work = excluded.work;
  insert into public.safety_audit_events(organization_id, workplace_id, actor_id, action, details) values(o, workplace, auth.uid(), 'task_profile_saved', jsonb_build_object('before', previous, 'after', jsonb_build_object('industry', industry, 'headcount', headcount, 'work', work)));
end;
$$;
revoke all on function app_private.safety_operator(boolean), app_private.safety_portal_membership_guard() from public, anon, authenticated;
grant execute on function app_private.safety_operator(boolean) to authenticated;
revoke all on function public.safety_portal_access(), public.safety_start_task(uuid,text,boolean), public.safety_save_task(uuid,integer,integer,text,date,text), public.safety_link_task_document(uuid,uuid,integer), public.safety_save_workplace_profile(uuid,text,integer,jsonb) from public, anon;
grant execute on function public.safety_portal_access(), public.safety_start_task(uuid,text,boolean), public.safety_save_task(uuid,integer,integer,text,date,text), public.safety_link_task_document(uuid,uuid,integer), public.safety_save_workplace_profile(uuid,text,integer,jsonb) to authenticated;

commit;
