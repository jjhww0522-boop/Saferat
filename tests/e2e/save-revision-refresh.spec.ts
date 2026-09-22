import { expect, test, type Page } from '@playwright/test';
import { completeProfile, expertRisk, startProfile } from './profile';

function taskForm(page: Page) { return page.locator('form').filter({ has: page.locator('input[name="task_revision"]') }); }
async function refreshServerComponents(page: Page) {
  // Use the same Next.js router refresh as the file-list button, without a full
  // document reload that would hide stale client-state/updated-revision defects.
  await page.evaluate(() => {
    const router = (window as Window & { next?: { router?: { refresh(): void } } }).next?.router;
    if (!router) throw new Error('Next.js refresh unavailable');
    router.refresh();
  });
}
for (const dirty of [false, true]) test(`${dirty ? '수정 중인' : '깨끗한'} 입력의 서버 갱신도 이전 본문에 최신 revision을 붙여 덮어쓰지 않는다`, async ({ page }) => {
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page.locator('.risk-workflow')).toBeVisible(); await expertRisk(page);
  const form = taskForm(page), scope = page.getByLabel('함께 살펴볼 작업·장소');
  await scope.fill('처음 저장한 작업 범위');
  await form.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  if (dirty) await form.getByRole('textbox', { name: '확인 메모', exact: true }).fill('이 탭에서 추가한 메모');
  const other = await page.context().newPage();
  try {
    await other.goto(page.url()); await expertRisk(other);
    await other.getByLabel('함께 살펴볼 작업·장소').fill('다른 탭이 확정한 새 작업 범위');
    await taskForm(other).getByRole('button', { name: '임시 저장', exact: true }).click();
    await expect(taskForm(other)).toHaveAttribute('data-save-state', 'saved');
    const latestRevision = await taskForm(other).locator('input[name="task_revision"]').inputValue();
    await refreshServerComponents(page);
    await expect(form.locator('input[name="task_revision"]')).toHaveValue(latestRevision);
    if (!dirty) await form.getByRole('textbox', { name: '확인 메모', exact: true }).fill('이 탭에서 추가한 메모');
    await form.getByRole('button', { name: '임시 저장', exact: true }).click();
    await expect(form).not.toHaveAttribute('data-save-state', 'saving');
    if (await scope.inputValue() === '처음 저장한 작업 범위') {
      await expect(form).toHaveAttribute('data-save-state', 'error');
      await expect(form.getByRole('alert')).toContainText('다른 변경이 먼저 저장되었습니다.');
      await expect(form.getByRole('textbox', { name: '확인 메모', exact: true })).toHaveValue('이 탭에서 추가한 메모');
    } else {
      await expect(scope).toHaveValue('다른 탭이 확정한 새 작업 범위');
      await expect(form).toHaveAttribute('data-save-state', 'saved');
    }
    await other.reload(); await expertRisk(other);
    await expect(other.getByLabel('함께 살펴볼 작업·장소')).toHaveValue('다른 탭이 확정한 새 작업 범위');
  } finally { await other.close(); }
});

test('자신의 연속 저장과 증빙·내용 확인 뒤 보완은 본문에 맞는 기준으로 저장한다', async ({ page }) => {
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page.locator('.risk-workflow')).toBeVisible(); await expertRisk(page);
  const form = taskForm(page), save = form.getByRole('button', { name: '임시 저장', exact: true });
  await page.getByLabel('함께 살펴볼 작업·장소').fill('계속 보완할 작업 범위');
  await save.click(); await expect(form).toHaveAttribute('data-save-state', 'saved');
  await form.getByRole('textbox', { name: '확인 메모', exact: true }).fill('두 번째 저장');
  await save.click(); await expect(form).toHaveAttribute('data-save-state', 'saved');
  await expect(page.getByRole('button', { name: 'v2 내용 확인', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '가상 사진 샘플 연결', exact: true }).click();
  await expect(page.getByRole('img', { name: '실제 현장 사진이 아닌 가상 통로 도식' })).toBeVisible();
  await page.getByRole('button', { name: 'v2 내용 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '검토 요청', exact: true })).toBeVisible();
  await form.getByRole('textbox', { name: '확인 메모', exact: true }).fill('확인한 뒤 추가로 보완한 내용');
  await save.click(); await expect(form).toHaveAttribute('data-save-state', 'saved');
  await expect(page.getByRole('button', { name: 'v3 내용 확인', exact: true })).toBeVisible();
  await page.reload(); await expertRisk(page);
  await expect(page.getByLabel('함께 살펴볼 작업·장소')).toHaveValue('계속 보완할 작업 범위');
  await expect(form.getByRole('textbox', { name: '확인 메모', exact: true })).toHaveValue('확인한 뒤 추가로 보완한 내용');
});

test('사업장 정보도 자신의 연속 저장 후 다른 탭 갱신에 기존 사실을 덮어쓰지 않는다', async ({ page }) => {
  await startProfile(page);
  const form = page.locator('form').filter({ has: page.locator('input[name="profile_revision"]') });
  const name = page.getByLabel('사업장명', { exact: true }), address = page.getByLabel('실제 작업 장소', { exact: true });
  await name.fill('처음 저장한 사업장');
  await form.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await address.fill('내가 확인한 장소');
  await form.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  const other = await page.context().newPage();
  try {
    await other.goto(page.url());
    await other.getByLabel('사업장명', { exact: true }).fill('다른 탭에서 확인한 사업장');
    const otherForm = other.locator('form').filter({ has: other.locator('input[name="profile_revision"]') });
    await otherForm.getByRole('button', { name: '임시 저장', exact: true }).click();
    await expect(otherForm).toHaveAttribute('data-save-state', 'saved');
    const newer = await otherForm.locator('input[name="profile_revision"]').inputValue();
    await refreshServerComponents(page);
    await expect(form.locator('input[name="profile_revision"]')).toHaveValue(newer);
    await expect(name).toHaveValue('처음 저장한 사업장');
    await address.fill('충돌해도 유지할 주소 보완');
    await form.getByRole('button', { name: '임시 저장', exact: true }).click();
    await expect(form).toHaveAttribute('data-save-state', 'error');
    await expect(form.getByRole('alert')).toContainText('다른 변경이 먼저 저장되었습니다.');
    await expect(address).toHaveValue('충돌해도 유지할 주소 보완');
    await other.reload();
    await expect(other.getByLabel('사업장명', { exact: true })).toHaveValue('다른 탭에서 확인한 사업장');
    await expect(other.getByLabel('실제 작업 장소', { exact: true })).toHaveValue('내가 확인한 장소');
  } finally { await other.close(); }
});
