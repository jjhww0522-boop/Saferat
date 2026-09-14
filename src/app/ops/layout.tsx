import { Shell } from '@/components/shell';
import { opsContext } from '@/server/store';
export default async function OpsLayout({ children }: { children: React.ReactNode }) { await opsContext(); return <Shell operator>{children}</Shell>; }
