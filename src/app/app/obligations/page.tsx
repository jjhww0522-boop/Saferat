import Link from 'next/link';
import { memberContext } from '@/server/store';
import { evaluationFor } from '@/domain/workflow';
import { PageHeading, TaskRow } from '@/components/ui';
export default async function Obligations() {
  const { state, workplace } = await memberContext();
  const items = state.obligations.filter(o => o.workplaceId === workplace.id);
  return <><PageHeading eyebrow="하나씩, 빠짐없이" title="우리 사업장 할 일" description="체험 규칙의 결과와 준비 상태를 구분해서 확인하세요."/>
    <div className="notice">데모 — 실제 법적 판단에 사용 불가. 미응답은 ‘해당 없음’으로 처리하지 않습니다.</div>
    {(['applicable', 'needs_review', 'not_applicable'] as const).map(status => <section className="panel" key={status}><div className="section-heading"><h2>{{ applicable: '체험 조건에 해당하는 업무', needs_review: '정보 확인이 필요한 업무', not_applicable: '체험 조건에 해당하지 않는 업무' }[status]}</h2></div>{items.filter(o => evaluationFor(state, o).applicability === status).map(o => <TaskRow key={o.id} item={o} applicability={status}/>)}{!items.some(o => evaluationFor(state, o).applicability === status) ? <p className="panel-padding muted">현재 이 분류의 체험 업무가 없습니다. 실제 의무가 없다는 뜻은 아닙니다.</p> : null}</section>)}
    <Link className="button secondary" href="/onboarding">적용 정보 수정·확인하기</Link></>;
}
