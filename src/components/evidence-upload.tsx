'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function EvidenceUpload({ version }: { version: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  return <form onSubmit={async event => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file');
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) { setMessage('1바이트 이상, 10MB 이하의 파일을 선택해주세요.'); return; }
    setPending(true);
    try {
      const response = await fetch('/api/files', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Version-Id': version, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
      const result: { message?: string } = await response.json();
      setMessage(response.ok ? result.message ?? '파일 목록에서 저장 결과를 확인해주세요.' : `${result.message ?? '업로드 결과를 확인하지 못했습니다.'} 파일 목록을 먼저 확인해주세요. 바로 다시 올리면 중복될 수 있습니다.`);
    } catch { setMessage('업로드 결과를 확인하지 못했습니다. 파일 목록을 새로고침해 기존 파일 상태를 먼저 확인해주세요. 바로 다시 올리면 중복될 수 있습니다.'); }
    finally { setPending(false); router.refresh(); }
  }}><fieldset disabled={pending}><label>첨부파일 (PDF·JPG·PNG, 최대 10MB)<input type="file" name="file" accept="application/pdf,image/jpeg,image/png" required/></label><p className="helper">현재 파일 검사는 아직 연결되지 않았습니다. 격리 저장만 가능하며, 검사 완료 전에는 미리보기·다운로드·자료 내용 확인을 할 수 없습니다.</p><div className="button-row"><button className="button secondary">{pending ? '업로드 중…' : '격리 저장'}</button><button type="button" className="button secondary" onClick={() => router.refresh()}>파일 목록 새로고침</button></div></fieldset>{message ? <p role="status" className="form-message">{message}</p> : null}</form>;
}
