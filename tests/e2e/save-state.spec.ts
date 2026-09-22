import { expect, test, type Page } from '@playwright/test';
import { expertRisk, completeProfile, nextProfileStep, startProfile } from './profile';

async function startRisk(page: Page) {
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page.locator('.risk-workflow')).toBeVisible(); await expertRisk(page);
  return page.locator('form').filter({ has: page.locator('input[name="task_revision"]') });
}

test('사업장 단계 이동은 변경이 아니며 원래 값 복원·실패·저장·재열람을 구분한다', async ({ page }) => {
  await startProfile(page);
  const form = page.locator('form').filter({ has: page.locator('input[name="profile_revision"]') });
  await expect(form).toHaveAttribute('data-save-state', 'ready');
  await nextProfileStep(page);
  await expect(form).toHaveAttribute('data-save-state', 'ready');
  await page.getByRole('button', { name: '이전', exact: true }).click();
  const name = page.getByLabel('사업장명', { exact: true }), original = await name.inputValue();
  await name.fill('저장 상태 시험'); await expect(form).toHaveAttribute('data-save-state', 'dirty');
  await name.fill(original); await expect(form).toHaveAttribute('data-save-state', 'ready');
  await name.fill('저장 후 다시 확인할 사업장');
  await page.route('**/app**', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'error');
  await expect(name).toHaveValue('저장 후 다시 확인할 사업장');
  await expect(form.getByRole('alert')).toContainText('입력을 유지한 채');
  await page.unroute('**/app**');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  const dialogs: string[] = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.reload();
  await expect(name).toHaveValue('저장 후 다시 확인할 사업장');
  await completeProfile(page);
  expect(dialogs).toEqual([]);
});

test('위험요인 추가·삭제와 입력 복원, 저장 중 상태, 앱 링크 이탈 확인', async ({ page }) => {
  const form = await startRisk(page);
  const path = page.url();
  const steps = page.getByRole('navigation', { name: '위험성평가 진행 단계' });
  await steps.getByRole('button', { name: /위험요인 찾기/ }).click();
  await expect(form).toHaveAttribute('data-save-state', 'ready');
  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'dirty');
  await page.getByRole('button', { name: '이 위험요인 입력 취소', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'ready');
  await steps.getByRole('button', { name: /준비·방법/ }).click();
  const scope = page.getByLabel('함께 살펴볼 작업·장소');
  await scope.fill('저장 상태 확인 작업');
  await expect(form).toHaveAttribute('data-save-state', 'dirty');
  await scope.fill(''); await expect(form).toHaveAttribute('data-save-state', 'ready');
  const notes = page.getByRole('textbox', { name: '확인 메모', exact: true });
  await notes.fill('저장할 메모'); await expect(form).toHaveAttribute('data-save-state', 'dirty');
  const emergencyOpened = page.waitForEvent('popup');
  await page.getByRole('link', { name: '사고·긴급 연락 (새 창)', exact: true }).first().click();
  const emergency = await emergencyOpened;
  await expect(emergency.locator('a[href="tel:119"]')).toBeVisible();
  await emergency.close();
  await expect(notes).toHaveValue('저장할 메모');
  await expect(form).toHaveAttribute('data-save-state', 'dirty');
  const back = page.getByRole('link', { name: '← 업무 목록', exact: true });
  let prompt = '';
  page.once('dialog', async dialog => { prompt = dialog.message(); await dialog.dismiss(); });
  await back.click();
  await expect(page).toHaveURL(path); expect(prompt).toContain('저장하지 않은 변경사항');
  await expect(notes).toHaveValue('저장할 메모');
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(true);
  let releaseSave: () => void = () => {}, intercepted = false;
  await page.route('**/app/tasks/**', async route => {
    if (route.request().method() === 'POST') await new Promise<void>(resolve => { releaseSave = resolve; intercepted = true; });
    await route.continue();
  });
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saving');
  await expect(form.locator('.form-save-state')).toHaveText('저장 중…');
  await expect.poll(() => intercepted).toBe(true);
  releaseSave();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await page.unroute('**/app/tasks/**');
  await notes.fill('새 메모'); await expect(form).toHaveAttribute('data-save-state', 'dirty');
  await notes.fill('저장할 메모'); await expect(form).toHaveAttribute('data-save-state', 'saved');
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(false);
  const unexpected: string[] = [];
  page.on('dialog', async dialog => { unexpected.push(dialog.message()); await dialog.dismiss(); });
  await back.click(); await expect(page).not.toHaveURL(path);
  expect(unexpected).toEqual([]);
});

test('지원 브라우저의 뒤로가기 취소는 입력과 URL을 유지하고 승인하면 이동한다', async ({ page }) => {
  const form = await startRisk(page);
  test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API 미지원: 앱 링크·새로고침/닫기 보호는 별도 검사');
  const path = page.url();
  await page.getByLabel('확인 메모').fill('뒤로가기 전 아직 저장하지 않은 메모');
  await expect(form).toHaveAttribute('data-save-state', 'dirty');
  let prompt = '';
  page.once('dialog', async dialog => { prompt = dialog.message(); await dialog.dismiss(); });
  await page.evaluate(() => history.back());
  await expect.poll(() => prompt).toContain('저장하지 않은 변경사항');
  await expect(page).toHaveURL(path);
  await expect(page.getByLabel('확인 메모')).toHaveValue('뒤로가기 전 아직 저장하지 않은 메모');
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => history.back());
  await expect(page).not.toHaveURL(path);
});

