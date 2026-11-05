import type { PublisherOptions, PublisherSubject, PublisherTask } from '../../shared/contracts'
import { instantSchema, PublisherFailure } from '../../shared/contracts'
import {
  clearPublisherComposition,
  providePublisherAccessDecision,
  providePublisherApproval,
  providePublisherAssetResolver,
  providePublisherClock,
  providePublisherDatabase,
  providePublisherDocumentTypes,
  providePublisherEventSink,
  providePublisherPolicy,
  providePublisherSiteResolver,
  providePublisherSubjectResolver,
  providePublisherTitleTemplate,
} from '../internal/composition'
import { checkPublisherComposition, migratePublisherDatabase } from '../internal/startup'
import { relayPublisherOutbox, runPublisherMaintenance } from './publisher-server'

/** A clock's answer as a `Date`: a `Date`, or an ISO 8601 UTC string. Anything else is a failing clock. */
function instant(value: Date | string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' && instantSchema.safeParse(value).success) return new Date(value)
  throw new PublisherFailure('unavailable', 'clock-failed')
}

/**
 * Composes Publisher in one call (ADR-0012): the host's one server plugin
 * passes what it owns, and everything else has a default. Runs Publisher's
 * migrations, checks the composition (failing closed), and answers the
 * scheduled tasks for the host's scheduler: maintenance every minute, and the
 * event relay every minute when `publish` is given.
 */
export async function composePublisher(options: PublisherOptions): Promise<{ tasks: PublisherTask[] }> {
  if (typeof options !== 'object' || options === null) throw new TypeError('composePublisher expects its options.')
  if (typeof options.resolveCaller !== 'function') throw new TypeError('composePublisher expects resolveCaller(event).')
  if (typeof options.decide !== 'function') throw new TypeError('composePublisher expects decide(user, action, resource).')
  clearPublisherComposition()
  providePublisherDatabase({ dialect: 'postgres', pool: options.pool, migrationPool: options.migrationPool, schema: options.schema, runtimeRole: options.runtimeRole })
  providePublisherDocumentTypes(options.types)
  const resolveCaller = options.resolveCaller
  providePublisherSubjectResolver({
    resolve: async (event): Promise<PublisherSubject | null> => {
      const caller = await resolveCaller(event)
      if (!caller || typeof caller.subjectId !== 'string') return null
      return { ...caller, identityId: caller.subjectId }
    },
  })
  const resolveSite = options.resolveSite
  if (resolveSite) providePublisherSiteResolver({ resolve: async event => resolveSite(event) })
  const decide = options.decide
  providePublisherAccessDecision({ decide: (user, action, resource) => decide(user, action, resource) })
  if (options.approval) providePublisherApproval(options.approval)
  if (options.policy) providePublisherPolicy(options.policy)
  if (options.assets) providePublisherAssetResolver(options.assets)
  if (options.titleTemplate) providePublisherTitleTemplate(options.titleTemplate)
  const now = options.now
  if (now) providePublisherClock({ now: () => instant(now()) })
  if (options.publish) providePublisherEventSink({ publish: options.publish })
  await migratePublisherDatabase()
  await checkPublisherComposition()
  const tasks: PublisherTask[] = [{ name: 'publisher-maintenance', every: '1m', run: () => runPublisherMaintenance() }]
  if (options.publish) tasks.push({ name: 'publisher-relay', every: '1m', run: () => relayPublisherOutbox() })
  return { tasks }
}
