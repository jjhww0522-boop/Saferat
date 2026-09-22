import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { actorPage, closeActors } from './actors';
import { openDirect, completeProfile, startProfile } from './profile';
test.afterEach(closeActors);

async function start(page: Page, definition = 'FORM_PHOTO') {
  await startProfile(page);
  await completeProfile(page);
  await page.goto(`/app/tasks/new?definition=${definition}&workplace=facility`);
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+$/);
}
async function record(page: Page) {
  const input = page.locator('input[name="task_revision"]');
  const before = Number(await input.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(input).toHaveValue(String(before + 1));
}
async function documentCommand(page: Page, name: string) {
  const input = page.locator('input[name="revision"]').first();
  const before = Number(await input.inputValue());
  await page.getByRole('button', { name, exact: true }).click();
  await expect(input).toHaveValue(String(before + 1));
}
test('목록 → 전용 기록 → 증빙 → 별도 검토자 보완 → 새 버전, 상태 분리', async ({ page }) => {
  await start(page);
  const taskPath = new URL(page.url()).pathname;
  await page.getByLabel('확인 위치', { exact: true }).fill('가상 시설 1층');
  await page.getByLabel('사진에서 관찰한 내용').fill('가상 통로에 물품이 보임');
  await page.getByLabel('담당자', { exact: true }).fill('시험 담당자');
  await record(page);
  await page.reload();
  await expect(page.getByLabel('확인 위치', { exact: true })).toHaveValue('가상 시설 1층');
  await expect(page.getByText('수행 기록 없음', { exact: true })).toBeVisible();
  await documentCommand(page, '가상 사진 샘플 연결');
  await documentCommand(page, 'v1 내용 확인');
  await documentCommand(page, '검토 요청');
  const operator = await actorPage(page, 'reviewer');
  await operator.getByRole('link', { name: /현장 사진 점검 기록.*검토하기/ }).click();
  await expect(operator.getByRole('heading', { name: '현장 사진 점검 기록', exact: true })).toBeVisible();
  await operator.getByLabel('보완 위치').fill('확인 위치');
  await operator.getByLabel('회원에게 보이는 검토 의견').fill('층과 구역을 구분해주세요.');
  await operator.getByLabel('검토자 내부 메모').fill('INTERNAL_TASK_SENTINEL');
  await operator.screenshot({ path: 'test-results/task-operator-review.png', fullPage: true });
  await operator.getByRole('button', { name: '검토 결과 저장' }).click();
  await expect(operator.getByLabel('검토자 내부 메모')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('확인 위치 — 층과 구역을 구분해주세요.')).toBeVisible();
  expect(await page.content()).not.toContain('INTERNAL_TASK_SENTINEL');
  await page.getByLabel('확인 위치', { exact: true }).fill('가상 시설 1층 동쪽');
  await record(page); await documentCommand(page, 'v2 내용 확인'); await documentCommand(page, '검토 요청');
  await operator.reload();
  await operator.getByRole('combobox', { name: '검토 결과', exact: true }).selectOption('reviewed');
  await operator.getByRole('button', { name: '검토 결과 저장' }).click();
  await expect(operator.getByLabel('검토자 내부 메모')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('자료: 자료 검토 완료')).toBeVisible();
  await expect(page.getByText('검토를 기다리고 있습니다.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('추가 의견이 없습니다.', { exact: true })).toBeVisible();
  await expect(page.getByText('기관 제출·접수: 미확인')).toBeVisible();
  await expect(page.getByText('수행 기록 없음', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/task-member-detail.png', fullPage: true });
  const other = await actorPage(page, 'member-b');
  await other.goto(taskPath);
  await expect(other.getByRole('heading', { name: '이 자료를 찾을 수 없습니다.' })).toBeVisible();
});

test('공개 회원 화면에 운영 입구가 없고 역할 쿠키·직접 요청으로 전환되지 않는다', async ({ page, request }) => {
  await page.goto('/'); expect(await page.locator('a[href^="/ops"]').count()).toBe(0);
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.landing-preview')).toHaveCSS('transform', 'none');
    await page.screenshot({ path: `test-results/landing-${width}.png`, fullPage: true });
  }
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await start(page, 'REVIEW-078');
  expect(await page.locator('.persona-menu').count()).toBe(0);
  expect(await page.locator('a[href^="/ops"]').count()).toBe(0);
  await page.context().addCookies([{ name: 'safety-persona', value: 'reviewer', url: new URL(page.url()).origin }]);
  await page.goto('/ops'); await expect(page).toHaveURL(/\/ops\/login$/);
  await expect(page.getByRole('heading', { name: '운영자 인증 연결 준비 중' })).toBeVisible();
  await page.goto('/ops/rules'); await expect(page).toHaveURL(/\/ops\/login$/);
  expect((await request.post('/api/testing/session', { data: { persona: 'reviewer' } })).status()).toBe(404);
  await page.goto('/app'); await openDirect(page); await expect(page.getByRole('heading', { name: '우리 사업장 관리 업무' })).toBeVisible();
});

test('모든 후보의 공통 기록·핵심 계획 양식, 검색 복원·모바일 표시', async ({ page }) => {
  await start(page, 'REVIEW-078');
  await page.getByLabel('확인 메모').fill('개인정보가 없는 시험용 교육 준비 메모');
  await record(page);
  await page.goto('/app?catalog=all&q=개인정보&status=managed'); await openDirect(page);
  const link = page.locator('.task-ledger').getByRole('link', { name: /개인정보취급자 보호 교육/ });
  await expect(link).toBeVisible(); await link.click();
  await page.getByRole('link', { name: '← 업무 목록' }).click();
  await expect(page.getByRole('searchbox', { name: '업무 검색' })).toHaveValue('개인정보');
  await expect(page.getByRole('combobox', { name: '업무 상태' })).toHaveValue('managed');
  await page.goto('/app/tasks/new?definition=FORM_PLAN&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await page.getByLabel('확인한 목표').fill('다음 점검의 확인 사항 정리');
  await record(page); await page.reload();
  await expect(page.getByLabel('결정된 예산')).toHaveValue('');
  await page.goto('/app?catalog=all'); await openDirect(page);
  for (const width of [320, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 900 });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: 'test-results/task-list-mobile.png', fullPage: false });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/task-list-desktop.png', fullPage: false });
});
