import Link from 'next/link';
import { opsContext } from '@/server/store';
import { canAccess } from '@/domain/workflow';
import { PageHeading, Empty, Badge, dateTime } from '@/components/ui';
export default async function Ops() {
  const { state, actor } = await opsContext();
  const items = state.obligations.filter(o => canAccess(actor, o.tenantId));
  const reviews = state.reviews.filter(r => items.some(o => o.id === r.obligationId));
  const queued = reviews.filter(r => r.status === 'queued');
  return <><PageHeading eyebrow="JH 검토 공간" title="오늘 확인할 자료" description="배정된 고객의 요청과 재제출 자료를 확인하세요."/><div className="overview-grid"><div className="summary-stat"><span>검토 대기</span><strong>{queued.length}<small>건</small></strong></div><div className="summary-stat"><span>고객 보완 대기</span><strong>{items.filter(o => o.reviewStatus === 'changes_requested').length}<small>건</small></strong></div><div className="summary-stat"><span>검토한 자료 버전</span><strong>{reviews.filter(r => r.status === 'reviewed').length}<small>건</small></strong></div></div>
    <div className="notice">체험용 역할·배정입니다. 실제 인증과 DB 권한 검증은 P2에서 연결합니다. 자료 검토와 법령 규칙 승인은 별개입니다.</div>
    <section className="panel"><div className="section-heading"><h2>검토 대기열</h2><Badge>{queued.length}건</Badge></div>{queued.length ? queued.map(r => {
      const item = items.find(o => o.id === r.obligationId)!;
      return <Link className="document-row" key={r.id} href={`/ops/reviews/${r.id}`}><div><strong>{item.title}</strong><p>{state.workplaces.find(w => w.id === item.workplaceId)?.name} · v{state.versions.find(v => v.id === r.versionId)?.number}</p><small>요청 {dateTime(r.requestedAt)}</small></div><Badge status="queued">검토하기 →</Badge></Link>;
    }) : <Empty title={actor.persona === 'unassigned' ? '배정된 고객이 없습니다' : '새 검토 요청을 기다리고 있어요'} detail={actor.persona === 'unassigned' ? '배정되지 않은 고객 자료는 조회할 수 없습니다.' : 'A 고객 역할에서 자료를 준비하고 검토를 요청해보세요.'}/> }</section>
    {reviews.some(r => r.status !== 'queued') ? <section className="panel"><div className="section-heading"><h2>처리한 요청</h2></div>{reviews.filter(r => r.status !== 'queued').toReversed().map(r => <Link className="document-row" href={`/ops/reviews/${r.id}`} key={r.id}><div><strong>{items.find(o => o.id === r.obligationId)?.title}</strong><p>{r.comment}</p></div><Badge status={r.status}>{r.status === 'reviewed' ? '자료 검토 완료' : '보완 요청'}</Badge></Link>)}</section> : null}</>;
}
