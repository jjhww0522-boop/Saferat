import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { workspacePageClient } from '@/server/supabase';
import { workspaceRepository } from '@/adapters/workspace';
import { uuid } from '@/domain/workspace';
import { DocumentPanel } from '@/components/document-panel';
export default async function Document({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const linked = await workspaceRepository((await workspacePageClient()).client).linkedTask(id);
  const version = (await searchParams).version;
  if (linked) redirect(`/workspace/tasks/${linked}${version ? `?version=${encodeURIComponent(version)}` : ''}`);
  return <><Link className="back-link" href="/workspace/documents">← 자료함</Link><DocumentPanel id={id} demo={false} path={`/workspace/documents/${id}`} versionId={(await searchParams).version} showEditor/></>;
}
