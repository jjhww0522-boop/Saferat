import { LiveOperatorHome } from '@/components/operator-home';
import type { DocumentSearchParams } from '@/domain/document-search';

export default async function Reviews({ searchParams }: { searchParams: Promise<DocumentSearchParams> }) {
  return <LiveOperatorHome searchParams={await searchParams} path="/ops/reviews"/>;
}
