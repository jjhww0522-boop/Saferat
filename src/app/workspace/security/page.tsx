import { MfaForms } from '@/components/mfa-forms';
import { PageHeading } from '@/components/ui';

export default function Security() {
  return <><PageHeading eyebrow="계정 보호" title="추가 인증" description="계정을 보호하기 위해 인증 앱을 등록하고 추가 인증할 수 있습니다."/><MfaForms/></>;
}
