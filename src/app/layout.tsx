import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: { default: '사업장 안전관리', template: '%s · 사업장 안전관리' }, description: '해야 할 일부터 자료 준비와 보완까지, 사업장 안전관리 업무 흐름 체험.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
