-- Test-only Supabase identity and Storage metadata stand-ins. Never deploy this file.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema auth to authenticated, anon, service_role;
create schema storage;
create function storage.allow_only_operation(operation text) returns boolean language sql stable as $$
  select coalesce(current_setting('storage.operation', true) = operation, false)
$$;
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null, unique(bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
