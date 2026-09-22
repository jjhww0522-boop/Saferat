import { demoTaskList } from '@/server/demo-tasks';
import { reviewStatusLabels } from '@/domain/workspace';
import Link from 'next/link';
import { memberContext } from '@/server/store';
import { Badge, Empty, PageHeading, dateTime } from '@/components/ui';
export default async function Reviews() {
  const { state, workplace } = await memberContext();
  const managed = (await demoTaskList(workplace.id)).tasks.filter(t => t.document_id && t.review_status !== 'not_requested');
  managed.sort((a, b) => Number(b.review_status === 'changes_requested') - Number(a.review_status === 'changes_requested'));
  const ids = state.obligations.filter(o => o.workplaceId === workplace.id).map(o => o.id);
  const reviews = state.reviews.filter(r => ids.includes(r.obligationId));
  return <><PageHeading eyebrow="준비부터 보완까지 함께" title="검토·보완" description="내가 보완할 자료와 검토자가 확인 중인 자료를 구분해보세요."/><div className="notice">현재는 가상 검토입니다. 실제 상담·정기 사람 검토·응답시간 약정은 아직 제공하지 않습니다.</div><section className="panel">{managed.map(t => <Link className="document-row" key={t.id} href={`/app/tasks/${t.id}#review-history`}><strong>{t.title}</strong><span>{reviewStatusLabels[t.review_status]}</span></Link>)}{reviews.length ? reviews.toReversed().map(r => <Link className="document-row" href={`/app/obligations/${r.obligationId}`} key={r.id}><div><strong>{state.obligations.find(o => o.id === r.obligationId)?.title}</strong><p>{r.comment || '검토자가 확인할 차례예요.'}</p><small>요청 {dateTime(r.requestedAt)} · v{state.versions.find(v => v.id === r.versionId)?.number}</small></div><Badge status={r.status}>{{ queued: '검토 대기', changes_requested: '내 보완 대기', reviewed: '자료 검토 완료' }[r.status]}</Badge></Link>) : managed.length ? null : <Empty title="검토를 요청한 자료가 없어요" detail="자료를 준비하고 내용을 확인하면 검토를 요청할 수 있어요." href="/app/map" action="지도에서 할 일 살펴보기"/>}</section></>;
}
