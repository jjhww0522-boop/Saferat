import { workspacePageClient } from '@/server/supabase';
import { workspaceRepository } from '@/adapters/workspace';
import { PageHeading } from '@/components/ui';
import { DocumentList } from '@/components/document-list';
import { documentFilters, type DocumentSearchParams } from '@/domain/document-search';
import { notFound } from 'next/navigation';
import { uuid } from '@/domain/workspace';

export default async function Reviews({ searchParams }: { searchParams: Promise<DocumentSearchParams> }) {
  const repo = workspaceRepository((await workspacePageClient()).client);
  const filters = documentFilters(await searchParams, 'reviews');
  if (filters.workplace && !uuid.safeParse(filters.workplace).success) notFound();
  const [documents, workplaces] = await Promise.all([repo.documentPage(filters), repo.workplaces()]);
  return <><PageHeading eyebrow="함께 확인하고 보완해요" title="검토·보완" description="보완 요청을 먼저 살펴보세요. 검토를 요청했던 자료와 요청 버전을 다시 찾을 수 있어요."/><DocumentList result={documents} filters={filters} workplaces={workplaces} path="/workspace/reviews"/></>;
}
