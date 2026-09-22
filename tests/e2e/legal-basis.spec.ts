import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expertRisk, completeProfile, startProfile } from './profile';

async function start(page: Page) {
  await startProfile(page);
  await completeProfile(page);
}

async function expectRecordsBeforeBasis(page: Page, withDocument = false) {
  const basis = page.getByRole('region', { name: '근거 법령·준비 이유', exact: true });
  await expect(basis).toBeVisible();
  expect(await basis.evaluate(element => {
    const records = [...document.querySelectorAll('.record-section, .document-sections')];
    return records.length > 0 && records.every(record =>
      !!(record.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  if (withDocument) {
    await expect(page.locator('.document-sections')).toBeVisible();
    await expect(page.getByRole('heading', { name: '증빙 자료', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '실제 수행 기록', exact: true })).toBeVisible();
  }
}

test('목록의 근거 → 활동·기록 조문 → 관리 시작 후에도 원문과 조건 확인', async ({ page }) => {
  await start(page);
  const row = page.locator('#task-REVIEW-003');
  await expect(row).toContainText('근거: 산업안전보건법 제36조제1항');
  await row.getByRole('link').click();
  const basis = page.getByRole('region', { name: '근거 법령·준비 이유', exact: true });
  await expectRecordsBeforeBasis(page);
  await expect(basis.getByText('조문 본문 확인 · 적용 검토 필요', { exact: true })).toBeVisible();
  await expect(basis.getByText('활동 수행 의무', { exact: true }).first()).toBeHidden();
  await basis.getByText('근거와 적용 조건 자세히 보기', { exact: true }).click();
  await expect(basis.getByText('활동 수행 의무', { exact: true }).first()).toBeVisible();
  await expect(basis.getByText('기록·보존 의무', { exact: true }).first()).toBeVisible();
  const source = basis.getByRole('link', { name: /제36조제5항 원문 확인/ });
  await expect(source).toHaveAttribute('href', /law\.go\.kr\/LSW\/lsInfoP\.do\?.*lsiSeq=283449/);
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(basis).toContainText('확인한 시행본 2026-08-01');
  await expect(basis).toContainText('조문 본문 확인 · 적용 검토 필요');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+/);
  await page.reload();
  await expectRecordsBeforeBasis(page);
  await expect(basis.getByText('활동 수행 의무', { exact: true }).first()).toBeHidden();
  await expertRisk(page);
  await page.getByLabel('확인 메모', { exact: true }).fill('순서 검증용 메모 · 실제 수행 여부는 미확인');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.locator('.document-sections')).toBeVisible();
  await page.reload();
  await expectRecordsBeforeBasis(page, true);
  await basis.getByText('근거와 적용 조건 자세히 보기', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(source).toBeVisible();
  for (const width of [320, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/legal-basis-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 900 });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await basis.screenshot({ path: 'test-results/legal-basis-mobile.png' });
});

test('미확인 조문과 자체 서식을 구분하고 기존 후보 목록에도 같은 근거 표시', async ({ page }) => {
  await start(page);
  await page.goto('/app/tasks/new?definition=REVIEW-045&workplace=facility');
  const basis = page.getByRole('region', { name: '근거 법령·준비 이유', exact: true });
  await expect(basis.getByText('조문 확인 중', { exact: true })).toBeVisible();
  await basis.getByText('근거와 적용 조건 자세히 보기', { exact: true }).click();
  await expect(basis).toContainText('법 제128조의2');
  await expect(basis.getByRole('link', { name: /휴게시설 설치·관리 기준 안내/ })).toBeVisible();
  await expect(basis.getByText('조문 본문 확인 · 적용 검토 필요', { exact: true })).toHaveCount(0);
  for (const id of ['FORM_PHOTO','FORM_PLAN']) {
    await page.goto(`/app/tasks/new?definition=${id}&workplace=facility`);
    await basis.getByText('근거와 적용 조건 자세히 보기', { exact: true }).click();
    await expect(basis.getByText('특정 조문 미연결 · 자체 서식', { exact: true })).toBeVisible();
    await expect(basis.getByRole('link', { name: /원문 확인/ })).toHaveCount(0);
  }
  await page.goto('/app/tasks/new?definition=FORM_REGISTRATION&workplace=facility');
  await expect(page).toHaveURL(/\/app\?setup=1/);
  await expect(page.getByRole('heading', { name: '사업장 정보 입력', exact: true })).toBeVisible();
  await page.goto('/app/checklists');
  await page.getByRole('searchbox').fill('위험성평가와 개선 추적');
  await page.locator('#REVIEW-003 > summary').click();
  await expect(page.locator('#REVIEW-003').getByRole('region', { name: '근거 법령·준비 이유' })).toContainText('제36조제5항');
});
