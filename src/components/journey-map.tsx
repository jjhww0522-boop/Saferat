'use client';
import { taskCycleLabel } from '@/domain/task-cycles';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Circle, MapPin, List, Network } from 'lucide-react';
import { journeyCandidates, journeyGroup, journeyGroups, savedJourneyLabel } from '@/domain/journey';
import type { TaskActionSource } from '@/domain/task-action-source';
import type { TaskActionSummary } from '@/domain/task-actions';
import type { TaskRecord, TaskProfile } from '@/domain/tasks';
import { riskSteps } from '@/domain/risk-assessment';
import { reviewStatusLabels } from '@/domain/workspace';
import { taskGuidance } from '@/domain/task-guidance';
import { profileQuestionDetails } from '@/domain/workplace-profile';

export function JourneyMap({ tasks, sources, actions, profile, base, workplace, riskCursor }: { tasks: TaskRecord[]; sources: TaskActionSource[]; actions: TaskActionSummary[]; profile: TaskProfile; base: string; workplace: string; riskCursor?: string | null }) {
  const [selected, setSelected] = useState('risk'), [list, setList] = useState(false);
  const branchHeading = useRef<HTMLHeadingElement>(null);
  const candidates = journeyCandidates(profile, tasks), questions = profileQuestionDetails(profile);
  const group = journeyGroups.find(g => g.id === selected)!;
  const back = `${base}/map?workplace=${encodeURIComponent(workplace)}`;
  const stored = sources.filter(s => s.version).length;
  const lastStep = riskCursor ? Number(riskCursor.split(':')[1]) : null;
  function selectGroup(id: string) {
    setSelected(id);
    // Match the single-column map layout, where the detail follows all category buttons.
    if (!window.matchMedia('(max-width: 1100px)').matches) return;
    requestAnimationFrame(() => {
      const heading = branchHeading.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  function rows(groupId: string) {
    return candidates.filter(d => journeyGroup(d.id).id === groupId).map(def => {
      const task = tasks.find(t => t.definition_id === def.id), source = sources.find(s => s.task_id === task?.id);
      const action = actions.find(a => a.taskId === task?.id), guide = taskGuidance(def);
      const href = task ? `${base}/tasks/${task.id}?return=${encodeURIComponent(back)}` : !profile.confirmed_at ? `${base}?workplace=${encodeURIComponent(workplace)}&setup=1` : `${base}/tasks/new?definition=${def.id}&workplace=${encodeURIComponent(workplace)}&return=${encodeURIComponent(back)}`;
      if (!task && !list) return <details key={def.id} className="journey-candidate"><summary><strong>{def.title}</strong><span>첫 행동 알아보기</span></summary><p>{guide?.goal ?? def.checks[0]}</p><p className="helper">적용 확인 필요 · 아직 등록한 업무가 없어요.</p><Link className="text-link" href={href}>{!profile.confirmed_at ? '사업장 정보부터 확인하기' : '무엇을 할지 알아보기'}<ArrowRight size={17}/></Link></details>;
      return <article key={def.id} className={`journey-task ${source?.risk?.improvement_count ? 'has-attention' : ''}`}><div className="journey-task-heading"><span className="journey-dot"/><div><span className="helper">적용 확인 필요</span><h3>{def.title}{task && taskCycleLabel(task) ? ` · ${taskCycleLabel(task)}` : ''}</h3></div></div><p>{guide?.goal ?? def.checks[0]}</p><p className="journey-record-state">{savedJourneyLabel(source)}</p>
        {source?.journey?.ready_steps ? <><ol className="journey-mini-steps" aria-label="저장된 위험성평가 기록 준비">{riskSteps.map((step, i) => <li key={step.id}><Link href={`${href}&step=${step.id}`} aria-current={lastStep === i ? "step" : undefined}><span>{source.journey!.ready_steps![i] ? <Check size={15}/> : <Circle size={12}/>}</span>{step.title}{lastStep === i ? <small>최근 본 단계</small> : null}</Link></li>)}</ol><p className="helper">위험 판단 확인 {source.journey.unknown_count ?? '집계 전'}건 · 개선·재확인 {source.risk?.improvement_count ?? '집계 전'}건</p></> : null}
        {task ? <p className="helper">자료: {reviewStatusLabels[task.review_status] ?? '기록 중'} · 실제 수행·기관 접수는 기록에서 별도 확인</p> : null}
        {action?.needsAttention && source?.version ? <p className="journey-missing">다음: {action.reason}</p> : null}
        <Link className="text-link" href={href}>{task ? '기록 이어서 보기' : !profile.confirmed_at ? '사업장 정보부터 확인하기' : '무엇을 할지 알아보기'}<ArrowRight size={17}/></Link></article>;
    });
  }
  return <section className="journey-map" aria-label="우리 사업장 관리 지도"><div className="journey-map-summary"><span><strong>{stored}</strong>개 업무에 저장한 기록</span><span><strong>{questions.length}</strong>개 사업장 정보 추가 확인</span><p>관리 분야의 관계도예요. 모든 법적 의무나 이행 완료율을 뜻하지 않아요.</p></div><div className="journey-map-toolbar"><p><MapPin size={17}/> 전체 지도{list ? ' · 목록 보기' : ` › ${group.title}`}</p><div className="task-tabs"><button type="button" aria-pressed={!list} onClick={() => setList(false)}><Network size={16}/> 관계도</button><button type="button" aria-pressed={list} onClick={() => setList(true)}><List size={16}/> 목록</button></div></div>
    <Link href={`${base}?workplace=${encodeURIComponent(workplace)}&setup=1`} className="journey-map-root"><span className="journey-root-mark"><MapPin size={25}/></span><span><strong>{profile.facts.businessName || '우리 사업장 알기'}</strong><small>{profile.confirmed_at ? `입력 확인됨 · 추가 확인 ${questions.length}개` : '장소·작업·사람을 알려주시면 관련 일을 안내해요.'}</small></span><ChevronRight size={20}/></Link>
    {list ? <div className="journey-map-list">{journeyGroups.map(g => <section key={g.id}><h2>{g.title}</h2><p>{g.description}</p><div className="journey-task-list">{rows(g.id)}</div></section>)}</div> : <div className="journey-map-layout"><nav className="journey-branches" aria-label="관리 분야">{journeyGroups.map((g, i) => { const count = tasks.filter(t => journeyGroup(t.definition_id).id === g.id).length; return <button key={g.id} type="button" aria-pressed={selected === g.id} aria-controls="journey-branch-detail" onClick={() => selectGroup(g.id)}><span className="journey-branch-number">0{i + 1}</span><span><strong>{g.title}</strong><small>{count ? `등록한 업무 ${count}개` : '첫 행동을 알아보세요'}</small></span><ChevronRight size={18}/></button>; })}</nav><section id="journey-branch-detail" className="journey-branch-detail" aria-label={group.title}><p className="eyebrow">선택한 분야</p><h2 ref={branchHeading} tabIndex={-1}>{group.title}</h2><p>{group.description}</p><div className="journey-task-list" key={selected}>{rows(selected)}</div></section></div>}
  </section>;
}
