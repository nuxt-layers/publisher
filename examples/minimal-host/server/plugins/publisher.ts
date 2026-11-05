import pg from 'pg'
import { noticeType } from '../../content/notices'

// Composing Publisher in one call. A real host passes its IAM's resolveCaller
// and decide here; this one has nobody signed in and refuses every action.
export default defineNitroPlugin(async () => {
  const { tasks } = await composePublisher({
    pool: new pg.Pool({ connectionString: process.env.MINIMAL_HOST_DATABASE_URL }),
    schema: 'minimal_host',
    types: [noticeType],
    resolveCaller: () => null,
    resolveSite: () => 'main',
    decide: async () => ({ allowed: false }),
  })
  for (const task of tasks) setInterval(() => task.run().catch(() => {}), 60_000).unref()
})
