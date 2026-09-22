import { operatorPageClient } from '@/server/supabase';
import { demoOperatorContext } from '@/server/store';
import { workspaceRepository } from '@/adapters/workspace';
import { OperatorShell } from '@/components/operator-shell';
import { Shell } from '@/components/shell';
import { PageHeading } from '@/components/ui';
export default async function Customers() {
  const demo = await demoOperatorContext();
  const workplaces = demo ? demo.workplaces : await workspaceRepository((await operatorPageClient()).client).workplaces();
  const content = <><PageHeading eyebrow="현재 배정 범위" title="배정 고객·현장" description="유효한 배정과 허용된 업무 범위의 현장만 표시합니다."/><section className="record-section">{workplaces.length ? workplaces.map(w => <div className="document-row" key={w.id}><strong>{w.name}</strong></div>) : <p>배정된 현장이 없습니다.</p>}</section></>;
  return demo ? <Shell operator>{content}</Shell> : <OperatorShell>{content}</OperatorShell>;
}
