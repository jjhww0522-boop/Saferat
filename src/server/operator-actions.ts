'use server';
import { z } from 'zod';
import { createSupabase, portalAccess } from './supabase';
import { workspaceError, type WorkspaceResult } from '@/domain/workspace';
export async function operatorLogin(_previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const email = z.email().max(254).parse(form.get('email'));
    const password = z.string().min(1).max(1024).parse(form.get('password'));
    const client = await createSupabase();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: '로그인 정보와 접근 권한을 확인해주세요.' };
    const access = await portalAccess(client);
    if (!access.operator) { await client.auth.signOut({ scope: 'local' }); return { ok: false, message: '로그인 정보와 접근 권한을 확인해주세요.' }; }
    return { ok: true, message: '인증했습니다.', redirectTo: access.mfa ? '/ops' : '/ops/security' };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function operatorLogout() {
  const client = await createSupabase();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
  const { redirect } = await import('next/navigation');
  redirect('/ops/login');
}
