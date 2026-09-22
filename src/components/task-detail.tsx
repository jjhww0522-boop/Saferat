import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { workspacePageClient } from '@/server/supabase';
import { memberContext } from '@/server/store';
import { workspaceRepository } from '@/adapters/workspace';
import { demoTaskEntry, demoTaskList } from '@/server/demo-tasks';
import { startTask, linkTaskDocument } from '@/server/task-actions';
import { taskDefinition, type TaskRecord } from '@/domain/tasks';
import { isSetupDefinition } from '@/domain/workplace-profile';
import { PageHeading } from './ui';
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
    return <><Link className="back-link" href={back}>{back.includes('/map') ? '← 전체 지도' : '← 업무 목록'}</Link><PageHeading eyebrow={def.template === 'common' ? '적용 확인이 필요한 후보' : '직접 작성하는 자체 서식'} title={def.title} description="해야 할 일을 살펴보고 확인한 사실부터 기록하세요."/><TaskGuidance definition={def}/><section className="record-section"><h2>우리 사업장에서 시작하기</h2>{def.id === 'REVIEW-003' ? <p>준비 → 근로자 참여 → 위험요인 찾기 → 위험 판단 → 개선 실행 → 재확인 → 공유·보관을 단계별로 안내합니다. 한 번에 다 채우지 않아도 됩니다.</p> : null}<WorkspaceForm action={startTask.bind(null, demo)}><input name="return" type="hidden" value={back}/><input name="definition" type="hidden" value={def.id}/><input name="workplace" type="hidden" value={workplace.id}/>{!demo ? <label className="checkbox-label"><input name="sensitive" type="checkbox" defaultChecked={def.category === 'health' || def.category === 'incident'}/>건강·사고 등 별도 권한이 필요한 자료를 기록합니다</label> : null}<p className="helper">‘관리 시작’은 이 사업장에서 기록할 항목을 추가하는 동작입니다. 법적 적용 여부는 확정되지 않습니다.</p><button className="button primary">관리 시작</button></WorkspaceForm></section><LegalBasis id={def.id}/></>;
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
  const cursor = !old && definition.id === 'REVIEW-003' ? await journeyState(demo, task.workplace_id, task.id) : null;
  return <><Link className="back-link" href={back}>{back.includes('/map') ? '← 전체 지도' : '← 업무 목록'}</Link><PageHeading eyebrow={definition.template === 'common' ? '적용 확인 필요 · 관리 중' : '자체 서식 · 관리 중'} title={task.title} description={definition.condition}/>{task.definition_version !== definition.version ? <p className="notice">등록 당시 후보 버전 {task.definition_version}입니다. 현재 안내와 달라진 부분을 확인해주세요.</p> : null}
    <nav className="journey-breadcrumb" aria-label="전체 지도에서 현재 위치"><Link href={`${base}/map?workplace=${encodeURIComponent(task.workplace_id)}`}>전체 지도</Link><span>› {journeyGroup(definition.id).title} › {task.title}</span></nav>
    {definition.id === 'REVIEW-003' ? <TaskCycleHistory task={task} cycles={cycles} sources={cycleSources} demo={demo} canWrite={canWrite && !old}/> : null}
    {!old && definition.id !== 'REVIEW-003' ? <TaskGuidance definition={definition}/> : null}
    {canWrite && !old ? <section className="record-section" id="task-editor"><h2>{content ? '내용 확인·보완' : '확인한 내용부터 기록하세요'}</h2><p className="helper">확인한 사실을 저장하면 전체 지도에 반영돼요. 모르는 내용은 남겨두고 이어서 보완할 수 있어요.</p><TaskRecordForm demo={demo} task={task} definition={definition} content={content} documentRevision={documentRevision} disabled={status === 'queued'} step={query.step} cursor={cursor}/></section> : null}
    {!task.document_id && canWrite && !demo && linkTotal > 0 ? <details className="record-section" open={!!query.linkPage}><summary>이미 작성한 자료 연결</summary>{existing.length ? <WorkspaceForm action={linkTaskDocument.bind(null, task.id)}><input type="hidden" name="task_revision" value={task.revision}/><label>같은 현장의 기존 자료<select name="document" required>{existing.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label><p className="helper">이전 버전과 검토 이력을 그대로 연결합니다. 이미 연결된 자료는 덮어쓰지 않습니다.</p><button className="button secondary">기존 자료 연결</button></WorkspaceForm> : <p>이 페이지에는 연결할 수 있는 자료가 없어요. 다른 페이지를 확인해주세요.</p>}<nav aria-label="연결할 자료 페이지">{linkPage > 1 ? <Link className="button secondary" href={`${base}/tasks/${id}?linkPage=${linkPage - 1}`}>이전 자료</Link> : null}{linkPage * 25 < linkTotal ? <Link className="button secondary" href={`${base}/tasks/${id}?linkPage=${linkPage + 1}`}>다음 자료</Link> : null}</nav><p className="helper">같은 현장·민감자료 구분의 자료 중 다른 업무에 연결되지 않은 자료만 표시해요.</p></details> : null}
    {task.document_id ? <DocumentPanel id={task.document_id} demo={demo} versionId={query.version} path={`${base}/tasks/${id}?return=${encodeURIComponent(back)}`}/> : <p className="notice">확인 답변이나 메모를 저장하면 자료 버전이 만들어지고 증빙·검토·수행 기록을 이어갈 수 있습니다.</p>}<LegalBasis id={definition.id}/></>;
}
