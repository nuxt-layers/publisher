import type {
  PublisherAccessDecision,
  PublisherApproval,
  PublisherApprovalState,
  PublisherAssetResolver,
  PublisherClock,
  PublisherEvent,
  PublisherEventSink,
  PublisherSubject,
  PublisherTitleTemplate,
} from '../../shared/contracts'

/**
 * Stand-ins for the host's ports, held in memory, so the tests decide who
 * holds which permission, what the approvals process answers, what time it
 * is and which assets exist.
 */

/** The site the tests publish on, unless a test names another. */
export const SITE = 'alpha'

let counter = 0x100

/** A fresh UUIDv7 for tests. */
export function id(): string {
  counter++
  return `01928c4e-0000-7000-8000-${counter.toString(16).padStart(12, '0')}`
}

interface ApprovalRecord {
  input: Parameters<PublisherApproval['request']>[0]
  state: PublisherApprovalState
}

export class World {
  /** `identityId|permission` on every site, or `siteId|identityId|permission` on one. */
  readonly grants = new Set<string>()
  /** `identityId|permission` for which Authorisation asks the user to step up first. */
  readonly stepUp = new Set<string>()
  /** The site of every question the access-decision port was asked. */
  readonly askedSites: string[] = []
  readonly approvals = new Map<string, ApprovalRecord>()
  readonly published: PublisherEvent[] = []
  readonly assets = new Map<string, string>()
  failing = false
  sinkFailing = false
  time = new Date('2026-10-21T09:00:00.000Z')

  private check(): void {
    if (this.failing) throw new Error('port down')
  }

  grant(identityId: string, ...permissions: string[]): void {
    for (const permission of permissions) this.grants.add(`${identityId}|${permission}`)
  }

  /** Every permission on a type: `view-draft`, `edit`, `publish`. */
  grantAll(identityId: string, type: string): void {
    this.grant(identityId, ...['view-draft', 'edit', 'publish'].map(action => `publisher.${type}.${action}`))
  }

  /** A permission on one site only. */
  grantOn(siteId: string, identityId: string, ...permissions: string[]): void {
    for (const permission of permissions) this.grants.add(`${siteId}|${identityId}|${permission}`)
  }

  revoke(identityId: string, permission: string): void {
    this.grants.delete(`${identityId}|${permission}`)
  }

  advance(minutes: number): void {
    this.time = new Date(this.time.getTime() + minutes * 60_000)
  }

  /** The approvals process approves, by its own rules. */
  approve(approvalId: string): void {
    this.approvals.get(approvalId)!.state = 'approved'
  }

  reject(approvalId: string): void {
    this.approvals.get(approvalId)!.state = 'rejected'
  }

  /** The newest approval asked for this document. */
  approvalFor(documentId: string): string | undefined {
    return [...this.approvals.entries()].reverse().find(([, record]) => record.input.documentId === documentId)?.[0]
  }

  readonly access: PublisherAccessDecision = {
    decide: async ({ identityId }, action, { siteId }) => {
      this.check()
      this.askedSites.push(siteId)
      const held = this.grants.has(`${identityId}|${action}`) || this.grants.has(`${siteId}|${identityId}|${action}`)
      if (held && this.stepUp.has(`${identityId}|${action}`)) return { allowed: false, reason: 'step-up' }
      return { allowed: held }
    },
  }

  readonly approval: PublisherApproval = {
    request: async (input) => {
      this.check()
      const approvalId = id()
      this.approvals.set(approvalId, { input, state: 'pending' })
      return { approvalId }
    },
    decision: async ({ approvalId }) => {
      this.check()
      const record = this.approvals.get(approvalId)
      if (!record) throw new Error('unknown approval')
      return { state: record.state, digest: record.input.digest }
    },
  }

  readonly clock: PublisherClock = { now: () => new Date(this.time) }

  readonly sink: PublisherEventSink = {
    publish: async (events) => {
      if (this.sinkFailing) throw new Error('sink down')
      this.published.push(...events)
    },
  }

  readonly assetResolver: PublisherAssetResolver = {
    resolve: async ({ assetIds }) => {
      this.check()
      return Object.fromEntries(assetIds.map(assetId => [assetId, this.assets.has(assetId) ? { url: this.assets.get(assetId)! } : null]))
    },
  }

  readonly titleTemplate: PublisherTitleTemplate = { format: ({ title }) => `${title} · Test site` }
}

/** A signed-in user, with whatever else a resolver might add, which Publisher passes on untouched. */
export function person(identityId: string, at: Date): PublisherSubject {
  return {
    identityId,
    assurance: { level: 'aal2', phishingResistant: true, authenticatedAt: at.toISOString() },
  }
}
