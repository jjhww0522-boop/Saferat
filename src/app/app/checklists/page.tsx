import { PageHeading } from '@/components/ui';
import { ReviewCatalog } from '@/components/review-catalog';

export default function Checklists() {
  return <><PageHeading eyebrow="준비할 내용 살펴보기" title="업종·인원별 검토 목록" description="우리 사업장의 업종·인원·실제 작업을 바탕으로 확인할 내용을 찾아보세요."/><ReviewCatalog/></>;
}
