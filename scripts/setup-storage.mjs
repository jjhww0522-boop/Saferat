import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error('SUPABASE_URL 및 별도 설정용 관리자 키가 필요합니다. 키를 로그나 채팅에 출력하지 마세요.');
const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const settings = { public: false, fileSizeLimit: 10485760, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'] };
const { data: buckets, error: listError } = await client.storage.listBuckets();
if (listError) throw new Error('비공개 파일 저장소 목록을 조회하지 못했습니다. 프로젝트와 설정용 키를 확인해주세요.');
const existing = buckets.find(bucket => bucket.id === 'safety-evidence');
if (existing) {
  const types = existing.allowed_mime_types ?? [];
  if (existing.public || Number(existing.file_size_limit) !== settings.fileSizeLimit || types.length !== settings.allowedMimeTypes.length || !settings.allowedMimeTypes.every(type => types.includes(type))) throw new Error('기존 safety-evidence 버킷의 비공개·크기·MIME 설정을 확인해주세요. 기존 설정을 자동 변경하지 않았습니다.');
} else {
  const { error } = await client.storage.createBucket('safety-evidence', settings);
  if (error) throw new Error('비공개 파일 저장소 생성에 실패했습니다.');
}
process.stdout.write('safety-evidence: private bucket, 10 MiB, PDF/JPEG/PNG configured.\n');
