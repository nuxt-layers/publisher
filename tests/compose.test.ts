import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { composePublisher } from '../server/utils/publisher-composition'
import { createPublisherDocument, getPublishedDocument, transitionPublisherDocument } from '../server/utils/publisher-server'
import { clearPublisherComposition } from '../server/internal/composition'
import { createPublisherFakes } from '../testing'
import { hasDatabase, requireDatabaseInCi } from './support/database'
import { Harness } from './support/publisher'
import { bulletin, TEST_TYPES } from './support/types'
import { id, person } from './support/world'

requireDatabaseInCi()

describe('composePublisher: the one call (ADR-0012)', () => {
  afterEach(() => clearPublisherComposition())

  it('refuses options without resolveCaller or decide', async () => {
    const fakes = createPublisherFakes()
    await expect(composePublisher({ ...fakes.options, pool: {} as never, types: TEST_TYPES, resolveCaller: undefined as never })).rejects.toThrow(/resolveCaller/)
    await expect(composePublisher({ ...fakes.options, pool: {} as never, types: TEST_TYPES, decide: undefined as never })).rejects.toThrow(/decide/)
  })

  it('ships fakes that are refused outside tests', () => {
    const saved = { NODE_ENV: process.env.NODE_ENV, VITEST: process.env.VITEST }
    try {
      process.env.NODE_ENV = 'production'
      expect(() => createPublisherFakes()).toThrow(/tests only/)
      process.env.NODE_ENV = 'development'
      delete process.env.VITEST
      expect(() => createPublisherFakes()).toThrow(/tests only/)
    }
    finally {
      process.env.NODE_ENV = saved.NODE_ENV
      if (saved.VITEST !== undefined) process.env.VITEST = saved.VITEST
    }
    expect(() => createPublisherFakes()).not.toThrow()
  })
})

describe.skipIf(!hasDatabase)('composePublisher with a database (PostgreSQL)', () => {
  let harness: Harness

  beforeAll(async () => {
    harness = await Harness.open()
    await harness.reset()
  })

  afterAll(async () => {
    clearPublisherComposition()
    await harness?.close()
  })

  it('migrates, checks, and answers the tasks; documents then work end to end with the fakes', async () => {
    const fakes = createPublisherFakes()
    const { tasks } = await composePublisher({ pool: harness.pool, types: TEST_TYPES, ...fakes.options })
    expect(tasks.map(task => [task.name, task.every])).toEqual([['publisher-maintenance', '1m'], ['publisher-relay', '1m']])

    const alice = id()
    fakes.grant(alice, 'publisher.bulletin.edit', 'publisher.bulletin.publish')
    const editor = person(alice, fakes.time)
    const site = fakes.site
    const draft = await createPublisherDocument({ siteId: site, subject: editor, correlationId: id(), type: 'bulletin', content: bulletin('composed') })
    expect(draft.createdAt).toBe(fakes.time.toISOString())
    await transitionPublisherDocument({ siteId: site, subject: editor, correlationId: id(), documentId: draft.id, request: { action: 'publish', expectedVersion: 1 } })
    expect(await getPublishedDocument({ siteId: site, documentId: draft.id })).not.toBeNull()

    for (const task of tasks) await task.run()
    expect(fakes.events.map(event => event.type)).toEqual(['publisher.document-created', 'publisher.document-published'])
  })

  it('answers only the maintenance task without publish, and takes the time as an ISO 8601 UTC string', async () => {
    const fakes = createPublisherFakes()
    const { tasks } = await composePublisher({ pool: harness.pool, types: TEST_TYPES, ...fakes.options, publish: undefined, now: () => '2026-03-04T05:06:07.000Z' })
    expect(tasks.map(task => task.name)).toEqual(['publisher-maintenance'])
    const alice = id()
    fakes.grant(alice, 'publisher.bulletin.edit')
    const draft = await createPublisherDocument({ siteId: fakes.site, subject: person(alice, fakes.time), correlationId: id(), type: 'bulletin', content: bulletin('stringly') })
    expect(draft.createdAt).toBe('2026-03-04T05:06:07.000Z')
  })
})
