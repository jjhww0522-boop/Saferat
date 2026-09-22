import Link from 'next/link';
import { documentPageHref, documentStatuses, documentTurn, type DocumentFilters, type DocumentListPage } from '@/domain/document-search';
import { reviewStatusLabels } from '@/domain/workspace';

const dates = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function DocumentList({ result, filters, workplaces, path, operator = false }: {
  result: DocumentListPage; filters: DocumentFilters; workplaces: { id: string; name: string }[]; path: string; operator?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const statuses = filters.view === 'reviews' ? documentStatuses.filter(status => status !== 'not_requested') : documentStatuses;
  return <section className="record-section" aria-label={filters.view === 'reviews' ? '검토 요청 찾기' : '자료 찾기'}>
    <form action={path} method="get" className="workspace-form">
      <div className="form-grid">
        <label>현장<select name="workplace" defaultValue={filters.workplace ?? ''}><option value="">접근 가능한 모든 현장</option>{filters.workplace && !workplaces.some(workplace => workplace.id === filters.workplace) ? <option value={filters.workplace}>접근할 수 없는 현장</option> : null}{workplaces.map(workplace => <option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}</select></label>
        <label>자료 상태<select name="status" defaultValue={filters.status}>{statuses.map(status => <option key={status} value={status}>{status === 'all' ? '모든 상태' : reviewStatusLabels[status]}</option>)}</select></label>
        <label>자료 제목<input type="search" name="q" defaultValue={filters.query} maxLength={200} placeholder="기억나는 제목을 입력하세요"/></label>
      </div>
      <div className="button-row"><button className="button primary" type="submit">검색</button><Link className="button secondary" href={`${path}?status=all`}>조건 지우기</Link></div>
    </form>
    <p className="helper">검색 결과 {result.total}건 · {result.page} / {pages}페이지 · 페이지당 {result.pageSize}건</p>
    {filters.view === 'reviews' ? <p className="helper">보완 요청을 먼저 표시하고, 검토 대기는 요청한 날짜가 오래된 순서로 표시해요. 자료 검토와 실제 수행·기관 접수는 각각 확인해요.</p> : null}
    {result.items.length ? result.items.map(document => {
      const base = document.href ?? (operator ? `/ops/reviews/${document.id}` : `/workspace/documents/${document.id}`);
      const href = filters.view === 'reviews' && document.review && document.review_status !== 'reopened' ? `${base}?version=${document.review.version_id}#review-history` : base;
      return <Link className="document-row" key={document.id} href={href}>
        <div><strong>{document.title}{document.task?.definition_id === 'REVIEW-003' ? ` ${document.task.cycle_number}회차` : ''}</strong><p>{document.workplace_name}{document.sensitive ? ' · 별도 권한 자료' : ''}</p>
          {document.review ? <p>최근 검토 요청 v{document.review.version_number} · {document.review.requested_at ? <time dateTime={document.review.requested_at}>{dates.format(new Date(document.review.requested_at))}</time> : '검토 요청일 기록 없음'}</p> : <p>자료 생성 · <time dateTime={document.created_at}>{dates.format(new Date(document.created_at))}</time> · 검토 요청 없음</p>}
          <p>{operator ? documentTurn(document.review_status) : documentTurn(document.review_status).replace('고객이 ', '')}{document.review_status === 'reopened' ? ' · 최신 자료 열기 →' : ''}</p>
        </div><span className={`badge ${document.review_status}`}>{reviewStatusLabels[document.review_status]}</span>
      </Link>;
    }) : <div className="empty"><h2>조건에 맞는 자료가 없어요</h2><p>현장·상태·제목 조건을 바꿔보세요. 접근 권한이 있는 자료만 표시해요.</p></div>}
    <nav className="button-row" aria-label="자료 목록 페이지">
      {result.page > 1 ? <Link className="button secondary" rel="prev" href={documentPageHref(path, filters, result.page - 1)}>이전 페이지</Link> : null}
      {result.page < pages ? <Link className="button secondary" rel="next" href={documentPageHref(path, filters, result.page + 1)}>다음 페이지</Link> : null}
    </nav>
  </section>;
}
