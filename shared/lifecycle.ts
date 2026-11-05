import { z } from 'zod'
import type { PublisherStatus } from './documents'
import { publisherContentSchema } from './documents'
import { identifierSchema, instantSchema } from './identifiers'
import type { PublisherPermissionAction } from './types'

/**
 * The lifecycle (docs/contracts.md §5): one state machine for every type.
 * The table is the contract; the server applies it and nothing else.
 */

export const PUBLISHER_ACTIONS = ['save', 'submit', 'withdraw', 'publish', 'unpublish', 'archive', 'reopen', 'restore', 'moderate'] as const
export type PublisherAction = typeof PUBLISHER_ACTIONS[number]

export interface PublisherTransition {
  /** The permission the action needs on the document's type. */
  readonly permission: PublisherPermissionAction
  /** From each status the action may start in, the statuses it may end in. */
  readonly from: Readonly<Partial<Record<PublisherStatus, readonly PublisherStatus[]>>>
}

export const PUBLISHER_TRANSITIONS: Readonly<Record<PublisherAction, PublisherTransition>> = {
  // A new version. Saving takes a document out of review or its schedule;
  // a published document stays published at its published version.
  'save': { permission: 'edit', from: { 'draft': ['draft'], 'in-review': ['draft'], 'scheduled': ['draft'], 'published': ['published'] } },
  // Types with `review`: asks the approval port about the newest version.
  'submit': { permission: 'edit', from: { 'draft': ['in-review'], 'published': ['published'] } },
  'withdraw': { permission: 'edit', from: { 'in-review': ['draft'], 'scheduled': ['draft'] } },
  // `scheduled` when `publishAt` is in the future.
  'publish': { permission: 'publish', from: { 'draft': ['published', 'scheduled'], 'in-review': ['published', 'scheduled'], 'published': ['published'] } },
  'unpublish': { permission: 'publish', from: { published: ['draft'] } },
  'archive': { permission: 'publish', from: { 'draft': ['archived'], 'in-review': ['archived'], 'scheduled': ['archived'], 'published': ['archived'] } },
  'reopen': { permission: 'edit', from: { archived: ['draft'] } },
  // A new version with an earlier version's content; otherwise as `save`.
  'restore': { permission: 'edit', from: { 'draft': ['draft'], 'in-review': ['draft'], 'scheduled': ['draft'], 'published': ['published'] } },
  // Types with `moderation`, on a pending submission: accept publishes, reject archives.
  'moderate': { permission: 'moderate', from: { 'in-review': ['published', 'archived'] } },
}

/** What `runPublisherMaintenance` does when the clock passes a document's times (§5.4). No permission: the schedule was approved when set. */
export const PUBLISHER_SCHEDULED_TRANSITIONS = [
  { at: 'publishAt', from: 'scheduled', to: 'published' },
  { at: 'unpublishAt', from: 'published', to: 'archived' },
] as const satisfies readonly { at: 'publishAt' | 'unpublishAt', from: PublisherStatus, to: PublisherStatus }[]

const expectedVersion = z.number().int().min(1)

/** An action on a document, as the administration endpoint and `transitionPublisherDocument` take it. */
export const publisherActionRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('save'), expectedVersion, content: publisherContentSchema }),
  z.strictObject({ action: z.literal('submit'), expectedVersion }),
  z.strictObject({ action: z.literal('withdraw'), expectedVersion }),
  z.strictObject({ action: z.literal('publish'), expectedVersion, publishAt: instantSchema.nullable().default(null), unpublishAt: instantSchema.nullable().default(null) }),
  // The number of linking documents the editor was shown (§7.3).
  z.strictObject({ action: z.literal('unpublish'), expectedVersion, acknowledgedLinks: z.number().int().min(0) }),
  z.strictObject({ action: z.literal('archive'), expectedVersion, acknowledgedLinks: z.number().int().min(0) }),
  z.strictObject({ action: z.literal('reopen'), expectedVersion }),
  z.strictObject({ action: z.literal('restore'), expectedVersion, version: z.number().int().min(1) }),
  z.strictObject({ action: z.literal('moderate'), expectedVersion, outcome: z.enum(['accept', 'reject']) }),
])
export type PublisherActionRequest = z.output<typeof publisherActionRequestSchema>
export type PublisherActionRequestInput = z.input<typeof publisherActionRequestSchema>

/**
 * The user, from the host's resolver only. Publisher reads only the
 * identifier, to record who acted; everything else the resolver gives (such
 * as how they signed in) is passed to the access decision untouched.
 */
export interface PublisherSubject {
  identityId: string
  readonly [key: string]: unknown
}

export const subjectSchema = z.looseObject({
  identityId: identifierSchema,
})
