import type { TaskDefinition } from '@/domain/tasks';
import { taskGuidance } from '@/domain/task-guidance';
import { JourneyHelp } from './journey-help';

export function TaskGuidance({ definition }: { definition: TaskDefinition }) {
  const guide = taskGuidance(definition);
  if (!guide) return <p className="notice">이 항목의 실행 안내는 아직 준비 중이에요. 확인할 내용을 메모해 담당자에게 전달해주세요.</p>;
  return <section className="task-guidance" aria-label={`${definition.title} 실행 안내`}>
    <p className="helper">{guide.kind === 'setup' ? '등록 준비 · 실제 업무를 찾기 위한 기초 확인' : guide.kind === 'record' ? '자체 서식 · 확인한 사실을 기록해요' : '실행 안내 · 적용 여부는 별도 확인'}</p>
    <h2>무엇부터 하면 되나요?</h2>
    <p><strong>{guide.firstAction}</strong></p>
    <details className="legal-research">
      <summary>진행 순서·준비할 자료·마무리 확인 보기</summary>
      <p>{guide.goal}</p>
      <ol className="journey-tour">{guide.steps.map((step, index) => <li key={step}><strong>{index === 0 ? '먼저 확인해요' : index === guide.steps.length - 1 ? '기록하고 이어가요' : '현장에서 실행해요'}</strong><p>{step}</p></li>)}</ol>
      <h3>실제로 준비할 자료</h3>
      <ul>{guide.evidence.map(item => <li key={item}>{item}</li>)}</ul>
      <h3>여기까지 확인하면 다음 단계로 갈 수 있어요</h3>
      <ul>{guide.done.map(item => <li key={item}>{item}</li>)}</ul>
      <h3>모르거나 자료가 없을 때</h3>
      {guide.help.map(item => <p key={item}>{item}</p>)}
    </details>
    <JourneyHelp title="처음 준비하는 분을 위한 안내">{guide.help.map(item => <p key={item}>{item}</p>)}</JourneyHelp>
  </section>;
}
