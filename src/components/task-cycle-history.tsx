import Link from 'next/link';
import type { TaskRecord } from '@/domain/tasks';
import type { TaskActionSource } from '@/domain/task-action-source';
import { taskCycleNumber } from '@/domain/task-cycles';
import { reviewStatusLabels } from '@/domain/workspace';
import { startNextTaskCycle } from '@/server/task-actions';
import { WorkspaceForm } from './workspace-form';

export function TaskCycleHistory({ task, cycles, sources, demo, canWrite }: { task: TaskRecord; cycles: TaskRecord[]; sources: TaskActionSource[]; demo: boolean; canWrite: boolean }) {
  const base = demo ? '/app' : '/workspace';
  const ordered = cycles.toSorted((a, b) => taskCycleNumber(b) - taskCycleNumber(a));
  const latest = ordered[0];
  const previous = ordered.filter(item => taskCycleNumber(item) < taskCycleNumber(task));
  const attention = previous.filter(item => {
    const source = sources.find(s => s.task_id === item.id);
    return !source || source.risk?.state === 'unreadable' || source.risk?.improvement_count || source.journey?.unknown_count || item.review_status === 'changes_requested';
  });
  return <section className="task-cycles record-section" aria-label="평가 회차와 지난 기록">
    <div className="section-heading"><h2>{taskCycleNumber(task)}회차 평가</h2><span className="badge">{latest?.id === task.id ? '현재 회차' : '지난 회차'}</span></div>
    <p>한 번의 평가 안에서 내용을 보완하면 v1, v2로 남아요. 다음 평가를 시작하면 별도의 회차에 기록해요.</p>
    {attention.length ? <div className="notice"><strong>지난 {attention.length}개 회차에 남은 확인이 있어요</strong><p>새 회차를 시작해도 지난 조치가 완료되지는 않아요. 지금도 남아 있는 위험인지 직접 확인하세요.</p><ul>{attention.slice(0, 3).map(item => {
      const source = sources.find(s => s.task_id === item.id);
      return <li key={item.id}><Link href={`${base}/tasks/${item.id}${item.review_status === 'changes_requested' ? '#review-history' : '#stored-record'}`}>{taskCycleNumber(item)}회차 {item.review_status === 'changes_requested' ? '보완 의견 확인' : '기록 확인'}</Link> · {source?.risk?.state === 'available' ? `개선·재확인 ${source.risk.improvement_count}건` : '남은 조치 집계 확인 필요'}{source?.journey?.unknown_count ? ` · 위험 판단 미확인 ${source.journey.unknown_count}건` : ''}</li>;
    })}</ul>{attention.length > 3 ? <p className="helper">다른 {attention.length - 3}개 회차는 아래 전체 평가 이력에서 확인하세요.</p> : null}</div> : null}
    {ordered.length > 1 ? <details><summary>전체 평가 이력 · {ordered.length}회차</summary><ol className="cycle-history">{ordered.map(item => {
      const source = sources.find(s => s.task_id === item.id);
      return <li key={item.id}><Link href={`${base}/tasks/${item.id}`} aria-current={item.id === task.id ? 'page' : undefined}>{taskCycleNumber(item)}회차{item.id === task.id ? ' · 보고 있는 기록' : ''}</Link><span>{source?.version ? `v${source.version}` : '내용 저장 전'} · {reviewStatusLabels[item.review_status] ?? '상태 확인 필요'}</span>{source?.version ? <span>{source.risk?.state === 'available' ? `개선·재확인 ${source.risk.improvement_count}건` : '남은 조치 집계 확인 필요'}{source.journey?.unknown_count ? ` · 위험 판단 미확인 ${source.journey.unknown_count}건` : ''}</span> : null}</li>;
    })}</ol></details> : null}
    {/* Keep the action mounted through revalidation until its navigation result is consumed. */}
    {canWrite ? <details className="new-cycle" hidden={latest?.id !== task.id}><summary>다음 평가를 새 회차로 시작하기</summary><p>이번 내용을 고치려면 위의 현재 회차 입력에서 이어서 작성하세요. 작업 변경 등으로 새 평가가 필요할 때만 새 회차를 시작하세요.</p>{task.document_id ? <WorkspaceForm action={startNextTaskCycle.bind(null, demo, task.id)}><input type="hidden" name="cycle_revision" value={task.revision}/><p className="helper">이전 기록·증빙·검토 이력은 그대로 보관합니다. 새 회차의 입력·참여·실행·검토 상태는 비워두며, 직접 확인한 사실을 새로 기록합니다.</p><label className="checkbox-label"><input type="checkbox" name="confirm_new_cycle" required/>기존 기록의 수정이 아니라 새로운 평가를 시작합니다</label><button className="button secondary">새 평가 회차 시작</button></WorkspaceForm> : <p className="helper">먼저 이번 회차에서 확인한 내용을 저장해주세요.</p>}</details> : null}
    {latest && latest.id !== task.id ? <p><Link className="text-link" href={`${base}/tasks/${latest.id}`}>현재 {taskCycleNumber(latest)}회차로 이동 →</Link></p> : null}
  </section>;
}
