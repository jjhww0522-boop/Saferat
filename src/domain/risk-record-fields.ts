const labels: Record<string, string> = {
  assessor: '평가 담당자·역할', startedOn: '실제 평가 시작일', finishedOn: '실제 평가 종료일', learningStatus: '교육 준비 상태', learningBasis: '교육 범위 조정 이유', representativeRequested: '근로자대표 참여 요청', representativePeople: '참여한 근로자대표·내용',
  kind: '평가 구분', reason: '평가 시작 이유', scope: '평가 작업·장소', plannedOn: '평가 예정일', criteria: '위험 판단 기준',
  learningOn: '실제 사전 설명일', learningPeople: '사전 설명 참여자', learningNote: '함께 익힌 내용·질문',
  announcedOn: '일정 공유일', announcementPeople: '일정 안내 대상', announcementNote: '알린 일정·방법',
  participationMethod: '근로자 참여 방법', participationOn: '실제 참여일', participants: '실제 참여자·작업', workerOpinion: '근로자 의견·반영', participationException: '순회 점검 예외 사정·대체 방법',
  work: '작업', location: '위치', hazard: '위험요인', people: '노출되는 사람', existingControls: '현재 안전조치', level: '위험 수준', acceptable: '현재 위험 허용 여부', decisionReason: '판단 이유',
  measure: '개선대책', owner: '조치 담당자', dueOn: '조치 목표일', performedOn: '실제 조치일', performedNote: '실제 조치·증빙', verifiedOn: '조치 후 확인일', verifier: '확인한 사람', residualAcceptable: '남은 위험 허용 여부', verificationNote: '조치 후 확인 결과',
  sharedOn: '결과 공유일', sharedPeople: '결과 공유 대상', sharedNote: '공유 내용·방법', nextReviewOn: '다음 확인 예정일', reviewTrigger: '다시 살펴볼 변화', storageNote: '기록·증빙 보관 위치',
};
const values: Record<string, string> = { unknown: '아직 확인하지 못함', initial: '최초평가', periodic: '정기평가', occasional: '수시평가', walkthrough: '근로자와 순회 점검', exception: '특별한 사정으로 다른 방법 사용', yes: '허용할 수 있음', no: '개선이 필요함', low: '낮음', medium: '보통', high: '높음', needed: '교육 필요', performed: '실제 설명·교육 기록', sufficient: '기존 지식 확인 후 범위 조정' };
const choices = new Set(['kind', 'learningStatus', 'participationMethod', 'level', 'acceptable', 'residualAcceptable']);
export function riskRecordFields(data: Record<string, unknown>) {
  return Object.entries(data).filter(([key, value]) => key in labels && typeof value === 'string').map(([key, value]) => ({
    label: labels[key],
    value: key === 'representativeRequested' ? value === 'yes' ? '요청 있음' : value === 'no' ? '확인 결과 요청 없음' : '아직 확인하지 못함' : choices.has(key) ? values[String(value)] ?? String(value) : String(value),
  }));
}
