import Link from 'next/link';
import { notFound } from 'next/navigation';
import { workspacePageClient } from '@/server/supabase';
import { workspaceRepository } from '@/adapters/workspace';
import { demoTaskList } from '@/server/demo-tasks';
import { TaskBoard } from './task-board';
import { BusinessProfile } from './business-profile';
import { emptyProfile, isSetupDefinition, profileQuestionDetails } from '@/domain/workplace-profile';
import { industries } from '@/domain/review-catalog';
import { PageHeading } from './ui';
import { WorkspaceForm } from './workspace-form';
import { createWorkspace } from '@/server/workspace-actions';
import { seoulDate } from '@/domain/tasks';
import { homeTaskActions } from '@/domain/task-actions';
import { JourneyHome } from './journey-home';
import { JourneyMap } from './journey-map';
import { journeyState } from '@/server/journey-state';
import { JourneyWelcome } from './journey-welcome';
import { currentTasks, taskCycleLabel } from '@/domain/task-cycles';

export async function TaskHome({ demo, selected, setup = false, focus, view = 'today', browse = false }: { demo: boolean; selected?: string; setup?: boolean; focus?: string; view?: 'today' | 'map'; browse?: boolean }) {
  let data;
  if (demo) { try { data = await demoTaskList(selected); } catch { notFound(); } }
  else {
    const { client } = await workspacePageClient();
    const repo = workspaceRepository(client), workplaces = await repo.workplaces();
    const workplace = selected ? workplaces.find(w => w.id === selected) : workplaces[0];
    if (selected && !workplace) notFound();
    const [tasks, profile, sources] = workplace ? await Promise.all([repo.tasks(workplace.id), repo.profile(workplace.id), repo.taskActionSources(workplace.id)]) : [[], null, []];
    // Use the same authorized read as saved readiness for mutable task metadata.
    const byTask = new Map(sources.map(source => [source.task_id, source]));
    data = { workplaces, workplace, tasks: tasks.filter(task => byTask.has(task.id)).map(task => ({ ...task, ...byTask.get(task.id)?.task_snapshot })), profile, sources };
  }
  const profile = data.profile ?? emptyProfile;
  const gated = !profile.confirmed_at || setup;
  const base = demo ? '/app' : '/workspace';
  const back = data.workplace ? `${base}?workplace=${encodeURIComponent(data.workplace.id)}` : base;
  const setupHref = `${back}&setup=1`;
  const questions = profileQuestionDetails(profile);
  const today = seoulDate();
  const actions = data.workplace ? homeTaskActions(data.tasks, data.sources, profile, data.workplace.id, base, today) : [];
  const activeTasks = currentTasks(data.tasks);
  const activeIds = new Set(activeTasks.map(task => task.id));
  const activeSources = data.sources.filter(source => activeIds.has(source.task_id));
  const previous = gated ? data.tasks : data.tasks.filter(task => isSetupDefinition(task.definition_id) || !activeIds.has(task.id));
  const [cursor, welcome] = gated && view !== 'map' && data.workplace ? await Promise.all([journeyState(demo, data.workplace.id, 'profile'), journeyState(demo, data.workplace.id, 'welcome')]) : [null, null];
  const riskTask = activeTasks.find(task => task.definition_id === 'REVIEW-003');
  const riskCursor = view === 'map' && riskTask && data.workplace ? await journeyState(demo, data.workplace.id, riskTask.id) : null;
  return <>
    <PageHeading eyebrow={view === 'map' ? '한눈에 보는 우리 사업장' : gated ? '처음부터, 하나씩 함께해요' : '오늘의 안전관리'} title={view === 'map' ? '전체 관리 지도' : gated ? '사업장 정보 입력' : '우리 사업장 관리 업무'} description={view === 'map' ? '분야를 펼쳐 현재 기록과 다음 행동을 살펴보세요.' : gated ? '어디에서 어떤 일을 하는지부터 알려주세요. 아는 내용부터 시작해도 괜찮아요.' : '무엇부터 할지 고민하지 않도록, 다음 행동을 안내해요.'}/>
    {data.workplace ? <>
      {!demo ? <div className="task-workplace"><form>{setup ? <input type="hidden" name="setup" value="1"/> : null}<label>관리할 현장<select name="workplace" defaultValue={data.workplace.id}>{data.workplaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><button className="button secondary">현장 선택</button></form></div> : null}
      {gated && view !== 'map' ? <JourneyWelcome demo={demo} workplace={data.workplace.id} seen={welcome === 'welcome:seen'}/> : null}
      {view === 'map' ? <JourneyMap riskCursor={riskCursor} tasks={activeTasks} sources={activeSources} actions={actions} profile={profile} workplace={data.workplace.id} base={base}/> : gated ? <><Link className="journey-map-entry" href={`${base}/map?workplace=${encodeURIComponent(data.workplace.id)}`}><span><strong>먼저 전체 흐름을 보고 싶으세요?</strong><small>입력 전에도 관리 지도를 살펴볼 수 있어요.</small></span><span>전체 지도 →</span></Link><BusinessProfile key={`${data.workplace.id}:${focus ?? ''}`} demo={demo} workplace={data.workplace.id} profile={profile} back={back} focus={focus} initialStep={Number(cursor?.split(':')[1] ?? 0)}/></> : <>
        <JourneyHome tasks={data.tasks} sources={data.sources} actions={actions} profile={profile} workplace={data.workplace.id} base={base}/>
        <section className="profile-summary" aria-label="확인한 사업장 정보"><div><strong>{profile.facts.businessName || data.workplace.name}</strong><p>{industries.find(i => i.id === profile.industry)?.label ?? '업종 확인 필요'} · 직접고용 {profile.headcount === null ? '미확인' : `${profile.headcount}명`}</p><p>{profile.facts.actualWork}</p></div><Link className="text-link" href={setupHref}>사업장 정보 변경</Link></section>
        <details className="journey-direct" open={browse}><summary>모든 업무 직접 찾기 · 검색과 목록</summary><TaskBoard demo={demo} workplace={data.workplace.id} tasks={activeTasks} profile={profile} today={today} actions={actions}/></details>
        {questions.length ? <details className="profile-questions"><summary>추가로 확인할 정보 · {questions.length}개</summary><p>미확인 정보는 해당 없음으로 처리하지 않습니다. 확인할 항목을 선택하면 해당 입력칸으로 이동합니다.</p><ul>{questions.map(question => <li key={question.id}><Link className="text-link" href={`${setupHref}&focus=${encodeURIComponent(question.id)}`}>{question.label}</Link><p className="helper">{question.reason}</p></li>)}</ul></details> : null}
      </>}
      {previous.length ? <details className="previous-task-records"><summary>이전에 작성한 기록 ({previous.length}건)</summary><p className="helper">이전에 작성한 내용과 증빙·검토 이력을 그대로 이어서 확인할 수 있습니다.</p><ul>{previous.map(task => <li key={task.id}><Link href={`${base}/tasks/${task.id}?return=${encodeURIComponent(gated ? setupHref : back)}`}>{task.title} {taskCycleLabel(task)}<span>이전 기록 보기</span></Link></li>)}</ul></details> : null}
    </> : <section className="panel panel-padding"><h2>연결된 현장이 없습니다</h2><p>초대를 받았다면 <Link href="/workspace/members">초대 코드 입력</Link>으로 연결해주세요.</p><details><summary>새 조직의 첫 작업 공간 만들기</summary><WorkspaceForm action={createWorkspace}><label>새 조직 이름<input name="organization_name" required maxLength={120}/></label><label>첫 현장 이름<input name="workplace_name" required maxLength={120}/></label><button className="button primary">작업 공간 만들기</button></WorkspaceForm></details></section>}
  </>;
}
