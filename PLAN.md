# Plan

> **In short:** Publisher is aligned with the current architecture at contract version 2. Nothing is in progress; what remains waits on other layers being built.

## Done

- **Contract version 1, built test-first:** host-registered document types, the lifecycle, versions and history, addresses, listings and feeds, personal data, export and import, sites. Headless, with rich text from `rich-text`.
- **Alignment (contract version 2), one pull request per step:**
  1. Moved to `nuxt-layers`; documents follow ADR-0010; toolchain on Node 26.13.0, Corepack 0.36.0 and pnpm 12.16.1 (ADR-0013).
  2. Security decisions out: Authorisation's `decide` and the approvals process decide; Publisher asks.
  3. Moderation out: content from people who are not editors arrives as ordinary drafts.
  4. Delete, refused under a policy hold, and reading a document's addresses.
  5. One call composes Publisher (`composePublisher`), with fakes for tests and `examples/minimal-host` proving the 50-line budget (ADR-0012).
  6. `CONTRACT.md` stands alone, naming the layer that fills each service.

## Later, when the layer it needs exists

| Work | Waits on |
|---|---|
| Move redirects and sitemap entries out, reading addresses through `getPublisherAddresses` | `seo` |
| Take retention, history depth and storage limits as policy | `privacy`, `policy-map` |
| Autosave, and storing versions as differences | A need shown by measurement |
| Tags and categories beyond identifiers in a type's fields | `metadata` |

## Decided

- No releases or tags until a beta; consumers follow `master`, and the package is `0.0.0`.
- Publisher knows nothing of where its services come from; the host fills each one in `composePublisher`.
- Addresses, listings, feeds, the HTTP API and `usePublisher()` stay in Publisher. Locking is not added: `expectedVersion` refuses lost updates. Export is data; file formats are the `export` layer's.
