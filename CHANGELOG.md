# Changelog

## Unreleased

- CI installs with `--no-frozen-lockfile` while the platform is in development, and shows any lockfile drift.
- Toolchain (ADR-0013): Node 26.13.0 (`.node-version`), Corepack 0.36.0 and pnpm 12.16.1; install scripts only for packages in `allowBuilds` (esbuild); CI caches the pnpm store. Development only: hosts' requirements are unchanged.
- Versions reset while the platform is in development: the package is `0.0.0` and the contract version stays 1. The `v1.0.0` tag and release are withdrawn; hosts follow `master`.
- Documents follow ADR-0010: added `RESOURCES.md`, `PLAN.md`, `STORAGE-REGISTER.md` and `capability.json`; the roadmap and the headless migration plan are folded into `PLAN.md`; external links moved to `RESOURCES.md`. Documentation only.
- Moved to the `nuxt-layers` organisation.
- The export bundle format is now `nuxt-layers.publisher` (and `nuxt-layers.publisher.person` for a person's export). Bundles exported as `nuxt4-layers.publisher` no longer import.
- Added `CONTRACT.md`, the one-page host contract for 1.0.0 (ADR-0012 §6). Documentation only.

## 1.0.0 — 2026-10-22

- First release, contract version 1: headless; document types registered by the host; the lifecycle with approval, moderation and scheduling; rich text checked by profile and returned as safe trees; addresses, redirects and links; listings, feeds and sitemap entries; personal data; export and import; a switchable HTTP API and the typed client `usePublisher()`; every document on a site. See the README and `docs/contracts.md`.
