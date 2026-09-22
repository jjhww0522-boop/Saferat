import Link from 'next/link';
export function OperatorNavigation() {
  return <nav className="main-nav" aria-label="중앙관제 메뉴"><Link href="/ops">검토 대기</Link><Link href="/ops/customers">배정 고객</Link><Link href="/ops/rules">법령 준비</Link></nav>;
}
