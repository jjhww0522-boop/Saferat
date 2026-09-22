import { z } from 'zod';
import { categories, catalogVersion, reviewCandidates, type CategoryId } from './review-catalog';
import { hasRiskContent, readRiskAssessment, riskAssessmentSchema } from './risk-assessment';
export { profileInput, emptyProfile, type TaskProfile } from './workplace-profile';

export type TaskTemplate = 'common' | 'registration' | 'photo' | 'plan';
export interface TaskDefinition { id: string; title: string; category: CategoryId; version: string; template: TaskTemplate; checks: string[]; evidence: string[]; condition: string; }
const core: TaskDefinition[] = [
  { id: 'FORM_REGISTRATION', title: '사업장 등록정보 확인', category: 'management', version: '1', template: 'registration', checks: ['등록 정보와 실제 작업 장소가 일치하는지 확인했나요?'], evidence: ['확인한 사업장 정보'], condition: '직접 확인한 기본정보를 정리하는 자체 서식입니다. 소속 인증이나 법적 적용 판정을 대신하지 않습니다.' },
  { id: 'FORM_PHOTO', title: '현장 사진 점검 기록', category: 'inspection', version: '1', template: 'photo', checks: ['사진에서 보이는 내용과 현장에서 직접 확인한 내용을 구분했나요?'], evidence: ['현장 사진', '확인 위치·관찰·후속 조치 기록'], condition: '관찰한 사실과 추가 확인 사항을 기록하는 자체 서식입니다.' },
  { id: 'FORM_PLAN', title: '업무 계획 초안', category: 'management', version: '1', template: 'plan', checks: ['목표·담당자·일정·예산 중 실제로 결정한 내용만 기록했나요?'], evidence: ['확인된 계획과 결정 기록'], condition: '직접 결정한 내용을 정리하는 자체 서식입니다. 공통 법정 계획서가 아닙니다.' },
];
export const taskDefinitions: TaskDefinition[] = [...core, ...reviewCandidates.map(item => ({ ...item, version: catalogVersion, template: 'common' as const }))];
export function taskDefinition(id: string) { return taskDefinitions.find(item => item.id === id); }
export const taskFields: Record<TaskTemplate, { name: string; label: string; multiline?: boolean }[]> = {
  common: [],
  registration: [{ name: 'businessName', label: '확인한 사업장명' }, { name: 'registeredAddress', label: '등록 주소' }, { name: 'actualAddress', label: '실제 작업 장소' }, { name: 'actualWork', label: '실제로 하는 작업', multiline: true }],
  photo: [{ name: 'location', label: '확인 위치' }, { name: 'observation', label: '사진에서 관찰한 내용', multiline: true }, { name: 'verified', label: '현장에서 직접 확인한 내용', multiline: true }, { name: 'followup', label: '추가 확인·후속 조치', multiline: true }],
  plan: [{ name: 'objective', label: '확인한 목표', multiline: true }, { name: 'responsible', label: '결정된 담당자' }, { name: 'schedule', label: '결정된 일정' }, { name: 'budget', label: '결정된 예산' }],
};
const questionSnapshotSchema = z.object({ id: z.string().max(200), label: z.string().max(2000).nullable(), definitionVersion: z.string().max(200).nullable() });
export const taskContentSchema = z.object({ format: z.literal('task-record-v1'), definition: z.string(), notes: z.string().max(4000), answers: z.array(z.string().max(2000)).max(20), questions: z.array(questionSnapshotSchema).max(20).optional(), fields: z.record(z.string(), z.string().max(2000)), risk: riskAssessmentSchema.optional() }).refine(value => (!value.risk || value.definition === 'REVIEW-003') && (!value.questions || value.questions.length === value.answers.length));
export type TaskContent = z.infer<typeof taskContentSchema>;
export function parseTaskContent(content: string): TaskContent | null {
  try { const result = taskContentSchema.safeParse(JSON.parse(content)); return result.success ? result.data : null; } catch { return null; }
}
export function taskAnswerQuestions(definition: TaskDefinition, stored: TaskContent | null) {
  if (stored?.questions) return stored.questions;
  if (stored?.answers.some(Boolean)) return stored.answers.map((_, i) => ({ id: `${definition.id}:legacy:${i + 1}`, label: null, definitionVersion: null }));
  return definition.checks.map((label, i) => ({ id: `${definition.id}:${definition.version}:${i + 1}`, label, definitionVersion: definition.version }));
}
export function storedAnswerLabel(stored: TaskContent, index: number) {
  return stored.questions?.[index]?.label ?? `이전 확인 답변 ${index + 1} · 당시 질문 원문 미보관`;
}
export function readTaskForm(definition: TaskDefinition, form: FormData, previousContent?: string, requireQuestionContext = false) {
  const questions = taskAnswerQuestions(definition, previousContent ? parseTaskContent(previousContent) : null);
  if (requireQuestionContext && form.get('questions_context') !== JSON.stringify(questions)) throw new Error('questions_changed');
  const content = taskContentSchema.parse({ format: 'task-record-v1', definition: definition.id, notes: String(form.get('notes') ?? '').trim(), questions, answers: questions.map((_, i) => String(form.get(`answer-${i}`) ?? '').trim()), fields: Object.fromEntries(taskFields[definition.template].map(field => [field.name, String(form.get(field.name) ?? '').trim()])) });
  if (definition.id === 'REVIEW-003' && form.has('risk_assessment')) content.risk = readRiskAssessment(String(form.get('risk_assessment')), seoulDate());
  const hasContent = [content.notes, ...content.answers, ...Object.values(content.fields)].some(Boolean) || !!(content.risk && hasRiskContent(content.risk));
  const serialized = hasContent ? JSON.stringify(content) : null;
  if (serialized && serialized.length > 20000) throw new Error('record_too_long');
  return serialized;
}
export const taskMetadataInput = z.object({ owner: z.string().trim().max(120), target_date: z.iso.date().nullable(), expected_revision: z.coerce.number().int().positive(), document_revision: z.coerce.number().int().positive().nullable() });
export interface TaskRecord { id: string; workplace_id: string; definition_id: string; definition_version: string; title: string; category: CategoryId; document_id: string | null; sensitive: boolean; owner: string; target_date: string | null; revision: number; review_status: string; cycle_number?: number; previous_task_id?: string | null; }
export const taskRecordSchema = z.object({ id: z.string(), workplace_id: z.string(), definition_id: z.string(), definition_version: z.string(), title: z.string(), category: z.enum(categories.map(c => c.id) as [CategoryId, ...CategoryId[]]), document_id: z.string().nullable(), sensitive: z.boolean(), owner: z.string(), target_date: z.string().nullable(), revision: z.number().int(), review_status: z.string(), cycle_number: z.number().int().positive().default(1), previous_task_id: z.string().nullable().default(null) });
export function seoulDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function taskUrgency(targetDate: string | null, reviewStatus: string, now = new Date()) {
  if (!targetDate || !z.iso.date().safeParse(targetDate).success || ['queued', 'reviewed'].includes(reviewStatus)) return 'normal';
  const days = (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${seoulDate(now)}T00:00:00Z`)) / 86400000;
  return days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'normal';
}
export const urgencyLabels = { overdue: '목표일 경과', soon: '목표일 임박', normal: '' };
