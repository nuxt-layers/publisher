import pg from 'pg'
import { TEST_TYPES } from '../../../tests/support/types'
import { SITE } from '../../../tests/support/world'

/**
 * The playground's composition, as a host's one server plugin would be
 * (ADR-0012): a single `composePublisher` call. It registers the tests' own
 * document types (the layer has none); nobody is signed in and every action
 * is refused. Without `PLAYGROUND_DATABASE_URL` it composes nothing: it then
 * proves only that the layer builds, headless, in a host.
 */
export default defineNitroPlugin(async () => {
  const url = process.env.PLAYGROUND_DATABASE_URL
  if (!url) return
  await composePublisher({
    pool: new pg.Pool({ connectionString: url }),
    types: TEST_TYPES,
    resolveCaller: () => null,
    // One site: a host serving several would answer each address's site here (later `site-hosting`).
    resolveSite: () => SITE,
    decide: async () => ({ allowed: false }),
    titleTemplate: { format: ({ title }) => `${title} · Publisher playground` },
  })
})
