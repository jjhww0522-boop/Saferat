'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="standalone"><p className="eyebrow">다시 연결할게요</p><h1>화면을 불러오지 못했습니다.</h1><p>새로고침하거나 체험 안내에서 실행 상태를 확인해주세요.</p><button className="button primary" onClick={reset}>다시 시도</button><Link className="button secondary" href="/demo">체험 안내</Link><Link className="emergency-link" href="/emergency">사고·긴급 연락</Link></main>;
}
