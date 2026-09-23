import { expect, test, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { completeProfile, startProfile } from './profile';

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function unobstructed(input: Locator) {
  expect(await input.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return [rect.top + 4, rect.bottom - 4].every(y => document.elementFromPoint(rect.left + rect.width / 2, y) === element);
  })).toBe(true);
}

test('간결한 홈의 실제 글꼴·모바일·확대와 폰트 실패 시 다음 행동', async ({ page }) => {
  test.setTimeout(120_000);
  await startProfile(page); await completeProfile(page); await page.goto('/app');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => Array.from(document.fonts).some(font => font.family.includes('pretendard') && font.status === 'loaded'))).toBe(true);
  const hero = page.getByRole('region', { name: '지금 함께 할 한 가지' });
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await noOverflow(page);
    await expect(hero.getByRole('link', { name: '작업과 장소 정하기' })).toBeVisible();
    const primary = await hero.getByRole('link', { name: '작업과 장소 정하기' }).boundingBox();
    expect(primary!.y).toBeGreaterThanOrEqual(0);
    expect(primary!.y + primary!.height).toBeLessThan(732);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/readability-home-${width}.png`, fullPage: true });
  }
  // Enlarge the rendered content, including controls, in addition to the mobile reflow check.
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await noOverflow(page);
  await expect(hero.getByRole('link', { name: '작업과 장소 정하기' })).toBeVisible();
  await page.screenshot({ path: 'test-results/readability-home-200percent.png', fullPage: true });
  await page.evaluate(() => { document.body.style.zoom = ''; });
  // A fresh context avoids the already downloaded font cache.
  const fallback = await page.context().browser()!.newContext({ viewport: { width: 360, height: 900 } });
  try {
    await fallback.addCookies(await page.context().cookies());
    const fallbackPage = await fallback.newPage();
    await fallbackPage.route('**/*.woff2', route => route.abort());
    await fallbackPage.goto(new URL('/app', page.url()).href);
    await noOverflow(fallbackPage);
    await fallbackPage.getByRole('region', { name: '지금 함께 할 한 가지' }).getByRole('link', { name: '작업과 장소 정하기' }).click();
    await expect(fallbackPage.getByRole('button', { name: '관리 시작', exact: true })).toBeVisible();
  } finally { await fallback.close(); }
});

test('그림 설명의 수동 이동·키보드·입력 보존과 저장 실패·재개', async ({ page }) => {
  test.setTimeout(120_000);
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await page.locator('.journey-step-picker>summary').click();
  await page.getByRole('navigation', { name: '위험성평가 진행 단계' }).getByRole('button', { name: /위험요인 찾기/ }).click();
  const form = page.locator('form[data-save-state]');
  await expect(form).toHaveAttribute('data-save-state', 'ready');
  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  await page.getByLabel('어떤 작업인가요?').fill('이용자가 확인한 운반 작업');
  const dataBefore = await page.locator('input[name="risk_assessment"]').inputValue();
  const help = page.locator('.risk-workflow').getByRole('button', { name: '모르겠어요 · 예시 보기' });
  await help.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '다칠 수 있는 상황을 찾아요' })).toBeVisible();
  const next = dialog.getByRole('button', { name: '다음 설명' });
  await next.focus(); await page.keyboard.press('Enter');
  await expect(dialog.getByRole('heading', { name: '그곳에서 일하는 사람에게 물어요' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('heading', { name: '확인한 위치와 상황을 적어요' })).toBeVisible();
  await expect(next).toBeDisabled();
  await page.setViewportSize({ width: 360, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await dialog.locator('.story-frame').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await noOverflow(page);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/readability-story-360.png', fullPage: true });
  await page.keyboard.press('Escape'); await expect(help).toBeFocused();
  await expect(page.locator('input[name="risk_assessment"]')).toHaveValue(dataBefore);
  await expect(page.getByLabel('어디에서 하나요?')).toHaveValue('');
  await expect(form).toHaveAttribute('data-save-state', 'dirty');
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await noOverflow(page);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.locator('.risk-step-panel').screenshot({ path: `test-results/readability-risk-${width}.png` });
  }
  await page.route('**/app/tasks/**', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: '저장하고 다음', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'error');
  await expect(page.locator('input[name="risk_assessment"]')).toHaveValue(dataBefore);
  await page.unroute('**/app/tasks/**');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await page.reload();
  await expect(page.getByLabel('어떤 작업인가요?')).toHaveValue('이용자가 확인한 운반 작업');
  await expect(page.getByLabel('어디에서 하나요?')).toHaveValue('');
  await expect(page.locator('.record-statuses')).toContainText('수행 기록 없음');
});


test('모바일 첫 화면의 입력·하단 저장과 도움말 복귀', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await startProfile(page);
  const first = page.getByLabel('사업장명', { exact: true });
  const firstBox = await first.boundingBox();
  expect(firstBox!.y + firstBox!.height).toBeLessThan(800);
  await unobstructed(first);
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeHidden();
  await first.fill('현장 모바일 시험');
  await page.getByRole('button', { name: '모르겠어요 · 예시 보기' }).click();
  const dialog = page.getByRole('dialog');
  await expect.poll(async () => { const box = await dialog.boundingBox(); return Math.round(box!.y + box!.height); }).toBe(800);
  expect((await dialog.boundingBox())!.width).toBe(360);
  await page.keyboard.press('Escape');
  await expect(first).toHaveValue('현장 모바일 시험');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'test-results/redesign-profile-360.png' });
  await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const scope = page.getByLabel('함께 살펴볼 작업·장소');
  const scopeBox = await scope.boundingBox();
  expect(scopeBox!.y + scopeBox!.height).toBeLessThan(800);
  await unobstructed(scope);
  await page.screenshot({ path: 'test-results/redesign-risk-first-360.png' });
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeHidden();
  await scope.fill('기계실 순회 점검');
  await unobstructed(scope);
  await page.getByRole('button', { name: '저장하고 다음', exact: true }).scrollIntoViewIfNeeded();
  const save = page.getByRole('button', { name: '저장하고 다음', exact: true });
  const saveBox = await save.boundingBox();
  expect(saveBox!.y).toBeGreaterThanOrEqual(0);
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(800);
  await save.click();
  await expect(page.getByRole('heading', { name: '판단 기준', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '판단 기준', exact: true })).toBeVisible();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'test-results/redesign-risk-360.png' });
});
