export type Truth = true | false | 'unknown';
export type FactValue = string | number | boolean | null;
export interface Fact { value: FactValue; confirmed: boolean; source: 'sample' | 'user' | 'mock_ocr'; }
export interface Snapshot { id: string; recordedAt: string; confirmedAt: string | null; facts: Record<string, Fact>; }
export type Condition =
  | { op: 'eq' | 'lt' | 'lte' | 'gt' | 'gte'; fact: string; value: Exclude<FactValue, null> }
  | { op: 'and' | 'or'; args: Condition[] }
  | { op: 'not'; arg: Condition };
export interface Rule {
  id: string; version: string; title: string; kind: 'demo' | 'legal';
  status: 'draft' | 'approved'; productionEligible: boolean; sourceRefs: string[];
  condition: Condition;
}
export interface Evaluation {
  ruleId: string; ruleVersion: string; snapshotId: string; asOf: string;
  applicability: 'applicable' | 'not_applicable' | 'needs_review';
  missingFacts: string[]; reasons: string[];
  trace: { op: string; fact?: string; result: Truth }[];
}
export interface Workplace {
  id: string; tenantId: string; name: string; industry: string; headcount: number | null;
  snapshotIds: string[]; revision: number;
}
export type ReviewStatus = 'not_requested' | 'queued' | 'changes_requested' | 'reviewed' | 'reopened';
export interface Obligation {
  id: string; workplaceId: string; tenantId: string; ruleId: string; title: string;
  description: string; targetDate: string | null; owner: string; revision: number;
  activity: { status: 'not_started' | 'reported_done'; performedAt: string | null; note: string };
  reviewStatus: ReviewStatus; submissionStatus: 'needs_confirmation';
  versionIds: string[]; reviewIds: string[];
}
export interface DocumentVersion {
  id: string; obligationId: string; number: number; kind: 'sample' | 'draft';
  status: 'draft' | 'user_confirmed'; createdAt: string; confirmedAt: string | null;
  fields: { location: string; observation: string; owner: string; schedule: string; budget: string };
}
export interface Review {
  id: string; obligationId: string; versionId: string; status: 'queued' | 'changes_requested' | 'reviewed';
  requestedAt: string; reviewedAt: string | null; reviewer: string | null;
  comment: string; internalNote: string; location: string;
}
export interface HistoryEvent { id: string; obligationId: string; versionId?: string; at: string; actor: string; message: string; activityRecord?: Obligation['activity']; }
export type Persona = 'member-a' | 'member-b' | 'reviewer' | 'unassigned';
export interface Actor { persona: Persona; tenantId: string | null; assignedTenantIds: string[]; }
export interface DemoState {
  workplaces: Workplace[]; snapshots: Snapshot[]; obligations: Obligation[];
  versions: DocumentVersion[]; reviews: Review[]; events: HistoryEvent[];
}
export interface ActionResult { ok: boolean; message: string; }
