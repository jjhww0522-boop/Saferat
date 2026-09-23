import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expertRisk, completeProfile, startProfile } from './profile';

async function save(page: Page) {
  const revision = page.locator('input[name="task_revision"]');
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
}
async function step(page: Page, name: string) {
  await expertRisk(page);
  await page.getByRole('navigation', { name: '위험성평가 진행 단계' }).getByRole('button', { name: new RegExp(name) }).click();
}

test('위험성평가 단계 이동·부분 저장·여러 위험·실제 조치·과거 버전 보존', async ({ page }) => {
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+/);
  const path = new URL(page.url()).pathname;
  await expect(page.locator('.journey-saved-progress')).toContainText('0/7'); await expertRisk(page);
  await page.getByLabel('이번 평가의 구분').selectOption('initial');
  await page.getByLabel('함께 살펴볼 작업·장소').fill('시험 매장 세척과 운반');
  await page.getByLabel('평가 예정일').fill('2026-09-15');
  await page.getByLabel('위험을 판단할 우리 사업장의 기준').fill('작업자와 위험 수준 및 개선 필요 여부 확인');
  await page.getByText('처음이라면: 공식 안내서와 판단 방법', { exact: true }).click();
  await expect(page.getByRole('link', { name: /소규모 사업장을 위한 위험성평가 안내서/ })).toHaveAttribute('href', /moel\.go\.kr/);
  await step(page, '위험요인 찾기');
  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  await page.getByLabel('어떤 작업인가요?').fill('세척');
  await page.getByLabel('어디에서 하나요?').fill('시험 세척구역');
  await page.getByLabel('무엇 때문에 어떻게 다칠 수 있나요?').fill('바닥 물기에 미끄러질 위험');
  await page.getByLabel('누가 영향을 받을 수 있나요?').fill('세척 근로자');
  await page.getByLabel('현재 하고 있는 안전조치').fill('표지만 있음');
  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  await save(page); await page.reload();
  await step(page, '위험요인 찾기');
  await expect(page.getByLabel('어떤 작업인가요?').first()).toHaveValue('세척');
  await expect(page.getByLabel('어떤 작업인가요?').nth(1)).toHaveValue('');
  await expect(page.locator('.risk-workflow .risk-status-summary')).toContainText('2건');
  await step(page, '위험 판단하기');
  const hazard = page.locator('.risk-hazard').first();
  await hazard.getByRole('combobox', { name: '위험 수준', exact: true }).selectOption('medium');
  await hazard.getByLabel('현재 위험을 허용할 수 있나요?').selectOption('no');
  await hazard.getByLabel('그렇게 판단한 이유').fill('표지만으로 미끄러짐을 막지 못함');
  await step(page, '개선조치 실행하기');
  await hazard.getByLabel('위험을 줄일 구체적인 조치').fill('배수 개선과 미끄럼 방지 바닥 보수');
  await hazard.getByLabel('조치 담당자').fill('시험 담당자');
  await hazard.getByLabel('조치 목표일').fill('2026-09-15');
  await hazard.getByLabel('실제 조치일').fill('2026-09-15');
  await hazard.getByLabel('실제로 한 조치·관련 증빙').fill('시험 바닥 보수 완료 기록');
  await step(page, '조치 후 다시 확인하기');
  await hazard.getByLabel('조치 후 실제 확인일').fill('2026-09-15');
  await hazard.getByLabel('현장에서 확인한 사람').fill('시험 확인자');
  await hazard.getByLabel('조치 후 남은 위험을 허용할 수 있나요?').selectOption('no');
  await hazard.getByLabel('확인 방법·결과·추가로 할 조치').fill('배수가 일부 부족하여 추가 개선 필요');
  await save(page);
  await expect(page.locator('.risk-workflow .risk-status-summary')).toContainText('2건');
  await hazard.getByLabel('조치 후 남은 위험을 허용할 수 있나요?').selectOption('yes');
  await hazard.getByLabel('확인 방법·결과·추가로 할 조치').fill('추가 보수 후 배수 확인');
  await save(page); await page.reload();
  await expect(page.locator('.risk-workflow .risk-status-summary')).toContainText('1건');
  await expect(page.getByText('기관 제출·접수: 미확인')).toBeVisible();
  await expect(page.getByText('수행 기록 없음', { exact: true })).toBeVisible();
  await page.locator('.version-history > summary').click();
  await page.getByRole('link', { name: 'v1', exact: true }).click();
  await expect(page.locator('.risk-workflow')).toHaveCount(0);
  await expect(page.locator('.risk-stored')).toContainText('2건');
  await page.goto(path);
  await step(page, '조치 후 다시 확인하기');
  await expect(hazard.getByLabel('조치 후 남은 위험을 허용할 수 있나요?')).toHaveValue('yes');
});

test('위험성평가 모든 단계의 모바일·키보드·대비와 미래 수행일 차단', async ({ page }) => {
  // Twenty-one step transitions and seven full accessibility audits run serially.
  test.setTimeout(180_000);
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page.locator('.risk-workflow')).toBeVisible();
  await step(page, '위험요인 찾기');
  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  const names = ['준비·방법', '함께 살펴보기', '위험요인 찾기', '위험 판단하기', '개선조치 실행하기', '조치 후 다시 확인하기', '결과 공유'];
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const name of names) {
      await step(page, name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 360) expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    }
  }
  await step(page, '함께 살펴보기');
  await page.getByLabel('실제 참여·현장 확인일').fill('2099-01-01');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.locator('.action-form .form-message[role="alert"]')).toContainText('미래 날짜');
  await expect(page.getByLabel('실제 참여·현장 확인일')).toHaveValue('2099-01-01');
  await expect(page.locator('.document-sections')).toHaveCount(0);
  await page.getByLabel('실제 참여·현장 확인일').fill('2026-09-15');
  await save(page);
  await page.setViewportSize({ width: 360, height: 900 });
  await page.screenshot({ path: 'test-results/risk-participation-mobile.png', fullPage: true });
});
