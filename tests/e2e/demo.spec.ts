import { actorPage, closeActors } from './actors';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.afterEach(closeActors);
async function start(page: Page) { await page.goto('/demo'); await page.getByRole('button', { name: '새 체험 시작', exact: true }).click(); await expect(page).toHaveURL(/\/app$/); }
async function persona(page: Page, name: string) {
  const roles: Record<string, 'member-a' | 'member-b' | 'reviewer' | 'unassigned'> = { 'A 고객 담당자': 'member-a', 'B 고객 담당자': 'member-b', 'JH 배정 검토자': 'reviewer', '미배정 검토자': 'unassigned' };
  return actorPage(page, roles[name]);
}
async function save(page: Page, name: string) {
  const before = await page.locator('input[name="revision"]').first().inputValue();
  await page.getByRole('button', { name, exact: true }).click();
  if (name === '보완 요청 보내기' || name === '자료 검토 완료') {
    await expect(page.getByLabel('고객에게 전달할 의견')).toHaveCount(0);
  } else {
    await expect(page.locator('input[name="revision"]').first()).toHaveValue(String(Number(before) + 1));
  }
}

test('회원 제출 → 운영자 보완 → 새 버전 재제출 → 검토, 내부 메모·다른 고객 차단', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await start(page);
  await page.goto('/app/obligations/facility-1');
  await page.getByLabel('확인 위치', { exact: true }).fill('가상 통로');
  await page.getByLabel('직접 확인한 내용').fill('가상 샘플에서 통로에 물품이 보임. 실제 상태 확인 필요.');
  await save(page, '샘플 사진 첨부');
  await expect(page.getByText('수행 기록 없음')).toBeVisible();
  await save(page, 'v1 내용 확인'); await save(page, '검토 요청');
  await page.reload(); await expect(page.getByText('이 버전은 검토 요청한 자료입니다.')).toBeVisible();
  page = await persona(page, 'JH 배정 검토자');
  await page.getByRole('link', { name: /현장 사진 점검 기록.*검토하기/ }).click();
  await expect(page).toHaveURL(/\/ops\/reviews\/[^/]+$/);
  const reviewPath = new URL(page.url()).pathname;
  await page.getByLabel('확인 항목·자료 위치').fill('v1 확인 위치');
  await page.getByLabel('고객에게 전달할 의견').fill('확인 요청: 층과 구역을 적고 새 버전으로 제출해주세요.');
  await page.getByLabel('내부 메모 · 고객 비공개').fill('INTERNAL_ONLY_SENTINEL');
  await save(page, '보완 요청 보내기');
  page = await persona(page, 'A 고객 담당자');
  await page.goto('/app/obligations/facility-1');
  await expect(page.getByText('확인 요청: 층과 구역을 적고 새 버전으로 제출해주세요.')).toBeVisible();
  expect(await page.content()).not.toContain('INTERNAL_ONLY_SENTINEL');
  await page.getByLabel('확인 위치', { exact: true }).fill('가상 시설 1층 동쪽 통로');
  await save(page, '자체 서식 초안 만들기'); await save(page, 'v2 내용 확인'); await save(page, '검토 요청');
  page = await persona(page, 'JH 배정 검토자');
  await page.getByRole('link', { name: /현장 사진 점검 기록.*검토하기/ }).click();
  await page.getByLabel('확인 항목·자료 위치').fill('v2 확인 위치');
  await page.getByLabel('고객에게 전달할 의견').fill('자료의 위치 항목을 확인했습니다. 현장 이행은 별도 확인 대상입니다.');
  await save(page, '자료 검토 완료');
  page = await persona(page, 'A 고객 담당자'); await page.goto('/app/obligations/facility-1');
  await expect(page.getByText('자료 검토 완료', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('수행 기록 없음')).toBeVisible();
  await expect(page.getByText('필요 여부·접수 미확인')).toBeVisible();
  await page.getByText(/^v1 · /).click(); await expect(page.getByText('가상 통로', { exact: true })).toBeVisible();
  page = await persona(page, 'B 고객 담당자'); await page.goto('/app/obligations/facility-1');
  await expect(page.getByRole('heading', { name: '이 자료를 찾을 수 없습니다.' })).toBeVisible();
  await page.goto('/app'); page = await persona(page, '미배정 검토자'); await page.goto(reviewPath);
  await expect(page.getByRole('heading', { name: '이 자료를 찾을 수 없습니다.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('입력·임시 저장·확인, 0과 미응답, 모름 처리', async ({ page }) => {
  await start(page); await page.goto('/onboarding');
  await page.getByRole('button', { name: '가상 후보 보기' }).click();
  await expect(page.getByText('읽기 후보 · 아직 확정되지 않았어요')).toBeVisible();
  await page.getByRole('button', { name: '후보를 입력란으로 가져오기' }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('직접고용 인원', { exact: false }).first().fill('0');
  await page.getByLabel('다른 업체 소속 작업 인원').fill('');
  await page.getByLabel('다른 업체와 함께 작업하나요?').selectOption('unknown');
  await page.getByRole('button', { name: '임시 저장' }).click();
  await expect(page.getByText('임시 저장했습니다.', { exact: false })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByLabel('직접고용 인원', { exact: false }).first()).toHaveValue('0');
  await expect(page.getByLabel('다른 업체 소속 작업 인원')).toHaveValue('');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '확인한 정보 저장' }).click();
  await expect(page.getByText('사업장 정보를 확인했습니다.', { exact: false })).toBeVisible();
  await page.goto('/app/obligations');
  await expect(page.getByRole('link', { name: /함께 일하는 업체 정보 확인.*확인 필요/ })).toBeVisible();
});

test('360px·확대 상당 폭·접근성·공개 긴급 경로', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await start(page);
  await expect(page.getByRole('heading', { name: '사업장 정보 입력' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  const zoomContext = await page.context().browser()!.newContext({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 2 });
  await zoomContext.addCookies(await page.context().cookies());
  const zoomPage = await zoomContext.newPage();
  await zoomPage.goto(new URL('/app', page.url()).href);
  expect(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await zoomPage.screenshot({ path: 'test-results/home-200percent-equivalent.png', fullPage: true });
  await zoomContext.close();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.context().clearCookies(); await page.goto('/emergency');
  await expect(page.locator('a[href="tel:119"]')).toBeVisible();
  await expect(page.locator('a[href="tel:112"]')).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('a[href="tel:119"]')).toBeFocused();
  expect(await page.context().cookies()).toHaveLength(0);
});

test('전송 실패 시 입력을 유지하고 재시도할 수 있음', async ({ page }) => {
  await start(page); await page.goto('/app/obligations/facility-1');
  await page.getByLabel('확인 위치', { exact: true }).fill('연결 복구 후에도 남아야 할 가상 위치');
  await page.route('**/*', route => route.request().method() === 'POST' ? route.abort('connectionrefused') : route.continue());
  await page.getByRole('button', { name: '샘플 사진 첨부', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '연결이 끊어져' })).toBeVisible();
  await expect(page.getByLabel('확인 위치', { exact: true })).toHaveValue('연결 복구 후에도 남아야 할 가상 위치');
  await page.unrouteAll({ behavior: 'wait' });
  await save(page, '샘플 사진 첨부');
  await expect(page.getByRole('button', { name: 'v1 내용 확인' })).toBeVisible();
});
