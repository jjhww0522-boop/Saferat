import { z } from 'zod';
import { industries, workConditions, filterCandidates, headcountBandFor } from './review-catalog';

const text = z.string().trim().max(2000).default('');
const count = z.number().int().min(0).max(1000000).nullable().default(null);
export const workplaceFactsSchema = z.object({
  businessName: text, registrationIndustry: text, registrationItems: text,
  registeredAddress: text, actualAddress: text, actualWork: text,
  temporary: count, dispatched: count, contractors: count,
  countDate: z.iso.date().nullable().default(null), countBasis: text,
  contractRole: z.enum(['unknown', 'none', 'client', 'contractor', 'both']).default('unknown'),
  workReviewed: z.boolean().default(false),
});
export const profileInput = z.object({
  industry: z.enum(['all', ...industries.map(i => i.id)]), headcount: count,
  work: z.array(z.enum(workConditions.map(w => w.id))).max(workConditions.length),
  facts: workplaceFactsSchema.prefault({}),
  revision: z.number().int().nonnegative().default(0),
  confirmed_at: z.iso.datetime({ offset: true }).nullable().default(null),
}).refine(p => p.headcount === null || p.facts.temporary === null || p.facts.temporary <= p.headcount, { message: '기간제·단시간 인원은 직접고용 인원 이하여야 합니다.', path: ['facts', 'temporary'] });
export type TaskProfile = z.infer<typeof profileInput>;
export const emptyProfile: TaskProfile = profileInput.parse({ industry: 'all', headcount: null, work: [] });
export const setupDefinitionIds = ['FORM_REGISTRATION', 'REVIEW-001', 'REVIEW-002'];
export function isSetupDefinition(id: string) { return setupDefinitionIds.includes(id); }
export function canConfirmProfile(profile: TaskProfile) {
  return !!(profile.facts.businessName && profile.facts.actualAddress && profile.facts.actualWork);
}
export type ProfileQuestionId = 'registration' | 'industry' | 'work' | 'headcount' | 'employment' | 'count-basis' | 'contract-role';
export type ProfileQuestionField = keyof TaskProfile['facts'] | 'industry' | 'work' | 'headcount';
export interface ProfileQuestion { id: ProfileQuestionId; label: string; reason: string; field: ProfileQuestionField; step: 0 | 1 | 2; }
export function profileQuestionDetails(profile: TaskProfile): ProfileQuestion[] {
  const f = profile.facts, questions: ProfileQuestion[] = [];
  const registrationField = (['registeredAddress', 'registrationIndustry', 'registrationItems'] as const).find(field => !f[field]);
  if (registrationField) questions.push({ id: 'registration', label: '등록증의 업태·종목·주소 확인', reason: '등록증에 적힌 내용과 실제 작업 장소·업무를 구분해 정리하기 위해 확인합니다. 등록증을 보고 모르는 항목만 보완해주세요.', field: registrationField, step: 0 });
  if (['all', 'other'].includes(profile.industry)) questions.push({ id: 'industry', label: '업종·복합 사업장 분류 확인', reason: '실제로 하는 일에 가까운 업무를 안내하기 위해 확인합니다. 여러 업종이 섞여 있거나 분류를 모르겠다면 그대로 두고 실제 작업을 적어주세요.', field: 'industry', step: 1 });
  if (!f.workReviewed) questions.push({ id: 'work', label: '작업·설비 조건 확인', reason: '업종 이름만으로 알 수 없는 현장의 작업·설비를 확인합니다. 실제 해당하는 항목을 살펴본 뒤 선택을 확인해주세요.', field: 'work', step: 1 });
  if (profile.headcount === null) questions.push({ id: 'headcount', label: '직접고용 인원 확인', reason: '사업장에서 직접 고용한 인원을 다른 업체 소속 인원과 구분하기 위해 확인합니다. 확인한 인원이 없으면 0, 아직 모르면 빈칸으로 남겨주세요.', field: 'headcount', step: 2 });
  const employmentField = (['temporary', 'dispatched', 'contractors'] as const).find(field => f[field] === null);
  if (employmentField) questions.push({ id: 'employment', label: '기간제·단시간·파견·다른 업체 인원 확인', reason: '고용관계별 인원을 구분하고 같은 사람을 중복 집계하지 않기 위해 확인합니다. 명부나 계약 내용을 확인한 범위만 입력해주세요.', field: employmentField, step: 2 });
  if (!f.countDate || !f.countBasis) questions.push({ id: 'count-basis', label: '인원 기준일·집계 범위 확인', reason: '입력한 인원이 언제, 어느 현장과 자료를 기준으로 확인된 숫자인지 남깁니다. 인원을 확인한 날짜와 집계 범위를 적어주세요.', field: !f.countDate ? 'countDate' : 'countBasis', step: 2 });
  if (f.contractRole === 'unknown') questions.push({ id: 'contract-role', label: '도급 계약과 실제 역할 확인', reason: '다른 업체에 작업을 맡기는지, 다른 업체가 맡긴 작업을 하는지 구분하기 위해 확인합니다. 계약과 실제 작업 관계를 확인한 뒤 선택해주세요.', field: 'contractRole', step: 2 });
  return questions;
}
export function profileQuestions(profile: TaskProfile): string[] {
  return profileQuestionDetails(profile).map(question => question.label);
}
export function profileCandidates(profile: TaskProfile, all = false) {
  const work = [...profile.work];
  if (!work.includes('contractor') && ((profile.facts.contractors ?? 0) > 0 || ['client', 'contractor', 'both'].includes(profile.facts.contractRole))) work.push('contractor');
  return filterCandidates({ industry: all ? 'all' : profile.industry, work: all ? [] : work, headcount: headcountBandFor(profile.headcount), category: 'all', query: '' }).filter(item => !isSetupDefinition(item.id));
}
