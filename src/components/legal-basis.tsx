import { legalBasisFor } from '@/domain/legal-basis';

export function LegalBasis({ id, headingLevel = 2 }: { id: string; headingLevel?: 2 | 3 }) {
  const basis = legalBasisFor(id);
  if (!basis) return null;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return <section className="legal-basis" aria-label="근거 법령·준비 이유">
    <div className="legal-basis-heading"><Heading>근거 법령·준비 이유</Heading><span className="legal-basis-status">{basis.status}</span></div>
    <details className="legal-research"><summary>근거와 적용 조건 자세히 보기</summary>
    <p>{basis.summary}</p>
    {basis.citations.length ? <div className="legal-citations">{basis.citations.map(citation => <article className="legal-citation" key={`${citation.law}-${citation.article}`}>
      <div className="legal-citation-title"><strong>{citation.law} {citation.article}</strong><span>{citation.relation === 'record' ? '기록·보존 의무' : '활동 수행 의무'}</span></div>
      <p>{citation.explanation}</p>
      <a className="text-link" href={citation.url} target="_blank" rel="noreferrer">{citation.law} {citation.article} 원문 확인 <span className="sr-only">새 창</span> ↗</a>
      <p className="helper">확인한 시행본 {citation.effectiveOn} · 조문 확인일 {citation.checkedOn}</p>
      <p className="helper">{citation.scope}</p>
    </article>)}</div> : <dl className="legal-basis-facts"><div><dt>근거 조문</dt><dd>{basis.kind === 'self_form' ? '특정 조문 미연결 · 자체 서식' : '조문 연결 확인 중'}</dd></div>{basis.research ? <><div><dt>확인 중인 근거</dt><dd>{basis.research}</dd></div><div><dt>관련 법령·자료</dt><dd className="legal-related-links">{basis.sources.map(source => <a className="text-link" key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} <span className="sr-only">새 창</span> ↗</a>)}</dd></div></> : null}</dl>}
    <dl className="legal-basis-facts"><div><dt>서류를 준비하는 이유</dt><dd>{basis.documentNote}</dd></div>{basis.condition ? <div><dt>적용 전 확인할 조건</dt><dd>{basis.condition}</dd></div> : null}</dl>
    {basis.research ? <details className="legal-research"><summary>조사 중인 근거·관련 법령 확인</summary><p>{basis.research}</p><p className="helper">아래는 조사 출처입니다. 출처의 확인일과 이 항목의 조문 확인·적용 검토는 구분합니다.</p>{basis.sources.map(source => <div className="legal-source" key={source.id}><a className="text-link" href={source.url} target="_blank" rel="noreferrer">{source.title} <span className="sr-only">새 창</span> ↗</a><p className="helper">{source.level} · {source.checkedOn ?? '확인일 미정'}<br/>{source.scope}</p>{source.inspectedUrl && source.inspectedUrl !== source.url ? <a className="text-link" href={source.inspectedUrl} target="_blank" rel="noreferrer">조사에 사용한 자료 <span className="sr-only">새 창</span> ↗</a> : null}</div>)}</details> : null}
    </details>
  </section>;
}