test('미저장·저장 중에는 다른 폼의 검토 요청을 막고 저장한 새 버전만 제출한다', async ({ page }) => {
  const form = await startRisk(page);
  const notes = form.getByRole('textbox', { name: '확인 메모', exact: true });
  await notes.fill('검토 전에 저장한 첫 기록');
  await form.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await page.getByRole('button', { name: 'v1 내용 확인', exact: true }).click();
  const submitReview = page.getByRole('button', { name: '검토 요청', exact: true });
  await expect(submitReview).toBeVisible();
  await notes.fill('아직 저장하지 않은 보완 기록');
  await submitReview.click();
  const blocked = form.getByRole('alert');
  await expect(blocked).toHaveText('작성 중인 내용을 먼저 임시 저장해주세요. 저장하지 않은 내용은 다른 동작에 포함되지 않습니다.');
  await expect(blocked).toBeFocused();
  await expect(notes).toBeEditable();
  await expect(form).toHaveAttribute('data-save-state', 'dirty');
  await expect(page.getByText('검토를 기다리고 있습니다.', { exact: true })).toHaveCount(0);
  await expect(page.locator('#stored-record')).not.toContainText('아직 저장하지 않은 보완 기록');
  let releaseSave: () => void = () => {}, intercepted = false;
  await page.route('**/app/tasks/**', async route => {
    if (route.request().method() === 'POST') await new Promise<void>(resolve => { releaseSave = resolve; intercepted = true; });
    await route.continue();
  });
  await form.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saving');
  await expect.poll(() => intercepted).toBe(true);
  await submitReview.click();
  await expect(blocked).toBeFocused();
  await expect(page.getByText('검토를 기다리고 있습니다.', { exact: true })).toHaveCount(0);
  releaseSave();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await page.unroute('**/app/tasks/**');
  await expect(blocked).toHaveCount(0);
  await expect(page.locator('#stored-record')).toContainText('아직 저장하지 않은 보완 기록');
  await page.getByRole('button', { name: 'v2 내용 확인', exact: true }).click();
  await submitReview.click();
  await expect(page.getByText('검토를 기다리고 있습니다.', { exact: true })).toBeVisible();
  await expect(page.locator('.feedback.review-queued')).toContainText('v2');
});

test('작성 중 revision이 갱신되어도 작성 시작 기준을 사용하고 다른 탭의 저장과 충돌한다', async ({ page }) => {
  const form = await startRisk(page);
  const notes = form.getByRole('textbox', { name: '확인 메모', exact: true });
  const revision = form.locator('input[name="task_revision"]');
  await notes.fill('작성 기준 첫 저장');
  await form.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  const before = Number(await revision.inputValue());
  await notes.fill('현재 작성 기준으로 저장할 메모');
  await expect(form).toHaveAttribute('data-save-state', 'dirty');
  // Simulate an unrelated server refresh changing hidden metadata without replacing the draft.
  await revision.evaluate((input, value) => { (input as HTMLInputElement).value = String(value); }, before + 100);
  await form.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await expect(revision).toHaveValue(String(before + 1));
  await notes.fill('충돌해도 화면에 유지할 미저장 메모');
  await expect(form).toHaveAttribute('data-save-state', 'dirty');
  const other = await page.context().newPage();
  try {
    await other.goto(page.url()); await expertRisk(other);
    const otherForm = other.locator('form').filter({ has: other.locator('input[name="task_revision"]') });
    await otherForm.getByRole('textbox', { name: '확인 메모', exact: true }).fill('다른 탭에서 먼저 저장한 메모');
    await otherForm.getByRole('button', { name: '임시 저장', exact: true }).click();
    await expect(otherForm).toHaveAttribute('data-save-state', 'saved');
    const newerTaskRevision = await otherForm.locator('input[name="task_revision"]').inputValue();
    const newerDocumentRevision = await otherForm.locator('input[name="document_revision"]').inputValue();
    await revision.evaluate((input, value) => { (input as HTMLInputElement).value = value; }, newerTaskRevision);
    await form.locator('input[name="document_revision"]').evaluate((input, value) => { (input as HTMLInputElement).value = value; }, newerDocumentRevision);
    await form.getByRole('button', { name: '임시 저장', exact: true }).click();
    await expect(form).toHaveAttribute('data-save-state', 'error');
    await expect(form.getByRole('alert')).toContainText('다른 변경이 먼저 저장되었습니다.');
    await expect(notes).toHaveValue('충돌해도 화면에 유지할 미저장 메모');
    await other.reload(); await expertRisk(other);
    await expect(otherForm.getByRole('textbox', { name: '확인 메모', exact: true })).toHaveValue('다른 탭에서 먼저 저장한 메모');
  } finally { await other.close(); }
});
