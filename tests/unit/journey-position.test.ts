import { describe, expect, it } from 'vitest';
import { initialRiskJourneyPosition, parseRiskJourneyCursor, riskJourneyCursor } from '@/domain/journey';
import { emptyRiskAssessment, emptyRiskHazard } from '@/domain/risk-assessment';

describe('위험요인 안정 ID로 보던 위치 재개', () => {
  const risk = { ...emptyRiskAssessment(), hazards: [emptyRiskHazard('first'), emptyRiskHazard('second')] };
  it('단계·장·위험요인을 저장하고 순서가 바뀌어도 같은 ID를 복원한다', () => {
    const cursor = riskJourneyCursor({ step: 4, chapter: 1, hazardId: 'second' });
    expect(cursor).toBe('risk:4:1:second');
    expect(initialRiskJourneyPosition({ ...risk, hazards: [...risk.hazards].reverse() }, cursor)).toEqual({ step: 4, chapter: 1, hazardId: 'second' });
  });
  it('삭제된 ID를 첫 항목으로 바꾸지 않고 선택 안내에 필요한 ID를 보존한다', () => {
    expect(initialRiskJourneyPosition({ ...risk, hazards: [risk.hazards[0]] }, 'risk:4:1:second')).toEqual({ step: 4, chapter: 1, hazardId: 'second' });
  });
  it('위험요인 선택이 없는 이전 커서와 명시적 단계 링크를 지원한다', () => {
    expect(initialRiskJourneyPosition(risk, 'risk:4:1')).toEqual({ step: 4, chapter: 1, hazardId: 'first' });
    expect(initialRiskJourneyPosition(risk, 'risk:4:1:second', 'verify')).toEqual({ step: 5, chapter: 0, hazardId: 'second' });
    expect(initialRiskJourneyPosition(risk, 'risk:3:0:second', 'improve')).toEqual({ step: 4, chapter: 0, hazardId: 'second' });
    expect(initialRiskJourneyPosition(risk, null, 'act:1').chapter).toBe(1);
  });
  it('콜론과 한글을 포함한 기존 ID도 자르지 않는다', () => {
    const position = { step: 2, chapter: 0, hazardId: '현장:위험-1' };
    expect(parseRiskJourneyCursor(riskJourneyCursor(position))).toEqual(position);
  });
  it.each(['risk:7:0', 'risk:2:1', 'risk:4:2', 'risk:4:1:', `risk:4:1:${'a'.repeat(81)}`, 'risk:4:1\n', 'profile:2', 'invalid'])('잘못된 위치 %s는 복원하지 않는다', cursor => {
    expect(parseRiskJourneyCursor(cursor)).toBeNull();
    expect(initialRiskJourneyPosition(risk, cursor)).toEqual({ step: 0, chapter: 0, hazardId: 'first' });
  });
});
