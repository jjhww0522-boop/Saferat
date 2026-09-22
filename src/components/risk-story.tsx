'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { WorkScene } from './work-scene';

const scenes = [
  { kind: 'observe', title: '다칠 수 있는 상황을 찾아요', text: '사람이 지나는 곳에 걸리거나 부딪힐 물건이 있나요? 작업하는 장소와 상황을 함께 살펴보세요.' },
  { kind: 'talk', title: '그곳에서 일하는 사람에게 물어요', text: '“최근 아찔했던 순간이 있었나요?” 직접 들은 내용과 아직 확인하지 못한 내용을 나눠보세요.' },
  { kind: 'record', title: '확인한 위치와 상황을 적어요', text: '어디에서, 어떤 작업 중에, 어떻게 다칠 수 있는지 적어주세요. 아직 확인하지 못했다면 모름으로 남겨도 괜찮아요.' },
] as const;

export function RiskStory() {
  const [index, setIndex] = useState(0);
  const scene = scenes[index];
  return <section className="risk-story" aria-label="위험요인 기록 설명 예시">
    <p className="scene-label">설명 예시 · 우리 사업장의 실제 기록이 아니에요</p>
    <div aria-live="polite" aria-atomic="true"><div key={index} className="story-frame"><WorkScene kind={scene.kind}/><p className="scene-counter">{index + 1} / 3</p><h3>{scene.title}</h3><p>{scene.text}</p></div></div>
    <div className="story-controls"><button type="button" className="button secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft size={18}/>이전 설명</button><button type="button" className="button secondary" disabled={index === 2} onClick={() => setIndex(index + 1)}>다음 설명<ArrowRight size={18}/></button></div>
  </section>;
}

const stepScenes = [
  { kind: 'observe', title: '어떤 작업을 함께 살펴볼까요?', text: '장소와 작업을 정하면 확인할 범위가 분명해져요. 평소 작업뿐 아니라 청소와 운반도 떠올려보세요.' },
  { kind: 'talk', title: '실제로 일하는 사람과 함께 살펴요', text: '혼자 알아내기 어려운 위험도 있어요. 작업자가 겪은 불편과 아찔했던 순간을 들어보세요.' },
  { kind: 'observe', title: '어디에서, 어떻게 다칠 수 있나요?', text: '그림 속 통로의 상자처럼, 사람과 물건이 만나는 상황을 살펴보세요. 우리 현장에서 확인한 사실을 적어요.' },
  { kind: 'talk', title: '정한 기준에 비춰 함께 판단해요', text: '지금의 안전조치로 충분한지 확인하세요. 근거가 부족하면 아직 판단하지 못한 상태로 남겨요.' },
  { kind: 'record', title: '할 일과 실제로 한 일을 나눠 적어요', text: '조치 내용·담당자·목표일은 계획이에요. 실행한 뒤 실제 날짜와 바뀐 내용을 따로 기록해요.' },
  { kind: 'observe', title: '조치한 뒤, 현장을 다시 살펴요', text: '위험이 충분히 줄었는지 확인한 사람과 결과를 남겨요. 남은 문제가 있으면 조치를 보완해요.' },
  { kind: 'record', title: '결과를 알리고 다시 찾을 수 있게 정리해요', text: '누구에게 무엇을 알렸는지, 자료는 어디에 보관했는지 남겨요. 남은 확인도 함께 전달해요.' },
] as const;

export function RiskScene({ step }: { step: number }) {
  const scene = stepScenes[step];
  return <details className="risk-scene" open><summary>그림으로 먼저 알아보기</summary><div className="risk-scene-content"><figure><WorkScene kind={scene.kind}/><figcaption>설명 예시 · 실제 현장과 다를 수 있어요</figcaption></figure><div><h4>{scene.title}</h4><p>{scene.text}</p></div></div></details>;
}
