import { PageHeading } from '@/components/ui';
import { ReviewCatalog } from '@/components/review-catalog';
import { demoOperatorContext } from '@/server/store';
import { operatorPageClient } from '@/server/supabase';
import { OperatorShell } from '@/components/operator-shell';
import { Shell } from '@/components/shell';
import { notFound } from 'next/navigation';

export default async function RulePreparation() {
  const content = <><PageHeading eyebrow="법령 검토 준비" title="업종·인원별 검토 목록" description="체크리스트·점검·교육·선임 등 검토할 항목과 근거를 살펴보세요."/><ReviewCatalog/></>;
  if (await demoOperatorContext()) return <Shell operator>{content}</Shell>;
  const { access } = await operatorPageClient();
  if (!access.rules) notFound();
  return <OperatorShell>{content}</OperatorShell>;
}
