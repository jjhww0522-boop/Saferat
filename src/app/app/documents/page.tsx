import Link from 'next/link';
import { demoTaskEntry, demoTaskList } from '@/server/demo-tasks';
import { memberContext } from '@/server/store';
import { Badge, PageHeading, dateTime } from '@/components/ui';
import { DocumentList } from '@/components/document-list';
import { documentFilters, documentPageSize, type DocumentListItem, type DocumentSearchParams } from '@/domain/document-search';

export default async function Documents({ searchParams }: { searchParams: Promise<DocumentSearchParams> }) {
  const { state, workplace, workplaces } = await memberContext();
  const filters = documentFilters(await searchParams, 'documents');
  const taskLists = await Promise.all(workplaces.map(place => demoTaskList(place.id)));
  const managed = taskLists.flatMap(list => list.tasks).filter(task => task.document_id);
  const entries = await Promise.all(managed.map(task => demoTaskEntry(task.id)));
  const rows: DocumentListItem[] = entries.flatMap(({ entry }) => {
    const document = entry.document, task = entry.task;
    const firstVersion = document?.versions.at(-1);
    if (!document || !firstVersion) return [];
    const review = document.reviews.at(-1);
    const version = review ? document.versions.find(version => version.id === review.version_id) : undefined;
    return [{ id: document.id, title: document.title, workplace_id: task.workplace_id, workplace_name: workplaces.find(place => place.id === task.workplace_id)!.name,
      sensitive: task.sensitive, review_status: document.review_status, created_at: firstVersion.created_at,
      task: { id: task.id, definition_id: task.definition_id, cycle_number: task.cycle_number ?? 1 }, href: `/app/tasks/${task.id}`,
      review: review && version ? { version_id: version.id, version_number: version.number, status: review.status, requested_at: null } : null }];
  });
  const matches = rows.filter(row => (!filters.workplace || row.workplace_id === filters.workplace) && (filters.status === 'all' || row.review_status === filters.status) && row.title.toLocaleLowerCase().includes(filters.query.toLocaleLowerCase()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const page = Math.min(filters.page, Math.max(1, Math.ceil(matches.length / documentPageSize)));
  const ids = state.obligations.filter(obligation => obligation.workplaceId === workplace.id).map(obligation => obligation.id);
  const samples = state.versions.filter(version => ids.includes(version.obligationId));
  return <><PageHeading eyebrow="준비한 자료를 한곳에" title="우리 사업장 자료" description="현장·제목·상태로 지난 기록을 찾아보세요. 새 버전을 올려도 이전 자료와 검토 이력은 남아 있어요."/>
    {!managed.length ? <p>아직 저장한 업무 자료가 없어요. <Link className="text-link" href="/app/map">지도에서 첫 업무 찾기 →</Link></p> : null}
    <DocumentList result={{ items: matches.slice((page - 1) * documentPageSize, page * documentPageSize), total: matches.length, page, pageSize: documentPageSize }} filters={filters} workplaces={workplaces} path="/app/documents"/>
    {samples.length ? <details className="panel panel-padding"><summary>둘러보기용 가상 자료 · 현재 선택한 현장</summary><p className="helper">아래 예시 자료는 검색 결과와 별도로 보여요. 실제로 수행한 기록이 아닙니다.</p>{samples.toReversed().map(version => <Link className="document-row" href={`/app/obligations/${version.obligationId}`} key={version.id}><div><strong>{state.obligations.find(obligation => obligation.id === version.obligationId)?.title} · v{version.number}</strong><p>{dateTime(version.createdAt)} · 자체 서식 · 가상 자료</p></div><Badge status={version.status === 'draft' ? 'needs_review' : 'reviewed'}>{version.status === 'draft' ? '초안' : '내용 확인'}</Badge></Link>)}</details> : null}
  </>;
}
