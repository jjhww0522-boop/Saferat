begin;

-- Read-only search runs as the caller: existing document/workplace/review RLS also
-- governs the total count. No original content or internal review notes are read.
create function public.safety_document_search(
  page_number integer default 1,
  workplace_filter uuid default null,
  title_query text default '',
  status_filter text default 'all',
  list_view text default 'documents'
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if page_number is null or page_number < 1 or page_number > 1000000
    or title_query is null or length(title_query) > 200
    or status_filter is null or status_filter not in ('all','not_requested','queued','changes_requested','reviewed','reopened')
    or list_view is null or list_view not in ('documents','reviews') then
    raise exception 'invalid_state';
  end if;
  with filtered as materialized (
    select d.id, d.organization_id, d.workplace_id, d.title, d.sensitive,
      d.revision, d.review_status, d.submission_status, d.created_at, w.name as workplace_name,
      case when t.id is null then null else jsonb_build_object('id',t.id,'definition_id',t.definition_id,'cycle_number',t.cycle_number) end as task,
      r.requested_at,
      case when r.id is null then null else jsonb_build_object(
        'id',r.id,'version_id',r.version_id,'version_number',r.version_number,
        'status',r.status,'requested_at',r.requested_at,'reviewed_at',r.reviewed_at
      ) end as review
    from public.safety_documents d
    join public.safety_workplaces w on w.id = d.workplace_id
    left join public.safety_tasks t on t.document_id = d.id
    left join lateral (
      select r.id,r.version_id,v.number as version_number,r.status,r.requested_at,r.reviewed_at
      from public.safety_reviews r
      join public.safety_document_versions v on v.id = r.version_id
      where r.document_id = d.id
      order by r.requested_at desc,r.id desc limit 1
    ) r on true
    where (workplace_filter is null or d.workplace_id = workplace_filter)
      and (status_filter = 'all' or d.review_status = status_filter)
      and (status_filter <> 'queued' or r.status = 'queued')
      and (list_view = 'documents' or r.id is not null)
      and (btrim(title_query) = '' or strpos(lower(d.title),lower(btrim(title_query))) > 0)
  ), counted as (
    select count(*)::integer as total from filtered
  ), selected_page as (
    select total,least(page_number,greatest(1,(total+24)/25)) as page from counted
  ), paged as (
    select f.*,
      case when list_view = 'reviews' then case f.review_status when 'changes_requested' then 0 when 'queued' then 1 when 'reopened' then 2 else 3 end else 0 end as sort_group
    from filtered f
    order by sort_group,
      case when (list_view = 'reviews' or status_filter = 'queued') and f.review_status = 'queued' then f.requested_at end asc nulls last,
      f.created_at desc,f.id desc
    limit 25 offset (select (page-1)*25 from selected_page)
  )
  select jsonb_build_object('total',s.total,'page',s.page,'pageSize',25,
    'items',coalesce((select jsonb_agg(to_jsonb(p)-'requested_at'-'sort_group' order by p.sort_group,
      case when (list_view = 'reviews' or status_filter = 'queued') and p.review_status = 'queued' then p.requested_at end asc nulls last,p.created_at desc,p.id desc) from paged p),'[]'::jsonb))
  into result from selected_page s;
  return result;
end;
$$;

revoke all on function public.safety_document_search(integer,uuid,text,text,text) from public,anon;
grant execute on function public.safety_document_search(integer,uuid,text,text,text) to authenticated;

commit;
