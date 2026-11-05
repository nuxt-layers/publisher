import { z } from 'zod'
import { definePublisherDocumentType } from '../../../shared/contracts'

// The host's own content declaration: data, not composition, so outside the budget.
export const noticeType = definePublisherDocumentType({
  type: 'notice',
  label: { one: 'Notice', many: 'Notices' },
  fields: z.strictObject({ body: z.string().max(2000) }),
  address: { kind: 'path', base: '/notices', pattern: 'slug' },
  listing: { listable: true, order: 'published-desc', filterable: [] },
  lifecycle: { approval: false, scheduling: false },
})
