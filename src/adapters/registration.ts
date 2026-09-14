// P1 exposes only an explicitly synthetic sample. A live provider must implement
// this interface on the server after document access and file inspection (P2/P4).
export interface RegistrationExtraction {
  status: 'awaiting_confirmation';
  provider: 'mock';
  original: string;
  fields: Record<string, string>;
}
export interface RegistrationProvider {
  extractRegistration(sampleId: string): Promise<RegistrationExtraction>;
}
export const mockRegistrationProvider: RegistrationProvider = {
  async extractRegistration(sampleId) {
    if (sampleId !== 'DEMO_REGISTRATION_001') throw new Error('지원하지 않는 가상 샘플입니다. 직접 입력해주세요.');
    return { status: 'awaiting_confirmation', provider: 'mock',
      original: '한결 시설관리 / 서비스업 / 시설관리·청소 / 가상 본점 주소 / 개업 2020-01-02 / 발급 2026-09-01',
      fields: { name: '한결 시설관리', industry: '서비스업', registrationItems: '시설관리·청소', registeredAddress: '가상 본점 주소', openingDate: '2020-01-02', issueDate: '2026-09-01' } };
  },
};
