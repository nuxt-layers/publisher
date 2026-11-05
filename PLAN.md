# Plan

> **In short:** Publisher's contract version 1 is built and headless. The work now under way brings it in line with the current architecture, one reviewed pull request at a time, keeping its public behaviour stable unless a change is stated.

## Done

- **Contract version 1, built test-first:** document types registered by the host; the lifecycle with approval, moderation and scheduling; versions and history; addresses, redirects and links; listings, feeds and sitemap entries; personal data; export and import; every document on a site.
- **Headless:** rich text from `rich-text`, checked by profile and answered as safe trees; screens, styles and wording removed; the HTTP API can be switched off; `usePublisher()` is a typed client only.

## In progress: alignment with the current architecture

| Step | Work | Status |
|---|---|---|
| 1 | Move to the `nuxt-layers` organisation; export bundle format `nuxt-layers.publisher` | Done |
| 2 | Documents (ADR-0010): `RESOURCES.md`, this plan, `STORAGE-REGISTER.md`, `capability.json`; external links only in Resources | Done |
| 3 | Toolchain (ADR-0013): Node 26.13.0, Corepack 0.36.0 and pnpm 12.16.1; `allowBuilds`; CI actions pinned by commit, pnpm through Corepack, the store cached | Done |
| 3a | Design review (its decisions are now in the code and `CONTRACT.md`) | Done |

## Next: the change plan

Each step is one pull request on its own branch, contract and failing tests first. Steps 4 to 7 change the public contract, so contract version 2 lands with step 4 and covers them all.

| Step | Work | Removes | Adds |
|---|---|---|---|
| 4 (done) | Security decisions out | Risk levels and floors, `lifecycle.risks`, step-up and freshness, `APPROVAL_FLOOR`, the subject's shape | `decide(caller, action, { siteId, type, documentId })` and an opaque caller; approval checks only the approved digest |
| 5 (done) | Moderation out | `receivePublisherSubmission`, `lifecycle.moderation`, the `moderate` action and permission, the queue, two events | Nothing: a service caller creates an ordinary draft |
| 6 (done) | Delete, and reading addresses | | Delete of a document with every version, link and history; a `document-deleted` event; refused while the policy port reports a hold. A function reading a document's current and former addresses, for `seo` and `doc-search`, since events carry identifiers only |
| 7 (done) | Composition (ADR-0012) | Every `providePublisher*` call and `migratePublisherDatabase` | One call, `composePublisher({ pool, resolveCaller, decide, types, ... })`, running migrations and returning `tasks`; fakes of every port, refused outside tests |
| 7b (done) | `examples/minimal-host` (ADR-0012 §4) | | A host composing Publisher and nothing else, with a CI check that its composition stays within 50 lines and a smoke test. Built from the layer's own dependencies, so no lockfile change |
| 8 (in review) | Contract | `docs/design-review.md`; `docs/guide.md`, which repeats what `CONTRACT.md` will say | `CONTRACT.md` standing alone, ending with the services Publisher expects as requirements on their owners |

## Assumptions to confirm

Each is the default the steps above follow unless the owner says otherwise.

| Question | Assumed |
|---|---|
| Addresses (each document's path on its site) | Stay: Publisher needs them to serve a document |
| Redirects and sitemap entries | Stay in Publisher until `seo` exists, then move. Events carry identifiers only, so `seo` will read addresses through a function, not from events |
| Listings and RSS/Atom feeds | Stay: they read only published documents |
| The HTTP API and `usePublisher()` | Stay, switchable off as today |
| Tags and categories | Not stored by Publisher: a type may hold `metadata`'s identifiers as plain fields |
| Autosave, diffs and history depth | Not in these steps: every save stays a full version; depth and storage limits arrive later from `privacy` and `policy-map` |
| Retention | Keeps the type's `retentionDays`, which the host already supplies, until `privacy` exists |
| Locking while editing | Not added: `expectedVersion` already refuses lost updates |
| Export | No change: answers are data, and the `export` layer turns them into files |

## Decided for this work

- The `v1.0.0` tag and release are withdrawn; consumers follow `master`. Versions are reset (package `0.0.0`) until a beta release; the contract version rises to 2 with step 4.
- The `providePublisher*` calls go in the same change as the single call, with no transition.
- Publisher declares its approval port in its own contract and knows nothing of where it comes from; the host fills it.
- Migrations run inside the single call.
- `rich-text` is followed at its `master`, not a tag.
