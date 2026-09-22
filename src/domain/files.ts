import { createHash } from 'node:crypto';

export const maxFileBytes = 10 * 1024 * 1024;
export class FileValidationError extends Error {}
export function isSameOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? url.protocol.slice(0, -1);
  return ['http', 'https'].includes(protocol) && request.headers.get('origin') === `${protocol}://${host}`;
}
export function inspectUpload(bytes: Uint8Array, filename: string, mimeType: string) {
  if (!filename || filename.length > 180 || /[/\\]/.test(filename) || [...filename].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new FileValidationError('파일 이름을 확인해주세요.');
  if (bytes.byteLength === 0 || bytes.byteLength > maxFileBytes) throw new FileValidationError('1바이트 이상, 10MB 이하의 파일을 선택해주세요.');
  const header = Buffer.from(bytes.subarray(0, 8));
  const extension = filename.split('.').pop()?.toLowerCase();
  const png = header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
  const pdf = header.subarray(0, 5).toString('ascii') === '%PDF-';
  if (!((png && mimeType === 'image/png' && extension === 'png') || (jpeg && mimeType === 'image/jpeg' && ['jpg', 'jpeg'].includes(extension ?? '')) || (pdf && mimeType === 'application/pdf' && extension === 'pdf'))) throw new FileValidationError('PDF·JPG·PNG 파일의 형식과 확장자가 일치해야 합니다.');
  // Preliminary identification only. A separate inspector must parse and scan before release.
  return { filename, mime_type: mimeType, byte_size: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function readUploadBody(request: Request) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxFileBytes)) throw new FileValidationError('10MB 이하의 파일을 선택해주세요.');
  if (!request.body) throw new FileValidationError('파일이 비어 있습니다.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxFileBytes) { await reader.cancel(); throw new FileValidationError('10MB 이하의 파일을 선택해주세요.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

export interface FileInspector {
  inspect(input: { bytes: Uint8Array; mimeType: string; expectedSha256: string }): Promise<{
    verdict: 'clean' | 'rejected' | 'unavailable'; scannerVersion: string | null;
    observedSha256: string; observedSize: number;
  }>;
}
export const unavailableFileInspector: FileInspector = {
  async inspect({ bytes }) {
    return { verdict: 'unavailable', scannerVersion: null, observedSha256: createHash('sha256').update(bytes).digest('hex'), observedSize: bytes.byteLength };
  },
};
