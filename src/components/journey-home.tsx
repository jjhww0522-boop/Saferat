import { currentTasks, taskCycleLabel } from '@/domain/task-cycles';
import Link from 'next/link';
import { ArrowRight, Compass, Map, FileText, CircleAlert } from 'lucide-react';
import { journeyPrimary, journeyGroup, journeyGroups, savedJourneyLabel } from '@/domain/journey';
import type { TaskActionSummary } from '@/domain/task-actions';
import type { TaskActionSource } from '@/domain/task-action-source';
import type { TaskRecord, TaskProfile } from '@/domain/tasks';
import { JourneyHelp } from './journey-help';
import { WorkScene } from './work-scene';

export function JourneyHome({ actions, tasks, sources, profile, workplace, base }: { actions: TaskActionSummary[]; tasks: TaskRecord[]; sources: TaskActionSource[]; profile: TaskProfile; workplace: string; base: string }) {
  const primary = journeyPrimary(actions, tasks, profile, workplace, base);
  const source = sources.find(s => s.task_id === primary.taskId);
  const headline = primary.taskId ? primary.priority === 0 ? '남은 개선조치를 함께 확인해요' : primary.priority === 1 ? '보완할 내용을 함께 살펴볼까요?' : source?.version ? '작성하던 기록을 이어볼까요?' : '이 업무, 함께 시작해볼까요?' : primary.title;
  const map = `${base}/map?workplace=${encodeURIComponent(workplace)}`;
  const important = actions.filter(a => a.taskId && a.needsAttention && a.id !== primary.id).slice(0, 2);
  const currentTask = tasks.find(task => task.id === primary.taskId);
  const currentGroup = currentTask ? journeyGroup(currentTask.definition_id).id : primary.id === 'first-risk' ? 'risk' : null;
  const savedTasks = currentTasks(tasks).filter(task => sources.some(item => item.task_id === task.id && item.version)).slice(0, 3);
  const risk = currentTask?.definition_id === 'REVIEW-003' || primary.id === 'first-risk';
  return <div className="journey-home">
    <div className="journey-bento">
    <section className="journey-hero" aria-label="지금 함께 할 한 가지">
      <div className="journey-hero-copy"><p className="eyebrow"><Compass size={16}/> 오늘, 여기부터 함께해요</p><h2>{headline}</h2>{primary.taskId ? <strong>{primary.title}</strong> : null}<p className="journey-reason">{primary.reason}</p><Link href={primary.href} className="button primary journey-cta">{primary.action}<ArrowRight size={20}/></Link><div className="journey-secondary"><Link href={map}>다른 일 살펴보기</Link><Link href={`${base}/documents`}>준비한 자료 찾기</Link></div>{source ? <p className="helper">{savedJourneyLabel(source)}</p> : <p className="helper">적용 조건을 확인하며 시작하는 안내예요.</p>}</div>
      <figure className="journey-illustration"><WorkScene kind={risk && !source?.version ? 'observe' : 'record'}/><figcaption><span>설명 예시</span><strong>{risk ? '현장을 살펴보고, 확인한 사실을 기록해요' : '확인한 내용과 남은 질문을 나눠 정리해요'}</strong></figcaption></figure>
    </section>
    <section className="journey-location"><p className="eyebrow"><Map size={18}/> 전체 흐름 속 나의 위치</p><h2>우리 사업장 전체 지도</h2><div className="journey-location-grid" aria-label="현재 업무 분야">{journeyGroups.map(group => <span key={group.id} data-current={group.id === currentGroup}>{group.title}{group.id === currentGroup ? <small>지금 안내하는 분야</small> : null}</span>)}</div><p className="helper">관리 분야 안내예요. 이행 완료를 뜻하지 않아요.</p><Link className="text-link" href={map}>지도에서 자세히 보기<ArrowRight size={18}/></Link></section>
    {important.length ? <section className="journey-attention" aria-label="먼저 살펴볼 일"><p className="eyebrow"><CircleAlert size={18}/> 남은 확인</p><h2>이 일도 놓치지 마세요</h2>{important.map(action => <Link key={action.id} href={action.href}><span><strong>{action.title}</strong><small>{action.reason}</small></span><span>{action.action} <ArrowRight size={16}/></span></Link>)}</section> : null}
    </div>
    {savedTasks.length ? <section className="journey-records" aria-label="저장한 기록"><div className="section-heading"><h2>저장한 기록</h2><Link className="text-link" href={`${base}/documents`}>자료 전체 보기<ArrowRight size={17}/></Link></div>{savedTasks.map(task => <Link key={task.id} href={`${base}/tasks/${task.id}`}><FileText size={22}/><span><strong>{task.title} {taskCycleLabel(task)}</strong><small>{savedJourneyLabel(sources.find(item => item.task_id === task.id))}</small></span><ArrowRight size={18}/></Link>)}</section> : null}
    <JourneyHelp title="한 번에 모두 준비하지 않아도 괜찮아요" label="이 앱은 어떻게 사용하나요?"><ol className="journey-tour"><li><strong>우리 사업장을 알려주세요</strong><p>장소·작업·사람을 확인하고, 모르는 내용은 남겨둘 수 있어요.</p></li><li><strong>추천한 일부터 하나씩 해보세요</strong><p>왜 필요한지, 실제로 무엇을 할지, 어떤 기록을 남길지 안내해요.</p></li><li><strong>저장한 자료와 남은 확인을 살펴보세요</strong><p>전체 지도에서 위치를 찾고, 증빙·검토·보완을 이어가세요.</p></li></ol><p>자료 저장, 실제 수행, 자료 검토, 기관 접수는 각각 확인해요.</p></JourneyHelp>
  </div>;
}
