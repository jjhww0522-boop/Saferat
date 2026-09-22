import { workspacePageClient } from '@/server/supabase';
import { workspaceRepository } from '@/adapters/workspace';
import { WorkspaceForm } from '@/components/workspace-form';
import { acceptInvitation, createInvitation, revokeInvitation } from '@/server/workspace-actions';
import { PageHeading } from '@/components/ui';
import { z } from 'zod';
import { uuid } from '@/domain/workspace';

export default async function Members() {
  const { client } = await workspacePageClient();
  const workplaces = await workspaceRepository(client).workplaces();
  const result = await client.rpc('safety_list_invitations');
  if (result.error) throw new Error('초대 목록을 불러오지 못했습니다.');
  const invitations = z.array(z.object({ id: uuid, workplace_id: uuid, email: z.string(), expires_at: z.string(), accepted_at: z.string().nullable(), revoked_at: z.string().nullable(), expired: z.boolean() })).parse(result.data);
  return <><PageHeading eyebrow="조직·현장 연결" title="초대 관리" description="초대받은 이메일로 로그인한 뒤 코드를 입력해주세요."/><section className="panel panel-padding"><h2>초대 수락</h2><WorkspaceForm action={acceptInvitation}><label>초대 코드<input name="token" required maxLength={64} autoComplete="off"/></label><button className="button primary">현장에 연결</button></WorkspaceForm></section>
    {workplaces.length ? <section className="panel panel-padding"><h2>현장 구성원 초대</h2><p>조직 소유자만 만들 수 있습니다. 코드 생성 후 대상자에게 직접 전달해주세요.</p><WorkspaceForm action={createInvitation}><label>현장<select name="workplace">{workplaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>대상 이메일<input name="email" type="email" required maxLength={254}/></label><label className="checkbox-label"><input type="checkbox" name="can_write"/>자료 작성 허용</label><button className="button primary">초대 코드 만들기</button></WorkspaceForm></section> : null}
    <section className="panel panel-padding"><h2>보낸 초대</h2>{invitations.length ? invitations.map(i => <div className="document-row" key={i.id}><div><strong>{i.email}</strong><p>{workplaces.find(w => w.id === i.workplace_id)?.name} · {i.revoked_at ? '철회됨' : i.accepted_at ? '수락됨' : i.expired ? '만료됨' : '수락 대기'}</p></div>{!i.revoked_at && !i.accepted_at && !i.expired ? <WorkspaceForm action={revokeInvitation}><input type="hidden" name="invitation" value={i.id}/><button className="button secondary">초대 철회</button></WorkspaceForm> : null}</div>) : <p>보낸 초대가 없습니다.</p>}</section></>;
}
