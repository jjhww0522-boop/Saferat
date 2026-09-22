import { expect, type Page, type BrowserContext } from '@playwright/test';
const contexts: BrowserContext[] = [];
export async function closeActors() { for (const context of contexts.splice(0)) await context.close(); }
export async function actorPage(source: Page, persona: 'member-a' | 'member-b' | 'reviewer' | 'unassigned') {
  const state = (await source.context().cookies()).find(c => c.name === 'safety-demo')?.value;
  if (!state || !process.env.SAFETY_TEST_TOKEN) throw new Error('Run browser checks using npm run test:e2e.');
  const context = await source.context().browser()!.newContext({ baseURL: new URL(source.url()).origin });
  contexts.push(context);
  const response = await context.request.post('/api/testing/session', { headers: { 'x-safety-test-token': process.env.SAFETY_TEST_TOKEN }, data: { source: state, persona } });
  expect(response.status()).toBe(200);
  const page = await context.newPage();
  await page.goto(persona === 'reviewer' || persona === 'unassigned' ? '/ops' : '/app');
  return page;
}
