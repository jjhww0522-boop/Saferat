'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authenticatedClient, memberClient, operatorClient, portalAccess, createSupabase } from '@/server/supabase';
import { documentInput, uuid, workspaceError } from '@/domain/workspace';
import type { WorkspaceResult } from '@/domain/workspace';

export async function login(_previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const email = z.email().max(254).parse(form.get('email'));
    const password = z.string().min(1).max(1024).parse(form.get('password'));
    const client = await createSupabase();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: '로그인하지 못했습니다. 이메일과 비밀번호를 확인하거나 잠시 후 다시 시도해주세요.' };
    if (!(await portalAccess(client)).member) { await client.auth.signOut({ scope: 'local' }); return { ok: false, message: '이 계정으로 회원 공간을 이용할 수 없습니다.' }; }
    return { ok: true, message: '로그인했습니다.', redirectTo: '/workspace' };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function logout(): Promise<void> {
  const client = await createSupabase();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new Error('로그아웃하지 못했습니다. 다시 시도해주세요.');
  const { redirect } = await import('next/navigation');
  redirect('/login');
}
export async function createWorkspace(_previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const { client } = await memberClient();
    const input = z.object({ organization_name: z.string().trim().min(1).max(120), workplace_name: z.string().trim().min(1).max(120) }).parse(Object.fromEntries(form));
    const { error } = await client.rpc('safety_create_workspace', input);
    if (error) throw error;
    revalidatePath('/workspace');
    return { ok: true, message: '새 조직과 현장을 만들었습니다.' };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function createDocument(_previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const { client } = await memberClient();
    const input = documentInput.parse({ ...Object.fromEntries(form), sensitive: form.get('sensitive') === 'on' });
    const { data, error } = await client.rpc('safety_create_document', input);
    if (error) throw error;
    const id = uuid.parse(data);
    revalidatePath('/workspace');
    return { ok: true, message: '자료 초안을 저장했습니다.', redirectTo: `/workspace/documents/${id}` };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function updateDocument(document: string, _previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    uuid.parse(document);
    const expected_revision = z.coerce.number().int().positive().parse(form.get('revision'));
    const command = z.enum(['version', 'confirm', 'submit', 'review', 'activity']).parse(form.get('command'));
    const { client } = command === 'review' ? await operatorClient() : await memberClient();
    let response;
    if (command === 'version') {
      response = await client.rpc('safety_new_version', { document, expected_revision, content: z.string().trim().min(1).max(20000).parse(form.get('content')) });
    } else if (command === 'confirm' || command === 'submit') {
      response = await client.rpc(command === 'confirm' ? 'safety_confirm_version' : 'safety_request_review', { version: uuid.parse(form.get('version')), expected_revision });
    } else if (command === 'review') {
      const input = z.object({ review: uuid, decision: z.enum(['changes_requested', 'reviewed']), location: z.string().trim().max(200), comment: z.string().trim().max(4000), internal_note: z.string().trim().max(4000) }).parse(Object.fromEntries(form));
      response = await client.rpc('safety_decide_review', { ...input, expected_revision });
    } else {
      const performed_on = z.iso.date().parse(form.get('performed_on'));
      const note = z.string().trim().min(1).max(2000).parse(form.get('note'));
      const corrects = form.get('corrects') ? uuid.parse(form.get('corrects')) : null;
      response = await client.rpc('safety_record_activity', { document, expected_revision, performed_on, note, corrects });
    }
    if (response.error) throw response.error;
    revalidatePath(`/workspace/documents/${document}`);
    revalidatePath('/workspace');
    revalidatePath('/workspace/tasks', 'layout');
    revalidatePath('/ops', 'layout');
    return { ok: true, message: '저장했습니다.' };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function createInvitation(_previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const { client } = await memberClient();
    const { data, error } = await client.rpc('safety_create_invitation', { workplace: uuid.parse(form.get('workplace')), email: z.email().max(254).parse(form.get('email')), can_write: form.get('can_write') === 'on' });
    if (error) throw error;
    const result = z.object({ id: uuid, token: z.string().regex(/^[0-9a-f]{64}$/) }).parse(data);
    revalidatePath('/workspace/members');
    return { ok: true, message: '초대 코드를 만들었습니다. 48시간 동안 사용할 수 있습니다. 이메일은 발송하지 않았습니다.', invitationId: result.id, token: result.token };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function acceptInvitation(_previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const { client } = await memberClient();
    const token = z.string().trim().regex(/^[0-9a-f]{64}$/).parse(form.get('token'));
    const { error } = await client.rpc('safety_accept_invitation', { token });
    if (error) throw error;
    revalidatePath('/workspace');
    return { ok: true, message: '초대받은 현장에 연결되었습니다.', redirectTo: '/workspace' };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function revokeInvitation(_previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const { client } = await memberClient();
    const { error } = await client.rpc('safety_revoke_invitation', { invitation: uuid.parse(form.get('invitation')) });
    if (error) throw error;
    revalidatePath('/workspace/members');
    return { ok: true, message: '초대를 철회했습니다.' };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function enrollMfa(): Promise<WorkspaceResult> {
  try {
    const { client } = await authenticatedClient();
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    if (factors.data.totp.some(f => f.status === 'verified')) return { ok: false, message: '등록된 인증 앱이 있습니다. 해당 앱의 코드로 인증해주세요.' };
    for (const factor of factors.data.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) {
      const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (removed.error) throw removed.error;
    }
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: '사업장 안전관리' });
    if (error) throw error;
    return { ok: true, message: '인증 앱에 아래 키를 직접 등록한 뒤 6자리 코드를 입력해주세요.', factorId: data.id, secret: data.totp.secret };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
export async function verifyMfa(_previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    const { client } = await authenticatedClient();
    const code = z.string().regex(/^\d{6}$/).parse(form.get('code'));
    let factorId = form.get('factor') ? uuid.parse(form.get('factor')) : undefined;
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    if (factorId && !factors.data.all.some(f => f.id === factorId && f.factor_type === 'totp')) throw new Error('access_denied');
    factorId ??= factors.data.totp.find(f => f.status === 'verified')?.id;
    if (!factorId) return { ok: false, message: '먼저 인증 앱을 등록해주세요.' };
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return { ok: false, message: '인증 코드를 확인하고 다시 입력해주세요.' };
    revalidatePath('/workspace');
    const access = await portalAccess(client);
    return { ok: true, message: '추가 인증을 완료했습니다.', redirectTo: access.operator ? '/ops' : '/workspace' };
  } catch (error) { return { ok: false, message: workspaceError(error) }; }
}
