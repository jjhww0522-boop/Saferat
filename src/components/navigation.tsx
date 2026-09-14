'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, ListChecks, FolderOpen, MessageSquare, Settings2, Building2, ClipboardCheck } from 'lucide-react';

const member = [
  { href: '/app', label: '홈', Icon: House }, { href: '/app/obligations', label: '할 일', Icon: ListChecks },
  { href: '/app/documents', label: '자료', Icon: FolderOpen }, { href: '/app/reviews', label: '검토·보완', Icon: MessageSquare }, { href: '/app/settings', label: '더보기', Icon: Settings2 },
];
const ops = [{ href: '/ops', label: '오늘 검토', Icon: ClipboardCheck }, { href: '/ops/customers', label: '배정 고객', Icon: Building2 }, { href: '/ops/rules', label: '법령 준비', Icon: ListChecks }];
export function Navigation({ operator = false }: { operator?: boolean }) {
  const path = usePathname();
  return <nav className="main-nav" aria-label={operator ? '운영자 메뉴' : '주요 메뉴'}>{(operator ? ops : member).map(({ href, label, Icon }) => {
    const active = path === href || (href !== '/app' && href !== '/ops' && path.startsWith(href));
    return <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><Icon size={21} strokeWidth={active ? 2 : 1.6} /><span>{label}</span></Link>;
  })}</nav>;
}
