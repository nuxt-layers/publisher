# Changelog

## Unreleased

- Documents follow ADR-0010: added `RESOURCES.md`, `PLAN.md`, `STORAGE-REGISTER.md` and `capability.json`; the roadmap and the headless migration plan are folded into `PLAN.md`; external links moved to `RESOURCES.md`. Documentation only.
- Moved to the `nuxt-layers` organisation.
- The export bundle format is now `nuxt-layers.publisher` (and `nuxt-layers.publisher.person` for a person's export). Bundles exported as `nuxt4-layers.publisher` no longer import.
- Added `CONTRACT.md`, the one-page host contract for 1.0.0 (ADR-0012 §6). Documentation only.

## 1.0.0 — 2026-10-22

- First release, contract version 1: headless; document types registered by the host; the lifecycle with approval, moderation and scheduling; rich text checked by profile and returned as safe trees; addresses, redirects and links; listings, feeds and sitemap entries; personal data; export and import; a switchable HTTP API and the typed client `usePublisher()`; every document on a site. See the README and `docs/contracts.md`.
