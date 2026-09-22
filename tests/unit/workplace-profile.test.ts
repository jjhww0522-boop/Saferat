import { describe, expect, it } from 'vitest';
import { canConfirmProfile, emptyProfile, isSetupDefinition, profileCandidates, profileInput, profileQuestionDetails, profileQuestions } from '@/domain/workplace-profile';

describe('사업장 사실 확인과 관련 후보', () => {
  it('예전 프로필은 미확인 기본값으로 읽고 확인 완료를 추정하지 않는다', () => {
    const profile = profileInput.parse({ industry: 'facility', headcount: 0, work: [] });
    expect(profile.confirmed_at).toBeNull();
    expect(profile.revision).toBe(0);
    expect(profile.facts).toEqual(emptyProfile.facts);
    expect(profile.headcount).toBe(0);
    expect(canConfirmProfile(profile)).toBe(false);
  });

  it('최소 사실로 확인 가능하되 업종·인원·고용관계 모름은 질문으로 남긴다', () => {
    const profile = profileInput.parse({ ...emptyProfile, facts: { businessName: '시험', actualAddress: '가상 위치', actualWork: '점검' } });
    expect(canConfirmProfile(profile)).toBe(true);
    expect(profileQuestions(profile)).toEqual(expect.arrayContaining(['업종·복합 사업장 분류 확인', '직접고용 인원 확인', '작업·설비 조건 확인', '도급 계약과 실제 역할 확인']));
    for (const field of ['businessName', 'actualAddress', 'actualWork'] as const) {
      expect(canConfirmProfile(profileInput.parse({ ...profile, facts: { ...profile.facts, [field]: '  ' } }))).toBe(false);
    }
    const zero = profileInput.parse({ ...profile, headcount: 0, facts: { ...profile.facts, temporary: 0, dispatched: 0, contractors: 0 } });
    expect(profileQuestions(zero)).not.toContain('직접고용 인원 확인');
    expect(profileQuestions(zero)).not.toContain('기간제·단시간·파견·다른 업체 인원 확인');
    expect(profileQuestions(zero)).toContain('인원 기준일·집계 범위 확인');
  });

  it('기간제·단시간은 직접고용의 부분집합이며 다른 고용관계와 합산하지 않는다', () => {
    const valid = { ...emptyProfile, headcount: 2, facts: { ...emptyProfile.facts, temporary: 2, dispatched: 8, contractors: 10 } };
    expect(profileInput.parse(valid).headcount).toBe(2);
    expect(profileInput.safeParse({ ...valid, facts: { ...valid.facts, temporary: 3 } }).success).toBe(false);
    expect(profileInput.safeParse({ ...valid, headcount: null }).success).toBe(true);
    for (const invalid of [-1, 1.5, 1000001]) {
      expect(profileInput.safeParse({ ...valid, headcount: invalid }).success).toBe(false);
      expect(profileInput.safeParse({ ...valid, facts: { ...valid.facts, contractors: invalid } }).success).toBe(false);
    }
  });

  it('미확인 질문은 기존 문구를 유지하고 입력 단계·확인 이유를 안내한다', () => {
    const questions = profileQuestionDetails(emptyProfile);
    expect(questions.map(({ id, field, step }) => ({ id, field, step }))).toEqual([
      { id: 'registration', field: 'registeredAddress', step: 0 },
      { id: 'industry', field: 'industry', step: 1 },
      { id: 'work', field: 'work', step: 1 },
      { id: 'headcount', field: 'headcount', step: 2 },
      { id: 'employment', field: 'temporary', step: 2 },
      { id: 'count-basis', field: 'countDate', step: 2 },
      { id: 'contract-role', field: 'contractRole', step: 2 },
    ]);
    expect(questions.map(question => question.label)).toEqual(profileQuestions(emptyProfile));
    expect(questions.every(question => question.reason.length > 0)).toBe(true);
  });

  it('먼저 확인한 항목이 사라져도 질문 ID를 유지하고 첫 미확인 입력으로 이동한다', () => {
    const profile = profileInput.parse({
      ...emptyProfile, industry: 'facility', headcount: 0,
      facts: { registeredAddress: '확인한 등록 주소', workReviewed: true, temporary: 0, countDate: '2026-09-17' },
    });
    expect(profileQuestionDetails(profile).map(({ id, field }) => ({ id, field }))).toEqual([
      { id: 'registration', field: 'registrationIndustry' },
      { id: 'employment', field: 'dispatched' },
      { id: 'count-basis', field: 'countBasis' },
      { id: 'contract-role', field: 'contractRole' },
    ]);
    const more = profileInput.parse({ ...profile, facts: { ...profile.facts, registrationIndustry: '확인한 업태', dispatched: 0 } });
    expect(profileQuestionDetails(more).find(question => question.id === 'registration')?.field).toBe('registrationItems');
    expect(profileQuestionDetails(more).find(question => question.id === 'employment')?.field).toBe('contractors');
  });

  it('확인한 0명·관계 없음에는 재확인 질문을 만들지 않고 빈 값만 미확인으로 남긴다', () => {
    const complete = profileInput.parse({
      ...emptyProfile, industry: 'facility', headcount: 0,
      facts: { registrationIndustry: '확인한 업태', registrationItems: '확인한 종목', registeredAddress: '확인한 주소', workReviewed: true, temporary: 0, dispatched: 0, contractors: 0, countDate: '2026-09-17', countBasis: '확인한 명부', contractRole: 'none' },
    });
    expect(profileQuestionDetails(complete)).toEqual([]);
    const unknown = profileInput.parse({ ...complete, facts: { ...complete.facts, contractors: null } });
    expect(profileQuestionDetails(unknown)).toEqual([expect.objectContaining({ id: 'employment', field: 'contractors', step: 2 })]);
  });

  it('업종·작업은 관련성을 넓히며 인원만으로 법적 적용·비적용을 결정하지 않는다', () => {
    const food = profileInput.parse({ ...emptyProfile, industry: 'food' });
    const ids = (profile: typeof food) => profileCandidates(profile).map(item => item.id).sort();
    expect(ids(food)).not.toContain('REVIEW-031');
    expect(ids({ ...food, work: ['vehicle'] })).toContain('REVIEW-031');
    for (const headcount of [0, 4, 50, 500]) expect(ids({ ...food, headcount })).toEqual(ids(food));
    expect(ids({ ...food, industry: 'other' })).toEqual(ids(emptyProfile));
    expect(profileCandidates(food, true).map(item => item.id).sort()).toEqual(ids(emptyProfile));
  });

  it('도급 인원 또는 역할은 관련 후보를 추가하고 등록정보는 업무 후보에서 제외한다', () => {
    const food = profileInput.parse({ ...emptyProfile, industry: 'food' });
    const explicit = profileCandidates({ ...food, work: ['contractor'] });
    expect(profileCandidates({ ...food, facts: { ...food.facts, contractors: 1 } })).toEqual(explicit);
    for (const contractRole of ['client', 'contractor', 'both'] as const) {
      expect(profileCandidates({ ...food, facts: { ...food.facts, contractRole } })).toEqual(explicit);
    }
    for (const id of ['FORM_REGISTRATION', 'REVIEW-001', 'REVIEW-002']) {
      expect(isSetupDefinition(id)).toBe(true);
      expect(profileCandidates(emptyProfile, true).map(item => item.id)).not.toContain(id);
    }
    expect(isSetupDefinition('REVIEW-003')).toBe(false);
    expect(isSetupDefinition('FORM_PHOTO')).toBe(false);
    expect(profileCandidates(emptyProfile, true).every(item => !item.id.startsWith('FORM_'))).toBe(true);
  });
});
