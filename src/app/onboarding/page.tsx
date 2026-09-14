import { memberContext } from '@/server/store';
import { Shell } from '@/components/shell';
import { PageHeading } from '@/components/ui';
import { OnboardingForm } from '@/components/onboarding-form';
export default async function Onboarding() {
  const { state, workplace, config } = await memberContext();
  const snapshot = state.snapshots.find(s => s.id === workplace.snapshotIds.at(-1))!;
  return <Shell><PageHeading eyebrow="우리 현장을 이해하는 첫걸음" title="사업장 정보 확인" description="한 번 확인한 정보는 자료를 준비할 때 함께 사용해요."/><OnboardingForm workplace={workplace} snapshot={snapshot} ocr={config.ocr}/></Shell>;
}
