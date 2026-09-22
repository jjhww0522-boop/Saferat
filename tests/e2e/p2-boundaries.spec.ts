import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('미연결 회원 공간은 로그인·업로드를 받지 않고 긴급 안내는 열린다', async ({ page, request }) => {
  await page.goto('/login');
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole('heading', { name: '회원 작업 공간 연결을 준비하고 있습니다' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: 'test-results/p2-login-mobile.png', fullPage: true });
  await page.goto('/workspace');
  await expect(page).toHaveURL(/\/login$/);
  const file = await request.get('/api/files/11111111-1111-4111-8111-111111111111');
  expect(file.status()).toBe(503);
  expect(file.headers()['cache-control']).toContain('no-store');
  const upload = await request.post('/api/files', { headers: { origin: new URL(page.url()).origin }, data: '%PDF-1.7' });
  expect(upload.status()).toBe(503);
  const crossOrigin = await request.post('/api/files', { headers: { origin: 'https://untrusted.example.test' }, data: '%PDF-1.7' });
  expect(crossOrigin.status()).toBe(403);
  await page.getByRole('link', { name: '사고·긴급 연락', exact: true }).click();
  await expect(page).toHaveURL(/\/emergency$/);
  await expect(page.locator('a[href="tel:119"]')).toBeVisible();
});
