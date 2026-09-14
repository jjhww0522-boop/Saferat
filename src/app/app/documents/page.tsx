import Link from 'next/link';
import { memberContext } from '@/server/store';
import { Badge, Empty, PageHeading, dateTime } from '@/components/ui';
export default async function Documents() {
  const { state, workplace } = await memberContext();
  const ids = state.obligations.filter(o => o.workplaceId === workplace.id).map(o => o.id);
  const documents = state.versions.filter(v => ids.includes(v.obligationId));
  return <><PageHeading eyebrow="준비한 자료를 한곳에" title="우리 사업장 자료" description="새 버전을 올려도 이전 자료와 검토 이력은 남아 있어요."/><section className="panel">{documents.length ? documents.toReversed().map(v => <Link className="document-row" href={`/app/obligations/${v.obligationId}`} key={v.id}><div><strong>{state.obligations.find(o => o.id === v.obligationId)?.title} · v{v.number}</strong><p>{dateTime(v.createdAt)} · 자체 서식 · 가상 자료</p></div><Badge status={v.status === 'draft' ? 'needs_review' : 'reviewed'}>{v.status === 'draft' ? '초안' : '내용 확인'}</Badge></Link>) : <Empty title="아직 준비한 자료가 없어요" detail="할 일에서 자체 서식을 만들거나 가상 사진을 첨부해보세요." href="/app/obligations" action="자료 준비할 일 찾기"/>}</section></>;
}
