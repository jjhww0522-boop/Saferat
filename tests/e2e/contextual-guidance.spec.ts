import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { completeProfile, startProfile } from './profile';

async function profileStep(page: Page, name: string) {
  const picker = page.locator('.profile-step-picker');
  if (!await picker.evaluate(element => (element as HTMLDetailsElement).open)) await picker.locator('summary').click();
  await picker.getByRole('button', { name, exact: true }).click();
}

test('역할에 따른 후속 질문은 입력값과 미확인 상태를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await startProfile(page);
  await profileStep(page, '인원·고용관계');
  const role = page.getByRole('combobox', { name: '도급 계약과 실제 역할', exact: true });
  const others = page.locator('#profile-contractors');
  const form = page.locator('form[data-save-state]');
  await expect(page.locator('.contextual-guidance')).toHaveCount(0);
  await role.selectOption('client');
  await expect(page.locator('.contextual-guidance')).toContainText('맡긴 작업에 참여하는');
  await expect(others).toHaveCount(1);
  await expect(others).toBeVisible();
  await expect(others).toHaveValue('');
  await others.fill('3');
  await role.selectOption('contractor');
  await expect(page.locator('.contextual-guidance')).toContainText('우리 회사가 직접 고용한 직원은 위에');
  await expect(others).toHaveValue('3');
  await role.selectOption('both');
  await expect(page.locator('.contextual-guidance')).toContainText('같은 사람은 중복 집계하지 않아요');
  await expect(others).toHaveValue('3');
  await role.selectOption('none');
  await expect(page.locator('.contextual-guidance')).toHaveCount(0);
  await page.getByText('고용관계·인원 집계 자세히 입력', { exact: true }).click();
  await expect(others).toHaveCount(1);
  await expect(others).toHaveValue('3');
  await role.selectOption('unknown');
  await expect(others).toHaveValue('3');
  await role.selectOption('client');
  await others.fill('0');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await page.reload();
  await expect(role).toHaveValue('client');
  await expect(others).toHaveValue('0');
  await expect(page.getByLabel('현재 직접고용 인원', { exact: true })).toHaveValue('');
  const profile = JSON.parse(await page.locator('input[name="profile"]').inputValue());
  expect(profile.headcount).toBeNull(); expect(profile.facts.dispatched).toBeNull();
  expect(profile.facts.contractors).toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.contextual-guidance').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.locator('.profile-question-heading').focus();
  await page.locator('.profile-section').screenshot({ path: 'test-results/contextual-profile-360.png' });
});

test('확인 화면에서 빠진 정보로 바로 이동하고 이동만으로 저장하지 않는다', async ({ page }) => {
  await startProfile(page);
  const revision = page.locator('input[name="profile_revision"]');
  const initial = await revision.inputValue();
  for (const [button, field] of [
    ['사업장명 입력하기', '#profile-businessName'],
    ['실제 작업 장소 입력하기', '#profile-actualAddress'],
    ['실제 작업 입력하기', '#profile-actualWork'],
    ['등록증의 업태·종목·주소 확인', '#profile-registeredAddress'],
    ['작업·설비 조건 확인', '#profile-work input'],
    ['기간제·단시간·파견·다른 업체 인원 확인', '#profile-temporary'],
    ['인원 기준일·집계 범위 확인', '#profile-countDate'],
  ]) {
    await profileStep(page, '입력 확인');
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.locator(field).first()).toBeFocused();
    await expect(page.locator(field).first()).toBeVisible();
    await expect(revision).toHaveValue(initial);
    await expect(page.locator('form[data-save-state]')).toHaveAttribute('data-save-state', 'ready');
  }
});

