import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FilePlus2, ImagePlus, ClipboardCheck } from 'lucide-react';
import { memberContext } from '@/server/store';
import { updateObligation } from '@/server/actions';
import { scopedObligation, evaluationFor } from '@/domain/workflow';
import { ActionForm } from '@/components/action-form';
import { DocumentPreview } from '@/components/document-preview';
import { PageHeading, Badge, reviewLabels, dateTime } from '@/components/ui';

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await memberContext();
  let item;
  try { item = scopedObligation(ctx.state, ctx.actor, id); } catch { notFound(); }
  const { state } = ctx;
  const targetWorkplace = state.workplaces.find(w => w.id === item.workplaceId)!;
  const currentSnapshot = state.snapshots.find(s => s.id === targetWorkplace.snapshotIds.at(-1))!;
  const addressFact = currentSnapshot.facts.address;
  const confirmedLocation = addressFact?.confirmed && typeof addressFact.value === 'string' ? addressFact.value : '';
  const evaluation = evaluationFor(state, item);
  const versions = state.versions.filter(v => item.versionIds.includes(v.id));
  const latest = versions.at(-1);
  const reviews = state.reviews.filter(r => item.reviewIds.includes(r.id));
  const action = updateObligation.bind(null, id);
  const missing = evaluation.applicability === 'needs_review';
  return <><Link className="back-link" href="/app/obligations"><ArrowLeft size={16}/>할 일 목록</Link><PageHeading eyebrow="체험 업무 · 자체 기록" title={item.title} description={item.description}><Badge status={item.reviewStatus}>{reviewLabels[item.reviewStatus]}</Badge></PageHeading>
    <div className="detail-summary"><div><span>담당자</span><strong>{item.owner}</strong></div><div><span>업무 목표일</span><strong>{item.targetDate ?? '설정 전'}</strong></div><div><span>실제 수행</span><strong>{item.activity.status === 'reported_done' ? '사용자 수행 기록 있음' : '수행 기록 없음'}</strong></div><div><span>외부 제출·접수</span><strong>필요 여부·접수 미확인</strong></div></div>
    <details className="legal-details"><summary>왜 이 업무가 보이나요? · 체험 조건과 추가 질문</summary><p>규칙: {evaluation.ruleId} v{evaluation.ruleVersion} · 데모 — 실제 법적 판단에 사용 불가</p><p>결과: {{ applicable: '체험 조건 해당', not_applicable: '체험 조건 비해당', needs_review: '확인 필요' }[evaluation.applicability]}</p><p>사업장 정보에서 선택한 체험 항목을 기준으로 표시합니다. 실제 법령 근거·법정 기한은 아직 검토되지 않았습니다.</p>{missing ? <p>필요한 정보: {evaluation.missingFacts.map(k => ({ photoCheck: '사진 점검 여부', training: '교육 기록 여부', contractor: '다른 업체와 함께 작업하는지' }[k] ?? k)).join(', ') || '규칙 검토'}</p> : null}<Link className="text-link" href="/onboarding">사업장 정보 수정·확인</Link></details>
    {evaluation.applicability !== 'applicable' ? <div className="notice amber"><h2>{missing ? '먼저 사업장 정보를 확인해주세요' : '현재 체험 조건에는 해당하지 않습니다'}</h2><p>정보가 달라졌다면 수정 후 다시 확인할 수 있습니다. 기존 자료와 이력은 보존합니다.</p><Link href="/onboarding" className="button secondary">필요한 정보 확인하기</Link></div> : null}
    {reviews.filter(r => r.comment).map(r => <section className={`feedback ${r.status === 'changes_requested' ? 'amber' : ''}`} key={r.id}><Badge status={r.status}>{r.status === 'changes_requested' ? '보완 요청' : '자료 검토 의견'}</Badge><h2>{r.location}</h2><p className="preserve-lines">{r.comment}</p><small>대상 v{versions.find(v => v.id === r.versionId)?.number} · {r.reviewer} · {dateTime(r.reviewedAt!)} · 새 자료는 새 버전으로 제출해주세요.</small></section>)}
    <div className="detail-columns"><div>
      <section className="panel panel-padding"><div className="section-heading flush"><h2><FilePlus2 size={20}/>1. 자료 준비</h2></div><p className="muted">확인된 내용만 입력하세요. 비워둔 담당자·일정·예산은 ‘결정 필요’로 남깁니다.</p>
        <ActionForm action={action}><input type="hidden" name="revision" value={item.revision}/><input type="hidden" name="command" value="document"/><div className="form-grid"><label>확인 위치<input name="location" maxLength={2000} defaultValue={latest?.fields.location ?? confirmedLocation} placeholder="예: 가상 시설 1층 통로"/></label><label>담당자<input name="owner" maxLength={2000} defaultValue={latest?.fields.owner ?? ''} placeholder="미정이면 비워두세요"/></label><label className="span-2">직접 확인한 내용<textarea name="observation" maxLength={2000} defaultValue={latest?.fields.observation ?? ''} placeholder="사진에서 보이는 내용과 현장에서 확인한 내용을 구분해주세요" rows={3}/></label><label>예정 일정<input name="schedule" maxLength={2000} placeholder="확인한 일정만 입력"/></label><label>예산<input name="budget" maxLength={2000} placeholder="결정 전이면 비워두세요"/></label></div><div className="button-row"><button className="button primary" name="kind" value="draft"><FilePlus2 size={17}/>자체 서식 초안 만들기</button><button className="button secondary" name="kind" value="sample"><ImagePlus size={17}/>샘플 사진 첨부</button></div><p className="helper">실제 파일 업로드 대신 제공된 가상 샘플만 사용합니다.</p></ActionForm>
      </section>
      <section className="panel panel-padding"><div className="section-heading flush"><h2><ClipboardCheck size={20}/>2. 수행 내용 기록</h2></div><p className="muted">자료 작성과 실제 수행은 다릅니다. 체험할 수행 내용을 직접 입력하세요.</p>{item.activity.status === 'reported_done' ? <div className="notice"><strong>{item.activity.performedAt} · 사용자 수행 기록</strong><p>{item.activity.note}</p><small>실제 이행 검증 전</small></div> : null}<ActionForm action={action}><input type="hidden" name="revision" value={item.revision}/><input type="hidden" name="command" value="activity"/><label>수행일<input name="date" type="date" required/></label><label>수행·참여 확인 내용<textarea name="note" required maxLength={2000} rows={3} placeholder="대상, 직접 한 일, 확인할 사항을 적어주세요"/></label><button className="button secondary">수행 내용 저장</button></ActionForm></section>
      <section className="panel panel-padding"><h2>변경·검토 이력</h2>{state.events.filter(e => e.obligationId === id).length ? <ol className="timeline">{state.events.filter(e => e.obligationId === id).toReversed().map(e => <li key={e.id}><strong>{e.message}</strong>{e.activityRecord ? <p className="helper">{e.activityRecord.performedAt} · {e.activityRecord.note}</p> : null}<span>{dateTime(e.at)} · {e.actor}</span></li>)}</ol> : <p className="muted">자료를 준비하면 이력이 차례대로 남습니다.</p>}</section>
    </div><aside>
      {latest ? <><DocumentPreview version={latest}/><section className="panel panel-padding"><h2>3. 내용 확인·검토 요청</h2><p className="muted">현재 자료 v{latest.number}를 확인하고 검토자에게 전달하세요.</p><ActionForm action={action}><input type="hidden" name="revision" value={item.revision}/><input type="hidden" name="versionId" value={latest.id}/>{latest.status === 'draft' ? <button className="button secondary full" name="command" value="confirm">v{latest.number} 내용 확인</button> : !reviews.some(r => r.versionId === latest.id) ? <button className="button primary full" name="command" value="submit">검토 요청</button> : <p className="notice">이 버전은 검토 요청한 자료입니다. 보완할 내용은 새 버전으로 준비해주세요.</p>}</ActionForm><p className="helper">요청한 자료의 검토·보완 이력은 이 업무에서 확인할 수 있습니다.</p></section></> : <div className="empty document-empty"><FilePlus2 size={36} strokeWidth={1.2}/><h3>자료가 준비되면<br/>여기에서 확인할 수 있어요.</h3><p>자체 서식 초안 또는 가상 사진을<br/>먼저 추가해주세요.</p></div>}
      {versions.length > 1 ? <section className="panel panel-padding"><h2>이전 자료</h2>{versions.slice(0, -1).toReversed().map(v => <details key={v.id}><summary>v{v.number} · {dateTime(v.createdAt)}</summary><DocumentPreview version={v}/></details>)}</section> : null}
    </aside></div></>;
}
