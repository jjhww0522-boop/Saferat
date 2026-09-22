import { describe, expect, it } from 'vitest';
import {
  catalogCsv, catalogSources, categories, filterCandidates, headcountBandFor, headcountBands, industries,
  reviewCandidates, workConditions, type CatalogFilter,
} from '@/domain/review-catalog';

const all: CatalogFilter = { industry: 'all', category: 'all', headcount: 'unknown', work: [], query: '' };

describe('검토 후보 탐색', () => {
  it.each([
    [null, 'unknown'], [0, 'zero'], [4, '1-4'], [5, '5-9'], [9, '5-9'], [10, '10-19'], [19, '10-19'],
    [20, '20-49'], [49, '20-49'], [50, '50-99'], [99, '50-99'], [100, '100-299'], [299, '100-299'],
    [300, '300-499'], [499, '300-499'], [500, '500+'], [501, '500+'], [-1, 'unknown'], [1.5, 'unknown'], [NaN, 'unknown'],
  ] as const)('탐색용 인원 %s는 %s (법적 적용 판정 아님)', (input, expected) => {
    expect(headcountBandFor(input)).toBe(expected);
  });

  it('인원·업종 미확인과 기타 업종은 전체 후보를 유지', () => {
    expect(filterCandidates(all)).toHaveLength(reviewCandidates.length);
    expect(filterCandidates({ ...all, industry: 'other' })).toHaveLength(reviewCandidates.length);
  });

  it('0명·소규모·큰 규모를 선택해도 후보를 인원만으로 제외하지 않음', () => {
    for (const industry of industries) {
      const baseline = filterCandidates({ ...all, industry: industry.id }).map(item => item.id).sort();
      for (const headcount of headcountBands) {
        expect(filterCandidates({ ...all, industry: industry.id, headcount: headcount.id }).map(item => item.id).sort()).toEqual(baseline);
      }
    }
  });

  it('음식점에 차량·하역 작업을 추가하면 업종 밖의 지게차 점검도 포함', () => {
    const food = { ...all, industry: 'food' as const };
    expect(filterCandidates(food).map(item => item.id)).not.toContain('REVIEW-031');
    const expanded = filterCandidates({ ...food, work: ['vehicle'] }).map(item => item.id);
    expect(expanded).toContain('REVIEW-031');
    for (const item of filterCandidates(food)) expect(expanded).toContain(item.id);
  });

  it('20~49명 제조업은 담당자를 먼저 보여주고 인원 미확인은 기본 순서 유지', () => {
    const items = filterCandidates({ ...all, industry: 'manufacturing', headcount: '20-49' });
    expect(items.findIndex(item => item.id === 'REVIEW-012')).toBeLessThan(items.findIndex(item => item.id === 'REVIEW-029'));
    expect(filterCandidates(all)[0].id).toBe('REVIEW-001');
  });

  it('분야·검색어를 함께 적용하며 없는 검색어는 빈 결과로 남김', () => {
    expect(filterCandidates({ ...all, category: 'training', query: '  MSDS  ' }).map(item => item.id)).toEqual(['REVIEW-021']);
    expect(filterCandidates({ ...all, query: '검색결과가없는고유문자열' })).toEqual([]);
  });

  it('누락된 출처·잘못된 분류로 근거 없는 항목을 표시하지 않음', () => {
    expect(new Set(reviewCandidates.map(item => item.id)).size).toBe(reviewCandidates.length);
    for (const item of reviewCandidates) {
      expect(item.checks.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.sourceIds.length).toBeGreaterThan(0);
      expect(categories.some(category => category.id === item.category)).toBe(true);
      for (const id of item.industries) expect(industries.some(industry => industry.id === id)).toBe(true);
      for (const id of item.work) expect(workConditions.some(work => work.id === id)).toBe(true);
      for (const id of item.focus) expect(headcountBands.some(band => band.id === id)).toBe(true);
      for (const id of item.sourceIds) expect(catalogSources.some(source => source.id === id)).toBe(true);
    }
    for (const source of catalogSources) {
      expect(new URL(source.url).protocol).toBe('https:');
      if (source.level === '조사 경로') expect(source.checkedOn).toBeNull();
      else {
        expect(source.checkedOn).toBeTruthy();
        expect(source.inspectedUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it('CSV는 한글 BOM·줄바꿈·따옴표·검토 상태와 편집 칸을 보존', () => {
    const item = { ...reviewCandidates[0], title: '검토, "따옴표"\n다음 줄' };
    const csv = catalogCsv([item]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"검토, ""따옴표""\n다음 줄"');
    expect(csv).toContain('적용 여부·전문 검토 대기');
    expect(csv).toContain('"검토자","검토일","검토 의견"');
    expect(csv).toContain(item.sourceIds.map(id => catalogSources.find(source => source.id === id)!.url).join('\n'));
    expect(csv).not.toContain('REVIEW-002');
  });

  it.each(['=HYPERLINK("https://example.com")', '+1+1', '-1+1', '@SUM(1)', '\t=1+1'])('CSV 수식 시작문자 %s 무력화', title => {
    expect(catalogCsv([{ ...reviewCandidates[0], title }])).toContain(`"'${title.replaceAll('"', '""')}"`);
  });
});
