import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { completeProfile, startProfile } from './profile';

async function step(page: Page, name: string) {
  const picker = page.locator('.journey-step-picker');
  if (!await picker.evaluate(element => (element as HTMLDetailsElement).open)) await picker.locator('summary').click();
  await picker.getByRole('button', { name: new RegExp(name) }).click();
  // Keep the map available on demand, as a customer would while filling a question.
  if (await picker.evaluate(element => (element as HTMLDetailsElement).open)) await picker.locator('summary').click();
}
async function startRisk(page: Page) {
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
}

test('숨은 두 번째 위험요인의 날짜 오류를 찾아 초안을 보존하고 수정·재열람한다', async ({ page }) => {
  test.setTimeout(150_000);
  await startRisk(page);
  await page.getByLabel('함께 살펴볼 작업·장소').fill('두 구역의 시설 점검');
  await step(page, '위험요인 찾기');
  for (const name of ['기계실 바닥 물기', '창고 통로 적재물']) {
    await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
    await page.getByLabel('무엇 때문에 어떻게 다칠 수 있나요?').filter({ visible: true }).fill(name);
  }
  await step(page, '개선조치 실행하기');
  await page.getByLabel('위험을 줄일 구체적인 조치').filter({ visible: true }).fill('적재물을 옮기고 통로 확보');
  await page.getByLabel('조치 목표일').filter({ visible: true }).fill('2099-01-01');
  await page.getByRole('button', { name: '다음 단계', exact: true }).click();
  await page.getByLabel('실제 조치일').filter({ visible: true }).fill('2099-01-01');
  await page.getByLabel('실제로 한 조치·관련 증빙').filter({ visible: true }).fill('작업자에게 실제 날짜 확인 필요');
  const input = page.locator('input[name="risk_assessment"]');
  const before = await input.inputValue(), parsed = JSON.parse(before);
  const firstId = parsed.hazards[0].id, secondId = parsed.hazards[1].id;
  await page.getByLabel('살펴볼 위험요인').selectOption(firstId);
  await step(page, '준비·방법');
  const revision = page.locator('input[name="task_revision"]'), previousRevision = await revision.inputValue();
  const form = page.locator('form[data-save-state]');
  await page.getByRole('button', { name: '저장하고 다음', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'error');
  const invalid = page.locator('[id="risk-' + secondId + '-performedOn"]');
  await expect(page.getByRole('heading', { name: '실제 조치', exact: true })).toBeVisible();
  await expect(page.getByLabel('살펴볼 위험요인')).toHaveValue(secondId);
  await expect(invalid).toBeFocused(); await expect(invalid).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.risk-field-error')).toContainText('계획은 조치 목표일');
  await expect(input).toHaveValue(before); await expect(revision).toHaveValue(previousRevision);
  await expect(page.locator('.journey-save-feedback')).toBeHidden();
  await expect(page.locator('.document-sections')).toHaveCount(0);
  expect(await invalid.evaluate(element => { const rect = element.getBoundingClientRect(); const top = document.elementFromPoint(rect.x + rect.width / 2, rect.top + 4); const bottom = document.elementFromPoint(rect.x + rect.width / 2, rect.bottom - 4); return element === top && element === bottom; })).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/persona-date-error-360.png' });
  await step(page, '위험요인 찾기');
  await page.getByRole('button', { name: '문제 있는 날짜로 이동', exact: true }).click();
  await expect(invalid).toBeFocused();
  await invalid.fill('2026-09-01');
  await expect(page.locator('.risk-input-recovery')).toHaveCount(0);
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await page.reload();
  const saved = JSON.parse(await input.inputValue());
  expect(saved).toEqual({ ...parsed, hazards: [parsed.hazards[0], { ...parsed.hazards[1], performedOn: '2026-09-01' }] });
  await expect(page.locator('.record-statuses')).toContainText('수행 기록 없음');
});

test('접힌 교육 날짜와 역전된 평가 기간도 정확한 입력으로 돌아간다', async ({ page }) => {
  await startRisk(page);
  await page.getByRole('button', { name: '다음 단계', exact: true }).click();
  await page.getByRole('button', { name: '다음 단계', exact: true }).click();
  const details = page.locator('details').filter({ has: page.locator('#risk-learningOn') });
  await details.locator('summary').click();
  await page.locator('#risk-learningOn').fill('2099-01-01');
  await details.locator('summary').click();
  await step(page, '위험요인 찾기');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.locator('#risk-learningOn')).toBeFocused();
  await expect(page.locator('#risk-learningOn')).toBeVisible();
  await page.locator('#risk-learningOn').fill('');
  await step(page, '결과 공유');
  await page.locator('#risk-startedOn').fill('2026-09-10');
  await page.locator('#risk-finishedOn').fill('2026-09-01');
  await step(page, '준비·방법');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.locator('#risk-finishedOn')).toBeFocused();
  await expect(page.locator('.risk-field-error')).toContainText('시작한 날보다 빠를 수 없습니다');
  // Fix the related start date, not the field which carries the error.
  await page.locator('#risk-startedOn').fill('2026-08-31');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.locator('form[data-save-state]')).toHaveAttribute('data-save-state', 'saved');
  await expect(page.locator('.risk-input-recovery')).toHaveCount(0);
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await page.reload();
  const saved = JSON.parse(await page.locator('input[name="risk_assessment"]').inputValue());
  expect(saved.startedOn).toBe('2026-08-31'); expect(saved.finishedOn).toBe('2026-09-01'); expect(saved.learningOn).toBe('');
  expect(saved.learningStatus).toBe('unknown'); expect(saved.hazards).toEqual([]);
});
