import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { readConfig, readSupabaseConfig } from '@/domain/config';

export async function createSupabase() {
  readConfig(process.env);
  const { url, key } = readSupabaseConfig(process.env);
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => {
        // Server Components cannot write; proxy refreshes their cookies before rendering.
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* Server Component */ }
      },
    },
  });
}

export async function authenticatedClient() {
  const client = await createSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('authentication_required');
  return { client, user: data.user };
}

export async function portalAccess(client: Awaited<ReturnType<typeof createSupabase>>) {
  const { data, error } = await client.rpc('safety_portal_access');
  if (error) throw error;
  return z.object({ member: z.boolean(), operator: z.boolean(), mfa: z.boolean(), rules: z.boolean() }).parse(data);
}
export async function memberClient() {
  const result = await authenticatedClient();
  if (!(await portalAccess(result.client)).member) throw new Error('access_denied');
  return result;
}
export async function operatorClient(requireMfa = true) {
  const result = await authenticatedClient();
  const access = await portalAccess(result.client);
  if (!access.operator || (requireMfa && !access.mfa)) throw new Error('access_denied');
  return { ...result, access };
}
export const operatorPageClient = cache(async (requireMfa = true) => {
  let result;
  try { result = await operatorClient(false); } catch { redirect('/ops/login'); }
  if (requireMfa && !result.access.mfa) redirect('/ops/security');
  return result;
});

// Layouts and pages render concurrently. Each protected page must guard its own reads.
export const workspacePageClient = cache(async () => {
  try { return await memberClient(); } catch { redirect('/login'); }
});
