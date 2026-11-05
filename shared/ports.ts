import type { PublisherEvent } from './events'
import type { PublisherSubject } from './lifecycle'

/**
 * Ports the host supplies (docs/contracts.md §11), in the publisher's own
 * vocabulary. Every port rejects on failure; the publisher then fails
 * closed as `unavailable`, never on a null, partial or stale answer.
 */

export interface PostgresPoolLike {
  query(text: string, values?: readonly unknown[]): Promise<unknown>
  connect(): Promise<unknown>
}

/** Persistence (ADR-0002, ADR-0006). `pool` connects as the runtime role. */
export interface PublisherDatabase {
  dialect: 'postgres'
  pool: PostgresPoolLike
  /** Schema owned by this capability. Defaults to `publisher`. */
  schema?: string
  migrationPool?: PostgresPoolLike
  /** The runtime role to grant, when migrations run as another role. */
  runtimeRole?: string
}

/** What an access decision is about: a document, or a whole type on a site when `documentId` is `null` (listing, creating). */
export interface PublisherResource {
  siteId: string
  type: string
  documentId: string | null
}

/**
 * Authorisation, through the host (ADR-0012's `decide`): whether the user may
 * take the action, a permission such as `publisher.<type>.publish`, on the
 * resource now. Risk, step-up and which group decides are Authorisation's.
 * `reason: 'step-up'` asks the user to sign in again first; any other refusal
 * is `forbidden`.
 */
export interface PublisherAccessDecision {
  decide(subject: PublisherSubject, action: string, resource: PublisherResource): Promise<{ allowed: boolean, reason?: string }>
}

export type PublisherApprovalState = 'pending' | 'approved' | 'rejected' | 'expired'

/**
 * The approvals process, through the host (later `workflow`). Its rules (who
 * approves, how many, never the requester) are its own; the publisher asks
 * once per version and publishes only on approval of that version's digest.
 */
export interface PublisherApproval {
  request(input: {
    siteId: string
    documentId: string
    type: string
    version: number
    digest: string
    permission: string
    requesterId: string
    correlationId: string
  }): Promise<{ approvalId: string }>
  decision(input: { approvalId: string }): Promise<{ state: PublisherApprovalState, digest: string }>
}

/**
 * Optional (later `policy-map`): whether a policy, such as a legal hold,
 * forbids deleting a document now. Anything but `false` refuses the delete.
 * Without it, nothing is held.
 */
export interface PublisherPolicy {
  isHeld(input: { siteId: string, documentId: string, type: string }): Promise<boolean>
}

/** Who is signed in, for an HTTP request (an h3 event, typed loosely). `null` when nobody is. */
export interface PublisherSubjectResolver {
  resolve(event: unknown): Promise<PublisherSubject | null>
}

/**
 * Which site an HTTP request is for (an h3 event, typed loosely), such as
 * the tenant Configuration finds for the request's host name; `null` when
 * the request is for no site. A host with one site answers a constant.
 */
export interface PublisherSiteResolver {
  resolve(event: unknown): Promise<string | null>
}

export interface PublisherClock {
  now(): Date
}

/** Where relayed events go, at least once and in order. */
export interface PublisherEventSink {
  publish(events: readonly PublisherEvent[]): Promise<void>
}

/** The host's asset store: each asset's address, or `null` when unknown. */
export interface PublisherAssetResolver {
  resolve(input: { siteId: string, assetIds: readonly string[] }): Promise<Readonly<Record<string, { url: string, width?: number, height?: number } | null>>>
}

/** The host's title template, e.g. Configuration's `seo.title-template`. */
export interface PublisherTitleTemplate {
  format(input: { siteId: string, title: string, type: string, locale: string }): string | Promise<string>
}
