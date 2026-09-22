import { createHash } from 'node:crypto';
import { authenticatedClient } from '@/server/supabase';
import { demoTaskEntry } from '@/server/demo-tasks';
import { workspaceRepository } from '@/adapters/workspace';
import { buildRiskExport, riskExportHtml, type RiskExportSource } from '@/domain/risk-export';
import { uuid } from '@/domain/workspace';
import { taskCycleNumber } from '@/domain/task-cycles';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  const query = new URL(request.url).searchParams;
  const format = query.get('format'), versionId = query.get('version');
  if (!['html', 'json'].includes(format ?? '') || !uuid.safeParse(versionId).success) return Response.json({ message: '저장된 자료에서 버전과 다운로드 형식을 다시 선택해주세요.' }, { status: 400, headers });
  try {
    const { id } = await params;
    let source: RiskExportSource;
    if ((process.env.APP_MODE ?? 'demo') === 'demo') {
      const { entry } = await demoTaskEntry(id);
      const document = entry.document;
      const version = document?.versions.find(v => v.id === versionId);
      if (!document || document.id !== id || !version) throw new Error('access_denied');
      source = { demo: true, document, version, reviews: document.reviews, activities: document.activities, files: [], cycle: { taskId: entry.task.id, number: taskCycleNumber(entry.task) } };
    } else {
      const { client } = await authenticatedClient();
      const repo = workspaceRepository(client), detail = await repo.detail(id);
      if (!detail?.permissions.read || !detail.versions.some(v => v.id === versionId)) throw new Error('access_denied');
      const version = await repo.readVersion(versionId!);
      if (version.document_id !== id || version.id !== versionId) throw new Error('access_denied');
      const taskId = await repo.linkedTask(id);
      const task = taskId ? await repo.task(taskId) : null;
      source = { demo: false, ...detail, version, cycle: task?.definition_id === 'REVIEW-003' ? { taskId: task.id, number: taskCycleNumber(task) } : null };
    }
    const data = buildRiskExport(source, new Date().toISOString(), createHash('sha256').update(source.version.content, 'utf8').digest('hex'));
    const filename = `risk-assessment-${data.cycle ? `cycle${data.cycle.number}-` : ''}v${data.version.number}-${data.version.id}.${format}`;
    return new Response(format === 'json' ? JSON.stringify(data, null, 2) : riskExportHtml(data), { headers: { ...headers, 'Content-Type': format === 'json' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
  } catch {
    return Response.json({ message: '자료를 내려받을 수 없습니다. 로그인·접근 권한과 저장된 위험성평가 버전을 확인해주세요.' }, { status: 404, headers });
  }
}
