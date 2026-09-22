import { z } from 'zod';
import { documentSchema, uuid } from './workspace';

export const documentPageSize = 25;
export const documentStatuses = ['all', 'not_requested', 'queued', 'changes_requested', 'reviewed', 'reopened'] as const;
const documentListSearchSchema = z.object({
  page: z.number().int().min(1).max(1000000).default(1),
  workplace: z.string().max(120).optional(),
  query: z.string().trim().max(200).default(''),
  status: z.enum(documentStatuses).default('all'),
  view: z.enum(['documents', 'reviews']).default('documents'),
});
export const documentSearchSchema = documentListSearchSchema.extend({ workplace: uuid.optional() });
export type DocumentSearch = z.input<typeof documentSearchSchema>;
export type DocumentFilters = z.output<typeof documentSearchSchema>;
export type DocumentSearchParams = { page?: string | string[]; workplace?: string | string[]; q?: string | string[]; status?: string | string[] };

export const documentSearchRowSchema = documentSchema.extend({
  workplace_name: z.string(),
  task: z.object({ id: uuid, definition_id: z.string(), cycle_number: z.number().int().positive() }).nullable(),
  review: z.object({ id: uuid, version_id: uuid, version_number: z.number().int().positive(), status: z.enum(['queued', 'changes_requested', 'reviewed']), requested_at: z.string(), reviewed_at: z.string().nullable() }).nullable(),
});
export const documentPageSchema = z.object({
  items: z.array(documentSearchRowSchema), total: z.number().int().nonnegative(),
  page: z.number().int().positive(), pageSize: z.literal(documentPageSize),
});
export type DocumentPage = z.infer<typeof documentPageSchema>;
export type DocumentListItem = Pick<DocumentPage['items'][number], 'id' | 'title' | 'workplace_id' | 'workplace_name' | 'sensitive' | 'review_status' | 'created_at' | 'task'> & {
  href?: string;
  review: { version_id: string; version_number: number; status: string; requested_at: string | null } | null;
};
export type DocumentListPage = Omit<DocumentPage, 'items'> & { items: DocumentListItem[] };

export function documentFilters(params: DocumentSearchParams, view: DocumentFilters['view'], defaultStatus: DocumentFilters['status'] = 'all'): DocumentFilters {
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) ?? '';
  const page = Number(first(params.page)), status = first(params.status);
  return documentListSearchSchema.parse({
    page: Number.isSafeInteger(page) && page > 0 && page <= 1000000 ? page : 1,
    workplace: first(params.workplace).slice(0, 120) || undefined, query: first(params.q).trim().slice(0, 200), view,
    status: view === 'reviews' && status === 'not_requested' ? 'all' : documentStatuses.includes(status as DocumentFilters['status']) ? status : defaultStatus,
  });
}

export function documentPageHref(path: string, filters: DocumentFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.workplace) params.set('workplace', filters.workplace);
  if (filters.query) params.set('q', filters.query);
  params.set('status', filters.status);
  if (page > 1) params.set('page', String(page));
  return `${path}?${params}`;
}

export function documentTurn(status: string) {
  if (status === 'queued') return '검토자가 확인할 차례';
  if (status === 'changes_requested') return '고객이 보완할 차례';
  if (status === 'reviewed') return '자료 검토 결과 있음 · 실제 수행 별도 확인';
  if (status === 'reopened') return '고객이 새 버전을 확인할 차례';
  return '고객이 자료를 준비할 차례';
}
