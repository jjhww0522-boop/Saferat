import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './task-design.css';
import './journey.css';
import './readability.css';
const pretendard = localFont({ src: './fonts/PretendardVariable.woff2', variable: '--font-pretendard', display: 'swap', weight: '100 900', fallback: ['Malgun Gothic', 'sans-serif'], adjustFontFallback: false });
export const metadata: Metadata = { title: { default: '사업장 안전관리', template: '%s · 사업장 안전관리' }, description: '해야 할 일부터 자료 준비와 보완까지, 사업장 안전관리 업무 흐름 체험.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" className={pretendard.variable}><body>{children}</body></html>;
}
