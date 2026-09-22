import { z } from 'zod';

/** The persisted inputs and their revisions travel together; never log or persist this client-only key. */
export interface FormBasis { key: string; revisions: Record<string, string>; }
export interface WorkspaceResult { ok: boolean; message: string; redirectTo?: string; token?: string; invitationId?: string; factorId?: string; secret?: string; savedBasis?: FormBasis; }

export const uuid = z.string().uuid();
export const documentInput = z.object({ workplace: uuid, title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(20000), sensitive: z.boolean() });
export const documentSchema = z.object({ id: uuid, organization_id: uuid, workplace_id: uuid, title: z.string(), sensitive: z.boolean(), revision: z.number().int(), review_status: z.string(), submission_status: z.literal('needs_confirmation'), created_at: z.string() });
export const versionSchema = z.object({ id: uuid, document_id: uuid, number: z.number().int(), content: z.string(), created_at: z.string(), confirmed_at: z.string().nullable() });
export const versionMetadataSchema = versionSchema.omit({ content: true });
export const workplaceSchema = z.object({ id: uuid, organization_id: uuid, name: z.string() });
export const reviewSchema = z.object({ id: uuid, version_id: uuid, status: z.string(), location: z.string(), comment: z.string(), requested_at: z.string(), reviewed_at: z.string().nullable() });
export const permissionsSchema = z.object({ read: z.boolean(), write: z.boolean(), review: z.boolean() });
export const fileSchema = z.object({ id: uuid, version_id: uuid, document_id: uuid, filename: z.string(), mime_type: z.string(), byte_size: z.number(), sha256: z.string(), object_path: z.string(), state: z.enum(['reserved', 'quarantined', 'clean', 'rejected', 'failed']), created_at: z.string().optional() });
export const activitySchema = z.object({ id: uuid, performed_on: z.string(), note: z.string(), corrects_id: uuid.nullable(), recorded_at: z.string() });

export const reviewStatusLabels: Record<string, string> = { not_requested: '자료 준비', queued: '검토 대기', changes_requested: '보완 요청', reviewed: '자료 검토 완료', reopened: '새 버전 확인 필요' };
export const fileStatusLabels: Record<z.infer<typeof fileSchema>['state'], string> = { reserved: '업로드 대기', quarantined: '파일 검사 대기', clean: '파일 검사 완료', rejected: '사용 제한', failed: '업로드 실패' };

const errors: Record<string, string> = {
  authentication_required: '로그인이 필요합니다. 다시 로그인해주세요.',
  profile_required: '사업장 정보를 먼저 입력하고 확인해주세요.',
  profile_incomplete: '사업장명, 실제 작업 장소, 실제로 하는 작업과 입력 확인 표시가 필요합니다.',
  access_denied: '이 자료에 접근하거나 변경할 권한이 없습니다.',
  revision_conflict: '다른 변경이 먼저 저장되었습니다. 입력을 복사해 둔 뒤 새로고침해주세요.',
  questions_changed: '작성 중에 확인 질문이 변경되었습니다. 입력을 복사해 둔 뒤 새로고침하여 질문을 다시 확인해주세요.',
  review_pending: '검토 중인 자료입니다. 검토 결과를 확인한 뒤 새 버전을 작성해주세요.',
  invalid_state: '자료 상태가 변경되었습니다. 새로고침 후 다시 확인해주세요.',
  feedback_required: '보완할 위치와 의견을 함께 입력해주세요.',
  file_inspection_pending: '첨부파일 검사가 끝나지 않았습니다. 검사 결과를 확인해주세요.',
  file_limit: '한 버전에는 파일을 최대 10개까지 연결할 수 있습니다.',
  invalid_invitation: '초대가 만료·사용·철회되었거나 로그인 이메일과 일치하지 않습니다.',
  already_has_organization: '이미 연결된 조직이 있습니다. 작업 공간을 새로고침해주세요.',
  future_activity: '실제 수행일에는 미래 날짜를 입력할 수 없습니다.',
  record_too_long: '기록의 전체 길이가 너무 깁니다. 내용을 줄이거나 별도 증빙으로 나눠주세요.',
  empty_record: '기존 기록을 빈 내용으로 바꿀 수 없습니다. 정정할 내용이나 확인 메모를 남겨주세요.',
  record_sensitivity_mismatch: '업무와 자료의 민감자료 표시가 같아야 연결할 수 있습니다.',
  separate_operator_account_required: '이 계정으로 해당 작업 공간에 참여할 수 없습니다.',
};
export function workspaceError(error: unknown) {
  if (error instanceof z.ZodError) return '입력 형식과 필수 항목을 확인해주세요.';
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return errors[message] ?? '요청을 완료하지 못했습니다. 입력을 유지한 채 다시 시도해주세요.';
}
