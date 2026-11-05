import { z } from 'zod'
import { adminSite, correlationOf, identifierParam, publisherHandler, readJson, requireSubject } from '../../../../internal/http'
import { deletePublisherDocument } from '../../../../utils/publisher-server'

const deleteRequestSchema = z.strictObject({ expectedVersion: z.number().int().min(1) })

/** DELETE /api/publisher/admin/documents/{id} — deletes a document with every version, with `expectedVersion`. */
export default publisherHandler(async (event) => {
  const subject = await requireSubject(event)
  const documentId = identifierParam(event, 'documentId')
  const { expectedVersion } = await readJson(event, deleteRequestSchema)
  return deletePublisherDocument({ siteId: await adminSite(event), subject, correlationId: correlationOf(event), documentId, expectedVersion })
})
