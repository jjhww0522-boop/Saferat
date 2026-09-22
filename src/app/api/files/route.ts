import { authenticatedClient } from '@/server/supabase';
import { evidenceRepository } from '@/adapters/evidence';
import { FileValidationError, isSameOrigin, readUploadBody } from '@/domain/files';
import { uuid, workspaceError } from '@/domain/workspace';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!isSameOrigin(request)) return Response.json({ message: '요청 출처를 확인할 수 없습니다.' }, { status: 403, headers });
  if (process.env.APP_MODE !== 'live') return Response.json({ message: '실제 파일 저장이 연결되지 않았습니다.' }, { status: 503, headers });
  try {
    const { client } = await authenticatedClient();
    const version = uuid.parse(request.headers.get('x-version-id'));
    const allowed = await client.from('safety_document_versions').select('id').eq('id', version).maybeSingle();
    if (allowed.error || !allowed.data) return Response.json({ message: '파일을 연결할 권한이 없습니다.' }, { status: 403, headers });
    const filename = decodeURIComponent(request.headers.get('x-file-name') ?? '');
    const mimeType = request.headers.get('content-type') ?? '';
    const bytes = await readUploadBody(request);
    const id = await evidenceRepository(client).upload(version, bytes, filename, mimeType);
    return Response.json({ id, message: '파일을 격리 저장했습니다. 파일 검사 완료 후 사용할 수 있습니다.' }, { status: 201, headers });
  } catch (error) {
    const message = error instanceof FileValidationError ? error.message : workspaceError(error);
    return Response.json({ message }, { status: error instanceof Error && error.message === 'authentication_required' ? 401 : 400, headers });
  }
}
