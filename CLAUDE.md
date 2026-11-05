# @nuxt-layers/publisher — notes for Claude

## What this is
Nuxt 4 foundation layer for publishing documents of types the host registers: drafts, versions and history; approval and moderation; scheduling; addresses, redirects and links; safe rich text; listings and feeds. Governed by `nuxt-layers/architecture-rules` (see `RESOURCES.md`); persistence follows ADR-0002 and ADR-0006. Not a member of the IAM suite. British spelling everywhere, including code and the manifest.

## Commands
- `pnpm install`, then `pnpm dev:prepare` for Nuxt types. Never add a `prepare`/`postinstall` script
- `pnpm check` = `nuxt typecheck` + `vitest run`; run it after every code change. Single file: `pnpm vitest run tests/<name>.test.ts`
- Database suites need `PUBLISHER_TEST_DATABASE_URL` (admin URL of a local, disposable PostgreSQL 16); they skip locally without it and fail in CI
- `pnpm build:playground` proves the layer composes in a host
- `@nuxt-layers/rich-text` follows `master` as `github:nuxt-layers/rich-text#master` (ADR-0008); the lockfile must record the `codeload.github.com` tarball, never `git@github.com`
- Never edit a released migration in `server/database/migrations.ts`; add a new one
- `python3 scripts/check_markdown.py` checks headings, local links, that external links appear only in `RESOURCES.md` (pinned to a tag or commit) and that `CHANGELOG.md` has none. Run it after every documentation change.

## Rules
- **The layer never names a document type.** Every type is the host's registration (`providePublisherDocumentTypes`); adding one is never a change to the layer. No `page`, `post`, `review`, `menu` or `blog` (or any other type) in `app/`, `server/` or `shared/`, outside comments; `tests/contracts.test.ts` searches for them. Reference types live only in `examples/`, never registered; tests and the playground use the types in `tests/support/types.ts`.
- Every document belongs to a site (docs/contracts.md §3.4): every scoped query, port call and event names it; endpoints take it only from the host's site resolver. Nothing crosses sites.
- **Headless (ADR-0009).** The layer draws nothing: no pages, routes, components, slots, styles or display wording; `app/` holds only the typed client, `usePublisher()`. `tests/headless.test.ts` enforces it. Screens are the host's, a kit's or `ui`'s.
- Publishing only. Never store site settings (Configuration's), files (the host's asset store), names (Profile's), permissions or approvals policy (the IAM suite's), or the site shell.
- Required ports fail closed. No implicit in-memory or file store, no default type, no default key.
- Contract (`shared/`) imports only zod and `@nuxt-layers/rich-text`; enforced by `tests/contracts.test.ts`. `server/internal` and `server/database` are private. Every row is parsed with the contract's schemas before it leaves the layer; SQL is parameterised.
- One state machine (`PUBLISHER_TRANSITIONS`) for every type; every action carries `expectedVersion` and is checked through the access-decision port. Types with `approval` publish only with the approval port's consent to that version's digest.
- Only published documents are public. A draft, without `view-draft`, answers exactly as a missing document.
- Formatted fields are `richTextSchema({ profile, max })` from `@nuxt-layers/rich-text` (ADR-0011), checked against their profile on every save; every other string is plain. Answers carry rich text as its safe tree, never HTML.
- Personal-data types: consent recorded before publishing; export and erasure by the person's identifier cover every version; superseded versions follow the retention period.
- Events and logs carry identifiers, codes, counts and times only, written to the outbox in the same transaction as the change.
- Endpoints (`server/api/publisher/`) take the subject only from the host's resolver; parse queries and bodies strictly; call the server functions, never SQL; are wrapped in `publisherHandler`. `tests/http.test.ts` mounts every file and pins the list. Export, import, submissions, erasure, maintenance and the relay are never endpoints. The host may switch the API off (`runtimeConfig.publisher.api.enabled`); off, it answers 404 as if absent.
- Members and other layers are reached only through ports the host supplies; never import another `@nuxt-layers/*` package, except the stateless `rich-text` library (ADR-0011 §7), following its `master`.
- Keep `docs/contracts.md`, `docs/threat-model.md` (control register), `STORAGE-REGISTER.md`, `capability.json` and `PLAN.md` in step with code, briefly.
- Documents follow ADR-0010: external links and verified revisions appear only in `RESOURCES.md`, pinned to a commit; every other document names the entry. `CHANGELOG.md` holds no links. `scripts/check_markdown.py` enforces both.
- Contract version 1 (docs/contracts.md §17). No releases or tags while the platform is in development; the package is `0.0.0` and hosts follow `master`. A breaking change is stated in the changelog and raises the contract version.
- Built test-first: a new feature's contract and failing tests come first. Anything specified but not yet built calls `pending()` (`shared/pending.ts`); `tests/contracts.test.ts` fails while any call remains, so nothing merges with one.
- Platform-agnostic: the layer and its tests run alike on Windows, macOS and Linux. Tests that compare file paths with import specifiers or routes pass them through `toPosix` (`tests/support/paths.ts`).
- Package manager: pnpm. Commit `pnpm-lock.yaml`.
