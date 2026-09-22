import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { fileSchema, permissionsSchema, uuid } from '@/domain/workspace';
import { inspectUpload } from '@/domain/files';

export const evidenceBucket = 'safety-evidence';
export function evidenceRepository(client: SupabaseClient) {
  return {
    async upload(version: string, bytes: Uint8Array, filename: string, mimeType: string) {
      const input = inspectUpload(bytes, filename, mimeType);
      const reserved = await client.rpc('safety_reserve_file', { version: uuid.parse(version), ...input });
      if (reserved.error) throw reserved.error;
      const file = fileSchema.parse(reserved.data);
      let succeeded = false, uploadError: unknown;
      try {
        const uploaded = await client.storage.from(evidenceBucket).upload(file.object_path, bytes, { upsert: false, contentType: input.mime_type, cacheControl: '0' });
        succeeded = !uploaded.error; uploadError = uploaded.error;
      } catch (error) { uploadError = error; }
      // Completion is idempotent: a lost response can be retried without uploading
      // the original again. A second failure remains visible for explicit recovery.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const recorded = await client.rpc('safety_complete_upload', { file: file.id, succeeded });
          if (recorded.error) throw recorded.error;
          break;
        } catch (error) { if (attempt === 1) throw error; }
      }
      if (!succeeded) throw uploadError;
      return file.id;
    },
    async download(id: string) {
      const prepared = await client.rpc('safety_prepare_download', { file: uuid.parse(id) });
      if (prepared.error) throw prepared.error;
      const file = fileSchema.parse(prepared.data);
      const downloaded = await client.storage.from(evidenceBucket).download(file.object_path, {}, { cache: 'no-store' });
      if (downloaded.error) throw downloaded.error;
      // Recheck access after fetching so a revocation during I/O prevents sending the body.
      const checked = await client.rpc('safety_document_permissions', { document: file.document_id });
      if (checked.error || !permissionsSchema.parse(checked.data).read) throw new Error('access_denied');
      if (downloaded.data.size !== file.byte_size) throw new Error('file_integrity');
      const bytes = await downloaded.data.arrayBuffer();
      if (createHash('sha256').update(Buffer.from(bytes)).digest('hex') !== file.sha256) throw new Error('file_integrity');
      return { file, bytes };
    },
  };
}
