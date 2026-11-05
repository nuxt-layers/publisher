import { runPublisherMigrations } from '../database/migrations'
import {
  usePublisherAccessDecision,
  usePublisherApproval,
  usePublisherDatabase,
  usePublisherRegistry,
} from './composition'
import { guarded, withClient } from './store'
import { PublisherCompositionError } from '../../shared/contracts'

/** PRIVATE. Start-up: migrations and the composition check, run by `composePublisher`. */

/** Applies append-only migrations through the migration pool. */
export async function migratePublisherDatabase(): Promise<string[]> {
  const database = usePublisherDatabase()
  return guarded(() => runPublisherMigrations(database.migrationPool ?? database.pool, database.schema, database.runtimeRole))
}

/**
 * Checks the composition at start-up: every required port supplied, and no
 * stored document of a type the host has not registered. Throws
 * `PublisherCompositionError`; a host calls it after migrating.
 */
export async function checkPublisherComposition(): Promise<void> {
  usePublisherDatabase()
  usePublisherAccessDecision()
  if ([...usePublisherRegistry().values()].some(declaration => declaration.lifecycle.approval)) usePublisherApproval()
  await withClient(async () => {})
  if (usePublisherRegistry().size === 0) throw new PublisherCompositionError('PublisherDocumentTypes', 'No document type is registered.')
}
