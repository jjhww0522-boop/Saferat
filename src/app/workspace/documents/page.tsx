import { workspacePageClient } from '@/server/supabase';
import { workspaceRepository } from '@/adapters/workspace';
import { WorkspaceForm } from '@/components/workspace-form';
import { createDocument } from '@/server/workspace-actions';
import { documentFilters, type DocumentSearchParams } from '@/domain/document-search';
import { DocumentList } from '@/components/document-list';
import { PageHeading } from '@/components/ui';
import { notFound } from 'next/navigation';
import { uuid } from '@/domain/workspace';
export default async function Documents({ searchParams }: { searchParams: Promise<DocumentSearchParams> }) {
  const repo = workspaceRepository((await workspacePageClient()).client);
  const filters = documentFilters(await searchParams, 'documents');
  if (filters.workplace && !uuid.safeParse(filters.workplace).success) notFound();
  const [documents, workplaces] = await Promise.all([repo.documentPage(filters), repo.workplaces()]);
  return <><PageHeading eyebrow="지난 기록도 다시 찾아요" title="자료함" description="현장과 제목으로 저장한 자료를 찾아보세요. 관리 업무에 연결하지 않은 자료도 보존해요."/><DocumentList result={documents} filters={filters} workplaces={workplaces} path="/workspace/documents"/>{workplaces.length ? <details className="record-section"><summary>별도 자료 작성</summary><WorkspaceForm action={createDocument}><label>현장<select name="workplace">{workplaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>자료 제목<input name="title" required maxLength={200}/></label><label>직접 확인한 내용<textarea name="content" required maxLength={20000}/></label><label className="checkbox-label"><input name="sensitive" type="checkbox"/>건강·사고 등 별도 권한이 필요한 자료</label><button className="button primary">초안 저장</button></WorkspaceForm></details> : null}</>;
}
