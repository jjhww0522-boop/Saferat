import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { actorPage, closeActors } from './actors';
import { expertRisk, openDirect, completeProfile, confirmProfile, nextProfileStep, startProfile } from './profile';

test.afterEach(closeActors);

async function startTask(page: Page, definition: string) {
  await page.goto(`/app/tasks/new?definition=${definition}&workplace=facility`);
  await page.getByRole('button', { name: '관리 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname;
}

async function saveTask(page: Page) {
  const revision = page.locator('input[name="task_revision"]');
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
}

async function documentCommand(page: Page, name: string) {
  const revision = page.locator('input[name="revision"]').first();
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name, exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
}

async function riskStep(page: Page, name: string) {
  await expertRisk(page);
  await page.getByRole('navigation', { name: '위험성평가 진행 단계' }).getByRole('button', { name: new RegExp(name) }).click();
}

test('홈의 미확인 인원 링크는 정확한 입력으로 이동하고 저장한 0명을 보존한다', async ({ page }) => {
  await startProfile(page);
  await completeProfile(page);
  const questions = page.locator('details.profile-questions');
  await questions.locator('summary').click();
  await questions.getByRole('link', { name: '직접고용 인원 확인', exact: true }).click();
  await expect(page).toHaveURL(/focus=headcount/);
  await expect(page.getByRole('heading', { name: '함께 일하는 사람을 알려주세요', exact: true })).toBeVisible();
  const headcount = page.getByLabel('현재 직접고용 인원', { exact: true });
  await expect(headcount).toBeFocused();
  await expect(headcount).toHaveValue('');
  await expect(page.locator('#profile-question-reason')).toContainText('직접 고용한 인원');
  await headcount.fill('0');
  const revision = page.locator('input[name="profile_revision"]');
  const before = Number(await revision.inputValue());
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(revision).toHaveValue(String(before + 1));
  await page.reload();
  // The resolved focus target falls back to step one, and a draft still needs confirmation.
  await expect(page.getByRole('heading', { name: '어디에서 일하고 계신가요?', exact: true })).toBeVisible();
  await expect(page.locator('.task-board')).toHaveCount(0);
  await nextProfileStep(page);
  await nextProfileStep(page);
  await expect(headcount).toHaveValue('0');
  await expect(page.getByLabel('파견받아 일하는 인원')).toHaveValue('');
  await expect(page.getByLabel('다른 업체 소속 작업 인원')).toHaveValue('');
  await nextProfileStep(page);
  await confirmProfile(page);
  await questions.locator('summary').click();
  await expect(questions.getByRole('link', { name: '직접고용 인원 확인', exact: true })).toHaveCount(0);
  await expect(questions.getByRole('link', { name: '기간제·단시간·파견·다른 업체 인원 확인', exact: true })).toBeVisible();
});

test('저장한 개선조치는 5단계로 이어지고 자료 검토 대기·완료 후에도 남는다', async ({ page }) => {
  await startProfile(page);
  await completeProfile(page);
  const taskPath = await startTask(page, 'REVIEW-003');
  await riskStep(page, '위험요인 찾기');
  await page.getByRole('button', { name: '위험요인 추가', exact: true }).click();
  await page.getByLabel('어떤 작업인가요?').fill('시험 세척 작업');
  await page.getByLabel('어디에서 하나요?').fill('가상 시설 세척구역');
  await page.getByLabel('무엇 때문에 어떻게 다칠 수 있나요?').fill('바닥 물기로 미끄러질 위험');
  await riskStep(page, '위험 판단하기');
  await page.getByLabel('현재 위험을 허용할 수 있나요?').selectOption('no');
  await riskStep(page, '개선조치 실행하기');
  await page.getByLabel('위험을 줄일 구체적인 조치').fill('배수 상태 확인과 미끄럼 방지 바닥 보수');
  await page.getByLabel('조치 담당자').fill('시험 담당자');
  await page.getByLabel('조치 목표일').fill('2026-09-01');
  await expect(page.getByLabel('실제 조치일')).toHaveValue('');
  await page.getByLabel('자료 준비 목표일', { exact: true }).fill('2026-09-01');
  await saveTask(page);
  await page.goto('/app'); await openDirect(page);
  const primary = page.getByRole('region', { name: '지금 함께 할 한 가지', exact: true });
  await expect(primary.getByRole('link', { name: '조치 결과 기록', exact: true })).toHaveAttribute('href', /step=improve.*#task-editor$/);
  await expect(primary).not.toContainText('보던 질문');
  const actions = page.getByRole('region', { name: '다음으로 할 일', exact: true });
  const improvement = actions.getByRole('link', { name: /위험성평가와 개선 추적.*조치 결과 기록/ });
  await expect(improvement).toContainText('개선·재확인이 남은 위험요인 1건');
  await expect(improvement).toContainText('조치 목표 2026-09-01');
  await expect(improvement).toContainText('저장한 v1 기준');
  await expect(improvement).toHaveAttribute('href', /step=improve.*#task-editor$/);
  await improvement.click();
  await expect(page.getByRole('region', { name: '5단계 개선조치 실행하기', exact: true })).toBeVisible();
  await expect(page.getByLabel('위험을 줄일 구체적인 조치')).toHaveValue('배수 상태 확인과 미끄럼 방지 바닥 보수');
  await expect(page.getByLabel('실제 조치일')).toHaveValue('');
  await documentCommand(page, 'v1 내용 확인');
  await documentCommand(page, '검토 요청');
  await page.goto('/app'); await openDirect(page);
  const pendingImprovement = actions.getByRole('link', { name: /위험성평가와 개선 추적.*남은 조치 확인/ });
  await expect(pendingImprovement).toContainText('개선·재확인이 남은 위험요인 1건');
  await expect(pendingImprovement).toHaveAttribute('href', /#stored-record$/);
  await expect(page.locator('#task-REVIEW-003 .badge')).toHaveText('검토 대기');
  await pendingImprovement.click();
  await expect(page.locator('#stored-record')).toBeVisible();
  await expect(page.getByRole('button', { name: '임시 저장', exact: true })).toBeDisabled();
  const operator = await actorPage(page, 'reviewer');
  await operator.getByRole('link', { name: /위험성평가와 개선 추적.*검토하기/ }).click();
  await operator.getByRole('combobox', { name: '검토 결과', exact: true }).selectOption('reviewed');
  await operator.getByLabel('회원에게 보이는 검토 의견').fill('자료 내용을 검토했습니다. 현장 개선조치의 실제 수행은 아직 확인하지 않았습니다.');
  await operator.getByRole('button', { name: '검토 결과 저장', exact: true }).click();
  await expect(operator.getByRole('combobox', { name: '검토 결과', exact: true })).toHaveCount(0);
  await page.goto('/app'); await openDirect(page);
  await expect(page.locator('#task-REVIEW-003 .badge')).toHaveText('자료 검토 완료');
  await expect(improvement).toBeVisible();
  await expect(improvement).toContainText('개선·재확인이 남은 위험요인 1건');
  await expect(improvement).toContainText('자료 검토 상태와 별개');
  await improvement.click();
  await expect(page).toHaveURL(new RegExp(`${taskPath}\\?step=improve`));
  await expect(page.getByRole('region', { name: '5단계 개선조치 실행하기', exact: true })).toBeVisible();
  await expect(page.getByLabel('실제 조치일')).toHaveValue('');
  await expect(page.getByText('기관 제출·접수: 미확인', { exact: true })).toBeVisible();
});

test('다음 행동은 먼저 3개를 보여주고 남은 항목을 펼쳐 확인할 수 있다', async ({ page }) => {
  await startProfile(page);
  await completeProfile(page);
  for (const definition of ['REVIEW-003', 'REVIEW-004', 'REVIEW-005', 'REVIEW-006']) await startTask(page, definition);
  await page.goto('/app'); await openDirect(page);
  const actions = page.getByRole('region', { name: '다음으로 할 일', exact: true });
  const primary = actions.locator(':scope > .next-action-list > li');
  const remaining = actions.locator('details.remaining-actions');
  await expect(actions).toContainText('5건 남음');
  await expect(primary).toHaveCount(3);
  await expect(actions.getByRole('link')).toHaveCount(3);
  await expect(remaining).toHaveJSProperty('open', false);
  await expect(remaining.locator('summary')).toHaveText('남은 할 일 2건 모두 보기');
  await remaining.locator('summary').click();
  await expect(remaining).toHaveJSProperty('open', true);
  await expect(remaining.locator('.next-action-list > li')).toHaveCount(2);
  await expect(actions.getByRole('link')).toHaveCount(5);
  await expect(actions.getByRole('link', { name: /사업장 미확인 정보.*사업장 정보 확인/ })).toBeVisible();
  const hrefs = await actions.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(new Set(hrefs).size).toBe(5);
  await page.setViewportSize({ width: 360, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});
