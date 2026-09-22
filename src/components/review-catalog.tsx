'use client';
import { useState } from 'react';
import { Download, Search, ChevronDown, ArrowUpRight, RotateCcw } from 'lucide-react';
import { Badge } from './ui';
import { LegalBasis } from './legal-basis';
import {
  catalogCsv, catalogNotice, catalogStatus, catalogVersion, categories, filterCandidates,
  headcountBands, industries, reviewCandidates, workConditions,
  type CatalogFilter, type CategoryId, type HeadcountBand, type IndustryId, type WorkId,
} from '@/domain/review-catalog';

const initialFilter: CatalogFilter = { industry: 'all', category: 'all', headcount: 'unknown', work: [], query: '' };

export function ReviewCatalog() {
  const [filter, setFilter] = useState<CatalogFilter>(initialFilter);
  const items = filterCandidates(filter);
  const band = headcountBands.find(item => item.id === filter.headcount)!;
  const industry = industries.find(item => item.id === filter.industry);
  const prioritized = items.filter(item => item.focus.includes(filter.headcount)).length;

  function update(patch: Partial<CatalogFilter>) { setFilter(current => ({ ...current, ...patch })); }
  function toggleWork(id: WorkId) {
    setFilter(current => ({ ...current, work: current.work.includes(id) ? current.work.filter(work => work !== id) : [...current.work, id] }));
  }
  function download() {
    const url = URL.createObjectURL(new Blob([catalogCsv(items, filter)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `safety-review-${catalogVersion}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <>
    <div className="notice amber catalog-notice"><strong>적용 여부는 추가 확인이 필요합니다</strong><p>{catalogNotice}</p><p>공식 자료를 바탕으로 정리한 조사 질문입니다. 교육시간·선임 기준·법정 주기는 개별 원문과 예외를 검토한 뒤 확정합니다.</p></div>
    <section className="panel panel-padding catalog-filters" aria-labelledby="catalog-filter-title">
      <div className="section-heading flush"><h2 id="catalog-filter-title">확인할 범위를 골라보세요</h2><button className="text-link catalog-reset" type="button" onClick={() => setFilter(initialFilter)}><RotateCcw size={15} aria-hidden="true"/>초기화</button></div>
      <div className="form-grid catalog-filter-grid">
        <label>업종 묶음<select value={filter.industry} onChange={event => update({ industry: event.target.value as IndustryId | 'all' })}><option value="all">전체 업종 · 미확인</option>{industries.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>인원 구간 · 검토 순서<select value={filter.headcount} onChange={event => update({ headcount: event.target.value as HeadcountBand })}>{headcountBands.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>검토 분야<select value={filter.category} onChange={event => update({ category: event.target.value as CategoryId | 'all' })}><option value="all">전체 분야</option>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>항목·질문 검색<span className="catalog-search"><Search size={18} aria-hidden="true"/><input type="search" placeholder="예: 특별교육, 지게차, 소방" value={filter.query} onChange={event => update({ query: event.target.value })}/></span></label>
      </div>
      <p className="helper">업무별 탐색용 분류이며 법정 산업분류가 아닙니다. 공통 후보와 관련 업종 후보를 함께 보여줍니다. 다른 업종에 분류된 작업도 아래에서 추가할 수 있습니다.</p>
      {industry ? <p className="catalog-industry-note">{industry.focus}</p> : null}
      <details className="catalog-work"><summary>실제 작업·설비 조건 추가 <span>{filter.work.length ? `${filter.work.length}개 선택` : '업종 밖의 관련 항목도 포함'}</span><ChevronDown size={17} aria-hidden="true"/></summary>
        <fieldset><legend className="sr-only">추가로 검토할 작업 조건</legend><div className="catalog-work-options">{workConditions.map(item => <label key={item.id}><input type="checkbox" checked={filter.work.includes(item.id)} onChange={() => toggleWork(item.id)}/>{item.label}</label>)}</div></fieldset>
        <p className="helper">선택한 작업에 연결된 후보를 추가합니다. 선택하지 않은 작업을 ‘해당 없음’으로 판단하지 않습니다.</p>
      </details>
      <div className="catalog-count-note" role="status"><strong>{band.label} · 먼저 확인할 내용</strong><p>{band.note}</p><small>다른 구간을 선택해도 항목 수는 줄지 않습니다. 인원 관련 후보를 위로 정렬합니다.</small></div>
    </section>

    <section aria-labelledby="catalog-result-title">
      <div className="catalog-results-heading"><div><p className="eyebrow">검토 목록 · {catalogVersion}</p><h2 id="catalog-result-title" aria-live="polite">현재 목록 {items.length}개 <span className="muted">/ 전체 후보 {reviewCandidates.length}개</span></h2><p className="helper">{prioritized}개는 선택한 인원 구간에서 우선 확인할 후보입니다. 항목을 열면 질문·증빙·출처를 볼 수 있습니다.</p></div>
        <div className="button-row"><button type="button" className="button secondary" onClick={download} disabled={items.length === 0}><Download size={17} aria-hidden="true"/>현재 목록 CSV</button><a className="text-link" href="/review-catalog.md" download>전체 검토 문서 <ArrowUpRight size={16} aria-hidden="true"/></a></div>
      </div>
      <p className="helper">CSV에는 현재 탐색 조건과 검토자·검토일·의견 입력란이 포함됩니다. 내려받은 파일에서 기록하며, 앱에는 검토 결과가 저장되지 않습니다.</p>
      {items.length === 0 ? <div className="panel panel-padding" role="status"><h3>이 검색 조건에서 찾은 후보가 없습니다</h3><p>법적 의무가 없다는 뜻은 아닙니다. 검색어·분야를 바꾸거나 전체 업종으로 확인해주세요.</p><button className="button secondary" onClick={() => setFilter(initialFilter)}>전체 후보 다시 보기</button></div> : <div className="panel catalog-list">{items.map(item => <details key={item.id} className="catalog-item" id={item.id}>
        <summary><span className="catalog-item-id">{item.id.replace('REVIEW-', '')}</span><span className="catalog-item-title"><span className="small-label">{categories.find(category => category.id === item.category)!.label} · {item.industries.length ? '업종·작업 확인' : '공통 검토 후보'}</span><strong>{item.title}</strong></span><span className="catalog-item-status"><Badge status="needs_review">{item.focus.includes(filter.headcount) ? '인원 조건 우선 확인' : '적용 확인 필요'}</Badge><ChevronDown size={18} aria-hidden="true"/></span></summary>
        <div className="catalog-item-body"><p className="catalog-condition">{item.condition}</p><div className="catalog-detail-grid"><section aria-label={`${item.title} 확인 질문`}><h3>확인할 내용</h3><ul>{item.checks.map(check => <li key={check}>{check}</li>)}</ul></section><section aria-label={`${item.title} 증빙 예시`}><h3>준비할 증빙 예시</h3><ul>{item.evidence.map(evidence => <li key={evidence}>{evidence}</li>)}</ul><p className="helper">실제로 수행·확인한 자료를 준비합니다. 서류를 만들었다고 이행이 완료되지는 않습니다.</p></section></div>
          <LegalBasis id={item.id} headingLevel={3}/><p className="helper">{item.id} · {catalogStatus} · 실제 규칙 승인 0개</p></div>
      </details>)}</div>}
    </section>
    <section className="panel panel-padding"><h2>검토가 끝나면 다음 단계로 연결합니다</h2><p>사업장 사실 확인 → 공식 원문·예외·시행일 대조 → 사용자 1차 검토 → 필요한 외부 전문 검토 → 기대 사례 시험 → 승인된 범위 반영.</p><p className="helper">업종별 세부 작업과 관련 법령은 조사하면서 확장합니다. 현재 목록의 항목 수나 화면 열람은 조사·법적 이행·승인 완료를 뜻하지 않습니다.</p></section>
  </>;
}
