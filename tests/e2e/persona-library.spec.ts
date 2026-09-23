import { expect, test } from '@playwright/test';
import { completeProfile, startProfile } from './profile';

test('자료함 첫 결과와 접힌 검색 조건을 모바일·PC·키보드로 확인한다', async ({ page }) => {
  test.setTimeout(120_000);
  await startProfile(page);
  await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await page.getByLabel('함께 살펴볼 작업·장소').fill('자료함에서 다시 찾는 가상 계단 청소 기록');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.locator('#stored-record')).toContainText('v1');
  const taskPath = new URL(page.url()).pathname;
  await page.goto('/app/documents');
  const list = page.getByRole('region', { name: '자료 찾기', exact: true });
  const filters = list.locator('.document-search-filters');
  const filterToggle = filters.locator('summary');
  const query = list.getByRole('searchbox', { name: '자료 제목' });
  const search = list.getByRole('button', { name: '검색', exact: true });
  const result = list.getByRole('link', { name: /위험성평가와 개선 추적 1회차/ });
  await expect(filters).toHaveJSProperty('open', false);
  await expect(list.getByRole('status')).toHaveText('검색 결과 1건');
  await expect(list.locator('.document-applied-filters')).toHaveText('적용 조건: 전체 현장 · 모든 상태');

  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect(query).toBeVisible();
    await expect(search).toBeVisible();
    const boundary = await page.getByRole('navigation', { name: '주요 메뉴' }).evaluate(element =>
      getComputedStyle(element).position === 'fixed' ? element.getBoundingClientRect().top : innerHeight);
    const title = result.locator('strong');
    const box = await title.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(boundary);
    expect(await title.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === element;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/persona-library-${width}.png` });
  }

  await page.setViewportSize({ width: 360, height: 800 });
  await query.fill('위험성평가');
  await filterToggle.focus();
  await page.keyboard.press('Enter');
  await expect(filters).toHaveJSProperty('open', true);
  await page.keyboard.press('Tab');
  const workplace = list.getByRole('combobox', { name: '현장', exact: true });
  await expect(workplace).toBeFocused();
  await workplace.selectOption('facility');
  await page.keyboard.press('Tab');
  const status = list.getByRole('combobox', { name: '자료 상태' });
  await expect(status).toBeFocused();
  await status.selectOption('not_requested');
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(list.getByRole('status')).toHaveText('검색 결과 1건');
  await expect(page).toHaveURL(/workplace=facility.*status=not_requested/);
  await expect(query).toHaveValue('위험성평가');
  await expect(filters).toHaveJSProperty('open', true);
  await expect(list.locator('.document-applied-filters')).toContainText('한결 시설관리');
  await expect(list.locator('.document-applied-filters')).toContainText('자료 준비');
  await expect(list.locator('.document-applied-filters')).toContainText('제목 “위험성평가”');

  await filterToggle.focus();
  await page.keyboard.press('Enter');
  await expect(filters).toHaveJSProperty('open', false);
  await expect(workplace).toBeHidden();
  await expect(list.locator('.document-applied-filters')).toBeVisible();
  await page.reload();
  await expect(filters).toHaveJSProperty('open', true);
  await expect(workplace).toHaveValue('facility');
  await expect(status).toHaveValue('not_requested');
  await expect(query).toHaveValue('위험성평가');

  await query.fill('찾을 수 없는 제목');
  await query.press('Enter');
  await expect(list.getByRole('heading', { name: '조건에 맞는 자료가 없어요' })).toBeVisible();
  await expect(list.getByRole('status')).toHaveText('검색 결과 0건');
  await expect(workplace).toHaveValue('facility');
  await list.getByRole('link', { name: '조건 지우기', exact: true }).click();
  await expect(filters).toHaveJSProperty('open', false);
  await expect(query).toHaveValue('');
  await expect(list.locator('.document-applied-filters')).toHaveText('적용 조건: 전체 현장 · 모든 상태');
  await expect(list.getByRole('status')).toHaveText('검색 결과 1건');
  await result.click();
  await expect(page).toHaveURL(taskPath);
  await expect(page.locator('#stored-record')).toContainText('자료함에서 다시 찾는 가상 계단 청소 기록');
});
