import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ClipboardList, FileCheck2, CircleHelp, Building2, ChevronRight } from 'lucide-react';
import { memberContext } from '@/server/store';
import { evaluationFor } from '@/domain/workflow';
import { PageHeading, TaskRow, Badge } from '@/components/ui';

export default async function Home() {
  const { state, workplace } = await memberContext();
  const items = state.obligations.filter(o => o.workplaceId === workplace.id);
  const active = items.filter(o => evaluationFor(state, o).applicability !== 'not_applicable');
  const missing = active.filter(o => evaluationFor(state, o).applicability === 'needs_review');
  const prepared = active.filter(o => o.reviewStatus === 'reviewed');
  const changes = active.filter(o => o.reviewStatus === 'changes_requested');
  const first = changes[0] ?? active.find(o => o.reviewStatus === 'not_requested' && evaluationFor(state, o).applicability === 'applicable');
  return <>
    <PageHeading eyebrow="우리 일터를 위한 작은 실천" title="오늘도, 하나씩 챙겨볼까요?" description={`${workplace.name}의 준비 상황과 다음 할 일을 확인하세요.`}><Link className="button secondary" href="/onboarding"><Building2 size={17}/>사업장 정보 확인</Link></PageHeading>
    <section className="overview-grid" aria-label="체험 업무 현황">
      <div className="summary-stat"><span><ClipboardList size={18}/>준비할 업무</span><strong>{active.filter(o => o.reviewStatus !== 'reviewed').length}<small>건</small></strong><p>현재 등록된 체험 업무 기준</p></div>
      <div className="summary-stat"><span><FileCheck2 size={18}/>자료 검토 완료</span><strong>{prepared.length}<small>/ {active.length}건</small></strong><p>현장 이행·외부 접수와 별도</p></div>
      <Link className="summary-stat" href="/onboarding"><span><CircleHelp size={18}/>추가로 확인할 정보</span><strong className="amber-text">{missing.length}<small>건</small></strong><p>답변하면 다음 단계가 보여요 <ArrowUpRight size={15}/></p></Link>
    </section>
    <div className="dashboard-columns"><div>
      <section className="next-action"><div className="next-action-kicker"><span className="status-dot"/> {first ? '여기서 시작해요' : '현재 준비 상황'}</div><h2>{first ? first.title : '진행 중인 업무를 확인해보세요'}</h2><p>{first ? first.reviewStatus === 'changes_requested' ? '도착한 검토 의견을 확인하고 자료를 보완해주세요.' : '샘플 사진을 연결하고 직접 확인한 내용을 남겨보세요.' : '검토 대기와 추가 질문을 확인하면 다음 할 일을 알 수 있어요.'}</p><Link className="button primary" href={first ? `/app/obligations/${first.id}` : '/app/obligations'}>{first ? '자료 준비하기' : '할 일 확인하기'}<ArrowRight size={18}/></Link><span className="next-action-number" aria-hidden="true">01</span></section>
      <section className="panel task-panel"><div className="section-heading"><h2>오늘 살펴볼 일 <span className="count">{active.length}</span></h2><Link className="text-link" href="/app/obligations">전체 보기<ChevronRight size={16}/></Link></div>{active.map(o => <TaskRow key={o.id} item={o} applicability={evaluationFor(state, o).applicability}/>)}</section>
      <div className="coverage-note"><ShieldIcon/><div><strong>확인한 범위를 정확하게 알려드려요.</strong><p>지금 보이는 목록은 체험 업무입니다. 산업안전보건법·중대재해처벌법의 실제 적용 의무는 법령 검토 후 제공할 예정입니다.</p><Link className="text-link" href="/app/settings">제공 범위 확인<ArrowUpRight size={14}/></Link></div></div>
    </div><aside className="dashboard-aside"><section className="panel workplace-card"><p className="small-label">우리 사업장</p><div className="workplace-illustration" aria-hidden="true"><Building2 size={64} strokeWidth={1}/><span className="illustration-ground"/></div><h2>{workplace.name}</h2><p>{workplace.industry}</p><dl><div><dt>직접고용 인원</dt><dd>{workplace.headcount === null ? '확인 필요' : `${workplace.headcount}명`}</dd></div><div><dt>정보 출처</dt><dd>가상 체험 자료</dd></div><div><dt>판정 범위</dt><dd><Badge status="needs_review">법령 검토 전</Badge></dd></div></dl><Link className="button secondary full" href="/onboarding">현장 정보 살펴보기<ArrowRight size={16}/></Link></section>
      <section className="review-note"><span className="avatar large">JH</span><h3>혼자 준비하기 어렵다면</h3><p>자료를 준비한 뒤 검토를 요청해보세요. 보완할 부분과 다음 행동을 함께 확인할 수 있어요.</p><Link className="text-link" href="/app/reviews">검토·보완 살펴보기<ArrowUpRight size={16}/></Link><small>현재는 역할을 전환해 경험하는 가상 검토입니다.</small></section></aside></div>
  </>;
}
function ShieldIcon() { return <span className="coverage-mark">i</span>; }
