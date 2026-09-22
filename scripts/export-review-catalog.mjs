import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import {
  catalogCsv, catalogNotice, catalogSources, catalogStatus, catalogVersion, categories,
  filterCandidates, headcountBands, industries, reviewCandidates, workConditions,
} from '../src/domain/review-catalog.ts';

const tableCell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
const label = (list, id) => list.find(item => item.id === id).label;
const lines = [
  '# 업종·인원별 체크리스트·점검·교육 검토 목록', '',
  `버전: ${catalogVersion} · 검토 후보 ${reviewCandidates.length}개 · 업종 묶음 ${industries.length}개 · 분야 ${categories.length}개`, '',
  `> ${catalogNotice}`, '',
  '## 먼저 읽기', '',
  '- 모든 항목은 적용 여부·전문 검토 대기입니다. 승인된 실제 법령 규칙은 0개입니다.',
  '- 질문·증빙은 현장과 법령을 검토하기 위한 제안입니다. 개별 질문을 모두 법정 의무로 확정한 것이 아닙니다.',
  '- 업종은 업무별 탐색용 묶음이며 한국표준산업분류의 공식 코드가 아닙니다.',
  '- 인원 구간은 검토 순서에만 사용합니다. 0명·미응답을 구분하며 인원만으로 후보를 제외하지 않습니다.',
  '- 교육시간·선임 인원·점검 주기·제출 기한·보존기간은 현행 원문·예외·시행일 검토 후 확정합니다.',
  '- 화면: 가상 사업장 체험 → 더보기 → 업종·인원별 검토 목록. 운영자는 법령 준비 메뉴.',
  '- CSV: 화면의 현재 목록 CSV 버튼 또는 docs/CHECKLIST_REVIEW.csv. 마지막 세 칸에 검토자·검토일·의견을 기록할 수 있습니다.',
  '- 실제 자료·개인정보를 공개 데모에 입력하지 않습니다. 내려받은 파일의 의견은 앱에 저장되지 않습니다.', '',
  '## 검토 순서', '',
  '1. 실제 업종·작업·고용·계약·설비·시설 사실을 먼저 확인합니다.',
  '2. 항목별 공식 원문과 적용 제외·시행일·경과조치·산정 단위를 대조합니다.',
  '3. 사용자 1차 검토와 필요한 외부 전문 검토를 기록합니다.',
  '4. 승인 전에는 적용·비적용으로 확정하지 않고 확인 질문을 남깁니다.', '',
  '## 인원별 우선 확인', '',
  '| 인원 구간 | 먼저 확인할 내용 |', '|---|---|',
  ...headcountBands.map(band => `| ${band.label} | ${tableCell(band.note)} |`), '',
  '인원 관련 원문 조사: 산업안전보건법 시행령의 적용범위·선임별 별표, 중대재해처벌법 적용범위, 휴게시설 조항, 이사회 보고 조항을 각각 대조합니다. 아래 출처 원장의 확인 범위를 함께 읽어주세요.', '',
  '## 업종별 검토 초점', '',
  '| 업종 묶음 | 우선 확인할 사실 | 관련 후보 수(공통 포함) |', '|---|---|---|',
  ...industries.map(industry => `| ${industry.label} | ${tableCell(industry.focus)} | ${filterCandidates({ industry: industry.id, headcount: 'unknown', category: 'all', work: [], query: '' }).length} |`), '',
  '공통 후보와 해당 업종에 연결된 후보의 합입니다. 실제 의무 수가 아니며 다른 작업 조건을 추가하면 후보가 늘어납니다. 기타·복합·분류 미정은 전체 후보를 표시합니다.', '',
  '## 검토 항목 요약', '',
  '| ID | 분야 | 검토 항목 |', '|---|---|---|',
  ...reviewCandidates.map(item => `| ${item.id} | ${label(categories, item.category)} | ${tableCell(item.title)} |`), '',
];

