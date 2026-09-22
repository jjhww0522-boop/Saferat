import { z } from 'zod';
import { riskAssessmentSchema } from './risk-assessment';
import { riskJourneySummary } from './journey';

export const taskActionSourceSchema = z.object({
  task_id: z.string(),
  version: z.number().int().positive().nullable(),
  confirmed_at: z.iso.datetime({ offset: true }).nullable(),
  journey: z.object({ definition_version: z.literal(1), ready_steps: z.array(z.boolean()).length(7).nullable(), unknown_count: z.number().int().nonnegative().nullable() }).optional(),
  task_snapshot: z.object({ revision: z.number().int().positive(), review_status: z.string(), owner: z.string(), target_date: z.iso.date().nullable() }).optional(),
  risk: z.object({
    state: z.enum(['available', 'unreadable']),
    improvement_count: z.number().int().nonnegative(),
    next_due_on: z.iso.date().nullable(),
  }).nullable(),
});
export type TaskActionSource = z.infer<typeof taskActionSourceSchema>;

// This projection deliberately reads only the fields used by the home summary.
// Keep it in parity with app_private.safety_task_risk_source in migration 0008.
const decision = z.enum(['unknown', 'yes', 'no']);
const hazardSourceSchema = z.object({
  id: z.string().min(1).max(80), acceptable: decision, residualAcceptable: decision,
  measure: z.string(), owner: z.string(), dueOn: z.string(),
  performedOn: z.string(), performedNote: z.string(),
  verifiedOn: z.string(), verifier: z.string(), verificationNote: z.string(),
});
const riskSourceSchema = z.object({ format: z.literal('risk-assessment-v1'), hazards: z.array(hazardSourceSchema).max(30) });
const validDate = (value: string) => !value.startsWith('0000-') && z.iso.date().safeParse(value).success;
const unreadable: NonNullable<TaskActionSource['risk']> = { state: 'unreadable', improvement_count: 0, next_due_on: null };

export function summarizeTaskSource(taskId: string, version: { number: number; content: string; confirmed_at: string | null } | undefined): TaskActionSource {
  const source: TaskActionSource = { task_id: taskId, version: version?.number ?? null, confirmed_at: version?.confirmed_at ?? null, risk: null };
  if (!version) return source;
  let content: unknown;
  try { content = JSON.parse(version.content); } catch { return { ...source, risk: { ...unreadable } }; }
  if (!content || typeof content !== 'object' || Array.isArray(content)) return { ...source, risk: { ...unreadable } };
  if (!Object.hasOwn(content, 'risk')) return source;
  const record = content as Record<string, unknown>;
  const parsed = riskSourceSchema.safeParse(record.risk);
  if (record.format !== 'task-record-v1' || record.definition !== 'REVIEW-003' || !parsed.success || new Set(parsed.data.hazards.map(h => h.id)).size !== parsed.data.hazards.length) return { ...source, risk: { ...unreadable } };
  const improvements = parsed.data.hazards.filter(h => {
    const known = h.acceptable === 'no' || h.residualAcceptable === 'no' || !!h.measure.trim();
    const recorded = h.measure.trim() && h.owner.trim() && validDate(h.dueOn)
      && validDate(h.performedOn) && h.performedNote.trim()
      && validDate(h.verifiedOn) && h.verifiedOn >= h.performedOn
      && h.verifier.trim() && h.residualAcceptable === 'yes' && h.verificationNote.trim();
    return known && !recorded;
  });
  const dates = improvements.map(h => h.dueOn).filter(validDate).sort();
  return { ...source, risk: { state: 'available', improvement_count: improvements.length, next_due_on: dates[0] ?? null } };
}

export function summarizeJourneySource(taskId: string, version: { number: number; content: string; confirmed_at: string | null } | undefined): TaskActionSource {
  const source = summarizeTaskSource(taskId, version);
  let journey: NonNullable<TaskActionSource['journey']> = { definition_version: 1, ready_steps: null, unknown_count: null };
  if (version && source.risk?.state === 'available') {
    const parsed = riskAssessmentSchema.safeParse(JSON.parse(version.content).risk);
    if (parsed.success) journey = riskJourneySummary(parsed.data);
  }
  return { ...source, journey };
}