test('도움 요청과 실제 저장에 응답하고 홈에서 보던 질문을 이어간다', async ({ page }) => {
  test.setTimeout(150_000);
  await startProfile(page); await completeProfile(page);
  await page.goto('/app/tasks/new?definition=REVIEW-003&workplace=facility');
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  const workflow = page.locator('.risk-workflow');
  const form = page.locator('form[data-save-state]');
  const receipt = workflow.locator('.journey-save-feedback');
  await expect(page.getByLabel('이번 평가의 구분')).toBeHidden();
  await page.getByLabel('함께 살펴볼 작업·장소').fill('기계실 순회 점검');
  await page.route('**/app/tasks/**', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: '저장하고 다음', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'error');
  await expect(receipt).toBeHidden();
  await expect(page.getByRole('heading', { name: '살펴볼 작업', exact: true })).toBeVisible();
  await expect(page.getByLabel('함께 살펴볼 작업·장소')).toHaveValue('기계실 순회 점검');
  await page.unroute('**/app/tasks/**');
  await page.getByRole('button', { name: '저장하고 다음', exact: true }).click();
  await expect(receipt).toContainText('입력한 작업·장소를 저장했어요.');
  await expect(receipt).toContainText('다음은 ‘판단 기준’');
  await expect(receipt).toBeVisible();
  await page.route('**/app/tasks/**', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'error');
  await expect(receipt).toBeHidden();
  await expect(page.getByRole('heading', { name: '판단 기준', exact: true })).toBeVisible();
  await page.unroute('**/app/tasks/**');
  await page.getByLabel('위험을 판단할 우리 사업장의 기준').fill('작업자와 기준을 더 확인할 예정');
  await expect(receipt).toBeHidden();
  await page.getByRole('button', { name: '저장하고 다음', exact: true }).click();
  await expect(page.getByRole('heading', { name: '방법 익히기', exact: true })).toBeVisible();
  await page.getByLabel('평가 방법을 익힐 준비는 되었나요?').selectOption('needed');
  await expect(page.locator('.learning-guidance')).toContainText('방법을 먼저 살펴볼까요?');
  await expect(receipt).toBeHidden();
  const beforeHelp = await page.locator('input[name="risk_assessment"]').inputValue();
  const help = page.getByRole('button', { name: '평가 방법 안내 보기', exact: true });
  await help.click();
  await expect(page.getByRole('dialog')).toContainText('교육 실시·참석 기록은 채워지지 않아요');
  await page.keyboard.press('Escape'); await expect(help).toBeFocused();
  await expect(page.locator('input[name="risk_assessment"]')).toHaveValue(beforeHelp);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.learning-guidance').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.locator('.risk-step-panel').screenshot({ path: 'test-results/contextual-help-360.png' });
  await page.getByRole('button', { name: '확인 필요로 저장', exact: true }).click();
  await expect(form).toHaveAttribute('data-save-state', 'saved');
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('평가 방법은 확인이 필요한 상태로 저장했어요.');
  await expect(receipt).toContainText('다음은 ‘일정 알리기’');
  await expect(page.locator('.record-statuses')).toContainText('수행 기록 없음');
  await page.goto('/app');
  const hero = page.getByRole('region', { name: '지금 함께 할 한 가지' });
  await expect(hero).toContainText('초안 v3 저장 · 내용 확인 전');
  await expect(hero).toContainText('보던 질문 · 일정 알리기');
  await hero.getByRole('link', { name: '일정 알리기 이어서 작성', exact: true }).click();
  await expect(page.getByRole('heading', { name: '일정 알리기', exact: true })).toBeVisible();
  const saved = JSON.parse(await page.locator('input[name="risk_assessment"]').inputValue());
  expect(saved.scope).toBe('기계실 순회 점검'); expect(saved.learningStatus).toBe('needed');
  expect(saved.learningOn).toBe(''); expect(saved.learningPeople).toBe('');
  expect(saved.announcedOn).toBe(''); expect(saved.finishedOn).toBe('');
  await expect(receipt).toHaveCount(0);
  await page.getByRole('button', { name: '이전 단계', exact: true }).click();
  await page.getByRole('button', { name: '이전 단계', exact: true }).click();
  await page.getByRole('button', { name: '익숙하다면 · 전체 항목 직접 입력', exact: true }).click();
  await expect(page.getByLabel('이번 평가의 구분')).toBeVisible();
  await expect(page.locator('.learning-guidance')).toContainText('임시 저장하면 설명·교육이 필요한 상태로 보관돼요.');
  await expect(page.locator('.learning-guidance')).not.toContainText('‘확인 필요로 저장’을 누르면');
});