for (const category of categories) {
  lines.push(`## ${category.label}`, '');
  for (const item of reviewCandidates.filter(item => item.category === category.id)) {
    lines.push(
      `### ${item.id} · ${item.title}`, '',
      `- 상태: **${catalogStatus}**`,
      `- 관련 업종 예시: ${item.industries.map(id => label(industries, id)).join(' / ') || '전 업종 공통 검토 후보'}`,
      `- 추가 작업 조건: ${item.work.map(id => label(workConditions, id)).join(' / ') || '개별 현장 사실 확인'}`,
      `- 우선 확인 인원 구간: ${item.focus.map(id => label(headcountBands, id)).join(' / ') || '인원만으로 제외하지 않음'}`,
      `- 적용 확인 조건: ${item.condition}`,
      `- 조사 위치: ${item.reference}`, '',
      '**확인할 질문**', '', ...item.checks.map(check => `- [ ] ${check}`), '',
      '**증빙 예시**', '', ...item.evidence.map(evidence => `- ${evidence}`), '',
      '**공식 출처·확인 범위**', '',
      ...item.sourceIds.map(id => {
        const source = catalogSources.find(candidate => candidate.id === id);
        return `- [${source.title}](${source.url}) · ${source.level} · ${source.checkedOn ?? '확인일 미정'}: ${source.scope}`;
      }), '',
      '검토자: ______ / 검토일: ______ / 추가 확인·정정 의견: ______', '',
    );
  }
}
lines.push('## 출처 원장', '', '검색 발췌 확인·서지 확인·조사 경로는 법적 적용 검토나 승인 완료가 아닙니다. 현행 원문 링크와 실제 확인에 사용한 시행본/안내 자료를 구분합니다.', '');
for (const source of catalogSources) {
  lines.push(`### ${source.id} · ${source.title}`, '', `- [공식 원문 조사 경로](${source.url})`,
    `- 실제 확인 경로: ${source.inspectedUrl ? `[확인에 사용한 자료](${source.inspectedUrl})` : '아직 확인하지 않음'}`,
    `- 확인 상태·날짜: ${source.level} / ${source.checkedOn ?? '미확인'}`, `- 확인 범위: ${source.scope}`, '');
}
lines.push('## 남은 조사 범위', '',
  '- 세부 업종·규모별 적용 제외, 근로자 수 산정 및 법령 시행일 대조.',
  '- 교육 과정별 시간·대상·면제·주기, 선임 자격·인원·위탁·전담·보고 조건.',
  '- 시설별 법정 점검·검사·진단·보고·서식·보존 기준.',
  '- 소방시설·가스·위험물·기계설비·건설·건축물·공중위생·광산·선원 등 조사 경로만 확보한 원문.',
  '- 공연·체육·학교·사회복지·환경 인허가·공공 현업 등 개별 법령과 외국기관·가사 분야의 별도 적용 범위.',
  '- 공정안전보고서·석면·취업 제한·노무제공자 후보의 조문별 세분화와 적용 기준 검증. 가맹본부 등 미수록 의무 추가 조사.',
  '- 전문 검토와 기대 사례 승인, P3 실행 규칙으로의 별도 전환.', '',
  '이 문서는 scripts/export-review-catalog.mjs에서 생성합니다. 항목 원본은 src/domain/review-catalog.ts이며 재생성 시 문서의 수기 변경이 덮어써집니다. 검토 의견은 별도 사본에 기록해주세요.', '');

const markdown = lines.join('\n');
const csv = catalogCsv(reviewCandidates);
const outputs = new Map([
  ['docs/CHECKLIST_REVIEW.md', markdown], ['docs/CHECKLIST_REVIEW.csv', csv], ['public/review-catalog.md', markdown],
]);
for (const [path, content] of outputs) {
  const target = new URL(`../${path}`, import.meta.url);
  if (process.argv.includes('--check')) {
    const existing = await readFile(target, 'utf8');
    if (existing !== content) throw new Error(`${path}: 목록 원본과 다릅니다. npm.cmd run catalog:export를 실행하세요.`);
  } else {
    await mkdir(new URL('.', target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  process.stdout.write(`${process.argv.includes('--check') ? 'Checked' : 'Written'} ${fileURLToPath(target)}\n`);
}
process.stdout.write(`${reviewCandidates.length} candidates, ${industries.length} industry groups, ${categories.length} categories.\n`);
