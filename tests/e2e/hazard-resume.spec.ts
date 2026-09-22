import { expect, test, type Page } from '@playwright/test';
import { completeProfile, startProfile } from './profile';

const visibleHazard = (page: Page) => page.locator('.risk-hazard:visible');
const hazardPicker = (page: Page) => page.getByRole('combobox', { name: '살펴볼 위험요인', exact: true });
async function save(page: Page) {
  const revision = page.locator('input[name="task_revision"]');
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
}
async function remember(page: Page, cursor: string, action: () => Promise<unknown>) {
  // A save-and-next form also contains the cursor. Wait for its separate position save.
  const [response] = await Promise.all([
    page.waitForResponse(response => response.request().method() === 'POST' && response.request().headers()['content-type']?.startsWith('text/plain') === true && (response.request().postData()?.includes(cursor) ?? false)),
    action(),
  ]);
  expect(response.ok()).toBe(true);
  // The RSC response can remain open after its action result. Navigation/reload
  // assertions below verify the persisted position without waiting for stream closure.
}
async function move(page: Page, name: string, cursor: string) {
  const picker = page.locator('.journey-step-picker');
  if (await picker.getAttribute('open') === null) await picker.locator('summary').click();
  await remember(page, cursor, () => page.getByRole('navigation', { name: '위험성평가 진행 단계' }).getByRole('button', { name: new RegExp(name) }).click());
}
async function prepare(page: Page) {
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await move(page, '위험요인 찾기', 'risk:2:0');
  for (const name of ['첫 번째 통로 위험', '두 번째 기계 위험', '세 번째 운반 위험']) {
    await remember(page, 'risk:2:0:', () => page.getByRole('button', { name: '위험요인 추가', exact: true }).click());
    await visibleHazard(page).getByLabel('무엇 때문에 어떻게 다칠 수 있나요?').fill(name);
  }
  await save(page);
  const risk = JSON.parse(await page.locator('input[name="risk_assessment"]').inputValue()) as { hazards: { id: string }[] };
  return risk.hazards.map(hazard => hazard.id);
}

test('두 번째 위험요인의 실제 조치 장을 재개하고 실패 시 입력·위치를 유지한다', async ({ page }) => {
  const [, second] = await prepare(page);
  await remember(page, `risk:2:0:${second}`, () => hazardPicker(page).selectOption(second));
  await move(page, '개선조치 실행하기', `risk:4:0:${second}`);
  await remember(page, `risk:4:1:${second}`, () => page.getByRole('button', { name: '다음 단계', exact: true }).click());
  const path = new URL(page.url()).pathname;
  await page.goto('/app'); await page.goto(path);
  await expect(page.getByRole('heading', { name: '실제 조치', exact: true })).toBeVisible();
  await expect(hazardPicker(page)).toHaveValue(second);
  await expect(visibleHazard(page)).toContainText('두 번째 기계 위험');
  await expect(page.locator('#evidence-records')).toContainText('v1');
  await expect(page.locator('.record-statuses')).toContainText('수행 기록 없음');
  await visibleHazard(page).getByLabel('실제로 한 조치·관련 증빙').fill('가상 시험: 기계 주변 임시 조치 내용을 확인함');
  await page.route('**/app/tasks/**', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: '저장하고 다음', exact: true }).click();
  await expect(page.locator('form[data-save-state="error"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '실제 조치', exact: true })).toBeVisible();
  await expect(visibleHazard(page).getByLabel('실제로 한 조치·관련 증빙')).toHaveValue('가상 시험: 기계 주변 임시 조치 내용을 확인함');
  await page.unroute('**/app/tasks/**');
  await remember(page, `risk:5:0:${second}`, () => page.getByRole('button', { name: '저장하고 다음', exact: true }).click());
  await expect(page.getByRole('heading', { name: '효과 확인', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '효과 확인', exact: true })).toBeVisible();
  await expect(hazardPicker(page)).toHaveValue(second);
  await expect(visibleHazard(page)).toContainText('두 번째 기계 위험');
  await expect(page.locator('#evidence-records')).toContainText('v2');
});

test('보던 위험요인을 취소하고 저장하면 임의 선택 대신 복구 안내를 보여준다', async ({ page }) => {
  const [first, second] = await prepare(page);
  await remember(page, `risk:2:0:${second}`, () => hazardPicker(page).selectOption(second));
  await visibleHazard(page).getByRole('button', { name: '이 위험요인 입력 취소' }).click();
  await expect(page.getByText(/이전에 보던 위험요인을 현재 기록에서 찾지 못했어요/)).toBeVisible();
  await expect(visibleHazard(page)).toHaveCount(0);
  await save(page); await page.reload();
  await expect(page.getByText(/이전에 보던 위험요인을 현재 기록에서 찾지 못했어요/)).toBeVisible();
  await expect(hazardPicker(page)).toHaveValue('');
  await expect(visibleHazard(page)).toHaveCount(0);
  await remember(page, `risk:2:0:${first}`, () => hazardPicker(page).selectOption(first));
  await expect(visibleHazard(page)).toContainText('첫 번째 통로 위험');
  await expect(page.getByText(/이전에 보던 위험요인을 현재 기록에서 찾지 못했어요/)).toHaveCount(0);
  await page.reload();
  await expect(hazardPicker(page)).toHaveValue(first);
  await expect(page.locator('#evidence-records')).toContainText('v2');
});
