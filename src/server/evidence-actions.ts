'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { memberClient } from './supabase';
import { uuid, workspaceError, type WorkspaceResult } from '@/domain/workspace';

export async function retryEvidenceVersion(version: string, _previous: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  try {
    if (form.get('confirm_file_retry') !== 'on') return { ok: false, message: '새 버전에 필요한 파일을 다시 연결한다는 내용을 확인해주세요.' };
    const expected_revision = z.coerce.number().int().positive().parse(form.get('recovery_revision'));
    const { client } = await memberClient();
    const { data, error } = await client.rpc('safety_retry_evidence_version', { source_version: uuid.parse(version), expected_revision });
    if (error) throw error;
    const result = z.object({ document_id: uuid, version_id: uuid }).parse(data);
    revalidatePath('/workspace', 'layout'); revalidatePath('/ops', 'layout');
    return { ok: true, message: '저장된 본문으로 새 버전을 만들었습니다. 필요한 증빙을 다시 연결해주세요.', redirectTo: `/workspace/documents/${result.document_id}?version=${result.version_id}#evidence-records` };
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    return { ok: false, message: message === 'file_retry_unavailable' ? '현재 파일 상태는 복구 대상이 아닙니다. 목록을 새로고침해 상태를 확인해주세요. 검사 대기 파일은 검사 완료가 필요합니다.' : workspaceError(error) };
  }
}
