import { describe, expect, it } from 'vitest';
import { documentFilters, documentPageHref, documentSearchSchema, documentTurn } from '@/domain/document-search';

describe('자료 검색 조건과 페이지 이동', () => {
  it('이전·다음 이동에서 현장·검색어·상태를 보존한다', () => {
    const filters = documentFilters({ workplace: '11111111-1111-4111-8111-111111111111', q: '지난 점검 & 50%', status: 'changes_requested', page: '5' }, 'reviews');
    const url = new URL(documentPageHref('/workspace/reviews', filters, 4), 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ workplace: filters.workplace, q: filters.query, status: filters.status, page: '4' });
    expect(documentPageHref('/workspace/reviews', filters, 1)).not.toContain('page=');
  });
  it('비정상 페이지와 미지원 상태는 첫 페이지·지정 기본값으로 정규화한다', () => {
    for (const page of ['-1', '1.5', 'NaN', '1000001']) expect(documentFilters({ page, status: 'unknown' }, 'reviews', 'queued')).toMatchObject({ page: 1, status: 'queued' });
    expect(() => documentSearchSchema.parse({ page: 0 })).toThrow();
    expect(() => documentSearchSchema.parse({ workplace: 'another-tenant' })).toThrow();
  });
  it('검토 결과를 실제 수행 완료로 바꾸지 않고 새 버전은 고객 확인 차례로 남긴다', () => {
    expect(documentTurn('queued')).toBe('검토자가 확인할 차례');
    expect(documentTurn('changes_requested')).toBe('고객이 보완할 차례');
    expect(documentTurn('reviewed')).toContain('실제 수행 별도 확인');
    expect(documentTurn('reopened')).toBe('고객이 새 버전을 확인할 차례');
  });
  it('표시 조건은 체험 현장과 긴·중복 URL 값을 정규화하고 실제 RPC는 UUID를 요구한다', () => {
    const filters = documentFilters({ workplace: 'facility', q: ['검'.repeat(250), '둘째'], status: ['queued', 'all'] }, 'documents');
    expect(filters).toMatchObject({ workplace: 'facility', query: '검'.repeat(200), status: 'queued' });
    expect(documentSearchSchema.safeParse(filters).success).toBe(false);
    expect(documentFilters({ status: 'not_requested' }, 'reviews').status).toBe('all');
  });
});
