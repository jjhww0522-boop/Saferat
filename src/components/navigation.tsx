'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, FolderOpen, MessageSquare, Map } from 'lucide-react';

const member = [
  { href: '/app', label: '오늘', Icon: House }, { href: '/app/map', label: '전체 지도', Icon: Map },
  { href: '/app/documents', label: '자료', Icon: FolderOpen }, { href: '/app/reviews', label: '검토·보완', Icon: MessageSquare },
];
export function Navigation() {
  const path = usePathname();
  return <nav className="main-nav" aria-label="주요 메뉴">{member.map(({ href, label, Icon }) => {
    const active = path === href || (href !== '/app' && path.startsWith(href));
    return <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><Icon size={21} strokeWidth={active ? 2 : 1.6} /><span>{label}</span></Link>;
  })}</nav>;
}
