import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PublisherActionRequestInput, PublisherDocument, PublisherSubject } from '../shared/contracts'
import { publisherAddressesSchema } from '../shared/contracts'
import {
  createPublisherDocument,
  deletePublisherDocument,
  getPublishedDocument,
  getPublisherAddresses,
  listPublisherBacklinks,
  resolvePublisherPath,
  transitionPublisherDocument,
} from '../server/utils/publisher-server'
import { hasDatabase, requireDatabaseInCi } from './support/database'
import { Harness } from './support/publisher'
import { bulletin, landing } from './support/types'
import { id, person, World, SITE } from './support/world'

requireDatabaseInCi()

/**
 * Delete (docs/contracts.md §5.6) and reading addresses (§7.2): a deleted
 * document leaves nothing behind but one event; a policy hold refuses it.
 */
describe.skipIf(!hasDatabase)('delete and addresses (PostgreSQL)', () => {
  let harness: Harness
  let world: World
  const alice = id()
  let editor: PublisherSubject

  const act = (document: PublisherDocument, request: PublisherActionRequestInput) =>
    transitionPublisherDocument({ siteId: SITE, subject: editor, correlationId: id(), documentId: document.id, request })
  const remove = (documentId: string, expectedVersion: number, subject = editor) =>
    deletePublisherDocument({ siteId: SITE, subject, correlationId: id(), documentId, expectedVersion })

  /** A bulletin published at `old`, then renamed and published at `renamed`: two versions and one redirect. */
  async function renamed(): Promise<PublisherDocument> {
    let document = await createPublisherDocument({ siteId: SITE, subject: editor, correlationId: id(), type: 'bulletin', content: bulletin('old') })
    document = await act(document, { action: 'publish', expectedVersion: 1 })
    document = await act(document, { action: 'save', expectedVersion: 1, content: bulletin('renamed', 'Renamed') })
    return act(document, { action: 'publish', expectedVersion: 2 })
  }

  async function count(table: string, column: string, value: string): Promise<number> {
    const { rows } = await harness.pool.query<{ n: number }>(`select count(*)::int as "n" from "publisher"."${table}" where "${column}" = $1`, [value])
    return rows[0]!.n
  }

  beforeAll(async () => {
    harness = await Harness.open()
  })

  afterAll(async () => {
    await harness?.close()
  })

  beforeEach(async () => {
    world = await harness.reset()
    for (const type of ['landing', 'appraisal', 'bulletin']) world.grantAll(alice, type)
    editor = person(alice, world.time)
  })

  it('reads a published document\'s current and former addresses, and nothing for any other', async () => {
    const document = await renamed()
    const addresses = await getPublisherAddresses({ siteId: SITE, documentId: document.id })
    expect(publisherAddressesSchema.parse(addresses)).toEqual({ current: '/bulletins/2026/10/21/renamed', former: ['/bulletins/2026/10/21/old'] })
    const draft = await createPublisherDocument({ siteId: SITE, subject: editor, correlationId: id(), type: 'bulletin', content: bulletin('draft') })
    for (const documentId of [draft.id, id(), 'not-an-id']) {
      expect(await getPublisherAddresses({ siteId: SITE, documentId })).toEqual({ current: null, former: [] })
    }
    expect(await getPublisherAddresses({ siteId: 'another-site', documentId: document.id })).toEqual({ current: null, former: [] })
  })

  it('deletes a document with every version, its links and its redirects, leaving one event', async () => {
    const target = await renamed()
    // Another document links to it; the link goes with it and renders as text.
    const linking = await createPublisherDocument({ siteId: SITE, subject: editor, correlationId: id(), type: 'landing', content: landing('linking', 'Linking', 'Welcome.', `See [the bulletin](doc:${target.id}).`) })
    expect(await listPublisherBacklinks({ siteId: SITE, subject: editor, documentId: target.id })).toHaveLength(1)

    expect(await remove(target.id, 2)).toEqual({ versions: 2 })

    expect(await count('document', 'id', target.id)).toBe(0)
    expect(await count('version', 'document_id', target.id)).toBe(0)
    expect(await count('redirect', 'document_id', target.id)).toBe(0)
    expect(await count('link', 'to_id', target.id)).toBe(0)
    expect(await count('document', 'id', linking.id)).toBe(1)
    expect(await getPublishedDocument({ siteId: SITE, path: '/bulletins/2026/10/21/renamed' })).toBeNull()
    expect(await resolvePublisherPath({ siteId: SITE, path: '/bulletins/2026/10/21/old' })).toEqual({ kind: 'none' })
    expect(await getPublisherAddresses({ siteId: SITE, documentId: target.id })).toEqual({ current: null, former: [] })
    expect((await harness.outbox()).at(-1)).toMatchObject({ type: 'publisher.document-deleted', data: { siteId: SITE, documentId: target.id, type: 'bulletin', versions: 2 } })
  })

  it('refuses without `delete`, on a stale version, and while a policy holds it, deleting nothing', async () => {
    const document = await renamed()
    const mallory = id()
    world.grant(mallory, 'publisher.bulletin.view-draft', 'publisher.bulletin.edit', 'publisher.bulletin.publish')
    await expect(remove(document.id, 2, person(mallory, world.time))).rejects.toMatchObject({ code: 'forbidden' })
    await expect(remove(document.id, 1)).rejects.toMatchObject({ code: 'conflict', reason: 'version-stale' })
    world.held.add(document.id)
    await expect(remove(document.id, 2)).rejects.toMatchObject({ code: 'conflict', reason: 'held' })
    await expect(remove(id(), 1)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(remove(document.id, 0)).rejects.toMatchObject({ code: 'validation-failed' })
    expect(await count('document', 'id', document.id)).toBe(1)
    expect(await count('version', 'document_id', document.id)).toBe(2)
    world.held.clear()
    expect(await remove(document.id, 2)).toEqual({ versions: 2 })
  })

  it('fails closed when a port fails: unavailable, and nothing deleted', async () => {
    const document = await renamed()
    world.failing = true
    await expect(remove(document.id, 2)).rejects.toMatchObject({ code: 'unavailable' })
    world.failing = false
    expect(await count('document', 'id', document.id)).toBe(1)
  })
})
