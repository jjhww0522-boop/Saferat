'use server';
import { journeyState } from './journey-state';
export async function rememberJourney(demo: boolean, workplace: string, resource: string, cursor: string) {
  try { await journeyState(demo, workplace, resource, cursor); return { ok: true }; }
  catch { return { ok: false }; }
}
