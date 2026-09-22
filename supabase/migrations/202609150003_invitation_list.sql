begin;
create function public.safety_list_invitations()
returns table(id uuid, workplace_id uuid, email text, expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz, expired boolean)
language sql stable security definer set search_path = '' as $$
  select i.id, i.workplace_id, i.email, i.expires_at, i.accepted_at, i.revoked_at, i.expires_at <= now()
  from app_private.safety_invitations i where app_private.safety_owner(i.organization_id)
  order by i.expires_at desc limit 100;
$$;
revoke all on function public.safety_list_invitations() from public, anon;
grant execute on function public.safety_list_invitations() to authenticated;
commit;
