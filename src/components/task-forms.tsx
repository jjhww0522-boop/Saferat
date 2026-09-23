import { WorkspaceForm } from './workspace-form';
import { saveTask } from '@/server/task-actions';
import { taskFields, parseTaskContent, taskAnswerQuestions, storedAnswerLabel, type TaskDefinition, type TaskRecord } from '@/domain/tasks';
import { RiskAssessmentFields } from './risk-assessment-form';
import { RiskAssessmentSummary } from './risk-assessment-summary';

export function TaskRecordForm({ demo, task, definition, content, documentRevision, disabled = false, step, cursor }: { demo: boolean; task: TaskRecord; definition: TaskDefinition; content: string | null; documentRevision: number | null; disabled?: boolean; step?: string; cursor?: string | null }) {
  const stored = content ? parseTaskContent(content) : null;
  const risk = definition.id === 'REVIEW-003';
  const answers = taskAnswerQuestions(definition, stored).map((question, i) => <label key={question.id}>{question.label ?? `이전 확인 답변 ${i + 1} · 당시 질문 원문 미보관`}<textarea name={`answer-${i}`} rows={2} maxLength={2000} defaultValue={stored?.answers[i] ?? ''}/></label>);
  const notes = <label>확인 메모<textarea name="notes" rows={4} maxLength={4000} defaultValue={stored?.notes ?? (stored ? '' : content ?? '')}/></label>;
  const metadata = <details className="journey-optional"><summary>담당자·준비 일정{risk ? '·추가 메모' : ''}<span className="task-meta-summary">저장된 정보 · {task.owner || '담당자 미정'} · {task.target_date ?? '일정 미정'}</span></summary>
    <div className="form-grid"><label>담당자<input name="owner" defaultValue={task.owner} maxLength={120}/></label><label>자료 준비 목표일<input type="date" name="target_date" defaultValue={task.target_date ?? ''}/></label></div>
    <p className="helper">목표일은 직접 정한 자료 준비 일정입니다. 법정 기한이 아닙니다. 자료가 검토 중이거나 검토 완료이면 준비 기한 강조에서 제외합니다.</p>
    {risk && stored?.answers.some(Boolean) ? <details className="risk-help"><summary>이전에 작성한 확인 답변</summary>{answers}</details> : null}
    {risk ? notes : null}
  </details>;
  return <WorkspaceForm key={task.id} trackChanges={!disabled} serverBasis={{ key: JSON.stringify([task.owner, task.target_date, content]), revisions: { task_revision: String(task.revision), document_revision: documentRevision === null ? '' : String(documentRevision) } }} action={saveTask.bind(null, demo, task.id)}>
    <input type="hidden" name="questions_context" value={JSON.stringify(taskAnswerQuestions(definition, stored))}/>
    <input type="hidden" name="task_revision" value={task.revision}/><input type="hidden" name="document_revision" value={documentRevision ?? ''}/>
    <fieldset disabled={disabled} className="task-form-fields"><legend className="sr-only">업무 확인 내용</legend>
      {risk ? <RiskAssessmentFields key={`${task.id}:${step ?? ''}`} stored={stored?.risk} demo={demo} requestedStep={step} cursor={cursor} workplace={task.workplace_id} resource={task.id}>{metadata}</RiskAssessmentFields> : <>
        <div className="task-record-fields">{taskFields[definition.template].map(field => <label key={field.name}>{field.label}{field.multiline ? <textarea name={field.name} rows={3} maxLength={2000} defaultValue={stored?.fields[field.name] ?? ''}/> : <input name={field.name} maxLength={2000} defaultValue={stored?.fields[field.name] ?? ''}/>}</label>)}{answers}{notes}</div>
        {metadata}
        <p className="helper">확인한 사실만 저장해주세요. 모르는 값은 비워두고, 나중에 보완할 수 있어요.</p><div className="task-save-bar"><button className="button primary">임시 저장</button></div>
      </>}
    </fieldset>{disabled ? <p className="notice">검토 중인 자료입니다. 결과를 받은 뒤 새 버전으로 보완해주세요.</p> : null}
  </WorkspaceForm>;
}
export function StoredTaskContent({ content }: { content: string }) {
  const stored = parseTaskContent(content);
  if (!stored) return <p className="preserve-lines">{content}</p>;
  return <div className="stored-task-record">{stored.risk ? <RiskAssessmentSummary risk={stored.risk}/> : null}{Object.entries(stored.fields).map(([key, value]) => value ? <p key={key}><strong>{Object.values(taskFields).flat().find(f => f.name === key)?.label ?? key}</strong><span className="preserve-lines">{value}</span></p> : null)}{stored.answers.map((answer, i) => stored.risk && !answer ? null : <p key={i}><strong>{storedAnswerLabel(stored, i)}</strong><span className="preserve-lines">{answer || '추가 확인 필요'}</span></p>)}{stored.notes ? <p><strong>확인 메모</strong><span className="preserve-lines">{stored.notes}</span></p> : null}</div>;
}
