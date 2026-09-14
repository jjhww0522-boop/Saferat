import Link from 'next/link';
export default function NotFound() { return <main className="standalone"><h1>이 자료를 찾을 수 없습니다.</h1><p>주소와 현재 체험 역할의 접근 범위를 확인해주세요.</p><Link className="button primary" href="/app">홈으로 돌아가기</Link></main>; }
