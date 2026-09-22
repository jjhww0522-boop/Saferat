import Link from 'next/link';
import { notFound } from 'next/navigation';
import { workspacePageClient, operatorPageClient } from '@/server/supabase';
import { workspaceRepository } from '@/adapters/workspace';
import { demoTaskEntry } from '@/server/demo-tasks';
import { demoDocumentAction } from '@/server/task-actions';
import { updateDocument } from '@/server/workspace-actions';
import { fileStatusLabels, reviewStatusLabels, uuid } from '@/domain/workspace';
import { WorkspaceForm } from './workspace-form';
import { EvidenceUpload } from './evidence-upload';
import { EvidenceRetry } from './evidence-retry';
import { StoredTaskContent } from './task-forms';
import { parseTaskContent, taskDefinition } from '@/domain/tasks';
import { taskGuidance } from '@/domain/task-guidance';
import { JourneyHelp } from './journey-help';
import { PageHeading } from './ui';

export async function DocumentPanel({ id, demo, operator = false, versionId, path, showEditor = false }: { id: string; demo: boolean; operator?: boolean; versionId?: string; path: string; showEditor?: boolean }) {
  let model;
  if (demo) {
    let result;
    try { result = await demoTaskEntry(id); } catch { notFound(); }
    const { entry, ctx } = result;
    if ((operator && ctx.actor.persona !== 'reviewer') || (!operator && !ctx.actor.tenantId)) notFound();
    const document = entry.document;
    if (!document) notFound();
    const version = versionId ? document.versions.find(v => v.id === versionId) : document.versions[0];
    if (!version) notFound();
    model = { document, version, versions: document.versions, reviews: document.reviews, activities: document.activities, files: [], write: !operator, review: operator, fetchedAt: 0 };
  } else {
    if (!uuid.safeParse(id).success) notFound();
    const { client } = operator ? await operatorPageClient() : await workspacePageClient();
    const repo = workspaceRepository(client), detail = await repo.detail(id);
    if (!detail) notFound();
    const metadata = versionId ? detail.versions.find(v => v.id === versionId) : detail.versions[0];
    if (!metadata) notFound();
    const version = await repo.readVersion(metadata.id);
    model = { ...detail, version, write: !operator && detail.permissions.write, review: operator && detail.permissions.review };
  }
  const { document, version, versions, reviews, activities, files } = model;
  const action = demo ? demoDocumentAction.bind(null, id) : updateDocument.bind(null, id);
  const latest = version.id === versions[0]?.id;
  const definition = taskDefinition(parseTaskContent(version.content)?.definition ?? '');
  const guide = definition ? taskGuidance(definition) : null;
  const canExportRisk = !!parseTaskContent(version.content)?.risk;
  const exportPath = `/api/documents/${encodeURIComponent(id)}/export?version=${encodeURIComponent(version.id)}`;
  const pending = reviews.find(r => r.status === 'queued' && r.version_id === version.id);
  const canRetryFiles = !demo && model.write && latest && !version.confirmed_at && document.review_status !== 'queued' && files.some(f => f.version_id === version.id && (f.state === 'failed' || f.state === 'rejected' || (f.state === 'reserved' && f.created_at && Date.parse(f.created_at) <= model.fetchedAt - 10 * 60 * 1000)));
  const revision = <input name="revision" type="hidden" value={document.revision}/>;
  return <div className="document-sections">{operator || showEditor ? <PageHeading eyebrow={operator ? "배정 자료 검토" : "보관한 자료"} title={document.title} description="자료 버전과 검토·수행 기록을 각각 확인하세요."/> : null}<div className="record-statuses"><span>자료: {reviewStatusLabels[document.review_status]}</span><span>수행: {activities.length ? '직접 기록 있음' : '수행 기록 없음'}</span><span>기관 제출·접수: 미확인</span></div>
    {!operator ? <section className="journey-document-next" aria-label="자료 준비의 다음 행동"><p className="eyebrow">저장한 뒤, 이렇게 이어가세요</p><h3>{!latest ? '이전 기록과 지금의 변경 내용을 비교해요' : !version.confirmed_at ? '실제 자료를 연결하고 내용을 확인해요' : pending ? '검토를 기다리며 현장 조치를 이어가세요' : '남은 보완과 실제 수행을 확인해요'}</h3><p>{guide?.goal ?? '직접 확인한 내용과 관련 자료를 함께 보관해 다시 찾을 수 있게 해요.'}</p><nav className="journey-document-links" aria-label="자료 준비 순서"><a href="#stored-record">1. 저장 내용 확인</a><a href="#evidence-records">2. 증빙 연결</a><a href="#review-history">3. 검토·보완</a><a href="#activity-records">실제 수행 기록</a></nav></section> : null}
    <section className="record-section" id="stored-record"><div className="section-heading"><h2>저장된 자료 <span className="count">v{version.number}</span></h2><span className="muted">{version.confirmed_at ? '작성자 내용 확인 완료' : '초안 · 내용 확인 전'}</span></div><p className="helper">아래는 저장된 v{version.number}입니다. 입력 영역에서 수정 중인 내용은 포함하지 않습니다.</p><details className="saved-content" open={operator || !latest || showEditor || document.review_status === 'queued'}><summary>저장된 v{version.number} 내용 펼쳐보기</summary><StoredTaskContent content={version.content}/></details><details className="version-history" open={!latest}><summary>버전 이력 · {versions.length}개</summary><nav className="version-links" aria-label="자료 버전">{versions.map(v => <Link key={v.id} prefetch={false} aria-current={v.id === version.id ? 'page' : undefined} href={`${path}${path.includes('?') ? '&' : '?'}version=${v.id}`}>v{v.number}{v.id === version.id ? ' · 현재 보기' : ''}</Link>)}</nav></details>
    {canExportRisk ? <div className="risk-export"><h3>이 버전 내려받아 보관하기</h3><p className="helper">저장된 v{version.number}만 포함합니다. 위에서 수정 중인 내용은 먼저 임시 저장해주세요. 내려받은 파일을 열어 확인하고 증빙 원본과 함께 보관하세요.</p><div className="version-links"><a className="button secondary" href={`${exportPath}&format=html`} download>v{version.number} 인쇄용 파일</a><a className="button secondary" href={`${exportPath}&format=json`} download>v{version.number} 원본 기록(JSON)</a></div><p className="helper">인쇄용 파일을 열고 브라우저 인쇄 메뉴에서 PDF로 저장할 수 있습니다. 첨부파일 원본은 별도로 내려받으세요. 다운로드만으로 이행·기관 제출·장기 보존이 완료되지는 않습니다.</p></div> : null}
    {model.write && latest ? <WorkspaceForm action={action}>{revision}<input name="version" type="hidden" value={version.id}/>{!version.confirmed_at ? <button name="command" value="confirm" className="button secondary">v{version.number} 내용 확인</button> : !reviews.some(r => r.version_id === version.id) ? <button name="command" value="submit" className="button primary">검토 요청</button> : <p className="notice">이 버전은 검토 요청한 자료입니다.</p>}</WorkspaceForm> : null}</section>
    <section className="record-section" id="evidence-records"><h2>증빙 자료</h2><p>지금 보는 <strong>{document.title} · v{version.number}</strong>에 연결된 자료예요.</p>{guide ? <div className="journey-document-purpose"><h3>무엇을 남기면 도움이 될까요?</h3><ul>{guide.evidence.map(item => <li key={item}>{item}</li>)}</ul><JourneyHelp title="자료를 연결하기 전에 확인해요"><p>이 자료가 어떤 작업·사람·날짜의 사실을 보여주는지 확인하세요. 새 활동의 증빙으로 이전 사진이나 참석 기록을 자동 복사하지 않아요.</p><p>파일 검사 통과와 증빙 내용의 충분함은 서로 달라요. 필요한 사실이 담겼는지 직접 확인해주세요.</p></JourneyHelp></div> : null}{demo ? <><p className="helper">체험에서는 실제 파일을 받지 않습니다. 가상 도식만 연결할 수 있습니다.</p>{'sample' in version && version.sample ? <figure className="demo-evidence"><div role="img" aria-label="실제 현장 사진이 아닌 가상 통로 도식">통로 ── □ 물품 ── 출입구</div><figcaption>가상 샘플 · 실제 현장 확인 자료가 아님</figcaption></figure> : null}{model.write && latest && !version.confirmed_at ? <WorkspaceForm action={action}>{revision}<button name="command" value="sample" className="button secondary">가상 사진 샘플 연결</button></WorkspaceForm> : null}</> : <>{files.filter(f => f.version_id === version.id).map(f => <div className="document-row" key={f.id}><span>{f.filename} · {fileStatusLabels[f.state]}</span>{f.state === 'clean' ? <a className="button secondary" href={`/api/files/${f.id}`}>다운로드</a> : null}</div>)}{!files.some(f => f.version_id === version.id) ? <p className="notice">이 버전에 연결한 파일이 없어요. 필요한 증빙이 따로 있다면 연결해주세요.</p> : null}{model.write && latest && !version.confirmed_at ? <EvidenceUpload version={version.id}/> : null}</>}</section>
    {!demo && model.write && latest && !version.confirmed_at && files.some(f => f.version_id === version.id && f.state === 'reserved') ? <div className="notice"><h3>업로드 결과를 먼저 확인해주세요</h3><ul>{files.filter(f => f.version_id === version.id && f.state === 'reserved').map(f => <li key={f.id}>{f.filename}{f.created_at ? <> · 저장 시작 <time dateTime={f.created_at}>{new Date(f.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</time></> : null}</li>)}</ul><p>저장 시작 후 10분이 지나도 업로드 대기이면 ‘파일 목록 새로고침’을 누르세요. ‘새 버전에서 파일 다시 연결’로 이어갈 수 있어요. 10분은 서비스 재시도 기준입니다. 상태를 확인하기 전에 같은 파일을 다시 올리면 중복될 수 있습니다.</p></div> : null}
    {canRetryFiles ? <EvidenceRetry version={version.id} number={version.number} revision={document.revision}/> : null}
    <section className="record-section" id="review-history"><h2>검토·보완 이력</h2>{reviews.length ? reviews.map(r => <div className={`feedback review-${r.status}`} key={r.id}><strong>v{versions.find(v => v.id === r.version_id)?.number} · {reviewStatusLabels[r.status]}</strong><p className="preserve-lines">{r.location}{r.location ? ' — ' : ''}{r.comment || (r.status === 'queued' ? '검토를 기다리고 있습니다.' : '추가 의견이 없습니다.')}</p></div>) : <p className="muted">아직 검토를 요청하지 않았습니다.</p>}
    {model.review && pending ? <WorkspaceForm action={action}>{revision}<input name="command" type="hidden" value="review"/><input name="review" type="hidden" value={pending.id}/><label>검토 결과<select name="decision"><option value="changes_requested">보완 요청</option><option value="reviewed">자료 검토 완료</option></select></label><label>보완 위치<input name="location" maxLength={200}/></label><label>회원에게 보이는 검토 의견<textarea name="comment" maxLength={4000}/></label><label>검토자 내부 메모<textarea name="internal_note" maxLength={4000}/></label><button className="button primary">검토 결과 저장</button></WorkspaceForm> : null}</section>
    {showEditor && model.write && !demo && document.review_status !== 'queued' ? <section className="record-section"><h2>새 버전 작성</h2><WorkspaceForm action={action}>{revision}<input type="hidden" name="command" value="version"/><label>보완한 내용<textarea name="content" rows={6} defaultValue={version.content} maxLength={20000} required/></label><button className="button primary">새 버전 저장</button></WorkspaceForm></section> : null}
    <section className="record-section" id="activity-records"><h2>실제 수행 기록</h2><p className="helper">문서 전체의 수행 이력이에요. 특정 평가 회차의 완료를 자동으로 뜻하지 않아요.</p>{activities.length ? activities.map(a => <div className="activity-record" key={a.id}><strong>{a.performed_on}{a.corrects_id ? ' · 정정 기록' : ''}</strong><p className="preserve-lines">{a.note}</p></div>) : <p className="muted">수행 기록 없음</p>}{model.write ? <WorkspaceForm action={action}>{revision}<input name="command" type="hidden" value="activity"/><div className="form-grid"><label>실제 수행일<input name="performed_on" type="date" required/></label><label>정정할 기록<select name="corrects"><option value="">새 수행 기록</option>{activities.map(a => <option key={a.id} value={a.id}>{a.performed_on} · {a.note.slice(0, 30)}</option>)}</select></label></div><label>직접 확인한 수행 내용<textarea name="note" maxLength={2000} required/></label><button className="button secondary">수행 기록 저장</button></WorkspaceForm> : null}</section>
  </div>;
}
