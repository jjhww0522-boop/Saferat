import { describe, expect, it } from 'vitest';
import { taskDefinitions } from '@/domain/tasks';
import { legalBasisFor, legalBasisSummary } from '@/domain/legal-basis';

describe('항목별 법령 근거와 검토 상태', () => {
  it('모든 후보와 자체 서식에서 근거 또는 미확인 상태를 볼 수 있다', () => {
    for (const definition of taskDefinitions) {
      const basis = legalBasisFor(definition.id);
      expect(basis).not.toBeNull();
      expect(basis!.documentNote).toBeTruthy();
      expect(legalBasisSummary(definition.id)).not.toBe('근거 미등록');
    }
    expect(legalBasisFor('UNKNOWN')).toBeNull();
  });
  it('출처 확인일이 있어도 미대조 조문을 확인 완료로 승격하지 않는다', () => {
    const pending = legalBasisFor('REVIEW-045')!;
    expect(pending.sources.some(source => source.checkedOn)).toBe(true);
    expect(pending.status).toBe('조문 확인 중');
    expect(pending.citations).toEqual([]);
  });
  it('위험성평가의 활동과 기록 근거를 구분하고 확인한 시행본을 보존한다', () => {
    const basis = legalBasisFor('REVIEW-003')!;
    expect(basis.status).toContain('적용 검토 필요');
    expect(basis.citations.filter(c => c.relation === 'record').map(c => c.article)).toEqual(['제36조제5항', '제37조의4제1항·제2항']);
    for (const citation of basis.citations) {
      expect(new URL(citation.url).hostname).toBe('www.law.go.kr');
      expect(citation.effectiveOn).toBe('2026-08-01');
      expect(citation.checkedOn).toBe('2026-09-15');
    }
  });
  it('현행 위험성평가의 참여·사전공유·기록을 문서 업로드와 별도 활동으로 안내한다', () => {
    const basis = legalBasisFor('REVIEW-003')!;
    const explanation = (article: string) => basis.citations.find(c => c.article === article)!.explanation;
    expect(explanation('제36조제2항·제3항')).toContain('근로자대표가 요구하면');
    expect(explanation('제37조의2')).toContain('순회점검이 원칙');
    expect(explanation('제37조의2')).toContain('특별한 사정');
    expect(explanation('제37조의3')).toContain('실시 전에는 평가 일정');
    expect(explanation('제37조의3')).toContain('이행 결과');
    expect(explanation('제36조제4항')).toContain('노력 의무');
    expect(explanation('제37조제1항·제2항')).toContain('최초 작업 시작 전');
    expect(explanation('제37조제1항·제2항')).toContain('다음 연도부터 매년 1회 이상');
    expect(explanation('제37조의4제1항·제2항')).toContain('3년간');
    expect(explanation('제37조의4제1항·제2항')).toContain('참여 근로자·근로자대표');
    expect(basis.citations[0].scope).toContain('2026-06-01 이후');
    expect(basis.status).toContain('적용 검토 필요');
    expect(basis.documentNote).toContain('모두 충족한다고 판단하지 않습니다');
  });
  it('자체 사진·계획 서식에 관련 법령의 작성 의무를 자동 부여하지 않는다', () => {
    for (const id of ['FORM_REGISTRATION','FORM_PHOTO','FORM_PLAN']) {
      const basis = legalBasisFor(id)!;
      expect(basis.kind).toBe('self_form');
      expect(basis.citations).toEqual([]);
      expect(basis.documentNote).toContain('필요 없는 것으로 판단하지 않습니다');
    }
    expect(legalBasisFor('REVIEW-015')!.citations[0].relation).toBe('activity');
    expect(legalBasisFor('REVIEW-015')!.documentNote).toContain('특정 서식');
  });
});
