import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expertRisk, completeProfile, startProfile } from './profile';
import { actorPage, closeActors } from './actors';

async function save(page: Page) {
  const revision = page.locator('input[name="task_revision"]');
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
}
async function download(page: Page, name: string, filename: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name, exact: true }).click();
  const file = await pending;
  await file.saveAs(`test-results/${filename}`);
  expect(await file.failure()).toBeNull();
  return { text: await readFile(`test-results/${filename}`, 'utf8'), suggested: file.suggestedFilename() };
}
test.afterEach(closeActors);

test('저장·보완·과거 버전 다운로드와 권한·인쇄·상태 분리', async ({ page, browser }) => {
  // Includes saved versions, downloads, print/PDF, accessibility, and four access contexts.
  test.setTimeout(180_000);
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page.locator('.risk-workflow')).toBeVisible(); await expertRisk(page);
  await expect(page.locator('.risk-export')).toHaveCount(0);
  await page.getByLabel('함께 살펴볼 작업·장소').fill('시험 세척장');
  await page.getByRole('navigation', { name: '위험성평가 진행 단계' }).getByRole('button', { name: /위험요인 찾기/ }).click();
  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  await page.getByLabel('무엇 때문에 어떻게 다칠 수 있나요?').fill('미끄러운 바닥');
  await page.getByRole('textbox', { name: '확인 메모', exact: true }).fill('원래 메모 <script>window.exportInjected=true</script>');
  await save(page);
  await page.getByRole('button', { name: '가상 사진 샘플 연결', exact: true }).click();
  await expect(page.getByText('가상 샘플 · 실제 현장 확인 자료가 아님')).toBeVisible();
  const oldUrl = await page.getByRole('link', { name: 'v1 원본 기록(JSON)', exact: true }).getAttribute('href');
  const revisionBeforeDownload = await page.locator('input[name="task_revision"]').inputValue();
  await page.getByRole('textbox', { name: '확인 메모', exact: true }).fill('미저장 메모');
  const first = JSON.parse((await download(page, 'v1 원본 기록(JSON)', 'risk-export-v1.json')).text);
  expect(first.record.notes).toContain('원래 메모');
  expect(first.record.notes).not.toContain('미저장');
  expect(first.demoSample).toBe(true);
  expect(first.version.confirmedAt).toBeNull();
  expect(first.activities).toEqual([]);
  expect(first.submissionStatus).toBe('needs_confirmation');
  await expect(page.locator('input[name="task_revision"]')).toHaveValue(revisionBeforeDownload);
  await page.getByRole('textbox', { name: '확인 메모', exact: true }).fill('보완한 메모');
  await save(page);
  await page.getByRole('button', { name: 'v2 내용 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '검토 요청', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '검토 요청', exact: true }).click();
  await expect(page.locator('.record-statuses')).toContainText('자료: 검토 대기');
  const current = JSON.parse((await download(page, 'v2 원본 기록(JSON)', 'risk-export-v2.json')).text);
  expect(current.record.notes).toBe('보완한 메모');
  expect(current.version.confirmedAt).not.toBeNull();
  expect(current.reviews[0].status).toBe('queued');
  expect(current.activities).toEqual([]);
  expect(current.submissionStatus).toBe('needs_confirmation');
  await page.locator('.version-history > summary').click();
  await page.getByRole('link', { name: 'v1', exact: true }).click();
  const oldAgain = JSON.parse((await download(page, 'v1 원본 기록(JSON)', 'risk-export-v1-again.json')).text);
  expect(oldAgain.version).toEqual(first.version);
  expect(oldAgain.reviews).toEqual([]);
  await expect(page.locator('.record-statuses')).toContainText('검토 대기');
  await expect(page.locator('.record-statuses')).toContainText('수행 기록 없음');
  await expect(page.locator('.record-statuses')).toContainText('기관 제출·접수: 미확인');
  const html = await download(page, 'v1 인쇄용 파일', 'risk-export-v1.html');
  expect(html.suggested).toBe(`risk-assessment-cycle1-v1-${first.version.id}.html`);
  expect(first.cycle.number).toBe(1);
  const report = await page.context().newPage();
  await report.setContent(html.text);
  await expect(report.getByRole('heading', { name: /위험요인 1 · 미끄러운 바닥/ })).toBeVisible();
  await expect(report.locator('body')).toContainText('원래 메모 <script>window.exportInjected=true</script>');
  expect(await report.evaluate(() => 'exportInjected' in window)).toBe(false);
  await expect(report.locator('body')).toContainText('미입력 · 확인 필요');
  for (const width of [360, 768, 1440]) {
    await report.setViewportSize({ width, height: 1000 });
    expect(await report.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect((await new AxeBuilder({ page: report }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await report.screenshot({ path: 'test-results/risk-export-desktop.png', fullPage: true });
  await report.emulateMedia({ media: 'print' });
  await expect(report.locator('.print-help')).toBeHidden();
  await expect(report.getByRole('heading', { name: /위험요인 1 · 미끄러운 바닥/ })).toBeVisible();
  await report.pdf({ path: 'test-results/risk-export-print.pdf', preferCSSPageSize: true });
  await report.close();
  await page.setViewportSize({ width: 360, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('.risk-export').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  const other = await actorPage(page, 'member-b');
  expect((await other.request.get(oldUrl!)).status()).toBe(404);
  const unassigned = await actorPage(page, 'unassigned');
  expect((await unassigned.request.get(oldUrl!)).status()).toBe(404);
  const reviewer = await actorPage(page, 'reviewer');
  expect((await reviewer.request.get(oldUrl!)).status()).toBe(200);
  const anonymous = await browser.newContext();
  try { expect((await anonymous.request.get(new URL(oldUrl!, page.url()).href)).status()).toBe(404); }
  finally { await anonymous.close(); }
});
