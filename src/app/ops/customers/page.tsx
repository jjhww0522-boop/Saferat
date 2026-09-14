import { opsContext } from '@/server/store';
import { selectWorkplace } from '@/server/actions';
import { PageHeading, Empty } from '@/components/ui';
export default async function Customers() { const { workplaces } = await opsContext(); return <><PageHeading eyebrow="배정 범위 안에서" title="배정 고객·현장" description="가상 고객 A의 현장만 JH 검토자에게 배정되어 있습니다."/><section className="panel">{workplaces.length ? workplaces.map(w => <form className="document-row" key={w.id} action={selectWorkplace}><div><strong>{w.name}</strong><p>{w.industry} · 직접고용 {w.headcount === null ? '확인 필요' : `${w.headcount}명`}</p></div><button className="button secondary" name="workplace" value={w.id}>현장 선택</button></form>) : <Empty title="배정된 고객 없음" detail="미배정 역할은 다른 고객의 자료에 접근할 수 없습니다."/>}</section></>; }
