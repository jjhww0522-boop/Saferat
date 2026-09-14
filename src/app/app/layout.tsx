import { Shell } from '@/components/shell';
import { memberContext } from '@/server/store';
export default async function MemberLayout({ children }: { children: React.ReactNode }) { await memberContext(); return <Shell>{children}</Shell>; }
