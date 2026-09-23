import { currentTasks, taskCycleLabel } from '@/domain/task-cycles';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { journeyPrimary, journeyGroup, parseRiskJourneyCursor, riskChapters, savedJourneyLabel } from '@/domain/journey';
import type { TaskActionSummary } from '@/domain/task-actions';
import type { TaskActionSource } from '@/domain/task-action-source';
import type { TaskRecord, TaskProfile } from '@/domain/tasks';
import { JourneyHelp } from './journey-help';

export function JourneyHome({ actions, tasks, sources, profile, workplace, base, riskResume }: { actions: TaskActionSummary[]; tasks: TaskRecord[]; sources: TaskActionSource[]; profile: TaskProfile; workplace: string; base: string; riskResume?: { taskId: string; cursor: string | null } }) {
  const primary = journeyPrimary(actions, tasks, profile, workplace, base);
  const source = sources.find(s => s.task_id === primary.taskId);
  const resumePosition = riskResume && primary.taskId === riskResume.taskId && source?.version && primary.action === '초안 이어서 작성' ? parseRiskJourneyCursor(riskResume.cursor) : null;
  const resumeQuestion = resumePosition ? riskChapters[resumePosition.step][resumePosition.chapter] : null;
  const map = `${base}/map?workplace=${encodeURIComponent(workplace)}`;
  const important = actions.filter(a => a.taskId && a.needsAttention && a.id !== primary.id);
  const currentTask = tasks.find(task => task.id === primary.taskId);
  const currentGroup = currentTask ? journeyGroup(currentTask.definition_id) : primary.id === 'first-risk' ? journeyGroup('REVIEW-003') : null;
  const savedTasks = currentTasks(tasks).filter(task => sources.some(item => item.task_id === task.id && item.version)).slice(0, 3);
  function actionRow(action: TaskActionSummary) {
    return <li key={action.id}><Link href={action.href}><div className="home-action-copy"><strong>{action.title}</strong><p>{action.reason}</p><span className="home-action-label">{action.action}</span></div><ChevronRight size={20} aria-hidden="true"/></Link></li>;
  }
  return <div className="journey-home home-overview">
    <section className="home-next-action" aria-label="지금 함께 할 한 가지">
      <p className="home-section-label">{currentGroup?.title ?? (primary.id === 'map' ? '관리 분야' : '사업장 정보')}</p>
      <h2>{primary.title}</h2>
      <p className="home-action-reason">{resumeQuestion ? `보던 질문 · ${resumeQuestion}` : primary.reason}</p>
      {source ? <p className="home-record-state">{resumeQuestion ? `초안 v${source.version} 저장 · ${source.confirmed_at ? '작성자 확인됨' : '내용 확인 전'}` : savedJourneyLabel(source)}</p> : null}
      <Link href={primary.href} className="button primary home-primary-action">{resumeQuestion ? `${resumeQuestion} 이어서 작성` : primary.action}<ArrowRight size={20} aria-hidden="true"/></Link>
    </section>
    {important.length ? <section className="home-followups" aria-label="먼저 살펴볼 일"><h2>남은 확인</h2><ul className="home-action-list">{important.slice(0, 2).map(actionRow)}</ul>{important.length > 2 ? <details className="home-more-actions"><summary>남은 확인 {important.length - 2}건 더 보기</summary><ul className="home-action-list">{important.slice(2).map(actionRow)}</ul></details> : null}</section> : null}
    <nav className="home-map-link" aria-label="현재 업무 분야"><p>{currentGroup ? <>현재 안내 · <strong>{currentGroup.title}</strong></> : '다른 관리 분야도 살펴보세요.'}</p><Link className="text-link" href={map}>전체 지도<ChevronRight size={18} aria-hidden="true"/></Link></nav>
    <section className="home-records" aria-label="저장한 기록"><div className="section-heading"><h2>저장한 기록</h2><Link className="text-link" href={`${base}/documents`}>자료 전체 보기<ChevronRight size={18} aria-hidden="true"/></Link></div>{savedTasks.length ? <ul className="home-record-list">{savedTasks.map(task => <li key={task.id}><Link href={`${base}/tasks/${task.id}`}><span><strong>{task.title}{taskCycleLabel(task) ? ` · ${taskCycleLabel(task)}` : ''}</strong><small>{savedJourneyLabel(sources.find(item => item.task_id === task.id))}</small></span><ChevronRight size={20} aria-hidden="true"/></Link></li>)}</ul> : <p className="helper">업무를 저장하면 여기에서 이어볼 수 있어요.</p>}</section>
    <JourneyHelp title="실행과 기록을 함께 관리해요" label="이 앱은 어떻게 사용하나요?"><ol className="journey-tour"><li><strong>사업장 정보 입력</strong><p>확인한 장소·작업·인원을 적고, 모르는 내용은 남겨두세요.</p></li><li><strong>다음 행동 따라가기</strong><p>해야 할 일을 확인하고 실제로 한 내용을 기록하세요.</p></li><li><strong>남은 확인 이어가기</strong><p>전체 지도와 자료함에서 증빙·검토·보완을 이어가세요.</p></li></ol><p>자료 저장, 실제 수행, 자료 검토, 기관 접수는 각각 확인해요.</p></JourneyHelp>
  </div>;
}
