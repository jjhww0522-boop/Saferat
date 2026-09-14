import { demoRules } from '@/domain/rules';
import type { DemoState, Persona, Actor } from '@/domain/types';

export function actorFor(persona: Persona): Actor {
  return { persona, tenantId: persona === 'member-a' ? 'tenant-a' : persona === 'member-b' ? 'tenant-b' : null, assignedTenantIds: persona === 'reviewer' ? ['tenant-a'] : [] };
}

export function createSeed(): DemoState {
  const recordedAt = '2026-09-14T00:00:00.000Z';
  const cases: [string, string, string, number | null][] = [
    ['facility', '한결 시설관리', '시설관리·유지보수', 20],
    ['shop', '혼자 운영하는 점포', '소매업', 0],
    ['restaurant', '작은 식당', '음식점', 4],
    ['store', '우리 편의점', '편의점', 5],
    ['factory', '한결 제조현장', '제조업', 50],
    ['enterprise', '다사업장 기업', '시설관리', 501],
    ['mobile', '이동 작업 현장', '건설·유지보수', null],
  ];
  const workplaces = cases.map(([id, name, industry, headcount]) => ({ id, tenantId: 'tenant-a', name, industry, headcount, snapshotIds: [`snapshot-${id}-1`], revision: 1 }));
  workplaces.push({ id: 'other', tenantId: 'tenant-b', name: '다른 고객의 사업장', industry: '시설관리', headcount: 12, snapshotIds: ['snapshot-other-1'], revision: 1 });
  const snapshots = workplaces.map(w => ({ id: w.snapshotIds[0], recordedAt, confirmedAt: recordedAt,
    facts: Object.fromEntries(Object.entries({ name: w.name, industry: w.industry, headcount: w.headcount, temporary: null, contractors: null, countDate: '2026-09-14', registeredAddress: '가상 본점 주소', address: '가상 시설 1층 공용 구역', registrationItems: w.industry, openingDate: null, issueDate: null, work: '시설 점검·청소·유지보수', role: null, photoCheck: true, training: w.id === 'shop' ? false : true, contractor: null }).map(([key, value]) => [key, { value, confirmed: value !== null, source: 'sample' as const }])) }));
  const obligations = workplaces.flatMap(w => demoRules.map((rule, i) => ({ id: `${w.id}-${i + 1}`, tenantId: w.tenantId, workplaceId: w.id, ruleId: rule.id,
    title: rule.title, description: i === 0 ? '현장 사진과 직접 확인한 내용을 함께 남겨주세요.' : i === 1 ? '실제로 진행한 교육의 대상·내용·일정을 확인해요.' : '다른 업체와 함께 하는 작업과 역할을 확인해요.',
    targetDate: null, owner: '현장 담당자', revision: 1,
    activity: { status: 'not_started' as const, performedAt: null, note: '' },
    reviewStatus: 'not_requested' as const, submissionStatus: 'needs_confirmation' as const,
    versionIds: [], reviewIds: [],
  })));
  return { workplaces, snapshots, obligations, versions: [], reviews: [], events: [] };
}
