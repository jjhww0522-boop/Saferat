import type { Condition, Evaluation, Rule, Snapshot, Truth } from './types';

export function and(values: Truth[]): Truth {
  return values.includes(false) ? false : values.every(v => v === true) ? true : 'unknown';
}
export function or(values: Truth[]): Truth {
  return values.includes(true) ? true : values.every(v => v === false) ? false : 'unknown';
}

export function evaluate(rule: Rule, snapshot: Snapshot, asOf: string, mode: 'demo' | 'live' = 'demo', scopeReviewed = true): Evaluation {
  const missing = new Set<string>();
  const trace: Evaluation['trace'] = [];
  function visit(condition: Condition): Truth {
    let result: Truth;
    if (condition.op === 'and' || condition.op === 'or') {
      const values = condition.args.map(visit);
      result = condition.op === 'and' ? and(values) : or(values);
    } else if (condition.op === 'not') {
      const value = visit(condition.arg);
      result = value === 'unknown' ? value : !value;
    } else if ('fact' in condition) {
      const fact = Object.hasOwn(snapshot.facts, condition.fact) ? snapshot.facts[condition.fact] : undefined;
      if (!fact || fact.value === null || !fact.confirmed) {
        missing.add(condition.fact);
        result = 'unknown';
      } else if (condition.op === 'eq') result = fact.value === condition.value;
      else if (typeof fact.value !== 'number' || typeof condition.value !== 'number') result = 'unknown';
      else {
        const a = fact.value, b = condition.value;
        result = condition.op === 'lt' ? a < b : condition.op === 'lte' ? a <= b : condition.op === 'gt' ? a > b : a >= b;
      }
    } else result = 'unknown';
    trace.push({ op: condition.op, ...('fact' in condition ? { fact: condition.fact } : {}), result });
    return result;
  }
  const truth = visit(rule.condition);
  const verified = rule.kind === 'demo' ? mode === 'demo' : rule.status === 'approved' && rule.productionEligible && rule.sourceRefs.length > 0;
  const reasons: string[] = [];
  if (!verified) reasons.push('규칙 미검증 또는 운영 사용 불가');
  if (!scopeReviewed) reasons.push('법령 조사 범위 확인 필요');
  if (missing.size) reasons.push('미응답 또는 확인하지 않은 사업장 정보');
  const applicability = !verified || !scopeReviewed || truth === 'unknown' ? 'needs_review' : truth ? 'applicable' : 'not_applicable';
  return { ruleId: rule.id, ruleVersion: rule.version, snapshotId: snapshot.id, asOf, applicability,
    missingFacts: [...missing], reasons, trace };
}

export const demoRules: Rule[] = [
  { id: 'DEMO_CHECKLIST_001', version: '1', title: '현장 사진 점검 기록', kind: 'demo', status: 'draft', productionEligible: false, sourceRefs: [], condition: { op: 'eq', fact: 'photoCheck', value: true } },
  { id: 'DEMO_TRAINING_001', version: '1', title: '교육 실시 내용 기록', kind: 'demo', status: 'draft', productionEligible: false, sourceRefs: [], condition: { op: 'eq', fact: 'training', value: true } },
  { id: 'DEMO_CONTRACT_001', version: '1', title: '함께 일하는 업체 정보 확인', kind: 'demo', status: 'draft', productionEligible: false, sourceRefs: [], condition: { op: 'eq', fact: 'contractor', value: true } },
];
