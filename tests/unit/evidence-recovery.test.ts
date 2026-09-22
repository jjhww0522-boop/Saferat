import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { evidenceRepository } from '@/adapters/evidence';
import { inspectUpload } from '@/domain/files';

const id = '11111111-1111-4111-8111-111111111111';
const bytes = new TextEncoder().encode('%PDF-1.7\nbody\n%%EOF');
const file = { id, version_id: id, document_id: id, object_path: `org/site/doc/version/${id}`, state: 'reserved', ...inspectUpload(bytes, '현장.pdf', 'application/pdf') };
function fixture() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const complete = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn((name: string, args: unknown) => name === 'safety_reserve_file' ? Promise.resolve({ data: file, error: null }) : complete(name, args));
  const client = { rpc, storage: { from: () => ({ upload }) } } as unknown as SupabaseClient;
  return { upload, complete, rpc, execute: () => evidenceRepository(client).upload(id, bytes, '현장.pdf', 'application/pdf') };
}
describe('업로드 응답 유실과 실패 기록', () => {
  it('Storage 호출이 throw해도 실패를 기록하며 파일 바이트를 재전송하지 않는다', async () => {
    const f = fixture(); f.upload.mockRejectedValue(new Error('network disconnected'));
    await expect(f.execute()).rejects.toThrow('network disconnected');
    expect(f.complete).toHaveBeenCalledWith('safety_complete_upload', { file: id, succeeded: false });
    expect(f.upload).toHaveBeenCalledOnce();
    expect(f.upload).toHaveBeenCalledWith(file.object_path, bytes, expect.objectContaining({ upsert: false }));
  });
  it('업로드 성공 후 완료 응답이 유실되면 동일 완료만 다시 요청한다', async () => {
    const f = fixture(); f.complete.mockRejectedValueOnce(new Error('response lost'));
    expect(await f.execute()).toBe(id);
    expect(f.upload).toHaveBeenCalledOnce(); expect(f.complete).toHaveBeenCalledTimes(2);
    expect(f.complete.mock.calls.map(call => call[1])).toEqual([{ file: id, succeeded: true }, { file: id, succeeded: true }]);
    expect(f.rpc.mock.calls.filter(call => call[0] === 'safety_reserve_file')).toHaveLength(1);
  });
  it('완료 RPC가 오류를 반환하면 한 번 재시도하고 계속 실패하면 성공으로 표시하지 않는다', async () => {
    const f = fixture(); f.complete.mockResolvedValue({ error: new Error('database unavailable') });
    await expect(f.execute()).rejects.toThrow('database unavailable');
    expect(f.complete).toHaveBeenCalledTimes(2); expect(f.upload).toHaveBeenCalledOnce();
    expect(f.complete.mock.calls.every(call => call[1].succeeded)).toBe(true);
  });
  it('Storage 오류 뒤 완료 기록 재시도에도 성공이나 검사 완료를 만들지 않는다', async () => {
    const f = fixture(); f.upload.mockResolvedValue({ error: new Error('upload failed') });
    f.complete.mockResolvedValueOnce({ error: new Error('temporary') });
    await expect(f.execute()).rejects.toThrow('upload failed');
    expect(f.complete.mock.calls.map(call => call[1])).toEqual([{ file: id, succeeded: false }, { file: id, succeeded: false }]);
    expect(f.rpc.mock.calls.some(call => call[0] === 'safety_record_file_inspection')).toBe(false);
  });
});
