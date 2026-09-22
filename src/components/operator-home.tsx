import Link from 'next/link';
import { operatorPageClient } from '@/server/supabase';
import { workspaceRepository } from '@/adapters/workspace';
import { OperatorShell } from './operator-shell';
import { PageHeading } from './ui';
import { demoTaskList } from '@/server/demo-tasks';
import { reviewStatusLabels, uuid } from '@/domain/workspace';
import { notFound } from 'next/navigation';
import { DocumentList } from './document-list';
import { documentFilters, type DocumentSearchParams } from '@/domain/document-search';
export async function LiveOperatorHome({ searchParams = {}, path = '/ops' }: { searchParams?: DocumentSearchParams; path?: string }) {
  const { client } = await operatorPageClient(), repo = workspaceRepository(client);
  const filters = documentFilters(searchParams, 'reviews', 'queued');
  if (filters.workplace && !uuid.safeParse(filters.workplace).success) notFound();
  const [workplaces, documents] = await Promise.all([repo.workplaces(), repo.documentPage(filters)]);
  return <OperatorShell><PageHeading eyebrow="배정 범위 안에서" title="검토할 자료" description="요청한 날짜가 오래된 자료부터 확인하세요. 상태를 바꾸면 보완 요청과 지난 검토 결과도 찾을 수 있어요."/><DocumentList result={documents} filters={filters} workplaces={workplaces} path={path} operator/></OperatorShell>;
}
export async function DemoTaskQueue() {
  const { tasks } = await demoTaskList();
  const documents = tasks.filter(t => t.document_id);
  return <section className="record-section"><h2>관리 업무에서 받은 자료</h2>{documents.length ? documents.map(t => <Link className="document-row" key={t.id} href={`/ops/reviews/${t.document_id}`}><strong>{t.title}</strong><span>{reviewStatusLabels[t.review_status]} · 검토하기 →</span></Link>) : <p>관리 업무에서 요청한 자료가 없습니다.</p>}</section>;
}
