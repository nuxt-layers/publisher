import type {
  PublisherApprovalState,
  PublisherCaller,
  PublisherEvent,
  PublisherOptions,
} from '../shared/contracts'

/**
 * Fakes of every service Publisher expects (ADR-0012 §3), for a host's and
 * a consumer's tests: pass `fakes.options` to `composePublisher` with a
 * test database's pool and the host's types. Refused outside tests: a
 * production build, or any run that is neither Vitest nor `NODE_ENV=test`,
 * throws.
 */
export interface PublisherFakes {
  /** The services, ready for `composePublisher({ pool, types, ...fakes.options })`. */
  options: Required<Pick<PublisherOptions, 'resolveCaller' | 'resolveSite' | 'decide' | 'approval' | 'policy' | 'assets' | 'titleTemplate' | 'now' | 'publish'>>
  /** Who `resolveCaller` answers, or `null` for nobody signed in. */
  caller: PublisherCaller | null
  /** The site `resolveSite` answers. */
  site: string
  /** Grants a permission, such as `publisher.<type>.publish`, to a subject. */
  grant(subjectId: string, ...permissions: string[]): void
  /** Makes `decide` ask this subject to step up before this permission. */
  requireStepUp(subjectId: string, permission: string): void
  /** Documents the policy holds, such as under a legal hold. */
  held: Set<string>
  /** Approves or rejects the newest approval asked about a document. */
  approve(documentId: string): void
  reject(documentId: string): void
  /** Images the asset store knows: asset id → address. */
  assets: Map<string, string>
  /** Events the relay published, in order. */
  events: PublisherEvent[]
  /** The fake clock; `advance` moves it on. */
  time: Date
  advance(minutes: number): void
}

function refuseOutsideTests(): void {
  const env = typeof process === 'undefined' ? {} : process.env
  if (env.NODE_ENV === 'production' || (env.VITEST === undefined && env.NODE_ENV !== 'test')) {
    throw new Error('Publisher\'s fakes are for tests only.')
  }
}

export function createPublisherFakes(start = new Date('2026-01-01T09:00:00.000Z')): PublisherFakes {
  refuseOutsideTests()
  const grants = new Set<string>()
  const stepUp = new Set<string>()
  const approvals: { documentId: string, digest: string, state: PublisherApprovalState }[] = []
  let sequence = 0
  const newest = (documentId: string) => [...approvals].reverse().find(approval => approval.documentId === documentId)
  const fakes: PublisherFakes = {
    caller: null,
    site: 'test-site',
    held: new Set(),
    assets: new Map(),
    events: [],
    time: new Date(start),
    grant: (subjectId, ...permissions) => permissions.forEach(permission => grants.add(`${subjectId}|${permission}`)),
    requireStepUp: (subjectId, permission) => void stepUp.add(`${subjectId}|${permission}`),
    approve: (documentId) => { const approval = newest(documentId); if (approval) approval.state = 'approved' },
    reject: (documentId) => { const approval = newest(documentId); if (approval) approval.state = 'rejected' },
    advance: (minutes) => { fakes.time = new Date(fakes.time.getTime() + minutes * 60_000) },
    options: {
      resolveCaller: () => fakes.caller,
      resolveSite: () => fakes.site,
      decide: async (user, action) => {
        const key = `${user.identityId}|${action}`
        if (!grants.has(key)) return { allowed: false }
        return stepUp.has(key) ? { allowed: false, reason: 'step-up' } : { allowed: true }
      },
      approval: {
        request: async ({ documentId, digest }) => {
          approvals.push({ documentId, digest, state: 'pending' })
          return { approvalId: `approval-${++sequence}` }
        },
        decision: async ({ approvalId }) => {
          const approval = approvals[Number(approvalId.slice('approval-'.length)) - 1]
          if (!approval) throw new Error('unknown approval')
          return { state: approval.state, digest: approval.digest }
        },
      },
      policy: { isHeld: async ({ documentId }) => fakes.held.has(documentId) },
      assets: { resolve: async ({ assetIds }) => Object.fromEntries(assetIds.map(assetId => [assetId, fakes.assets.has(assetId) ? { url: fakes.assets.get(assetId)! } : null])) },
      titleTemplate: { format: ({ title }) => title },
      now: () => new Date(fakes.time),
      publish: async (events) => { fakes.events.push(...events) },
    },
  }
  return fakes
}
