import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { workspacePageClient } from '@/server/supabase';
import { memberContext } from '@/server/store';
import { workspaceRepository } from '@/adapters/workspace';
import { demoTaskEntry, demoTaskList } from '@/server/demo-tasks';
import { startTask, linkTaskDocument } from '@/server/task-actions';
import { taskDefinition, type TaskRecord } from '@/domain/tasks';
import { isSetupDefinition } from '@/domain/workplace-profile';
import { WorkspaceForm } from './workspace-form';
import { TaskRecordForm } from './task-forms';
import { DocumentPanel } from './document-panel';
import { LegalBasis } from './legal-basis';
import { TaskGuidance } from './task-guidance';
import { journeyState } from '@/server/journey-state';
import { journeyGroup } from '@/domain/journey';
import { TaskCycleHistory } from './task-cycle-history';
import type { TaskActionSource } from '@/domain/task-action-source';

export type TaskQuery = { definition?: string; workplace?: string; return?: string; version?: string; step?: string; linkPage?: string };
function returnPath(demo: boolean, value?: string) { const base = demo ? '/app' : '/workspace'; return value === base || value?.startsWith(`${base}?`) || value === `${base}/map` || value?.startsWith(`${base}/map?`) ? value : base; }
export async function TaskDetail({ id, demo, query }: { id: string; demo: boolean; query: TaskQuery }) {
  const base = demo ? '/app' : '/workspace', back = returnPath(demo, query.return);
  if (id === 'new') {
    const def = taskDefinition(query.definition ?? '');
    const repo = demo ? null : workspaceRepository((await workspacePageClient()).client);
    const workplaces = demo ? (await memberContext()).workplaces : await repo!.workplaces();
    const workplace = workplaces.find(w => w.id === query.workplace);
    if (!def || !workplace) notFound();
    const profile = demo ? (await demoTaskList(workplace.id)).profile : await repo!.profile(workplace.id);
    if (!profile?.confirmed_at || isSetupDefinition(def.id)) redirect(`${base}?setup=1&workplace=${encodeURIComponent(workplace.id)}`);
    return <div className="task-detail"><Link className="back-link" href={back}>{back.includes('/map') ? '← 전체 지도' : '← 업무 목록'}</Link><header className="task-detail-heading"><p className="eyebrow">{def.template === 'common' ? '적용 확인이 필요한 후보' : '직접 작성하는 자체 서식'}</p><h1>{def.title}</h1><p>{def.id === 'REVIEW-003' ? '살펴볼 작업과 장소부터 적어볼까요? 모르는 내용은 나중에 보완할 수 있어요.' : '확인한 사실을 기록하고, 증빙과 보완 이력을 함께 정리해요.'}</p></header><section className="record-section task-editor"><h2 className="sr-only">우리 사업장에서 시작하기</h2><WorkspaceForm action={startTask.bind(null, demo)}><input name="return" type="hidden" value={back}/><input name="definition" type="hidden" value={def.id}/><input name="workplace" type="hidden" value={workplace.id}/>{!demo ? <label className="checkbox-label"><input name="sensitive" type="checkbox" defaultChecked={def.category === 'health' || def.category === 'incident'}/>건강·사고 등 별도 권한이 필요한 자료를 기록합니다</label> : null}<p className="helper">‘관리 시작’은 기록할 항목을 추가해요. 법적 적용 여부는 별도 확인이 필요해요.</p><button className="button primary">관리 시작</button></WorkspaceForm></section><details className="task-context-help"><summary>무엇을 준비하면 되나요?</summary><TaskGuidance definition={def}/></details><LegalBasis id={def.id}/></div>;
  }
  let task: TaskRecord, content: string | null = null, documentRevision: number | null = null, status = 'not_requested', canWrite = true, latestVersion: string | undefined;
  let existing: { id: string; title: string }[] = [];
  let cycles: TaskRecord[] = [], cycleSources: TaskActionSource[] = [];
  const requestedPage = Number(query.linkPage);
  const linkPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  let linkTotal = 0;
  if (demo) {
    await memberContext();
    let result;
    try { result = await demoTaskEntry(id, true); } catch { notFound(); }
    task = result.entry.task;
    content = result.entry.document?.versions[0]?.content ?? null;
    documentRevision = result.entry.document?.revision ?? null;
    status = result.entry.document?.review_status ?? status;
    latestVersion = result.entry.document?.versions[0]?.id;
    if (task.definition_id === 'REVIEW-003') {
      const history = await demoTaskList(task.workplace_id);
      cycles = history.tasks.filter(item => item.definition_id === task.definition_id);
      cycleSources = history.sources;
    }
  } else {
    const { client } = await workspacePageClient(), repo = workspaceRepository(client);
    const found = await repo.task(id);
    if (!found) notFound();
    task = found;
    const { data: writable, error } = await client.rpc('safety_task_can_write', { task: id });
    if (error) throw error;
    canWrite = writable === true;
    if (task.document_id) {
      const detail = await repo.detail(task.document_id);
      if (!detail) notFound();
      const version = await repo.readVersion(detail.versions[0].id);
      content = version.content; documentRevision = detail.document.revision; status = detail.document.review_status; latestVersion = version.id;
    } else if (canWrite && (task.cycle_number ?? 1) === 1) {
      const [documents, tasks] = await Promise.all([repo.documentPage({ workplace: task.workplace_id, page: linkPage }), repo.tasks(task.workplace_id)]);
      linkTotal = documents.total;
      existing = documents.items.filter(d => d.sensitive === task.sensitive && !tasks.some(t => t.document_id === d.id));
    }
    if (task.definition_id === 'REVIEW-003') {
      const [tasks, sources] = await Promise.all([repo.tasks(task.workplace_id), repo.taskActionSources(task.workplace_id)]);
      cycles = tasks.filter(item => item.definition_id === task.definition_id);
      cycleSources = sources;
    }
  }
  const definition = taskDefinition(task.definition_id);
  if (!definition) notFound();
  const old = !!query.version && query.version !== latestVersion;
  const risk = definition.id === 'REVIEW-003';
  const cursor = !old && definition.id === 'REVIEW-003' ? await journeyState(demo, task.workplace_id, task.id) : null;
  return <div className="task-detail"><nav className="task-detail-nav" aria-label="전체 지도에서 현재 위치"><Link className="back-link" href={back}>{back.includes('/map') ? '← 전체 지도' : '← 업무 목록'}</Link><Link href={`${base}/map?workplace=${encodeURIComponent(task.workplace_id)}`}>{journeyGroup(definition.id).title} · 전체 지도</Link></nav><header className="task-detail-heading"><h1>{task.title}</h1><p className="helper">{definition.template === 'common' ? '적용 확인 필요' : '자체 서식'}{risk ? <> · {task.cycle_number ?? 1}회차 <a className="text-link" href="#task-cycle-records">회차와 지난 기록 보기</a></> : ' · 확인한 사실부터 기록해주세요'}</p></header>{task.definition_version !== definition.version ? <p className="notice">등록 당시 후보 버전 {task.definition_version}입니다. 현재 안내와 달라진 부분을 확인해주세요.</p> : null}
    {risk && (task.cycle_number ?? 1) > 1 ? <p className="risk-attention risk-status-summary">새 회차와 별도로 지난 조치도 확인해주세요. <a href="#task-cycle-records">지난 기록·남은 조치 보기</a></p> : null}
    {canWrite && !old ? <section className="record-section task-editor" id="task-editor"><h2 className={risk ? 'sr-only' : undefined}>{content ? '내용 확인·보완' : '확인한 내용부터 기록하세요'}</h2><TaskRecordForm demo={demo} task={task} definition={definition} content={content} documentRevision={documentRevision} disabled={status === 'queued'} step={query.step} cursor={cursor}/></section> : null}
    <details className="task-context-help"><summary>업무 안내·적용 조건 보기</summary><p>{definition.condition}</p>{!old && !risk ? <TaskGuidance definition={definition}/> : null}</details>
    {risk ? <div id="task-cycle-records"><TaskCycleHistory task={task} cycles={cycles} sources={cycleSources} demo={demo} canWrite={canWrite && !old}/></div> : null}
    {!task.document_id && canWrite && !demo && linkTotal > 0 ? <details className="record-section" open={!!query.linkPage}><summary>이미 작성한 자료 연결</summary>{existing.length ? <WorkspaceForm action={linkTaskDocument.bind(null, task.id)}><input type="hidden" name="task_revision" value={task.revision}/><label>같은 현장의 기존 자료<select name="document" required>{existing.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label><p className="helper">이전 버전과 검토 이력을 그대로 연결합니다. 이미 연결된 자료는 덮어쓰지 않습니다.</p><button className="button secondary">기존 자료 연결</button></WorkspaceForm> : <p>이 페이지에는 연결할 수 있는 자료가 없어요. 다른 페이지를 확인해주세요.</p>}<nav aria-label="연결할 자료 페이지">{linkPage > 1 ? <Link className="button secondary" href={`${base}/tasks/${id}?linkPage=${linkPage - 1}`}>이전 자료</Link> : null}{linkPage * 25 < linkTotal ? <Link className="button secondary" href={`${base}/tasks/${id}?linkPage=${linkPage + 1}`}>다음 자료</Link> : null}</nav><p className="helper">같은 현장·민감자료 구분의 자료 중 다른 업무에 연결되지 않은 자료만 표시해요.</p></details> : null}
    {task.document_id ? <DocumentPanel id={task.document_id} demo={demo} versionId={query.version} path={`${base}/tasks/${id}?return=${encodeURIComponent(back)}`}/> : <p className="notice">확인 답변이나 메모를 저장하면 자료 버전이 만들어지고 증빙·검토·수행 기록을 이어갈 수 있습니다.</p>}<LegalBasis id={definition.id}/></div>;
}
