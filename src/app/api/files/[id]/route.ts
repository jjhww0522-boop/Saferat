import { authenticatedClient } from '@/server/supabase';
import { evidenceRepository } from '@/adapters/evidence';

export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  if (process.env.APP_MODE !== 'live') return Response.json({ message: '실제 파일 저장이 연결되지 않았습니다.' }, { status: 503, headers });
  try {
    const { client } = await authenticatedClient();
    const { file, bytes } = await evidenceRepository(client).download((await params).id);
    return new Response(bytes, { headers: { ...headers, 'Content-Type': file.mime_type, 'Content-Length': String(file.byte_size), 'Content-Disposition': `attachment; filename="evidence"; filename*=UTF-8''${encodeURIComponent(file.filename)}` } });
  } catch {
    return Response.json({ message: '파일을 내려받을 수 없습니다. 접근 권한과 파일 검사 상태를 확인해주세요.' }, { status: 404, headers });
  }
}
