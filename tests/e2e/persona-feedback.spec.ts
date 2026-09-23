import { expect, test } from '@playwright/test';
import { completeProfile, startProfile } from './profile';

test('모바일 저장 후 다음 질문의 입력을 성공 안내나 저장 버튼이 덮지 않는다', async ({ page }) => {
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByLabel('함께 살펴볼 작업·장소').fill('계단 청소 작업');
  await page.getByRole('button', { name: '저장하고 다음', exact: true }).click();
  await expect(page.locator('form[data-save-state]')).toHaveAttribute('data-save-state', 'saved');
  await expect(page.getByRole('heading', { name: '판단 기준', exact: true })).toBeFocused();
  await expect(page.locator('.journey-save-feedback')).toBeVisible();
  const input = page.getByLabel('위험을 판단할 우리 사업장의 기준');
  const unobstructed = () => input.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight && [rect.top + 4, rect.bottom - 4].every(y => document.elementFromPoint(rect.x + rect.width / 2, y) === element);
  });
  await page.screenshot({ path: 'test-results/persona-feedback-360.png' });
  await expect.poll(unobstructed).toBe(true);
  await input.fill('실제 작업자와 기준을 확인할 예정');
  await expect(page.locator('.journey-save-feedback')).toBeHidden();
  await expect(page.locator('.form-save-state')).toContainText('저장하지 않은 변경사항');
});
