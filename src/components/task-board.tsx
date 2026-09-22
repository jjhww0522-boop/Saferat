'use client';
import { taskCycleLabel } from '@/domain/task-cycles';
import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
import { categories } from '@/domain/review-catalog';
import { taskDefinitions, taskUrgency, urgencyLabels, type TaskRecord, type TaskProfile } from '@/domain/tasks';
import { isSetupDefinition, profileCandidates } from '@/domain/workplace-profile';
import { reviewStatusLabels } from '@/domain/workspace';
import { legalBasisSummary } from '@/domain/legal-basis';
import type { TaskActionSummary } from '@/domain/task-actions';

export function TaskBoard({ tasks, profile, workplace, demo, today, actions }: { tasks: TaskRecord[]; profile: TaskProfile; workplace: string; demo: boolean; today: string; actions: TaskActionSummary[] }) {
  const path = usePathname(), params = useSearchParams(), router = useRouter();
  const query = params.get('q') ?? '', status = params.get('status') ?? 'all', all = params.get('catalog') === 'all';
  const returnTo = `${path}${params.size ? `?${params}` : ''}`;
  useEffect(() => { const y = sessionStorage.getItem(`task-scroll:${returnTo}`); if (y) requestAnimationFrame(() => window.scrollTo(0, Number(y))); }, [returnTo]);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    router.replace(`${path}?${next}`, { scroll: false });
  }
  function remember() { sessionStorage.setItem(`task-scroll:${returnTo}`, String(window.scrollY)); }
  const candidates = profileCandidates(profile, all);
  const relevant = new Set(candidates.map(item => item.id));
  const profileRelated = new Set(profileCandidates(profile).map(item => item.id));
  const priority = new Map(candidates.map((item, index) => [item.id, index]));
  const complianceDefinitions = taskDefinitions.filter(def => def.template === 'common' && !isSetupDefinition(def.id));
  const complianceIds = new Set(complianceDefinitions.map(def => def.id));
  const managed = tasks.filter(task => complianceIds.has(task.definition_id));
  const clock = new Date(`${today}T03:00:00Z`);
  const rows = complianceDefinitions.map(def => ({ def, task: tasks.find(t => t.definition_id === def.id) })).filter(({ def, task }) => {
    if (!task && !relevant.has(def.id)) return false;
    if (query && !`${def.title} ${def.checks.join(' ')} ${task?.owner ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    if (status === 'managed') return !!task;
    if (status === 'needs_review') return def.template === 'common';
    if (status === 'overdue') return !!task && taskUrgency(task.target_date, task.review_status, clock) === 'overdue';
    if (['changes_requested', 'queued', 'reviewed'].includes(status)) return task?.review_status === status;
    return true;
  }).sort((a, b) => (priority.get(a.def.id) ?? Infinity) - (priority.get(b.def.id) ?? Infinity));
  const attention = actions.filter(action => action.needsAttention);
  const actionByTask = new Map(actions.filter(action => action.taskId).map(action => [action.taskId, action]));
  const base = demo ? '/app' : '/workspace';
  function actionHref(action: TaskActionSummary) {
    const url = new URL(action.href, 'http://local');
    if (action.taskId) url.searchParams.set('return', returnTo);
    return `${url.pathname}${url.search}${url.hash}`;
  }
  function nextAction(action: TaskActionSummary) {
    return <li key={action.id}><Link href={actionHref(action)} onClick={remember}><div><strong>{action.title}</strong><p>{action.reason}</p>{action.version ? <small>저장한 v{action.version} 기준 · {action.confirmed ? '작성자 확인됨' : '초안 · 내용 확인 전'}</small> : null}</div><span className="next-action-label">{action.action}<ArrowUpRight size={17}/></span></Link></li>;
  }
  const management = tasks.find(task => task.definition_id === 'REVIEW-004');
  return <div className="task-board">
    <section className="next-actions" aria-labelledby="next-actions-title"><div className="section-heading"><h2 id="next-actions-title">다음으로 할 일</h2><span>{attention.length}건 남음</span></div><p className="helper">저장한 기록과 미확인 정보를 기준으로 안내합니다. 개선조치, 보완 의견, 준비 일정 순으로 살펴보세요.</p>{attention.length ? <><ol className="next-action-list">{attention.slice(0, 3).map(nextAction)}</ol>{attention.length > 3 ? <details className="remaining-actions"><summary>남은 할 일 {attention.length - 3}건 모두 보기</summary><ol className="next-action-list" start={4}>{attention.slice(3).map(nextAction)}</ol></details> : null}</> : <p>현재 기록에서 집계된 후속 항목이 없습니다. 아래 관련 업무의 적용 조건과 실제 수행 여부를 확인하세요.</p>}</section>
    <div className="task-overview"><div><span className="small-label">등록한 관리 업무</span><strong>{managed.length}<small>건</small></strong></div><div><span className="small-label">확인·기록할 다음 행동</span><strong>{attention.length}<small>건</small></strong></div><p>관리 목록 등록은 법적 적용 확정이 아닙니다.<br/>자료·수행·검토 상태를 각각 확인하세요.</p></div>
    <section className="management-entry" aria-label="경영책임자와 관리체계"><h2>경영책임자·관리체계도 함께 확인하세요</h2><p>목표·방침, 담당 조직, 인력·예산, 종사자 의견, 도급 평가와 이행점검의 실제 운영을 연결해 살펴봅니다.</p><Link className="text-link" onClick={remember} href={management ? `${base}/tasks/${management.id}?return=${encodeURIComponent(returnTo)}` : `${base}/tasks/new?definition=REVIEW-004&workplace=${encodeURIComponent(workplace)}&return=${encodeURIComponent(returnTo)}`}>안전보건관리체계 확인 <ArrowUpRight size={17}/></Link><p className="helper">적용 조건을 확인할 후보입니다. 중대시민재해는 별도 범위로 확인합니다.</p></section>
    <div className="task-toolbar"><div className="task-tabs" aria-label="목록 범위"><button type="button" aria-pressed={!all} onClick={() => update({ catalog: '' })}>우리 사업장</button><button type="button" aria-pressed={all} onClick={() => update({ catalog: 'all' })}>전체 후보 열람</button></div><form className="task-search" onSubmit={e => { e.preventDefault(); update({ q: String(new FormData(e.currentTarget).get('q') ?? '') }); }}><label><span className="sr-only">업무 검색</span><Search size={17}/><input name="q" type="search" defaultValue={query} key={query} placeholder="업무명·확인 내용·담당자"/></label><button className="button secondary" type="submit">검색</button></form><label className="task-status-filter"><span className="sr-only">업무 상태</span><select value={status} onChange={e => update({ status: e.target.value })}><option value="all">모든 상태</option><option value="managed">등록한 업무</option><option value="needs_review">적용 확인 필요</option><option value="overdue">목표일 경과</option><option value="changes_requested">보완 요청</option><option value="queued">검토 대기</option><option value="reviewed">자료 검토 완료</option></select></label></div>
    <p className="task-list-description" role="status">{all ? '전체 검토 후보' : '등록한 업무와 사업장 조건에 관련된 검토 후보'} · {rows.length}개 표시 <span>검토 후보는 적용 확인이 필요합니다. 인원은 검토 순서에만 반영하며 후보를 제외하지 않습니다.</span></p>
    {rows.length === 0 ? <div className="empty"><h2>이 조건에서 찾은 항목이 없습니다</h2><p>법적 의무가 없다는 뜻은 아닙니다. 검색어나 상태를 바꿔 확인해주세요.</p><button className="button secondary" onClick={() => update({ q: '', status: 'all' })}>검색·상태 초기화</button></div> : categories.map(category => {
      const items = rows.filter(row => row.def.category === category.id);
      if (!items.length) return null;
      return <section className="task-category" key={category.id} aria-labelledby={`category-${category.id}`}><div className="task-category-heading"><h2 id={`category-${category.id}`}>{category.label}</h2><span>{items.length}개</span></div><ul className="task-ledger">{items.map(({ def, task }) => {
        const urgency = task ? taskUrgency(task.target_date, task.review_status, clock) : 'normal';
        const href = task ? `${base}/tasks/${task.id}` : `${base}/tasks/new?definition=${def.id}&workplace=${workplace}`;
        const action = task ? actionByTask.get(task.id) : undefined;
        return <li key={def.id} id={`task-${def.id}`}><Link className={`ledger-row ${urgency}`} onClick={remember} href={action ? actionHref(action) : `${href}${task ? '?' : '&'}return=${encodeURIComponent(returnTo)}`}><div className="ledger-title"><span className="ledger-kind">적용 확인 필요</span><strong>{def.title}{task && taskCycleLabel(task) ? ` · ${taskCycleLabel(task)}` : ''}</strong><span className="ledger-description">{task && !profileRelated.has(def.id) ? '현재 사업장 조건과 달라도 이전 관리 기록을 유지합니다. 적용 여부를 다시 확인해주세요.' : action ? action.reason : def.checks[0]}</span><span className="ledger-basis">근거: {legalBasisSummary(def.id)}</span></div><div className="ledger-owner">{task?.owner || '담당 미지정'}<small>{task?.target_date ? `준비 목표 ${task.target_date}` : '목표일 미정'}</small></div><div className="ledger-state"><span className={`badge ${task?.review_status ?? ''}`}>{task ? reviewStatusLabels[task.review_status] ?? '기록 중' : '관리 시작 전'}</span>{urgency !== 'normal' ? <strong className="deadline-label">{urgencyLabels[urgency]}</strong> : null}</div><span className="ledger-action">{action?.action ?? '내용 확인'}<ArrowUpRight size={17}/></span></Link></li>;
      })}</ul></section>;
    })}
    <details className="direct-record-tools"><summary>직접 기록 도구</summary><p className="helper">필요할 때 선택해 쓰는 자체 서식입니다. 관련 법적 의무의 적용 여부와 구분해 사용하세요.</p><ul>{taskDefinitions.filter(def => ['FORM_PHOTO', 'FORM_PLAN'].includes(def.id)).map(def => {
      const task = tasks.find(item => item.definition_id === def.id);
      const action = task ? actionByTask.get(task.id) : undefined;
      const href = action ? actionHref(action) : `${base}/tasks/new?definition=${def.id}&workplace=${encodeURIComponent(workplace)}&return=${encodeURIComponent(returnTo)}`;
      return <li key={def.id}><Link href={href} onClick={remember}><strong>{def.title}</strong><span>자체 서식 · {action?.action ?? '내용 확인'}</span></Link></li>;
    })}</ul></details>
  </div>;
}
