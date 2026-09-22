// Each page guards its own reads. Login must remain outside the protected portal.
export const dynamic = 'force-dynamic';
export default function OpsLayout({ children }: { children: React.ReactNode }) { return children; }
