import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { completeProfile, confirmProfile, nextProfileStep, startProfile } from './profile';

async function noTasks(page: Page) {
  await expect(page.getByRole('heading', { name: '오늘 할 일', exact: true })).toHaveCount(0);
  await expect(page.locator('.task-board')).toHaveCount(0);
  await expect(page.locator('a[href*="/tasks/new"]')).toHaveCount(0);
}

async function saveDraft(page: Page) {
  const revision = page.locator('input[name="profile_revision"]');
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
}

test('확인 전 목록 차단, 전송 실패 입력 유지와 임시 저장·새로고침의 0/미확인 구분', async ({ page }) => {
  await startProfile(page);
  await noTasks(page);
  await page.getByLabel('사업장명', { exact: true }).fill('가상 저장 시험');
  await page.getByLabel('실제 작업 장소', { exact: true }).fill('가상 주방');
  await page.route('**/app**', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('입력을 유지한 채');
  await expect(page.getByLabel('사업장명', { exact: true })).toHaveValue('가상 저장 시험');
  await page.unroute('**/app**');
  await nextProfileStep(page);
  await page.getByLabel('실제로 하는 작업').fill('음식 조리');
  await nextProfileStep(page);
  await page.getByLabel('현재 직접고용 인원', { exact: true }).fill('0');
  await page.getByLabel('직접고용 중 기간제·단시간 인원').fill('0');
  await expect(page.getByLabel('파견받아 일하는 인원')).toHaveValue('');
  await expect(page.getByLabel('다른 업체 소속 작업 인원')).toHaveValue('');
  await saveDraft(page);
  await noTasks(page);
  await page.reload();
  await noTasks(page);
  await page.locator('.profile-step-picker > summary').click(); await page.getByRole('button', { name: '등록정보', exact: true }).click();
  await expect(page.getByLabel('사업장명', { exact: true })).toHaveValue('가상 저장 시험');
  await expect(page.getByLabel('등록 주소', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('실제 작업 장소', { exact: true })).toHaveValue('가상 주방');
  await nextProfileStep(page);
  await expect(page.getByLabel('실제로 하는 작업')).toHaveValue('음식 조리');
  await expect(page.getByLabel('실제 업무에 가까운 업종')).toHaveValue('all');
  await nextProfileStep(page);
  await expect(page.getByLabel('현재 직접고용 인원', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('직접고용 중 기간제·단시간 인원')).toHaveValue('0');
  await expect(page.getByLabel('다른 업체 소속 작업 인원')).toHaveValue('');
  await expect(page.getByLabel('도급 계약과 실제 역할')).toHaveValue('unknown');
  await nextProfileStep(page);
  await expect(page.getByRole('button', { name: '확인하고 업무 목록 보기' })).toBeDisabled();
  await expect(page.getByText('업종·복합 사업장 분류 확인', { exact: true })).toBeVisible();
  await expect(page.getByText('기간제·단시간·파견·다른 업체 인원 확인', { exact: true })).toBeVisible();
  await expect(page.getByText('직접고용 인원 확인', { exact: true })).toHaveCount(0);
  await confirmProfile(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: '오늘 할 일', exact: true })).toBeVisible();
});

test('최소 사실과 확인 체크가 필요하고 확인 후 관련 업무·조문과 보조 도구를 제공한다', async ({ page }) => {
  await startProfile(page);
  for (let step = 0; step < 3; step++) await nextProfileStep(page);
  await page.getByRole('checkbox', { name: '입력 내용을 확인했습니다. 미확인 정보는 추가 확인 대상으로 남깁니다.' }).check();
  await expect(page.getByRole('button', { name: '확인하고 업무 목록 보기' })).toBeDisabled();
  await noTasks(page);
  await page.reload();
  await completeProfile(page, 'food');
  const row = page.locator('#task-REVIEW-003');
  await expect(row).toContainText('적용 확인 필요');
  await expect(row).toContainText('산업안전보건법 제36조제1항');
  for (const id of ['FORM_REGISTRATION', 'REVIEW-001', 'REVIEW-002', 'FORM_PHOTO', 'FORM_PLAN']) {
    await expect(page.locator(`.task-ledger #task-${id}`)).toHaveCount(0);
  }
  await page.getByText('직접 기록 도구', { exact: true }).click();
  for (const id of ['FORM_PHOTO', 'FORM_PLAN']) {
    await expect(page.locator(`a[href*="definition=${id}"]`)).toBeVisible();
  }
  await row.getByRole('link').click();
  const basis = page.getByRole('region', { name: '근거 법령·준비 이유' });
  await basis.getByText('근거와 적용 조건 자세히 보기', { exact: true }).click();
  await expect(basis.getByRole('link', { name: /제36조제5항 원문 확인/ })).toHaveAttribute('href', /law\.go\.kr\/LSW\/lsInfoP\.do\?.*lsiSeq=283449/);
});

test('직접 새 업무 경로도 확인을 요구하고 등록정보 항목은 설정으로 돌아간다', async ({ page }) => {
  await startProfile(page);
  for (const id of ['REVIEW-003', 'FORM_PHOTO', 'FORM_PLAN', 'FORM_REGISTRATION', 'REVIEW-001', 'REVIEW-002']) {
    await page.goto(`/app/tasks/new?definition=${id}&workplace=facility`);
    await expect(page).toHaveURL(/\/app\?setup=1/);
    await expect(page.getByRole('heading', { name: '사업장 정보 입력', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '관리 시작', exact: true })).toHaveCount(0);
    await noTasks(page);
  }
  await completeProfile(page);
  for (const id of ['FORM_REGISTRATION', 'REVIEW-001', 'REVIEW-002']) {
    await page.goto(`/app/tasks/new?definition=${id}&workplace=facility`);
    await expect(page).toHaveURL(/\/app\?setup=1/);
    await expect(page.getByRole('heading', { name: '사업장 정보 입력', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '관리 시작', exact: true })).toHaveCount(0);
  }
});

test('업종·작업 변경은 관련 후보를 갱신하고 이미 저장한 업무 기록은 보존한다', async ({ page }) => {
  await startProfile(page);
  await completeProfile(page, 'food');
  await expect(page.locator('#task-REVIEW-031')).toHaveCount(0);
  await page.goto('/app?setup=1'); await page.locator('.profile-step-picker > summary').click(); await page.getByRole('button', { name: '등록정보', exact: true }).click();
  await nextProfileStep(page);
  await page.getByLabel('실제 업무에 가까운 업종').selectOption('manufacturing');
  await page.getByRole('checkbox', { name: '차량·하역', exact: true }).check();
  await nextProfileStep(page); await nextProfileStep(page); await confirmProfile(page);
  await expect(page.locator('#task-REVIEW-032')).toBeVisible();
  await page.locator('#task-REVIEW-031').getByRole('link').click();
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+/);
  const taskPath = new URL(page.url()).pathname;
  await page.getByLabel('확인 메모').fill('업종 변경 후에도 보존할 차량 확인 기록');
  const revision = page.locator('input[name="task_revision"]');
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
  await page.goto('/app?setup=1'); await page.locator('.profile-step-picker > summary').click(); await page.getByRole('button', { name: '등록정보', exact: true }).click();
  await nextProfileStep(page);
  await page.getByRole('checkbox', { name: '차량·하역', exact: true }).uncheck();
  await page.getByLabel('실제 업무에 가까운 업종').selectOption('office');
  await page.getByLabel('실제로 하는 작업').fill('사무 업무');
  await nextProfileStep(page); await nextProfileStep(page); await confirmProfile(page);
  // Unmanaged lifting equipment disappears, while the managed vehicle task remains.
  await expect(page.locator('#task-REVIEW-032')).toHaveCount(0);
  await expect(page.locator('#task-REVIEW-031').getByRole('link')).toHaveAttribute('href', new RegExp(taskPath));
  await page.locator('#task-REVIEW-031').getByRole('link').click();
  await expect(page.getByLabel('확인 메모')).toHaveValue('업종 변경 후에도 보존할 차량 확인 기록');
});

test('사업장 입력 네 단계는 320·360·768·1440px에서 넘치지 않고 접근 가능하다', async ({ page }) => {
  // Sixteen full accessibility audits plus screenshots need time under parallel browser load.
  test.setTimeout(180_000);
  await startProfile(page);
  const headings = ['어디에서 일하고 계신가요?', '현장에서 어떤 일을 하나요?', '함께 일하는 사람을 알려주세요', '입력한 내용을 함께 확인해요'];
  for (const [index, heading] of headings.entries()) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    // Measure the rendered colors after entrance motion, not a partially transparent frame.
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined)));
    });
    for (const width of [320, 360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${heading}: ${width}px overflow`).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations, `${heading}: ${width}px axe`).toEqual([]);
      if (width === 320 || width === 1440) await page.screenshot({ path: `test-results/profile-step-${index + 1}-${width}.png`, fullPage: true });
    }
    await noTasks(page);
    if (index < 3) await nextProfileStep(page);
  }
});
