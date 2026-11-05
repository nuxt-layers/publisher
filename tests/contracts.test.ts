import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { richTextSchema } from '@nuxt-layers/rich-text'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { toPosix } from './support/paths'
import * as contracts from '../shared/contracts'
import { EXAMPLE_DOCUMENT_TYPES } from '../examples'
import { appraisalType, bulletinType, landingType, TEST_TYPES } from './support/types'

const root = normalize(join(import.meta.dirname, '..'))

function files(dir: string, pattern = /\.(ts|vue)$/): string[] {
  let entries: string[]
  try {
    entries = readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
  }
  catch {
    return []
  }
  return entries.filter(file => pattern.test(file)).map(file => toPosix(join(dir, file)))
}

function imports(file: string): string[] {
  const source = readFileSync(join(root, file), 'utf8')
  return [...source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map(([, specifier]) =>
    specifier!.startsWith('.') ? toPosix(relative(root, join(root, dirname(file), specifier!))) : specifier!)
}

/** Source without comments, so a comment may explain what the code never names. */
function code(file: string): string {
  return readFileSync(join(root, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

const RICH_TEXT = '@nuxt-layers/rich-text'
const contractFiles = files('shared', /\.ts$/)
/** The layer's own source: everything a host receives except the examples. */
const layerFiles = [...files('app'), ...files('server'), ...files('shared'), 'nuxt.config.ts']

/**
 * Contract version 2 (docs/contracts.md §17). Removing or narrowing any of
 * these is a breaking change: stated in the changelog, with the contract version raised.
 */
const CONTRACT_EXPORTS = [
  'ASSET_ID_PATTERN', 'FIELD_NAME_PATTERN',
  'PUBLISHER_ACTIONS', 'PUBLISHER_BUNDLE_FORMAT', 'PUBLISHER_CONFLICT_REASONS', 'PUBLISHER_CONTENT_PROBLEMS', 'PUBLISHER_CONTRACT_VERSION',
  'PUBLISHER_ERROR_CODES', 'PUBLISHER_ERROR_STATUS', 'PUBLISHER_FEED_FORMATS', 'PUBLISHER_MAX_RICH_TEXT_FIELDS', 
  'PUBLISHER_ORDERS', 'PUBLISHER_PERMISSION_ACTIONS', 'PUBLISHER_RETENTION', 
  'PUBLISHER_SCHEDULED_TRANSITIONS', 'PUBLISHER_STATUSES', 'PUBLISHER_TRANSITIONS', 'PublisherCompositionError', 'PublisherFailure', 'REASON_CODE_PATTERN',
  'SITE_ID_PATTERN', 'SLUG_PATTERN', 'TYPE_KEY_PATTERN', 'UUID_PATTERN', 'UUID_V7_PATTERN', 'addressDateSchema',
  'addressRuleSchema', 'assetIdSchema', 'buildPublisherRegistry', 'canonicalJson', 'codeSchema', 'correlationIdSchema',
  'definePublisherDocumentType', 'digestSchema', 'httpsUrlSchema', 'identifierSchema', 'instantSchema', 'localeSchema',
  'publisherActionRequestSchema', 'publisherBacklinkSchema', 'publisherBundleDocumentSchema', 'publisherBundleSchema',
  'publisherConsentSchema', 'publisherContentSchema', 'publisherDocumentSchema', 'publisherDraftSchema', 'publisherEventSchema', 'publisherHeadSchema',
  'publisherListingQuerySchema', 'publisherListingSchema', 'publisherPermission', 'publisherPermissions', 'publisherPersonExportSchema', 'publisherRenderedSchema',
  'publisherResolutionSchema', 'publisherResolvedLinksSchema', 'publisherSitemapEntrySchema', 'publisherTypeDeclarationSchema', 'publisherVersionSchema', 'reasonCodeSchema',
  'safeTextSchema', 'siteIdSchema', 'sitePathSchema', 'slugSchema', 'subjectSchema', 'typeKeySchema',
]

describe('the public contract', () => {
  it('is contract version 2, and exports everything version 2 does', () => {
    expect(contracts.PUBLISHER_CONTRACT_VERSION).toBe(2)
    expect(Object.keys(contracts)).toEqual(expect.arrayContaining(CONTRACT_EXPORTS))
  })

  it('imports nothing but zod, the shared rich-text format and its own modules', () => {
    for (const file of contractFiles) {
      for (const target of imports(file)) {
        expect(target === 'zod' || target === RICH_TEXT || /^shared\//.test(target), `${file} imports ${target}`).toBe(true)
      }
    }
  })

  it('never imports another layer, only the stateless rich-text library (ADR-0011), and the examples only the contract', () => {
    for (const file of [...layerFiles, ...files('examples')]) {
      for (const target of imports(file)) expect(/^@nuxt-layers\//.test(target) && target !== RICH_TEXT, `${file} imports ${target}`).toBe(false)
    }
    for (const file of files('examples')) {
      for (const target of imports(file)) expect(target === 'zod' || target === RICH_TEXT || target === 'shared/contracts', `${file} imports ${target}`).toBe(true)
    }
  })

  it('names no document type anywhere in the layer\'s own source, outside comments and the examples', () => {
    // `in-review` is a status, `.post.ts` a file name and `POST` an HTTP method: none names a type.
    const named = /(?<![\w-])(?:[Pp]age|[Pp]ost|[Rr]eview|[Mm]enu|[Bb]log)s?(?![\w-])/
    const offending = layerFiles.flatMap(file => code(file).split('\n').filter(line => named.test(line)).map(line => `${file}: ${line.trim()}`))
    expect(offending).toEqual([])
  })

  it('leaves nothing pending: every function the contract specifies is implemented', () => {
    const offending = [...layerFiles, ...files('examples')].filter(file => file !== 'shared/pending.ts' && /\bpending\(/.test(code(file)))
    expect(offending).toEqual([])
  })

  it('carries identifiers, codes and times only in events: never a title, field or address', () => {
    const envelope = { eventId: '01928c4e-0000-7000-8000-000000000001', occurredAt: '2026-10-21T12:00:00.000Z', correlationId: '01928c4e-0000-7000-8000-0000000000aa', actorId: null }
    const data = { siteId: 'alpha', documentId: '01928c4e-0000-7000-8000-000000000002', type: 'anything', version: 3, unpublishAt: null }
    expect(contracts.publisherEventSchema.safeParse({ ...envelope, type: 'publisher.document-published', data }).success).toBe(true)
    expect(contracts.publisherEventSchema.safeParse({ ...envelope, type: 'publisher.document-published', data: { ...data, title: 'Hello' } }).success).toBe(false)
    expect(contracts.publisherEventSchema.safeParse({ ...envelope, type: 'publisher.document-published', data: { ...data, path: '/hello' } }).success).toBe(false)
    expect(contracts.publisherEventSchema.safeParse({ ...envelope, type: 'publisher.address-changed', data: { siteId: 'alpha', documentId: data.documentId, type: 'x', redirectRecorded: true, from: '/old' } }).success).toBe(false)
  })

  it('decides nothing about risk, step-up or approvers: Authorisation and the approvals process do', () => {
    for (const name of ['APPROVAL_FLOOR', 'CRITICAL_FRESHNESS_MINUTES', 'PUBLISHER_RISKS', 'PUBLISHER_RISK_FLOOR', 'PUBLISHER_PERSONAL_DATA_RISK_FLOOR', 'meetsStepUp', 'riskRank']) {
      expect(Object.keys(contracts), name).not.toContain(name)
    }
    expect(contracts.publisherTypeDeclarationSchema.safeParse({ ...bulletinType, lifecycle: { ...bulletinType.lifecycle, risks: { publish: 'high' } } }).success).toBe(false)
  })

  it('serves every action from one state machine, each guarded by one of the four permissions', () => {
    for (const action of contracts.PUBLISHER_ACTIONS) {
      const transition = contracts.PUBLISHER_TRANSITIONS[action]
      expect(contracts.PUBLISHER_PERMISSION_ACTIONS).toContain(transition.permission)
      for (const [from, to] of Object.entries(transition.from)) {
        expect(contracts.PUBLISHER_STATUSES).toContain(from)
        for (const status of to!) expect(contracts.PUBLISHER_STATUSES).toContain(status)
      }
    }
    // Nothing leaves `archived` but reopening, and nothing reaches `published` without `publish`.
    const fromArchived = contracts.PUBLISHER_ACTIONS.filter(action => 'archived' in contracts.PUBLISHER_TRANSITIONS[action].from)
    expect(fromArchived).toEqual(['reopen'])
    for (const action of contracts.PUBLISHER_ACTIONS) {
      const { permission, from } = contracts.PUBLISHER_TRANSITIONS[action]
      const reachesPublished = Object.entries(from).some(([status, to]) => status !== 'published' && to!.includes('published'))
      if (reachesPublished) expect(permission).toBe('publish')
    }
  })

  it('takes slugs, addresses and text strictly', () => {
    expect(contracts.siteIdSchema.safeParse('01928c4e-0000-7000-8000-000000000002').success).toBe(true)
    expect(contracts.siteIdSchema.safeParse('main').success).toBe(true)
    for (const site of ['', 'Main', '-main', 'main-', 'a b', 'x'.repeat(65)]) expect(contracts.siteIdSchema.safeParse(site).success, site).toBe(false)
    expect(contracts.slugSchema.safeParse('about/our-team').success).toBe(true)
    expect(contracts.slugSchema.safeParse('').success).toBe(true)
    for (const slug of ['About', '/about', 'about/', 'a//b', 'a b', '../x', 'a--b']) expect(contracts.slugSchema.safeParse(slug).success, slug).toBe(false)
    expect(contracts.safeTextSchema({ max: 10 }).parse('  A   b ')).toBe('A b')
    expect(contracts.safeTextSchema({ max: 10 }).safeParse('a‮b').success).toBe(false)
    expect(contracts.canonicalJson({ b: 1, a: [{ d: 2, c: null }] })).toBe(contracts.canonicalJson({ a: [{ c: null, d: 2 }], b: 1 }))
  })
})

describe('registration', () => {
  const registry = () => contracts.buildPublisherRegistry(TEST_TYPES)

  it('registers types the layer has never heard of, filling in the defaults', () => {
    const built = registry()
    expect([...built.keys()].sort()).toEqual(['appraisal', 'bulletin', 'landing'])
    expect(built.get('landing')!.jsonSchema).toMatchObject({ type: 'object', additionalProperties: false })
  })

  it('finds each type\'s formatted fields and profiles from its schema; every other string is plain', () => {
    const built = registry()
    expect(built.get('landing')!.richTextFields).toEqual([
      { path: 'intro', profile: 'block', max: 10_000 },
      { path: 'blocks[].body', profile: 'document', max: 10_000 },
    ])
    expect(built.get('appraisal')!.richTextFields).toEqual([{ path: 'words', profile: 'block', max: 2000 }])
  })

  it('registers nothing by default: the examples are valid declarations, and examples only', () => {
    expect(contracts.buildPublisherRegistry([]).size).toBe(0)
    expect(contracts.buildPublisherRegistry(EXAMPLE_DOCUMENT_TYPES).size).toBe(EXAMPLE_DOCUMENT_TYPES.length)
  })

  it('derives three permissions per type; Authorisation\'s catalogue sets their risk', () => {
    expect(contracts.publisherPermission('landing', 'view-draft')).toBe('publisher.landing.view-draft')
    expect(contracts.publisherPermissions(registry())).toEqual(expect.arrayContaining([
      { permission: 'publisher.landing.publish', type: 'landing', action: 'publish' },
      { permission: 'publisher.appraisal.view-draft', type: 'appraisal', action: 'view-draft' },
      { permission: 'publisher.bulletin.edit', type: 'bulletin', action: 'edit' },
    ]))
    expect(contracts.publisherPermissions(registry())).toHaveLength(9)
  })

  it('fails closed on a duplicate type', () => {
    expect(() => contracts.buildPublisherRegistry([landingType, { ...bulletinType, type: 'landing' }])).toThrow(/twice/)
  })

  it('fails closed on a declaration invalid against the meta-schema', () => {
    const invalid: unknown[] = [
      { ...bulletinType, type: 'Bulletin' },
      { ...bulletinType, extra: true },
      { ...bulletinType, label: undefined },
      { ...bulletinType, address: { kind: 'path', base: 'bulletins', pattern: 'slug' } },
      { ...bulletinType, address: { kind: 'path', base: '/bulletins/', pattern: 'slug' } },
      // Fields must be a strict object, every string and array bounded.
      { ...bulletinType, fields: z.object({ body: z.string().max(10) }) },
      { ...bulletinType, fields: z.strictObject({ body: z.string() }) },
      { ...bulletinType, fields: z.strictObject({ body: z.string().max(10), list: z.array(z.string().max(5)) }) },
      { ...bulletinType, fields: z.string() },
      // Formatted fields are found from the schema, never named; and bounded in number.
      { ...bulletinType, markdownFields: ['body'] },
      { ...bulletinType, fields: z.strictObject(Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`text${index}`, richTextSchema({ profile: 'inline', max: 100 })]))) },
      // Named fields must exist, with the right shape.
      { ...bulletinType, listing: { listable: true, order: 'published-desc', filterable: ['body2'] } },
      { ...appraisalType, personalData: { subjectField: 'nobody', consentField: 'consent', retentionDays: 90 } },
      { ...appraisalType, personalData: { subjectField: 'authorId', consentField: 'stars', retentionDays: 90 } },
      { ...appraisalType, personalData: { subjectField: 'authorId', consentField: 'consent', retentionDays: 10 } },
      // Moderation is not Publisher's: a lifecycle declares only approval and scheduling.
      { ...appraisalType, lifecycle: { approval: false, moderation: true, scheduling: false } },
    ]
    for (const declaration of invalid) {
      expect(() => contracts.buildPublisherRegistry([declaration as contracts.PublisherTypeDeclarationInput]), JSON.stringify(declaration)).toThrow()
    }
  })
})
