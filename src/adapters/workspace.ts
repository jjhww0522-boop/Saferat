import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { documentSchema, versionSchema, versionMetadataSchema, workplaceSchema, reviewSchema, permissionsSchema, fileSchema, activitySchema, uuid } from '@/domain/workspace';
import { taskRecordSchema, emptyProfile, profileInput } from '@/domain/tasks';
import { taskActionSourceSchema } from '@/domain/task-action-source';
import { documentPageSchema, documentSearchSchema, type DocumentSearch } from '@/domain/document-search';

export function workspaceRepository(client: SupabaseClient) {
  return {
    async taskActionSources(workplace: string) {
      const { data, error } = await client.rpc('safety_task_action_sources', { workplace: uuid.parse(workplace) });
      if (error) throw error;
      return z.array(taskActionSourceSchema).parse(data);
    },
    async tasks(workplace: string) {
      const { data, error } = await client.from('safety_tasks').select('id,workplace_id,definition_id,definition_version,cycle_number,previous_task_id,title,category,document_id,sensitive,owner,target_date,revision,safety_documents(review_status)').eq('workplace_id', uuid.parse(workplace)).order('created_at');
      if (error) throw error;
      return (data ?? []).map(row => { const doc = row.safety_documents as unknown as { review_status: string } | null; return taskRecordSchema.parse({ ...row, review_status: doc?.review_status ?? 'not_requested' }); });
    },
    async task(id: string) {
      const { data, error } = await client.from('safety_tasks').select('id,workplace_id,definition_id,definition_version,cycle_number,previous_task_id,title,category,document_id,sensitive,owner,target_date,revision,safety_documents(review_status)').eq('id', uuid.parse(id)).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const doc = data.safety_documents as unknown as { review_status: string } | null;
      return taskRecordSchema.parse({ ...data, review_status: doc?.review_status ?? 'not_requested' });
    },
    async profile(workplace: string) {
      const { data, error } = await client.from('safety_workplace_profiles').select('industry,headcount,work,facts,revision,confirmed_at').eq('workplace_id', uuid.parse(workplace)).maybeSingle();
      if (error) throw error;
      return data ? profileInput.parse(data) : emptyProfile;
    },
    async workplaces() {
      const { data, error } = await client.from('safety_workplaces').select('id, organization_id, name').order('name');
      if (error) throw error;
      return z.array(workplaceSchema).parse(data);
    },
    async linkedTask(document: string) {
      const { data, error } = await client.from('safety_tasks').select('id').eq('document_id', uuid.parse(document)).maybeSingle();
      if (error) throw error;
      return data ? uuid.parse(data.id) : null;
    },
    async documentPage(search: DocumentSearch = {}) {
      const filters = documentSearchSchema.parse(search);
      const { data, error } = await client.rpc('safety_document_search', {
        page_number: filters.page, workplace_filter: filters.workplace ?? null,
        title_query: filters.query, status_filter: filters.status, list_view: filters.view,
      });
      if (error) throw error;
      return documentPageSchema.parse(data);
    },
    async detail(id: string) {
      uuid.parse(id);
      const { data, error } = await client.from('safety_documents').select('id, organization_id, workplace_id, title, sensitive, revision, review_status, submission_status, created_at').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const document = documentSchema.parse(data);
      const responses = await Promise.all([
        client.from('safety_document_versions').select('id, document_id, number, created_at, confirmed_at').eq('document_id', id).order('number', { ascending: false }),
        client.from('safety_reviews').select('id, version_id, status, location, comment, requested_at, reviewed_at').eq('document_id', id).order('requested_at', { ascending: false }),
        client.rpc('safety_document_permissions', { document: id }),
        client.from('safety_files').select('id, version_id, document_id, filename, mime_type, byte_size, sha256, object_path, state, created_at').eq('document_id', id).order('created_at'),
        client.from('safety_activity_records').select('id, performed_on, note, corrects_id, recorded_at').eq('document_id', id).order('recorded_at'),
      ]);
      for (const response of responses) if (response.error) throw response.error;
      return { document, versions: z.array(versionMetadataSchema).parse(responses[0].data), reviews: z.array(reviewSchema).parse(responses[1].data), permissions: permissionsSchema.parse(responses[2].data), files: z.array(fileSchema).parse(responses[3].data), activities: z.array(activitySchema).parse(responses[4].data), fetchedAt: Date.now() };
    },
    async readVersion(version: string) {
      const { data, error } = await client.rpc('safety_read_version', { version: uuid.parse(version) });
      if (error) throw error;
      return versionSchema.parse(data);
    },
  };
}
