import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { readConfig, readSupabaseConfig } from '@/domain/config';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  if (process.env.APP_MODE !== 'live') return response;
  try {
    readConfig(process.env);
    const { url, key } = readSupabaseConfig(process.env);
    const client = createServerClient(url, key, {
      cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: values => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          response.headers.set('Cache-Control', 'private, no-store, max-age=0');
          response.headers.set('Referrer-Policy', 'no-referrer');
        },
      },
    });
    await client.auth.getClaims();
  } catch { /* Pages and handlers report unavailable/authentication state; never grant access here. */ }
  return response;
}

export const config = { matcher: ['/login', '/workspace/:path*', '/ops/:path*', '/api/files/:path*', '/api/documents/:path*'] };
