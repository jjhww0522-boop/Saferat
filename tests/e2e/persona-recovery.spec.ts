import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { completeProfile, startProfile } from './profile';

async function save(page: Page) {
  const revision = page.locator('input[name="task_revision"]');
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
}

async function identify(page: Page) {
  const picker = page.locator('.journey-step-picker');
  if (await picker.getAttribute('open') === null) await picker.locator('summary').click();
  await page.getByRole('navigation', { name: '위험성평가 진행 단계' }).getByRole('button', { name: /위험요인 찾기/ }).click();
  if (await picker.getAttribute('open') !== null) await picker.locator('summary').click();
}

test('위험요인 제외는 빈 항목만 즉시 처리하고 확인 취소·이전 버전·다른 입력을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page.locator('.risk-workflow')).toBeVisible();
  await page.getByLabel('함께 살펴볼 작업·장소').fill('가상 시설 청소와 통로 확인');
  await identify(page);
  const serialized = page.locator('input[name="risk_assessment"]');
  const remove = page.getByRole('button', { name: '이 위험요인 입력 취소', exact: true });
  const dialog = page.getByRole('dialog', { name: '이번 초안에서 이 위험요인을 제외할까요?', exact: true });

  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  await remove.click();
  await expect(dialog).toBeHidden();
  expect(JSON.parse(await serialized.inputValue()).hazards).toHaveLength(0);

  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  await page.getByLabel('어떤 작업인가요?').fill('가상 바닥 청소');
  await page.getByLabel('어디에서 하나요?').fill('가상 1층 통로');
  await page.getByLabel('무엇 때문에 어떻게 다칠 수 있나요?').fill('가상 바닥 물기에 미끄러질 위험');
  await page.getByLabel('누가 영향을 받을 수 있나요?').fill('가상 청소 담당자');
  await page.getByLabel('현재 하고 있는 안전조치').fill('가상 표지 설치');
  await save(page);
  await expect(page.locator('#stored-record .count')).toHaveText('v1');
  const before = await serialized.inputValue();
  const beforeRevision = await page.locator('input[name="task_revision"]').inputValue();

  await remove.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '계속 작성', exact: true })).toBeFocused();
  await expect(dialog).toContainText('가상 바닥 물기에 미끄러질 위험');
  await expect(dialog).toContainText('이전에 저장한 버전은 남아 있어요.');
  await expect(dialog).toContainText('위험이 해결된 것은 아니에요.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/persona-exclude-360.png' });
  await expect(serialized).toHaveValue(before);
  await dialog.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(remove).toBeFocused();
  await expect(serialized).toHaveValue(before);
  await expect(page.getByRole('heading', { name: '위험요인 기록', exact: true })).toBeVisible();

  await remove.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(remove).toBeFocused();
  await expect(serialized).toHaveValue(before);
  await expect(page.locator('input[name="task_revision"]')).toHaveValue(beforeRevision);

  await remove.click();
  await dialog.getByRole('button', { name: '초안에서 제외', exact: true }).click();
  await expect(dialog).toBeHidden();
  const after = JSON.parse(await serialized.inputValue());
  expect(after.hazards).toHaveLength(0);
  expect(after.scope).toBe('가상 시설 청소와 통로 확인');
  await expect(page.locator('input[name="task_revision"]')).toHaveValue(beforeRevision);
  await expect(page.locator('form[data-save-state="dirty"]')).toBeVisible();
  await expect(page.locator('#stored-record .count')).toHaveText('v1');
  await save(page);
  await expect(page.locator('#stored-record .count')).toHaveText('v2');
  await page.reload();
  expect(JSON.parse(await serialized.inputValue()).hazards).toHaveLength(0);
  await page.locator('.version-history > summary').click();
  await page.getByRole('link', { name: 'v1', exact: true }).click();
  await expect(page.locator('.risk-workflow')).toHaveCount(0);
  await expect(page.locator('.risk-stored')).toContainText('가상 바닥 물기에 미끄러질 위험');
  await expect(page.locator('.risk-stored')).toContainText('가상 1층 통로');
});
