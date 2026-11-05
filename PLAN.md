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
| 3a | [Design review](docs/design-review.md): move security decisions to Authorisation, Authentication and the approvals process | In review |
| 4 | Composition (ADR-0012): one call taking the pool, `resolveCaller`, `decide`, `tasks`, `now()`, the approval port and the host's types, running migrations itself; fakes of every port, refused outside tests; `examples/minimal-host` with a budget check and smoke test | After 3a |
| 5 | `CONTRACT.md` rewritten to stand alone (ADR-0012 §6), with the asset port's exact shape and a clock answering a `Date` or an ISO 8601 UTC string | Next |

## Decided for this work

- The `v1.0.0` tag and release are withdrawn; consumers follow `master`. Versions are reset (package `0.0.0`, contract version 1) until a beta release.
- The `providePublisher*` calls go in the same change as the single call, with no transition.
- Publisher declares its approval port in its own contract and knows nothing of where it comes from; the host fills it.
- Migrations run inside the single call.
- `rich-text` is followed at its `master`, not a tag.
