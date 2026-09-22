import Link from 'next/link';
import { notFound } from 'next/navigation';
import { opsContext, demoOperatorContext } from '@/server/store';
import { Shell } from '@/components/shell';
import { OperatorShell } from '@/components/operator-shell';
import { DocumentPanel } from '@/components/document-panel';
import { scopedObligation } from '@/domain/workflow';
import { updateObligation } from '@/server/actions';
import { PageHeading, Badge, dateTime } from '@/components/ui';
import { DocumentPreview } from '@/components/document-preview';
import { ActionForm } from '@/components/action-form';
export default async function ReviewDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const version = (await searchParams).version;
  const { id } = await params;
  const demo = await demoOperatorContext();
  if (!demo) return <OperatorShell><Link className="back-link" href="/ops">← 검토 대기</Link><DocumentPanel id={id} demo={false} versionId={version} operator path={`/ops/reviews/${id}`}/></OperatorShell>;
  if (id.startsWith('demo-doc-')) return <Shell operator><Link className="back-link" href="/ops">← 검토 대기</Link><DocumentPanel id={id} demo versionId={version} operator path={`/ops/reviews/${id}`}/></Shell>;
  return <Shell operator><LegacyReviewDetail params={params}/></Shell>;
}
async function LegacyReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { state, actor } = await opsContext();
  const review = state.reviews.find(r => r.id === id);
  if (!review) notFound();
  let item;
  try { item = scopedObligation(state, actor, review.obligationId); } catch { notFound(); }
  const version = state.versions.find(v => v.id === review.versionId)!;
  return <><Link className="back-link" href="/ops">← 검토 대기열</Link><PageHeading eyebrow="배정 자료 검토" title={item.title} description={`${state.workplaces.find(w => w.id === item.workplaceId)?.name} · 검토 대상 v${version.number} · 요청 ${dateTime(review.requestedAt)}`}/>
    {item.versionIds.at(-1) !== version.id ? <div className="notice amber">요청 이후 새 자료가 작성되었습니다. 이번 의견은 v{version.number}에만 연결되며 새 버전에 자동 적용되지 않습니다.</div> : null}
    <div className="detail-columns"><div><DocumentPreview version={version}/><section className="panel panel-padding"><h2>실제 수행 기록</h2><p>{item.activity.status === 'reported_done' ? `${item.activity.performedAt} · ${item.activity.note}` : '아직 수행 기록이 없습니다.'}</p><p className="helper">사용자 입력 기록입니다. 실제 수행 여부는 별도 확인이 필요합니다.</p></section>{state.versions.filter(v => v.obligationId === item.id && v.number < version.number).map(v => <details className="panel panel-padding" key={v.id}><summary>이전 자료 v{v.number} 비교</summary><DocumentPreview version={v}/></details>)}</div>
      <aside className="panel panel-padding review-form"><h2>검토 의견 남기기</h2><p className="muted">자료의 어느 부분을 확인했고, 고객이 다음에 무엇을 해야 하는지 구체적으로 적어주세요.</p>
      {review.status === 'queued' ? <ActionForm action={updateObligation.bind(null, item.id)}><input type="hidden" name="revision" value={item.revision}/><input type="hidden" name="command" value="review"/><input type="hidden" name="reviewId" value={review.id}/><label>확인 항목·자료 위치<input name="location" required maxLength={2000} placeholder="예: v1 확인 위치·관찰 내용"/></label><label>고객에게 전달할 의견<textarea name="comment" rows={5} maxLength={2000} required placeholder="부족한 항목, 필요한 자료, 다음 행동을 입력하세요. 법적 근거를 검토하지 않은 의견은 권고·확인 요청으로 적어주세요."/></label><label>내부 메모 · 고객 비공개<textarea name="internalNote" rows={2} maxLength={2000} placeholder="고객에게 전달하지 않을 업무 메모"/></label><div className="button-row"><button className="button amber-button" name="decision" value="changes_requested">보완 요청 보내기</button><button className="button primary" name="decision" value="reviewed">자료 검토 완료</button></div><p className="helper">검토 완료는 이 자료 버전에 한정됩니다. 법적 적합·현장 이행·기관 접수를 확정하지 않습니다.</p></ActionForm> : <div><Badge status={review.status}>{review.status === 'reviewed' ? '자료 검토 완료' : '보완 요청'}</Badge><h3>{review.location}</h3><p className="preserve-lines">{review.comment}</p><p className="helper">{review.reviewer} · {dateTime(review.reviewedAt!)}</p><details><summary>내부 메모 · 고객 비공개</summary><p>{review.internalNote || '메모 없음'}</p></details></div>}
      <div className="notice">회원은 본인의 작업 공간에서 전달된 의견을 확인하고 새 버전을 제출할 수 있습니다.</div></aside></div></>;
}
