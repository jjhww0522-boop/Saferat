import { expect, type Page } from '@playwright/test';

export async function startProfile(page: Page) {
  await page.goto('/demo');
  await page.getByRole('button', { name: '새 체험 시작', exact: true }).click();
  await expect(page.getByRole('heading', { name: '사업장 정보 입력', exact: true })).toBeVisible();
}

export async function nextProfileStep(page: Page) {
  await page.getByRole('button', { name: '다음', exact: true }).click();
  for (const summary of await page.locator('.profile-section details.journey-optional:not([open]) > summary').all()) await summary.click();
}

export async function confirmProfile(page: Page) {
  await page.getByRole('checkbox', { name: '입력 내용을 확인했습니다. 미확인 정보는 추가 확인 대상으로 남깁니다.' }).check();
  await page.getByRole('button', { name: '확인하고 업무 목록 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '오늘 할 일', exact: true })).toBeVisible();
  await openDirect(page);
}

// Complete the prerequisite through the same form members use, without cookie/API seeding.
export async function completeProfile(page: Page, industry = 'facility') {
  const picker = page.locator('.profile-step-picker:not([open]) > summary');
  if (await picker.count()) await picker.click();
  await page.getByRole('button', { name: '등록정보', exact: true }).click();
  await page.getByLabel('사업장명', { exact: true }).fill('가상 시험 사업장');
  await page.getByLabel('실제 작업 장소', { exact: true }).fill('가상 시설 1층');
  await nextProfileStep(page);
  await page.getByLabel('실제 업무에 가까운 업종').selectOption(industry);
  await page.getByLabel('실제로 하는 작업').fill('시설 점검과 청소');
  await nextProfileStep(page);
  await nextProfileStep(page);
  await confirmProfile(page);
}

export async function openDirect(page: Page) {
  const summary = page.locator('.journey-direct:not([open]) > summary');
  if (await summary.count()) await summary.click();
}

// Existing record/version regression tests use the explicit experienced-user path.
// journey.spec exercises the default guided path separately.
export async function expertRisk(page: Page) {
  const direct = page.getByRole('button', { name: '익숙하다면 · 전체 항목 직접 입력', exact: true });
  if (await direct.count()) await direct.click();
  const metadata = page.locator('.task-form-fields .journey-optional:not([open]) > summary');
  if (await metadata.count()) await metadata.click();
}
