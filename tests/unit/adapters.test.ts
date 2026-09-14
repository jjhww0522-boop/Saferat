import { it, expect } from 'vitest';
import { mockRegistrationProvider } from '@/adapters/registration';
import { createSeed, actorFor } from '@/demo/seed';
import { applyCommand } from '@/domain/workflow';
it('OCR 후보는 사용자 확인을 기다리고 개업일·발급일·복수 종목을 보존', async () => {
  const result = await mockRegistrationProvider.extractRegistration('DEMO_REGISTRATION_001');
  expect(result.status).toBe('awaiting_confirmation');
  expect(result.fields.openingDate).not.toBe(result.fields.issueDate);
  expect(result.fields.registrationItems).toBe('시설관리·청소');
});
it('지원하지 않는 샘플을 임의 추출 성공으로 처리하지 않음', async () => {
  await expect(mockRegistrationProvider.extractRegistration('customer-document')).rejects.toThrow('직접 입력');
});
it('수행 기록을 정정해도 이전 사용자 기록을 이력에 보존', () => {
  const state = createSeed(), item = state.obligations[0], actor = actorFor('member-a');
  applyCommand(state, actor, item.id, item.revision, { type: 'activity', date: '2026-09-01', note: '첫 확인 내용' });
  applyCommand(state, actor, item.id, item.revision, { type: 'activity', date: '2026-09-02', note: '정정한 확인 내용' });
  expect(state.events[0].activityRecord?.note).toBe('첫 확인 내용');
  expect(state.events[1].activityRecord?.note).toBe('정정한 확인 내용');
});
