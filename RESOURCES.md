# Resources

> **In short:** every external architectural document Publisher relies on, with the revision reviewed. This is the only file that links outside the repository (ADR-0010). Software dependencies are resolved as ADR-0008 says, not here.

All rows were checked on 5 November 2026 against `nuxt-layers/architecture-rules` at commit `7a2d5c3`.

| Document | Relied on for |
|---|---|
| [ADR-0002 — Composition-supplied persistence](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/decisions/ADR-0002-composition-supplied-persistence-and-capability-owned-schemas.md) | The host passes a pool; Publisher owns its schema and migrations |
| [ADR-0006 — Polyglot persistence and data-store security](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/decisions/ADR-0006-polyglot-persistence-and-data-store-security.md) | PostgreSQL, the runtime role and the outbox |
| [ADR-0008 — Independent layer delivery](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/decisions/ADR-0008-independent-layer-delivery.md) | Consumers follow `master`; release tags suspended |
| [ADR-0009 — Headless capability layers](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/decisions/ADR-0009-headless-capability-layers.md) | Publisher draws nothing; the headless surface |
| [ADR-0010 — Documentation style](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/decisions/ADR-0010-documentation-style.md) | Which document holds what |
| [ADR-0011 — Shared rich text](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/decisions/ADR-0011-shared-rich-text-and-configurable-copy.md) | Formatted fields use `rich-text` profiles and safe trees |
| [ADR-0012 — Trivial composition](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/decisions/ADR-0012-trivial-composition.md) | One call, the shared shapes, fakes, `examples/minimal-host` and `CONTRACT.md` |
| [ADR-0013 — Development toolchain baseline](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/decisions/ADR-0013-development-toolchain-baseline.md) | Node, pnpm and CI |
| [Security](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/security.md) | The control register (§11) and data stores (§16), followed by the [threat model](docs/threat-model.md) |
| [Privacy](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/privacy.md) | Personal data and the storage register (§5) |
| [Layer standard](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/layer-standard.md) | Repository layout, `capability.json`, testing and versioning |
| [Catalogue](https://github.com/nuxt-layers/architecture-rules/blob/7a2d5c34d1943f7b92edbc41f54b4201236cbfb5/docs/catalogue.md) | What Publisher owns and which capabilities build on it |
