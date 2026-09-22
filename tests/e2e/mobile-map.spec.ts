import { expect, test, type Locator } from '@playwright/test';
import { startProfile } from './profile';

async function inUsableViewport(locator: Locator) {
  await expect.poll(() => locator.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const navigation = document.querySelector('.main-nav')?.getBoundingClientRect();
    const bottom = navigation && navigation.top > 0 ? Math.min(innerHeight, navigation.top) : innerHeight;
    return bounds.top >= 0 && bounds.bottom <= bottom;
  })).toBe(true);
}

test('모바일 지도 분야 선택은 제목과 첫 행동으로 이동하고 키보드로 이어진다', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await startProfile(page);
  await page.goto('/app/map');
  const branches = page.getByRole('navigation', { name: '관리 분야', exact: true });
  for (const [motion, group] of [['reduce', '담당자와 관리체계'], ['no-preference', '교육과 훈련']] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await branches.getByRole('button', { name: new RegExp(group) }).click();
    const detail = page.getByRole('region', { name: group, exact: true });
    const title = detail.getByRole('heading', { name: group, exact: true });
    await expect(title).toBeFocused();
    await inUsableViewport(title);
    const firstAction = detail.locator('.journey-candidate > summary').first();
    await inUsableViewport(firstAction);
    await page.keyboard.press('Tab');
    await expect(firstAction).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(detail.getByRole('link', { name: '사업장 정보부터 확인하기' }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/mobile-map-selection-360.png', fullPage: true });
});

test('넓은 화면에서 지도 분야 선택은 기존 버튼 포커스와 스크롤을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startProfile(page);
  await page.goto('/app/map');
  const button = page.getByRole('navigation', { name: '관리 분야', exact: true }).getByRole('button', { name: /담당자와 관리체계/ });
  await button.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await button.click();
  await expect(button).toBeFocused();
  await expect(page.locator('#journey-branch-detail').getByRole('heading', { name: '담당자와 관리체계', exact: true })).not.toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(before);
});
