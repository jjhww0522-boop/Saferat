import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { fixtureSession } from '@/server/store';
export async function POST(request: NextRequest) {
  const configured = process.env.SAFETY_TEST_TOKEN ?? '';
  const supplied = request.headers.get('x-safety-test-token') ?? '';
  if (process.env.APP_MODE === 'live' || process.env.SAFETY_ENABLE_TEST_FIXTURES !== '1' || configured.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(configured) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(configured))) return new NextResponse(null, { status: 404 });
  try {
    const { source, persona } = z.object({ source: z.string().uuid(), persona: z.enum(['member-a', 'member-b', 'reviewer', 'unassigned']) }).parse(await request.json());
    const response = NextResponse.json({ ok: true });
    response.cookies.set('safety-demo', fixtureSession(source, persona), { httpOnly: true, sameSite: 'lax', path: '/' });
    response.cookies.set('safety-workplace', persona === 'member-b' ? 'other' : 'facility', { httpOnly: true, sameSite: 'lax', path: '/' });
    return response;
  } catch { return new NextResponse(null, { status: 400 }); }
}
