# Publisher Host Contract

> **Note:** this describes the code as it is today. [PLAN.md](PLAN.md) steps 6 to 8 change it: delete and reading addresses arrive, and composition becomes one call. Each step updates this document.

What a host needs to compose Publisher, and nothing else (ADR-0012 §6, in [Resources](RESOURCES.md)). The [longer contract](docs/contracts.md) and the code stay the source: where this page disagrees with them, this page is the bug. Publisher predates ADR-0012: there is no single call, and it does not take `resolveCaller` or `decide` yet, so today the host fills each port below itself.

## Install

```json
"@nuxt-layers/publisher": "github:nuxt-layers/publisher#master"
```

`extends: ['@nuxt-layers/publisher']` in `nuxt.config.ts`; install with `--frozen-lockfile`. One Nitro plugin (the `providePublisher*` and server functions are auto-imported):

```ts
import { postsType } from '../content-types' // the host's own declarations

export default defineNitroPlugin(async () => {
  providePublisherDatabase({ dialect: 'postgres', pool, migrationPool, runtimeRole: 'publisher_runtime' })
  providePublisherDocumentTypes([postsType])
  providePublisherSiteResolver({ resolve: async event => siteIdFor(event) }) // a constant for one site
  providePublisherSubjectResolver({ resolve: async event => publisherSubjectOf(await getAuthenticatedPrincipal(event)) })
  providePublisherAccessDecision({ allows: async input => (await authorise(authorisationInputOf(input))).allowed })
  providePublisherApproval({ request: input => approvals.request(input), decision: input => approvals.decision(input) }) // only with `approval` types
  providePublisherEventSink({ publish: events => bus.publish(events) })
  providePublisherAssetResolver({ resolve: input => assets.addresses(input) }) // optional
  providePublisherTitleTemplate({ format: input => titleFor(input) }) // optional
  await migratePublisherDatabase()
  await checkPublisherComposition() // fails at start-up if a required port or a stored type is missing
})
```

`publisherSubjectOf`, `authorisationInputOf`, `siteIdFor` and `titleFor` are the host's mappings, described under "Host passes".

## Settings

| Setting | Default | Does |
|---|---|---|
| `runtimeConfig.publisher.api.enabled` (`NUXT_PUBLISHER_API_ENABLED`) | `true` | `false` switches the HTTP API off: every `/api/publisher/*` request answers a plain 404 before any port is asked, as if absent. Server functions still work |
| `PublisherDatabase.schema` | `publisher` | The PostgreSQL schema the layer owns |
| `PublisherDatabase.migrationPool`, `runtimeRole` | The runtime pool; none | Run migrations as another role and grant the runtime role |
| Each type's `personalData.retentionDays` | None | 30 to 2,190 days to keep superseded versions of a personal-data type |

The layer reads no other environment variable. Document types are code the host registers, never settings.

## Host passes

| Need | Shared shape (ADR-0012 §2) | Today |
|---|---|---|
| Database | A `pg` pool; the layer owns its schema | `providePublisherDatabase({ dialect: 'postgres', pool, schema?, migrationPool?, runtimeRole? })`; any pool with `query` and `connect` |
| Document types | Not a shared shape | `providePublisherDocumentTypes(declarations)`, each from `definePublisherDocumentType`, with `type`, `label`, `fields` (a `z.strictObject`, every string and array bounded), `address`, `listing`, `lifecycle`, `personalData`. No default type |
| Caller | `resolveCaller(event)` | Not taken yet. `PublisherSubjectResolver.resolve(event)` → the signed-in user, `{ identityId, ... }` (a UUIDv7; anything else is passed to `decide` untouched), or `null`. `PublisherSiteResolver.resolve(event)` → the site id or `null`. Both needed for the HTTP API |
| Access | `decide(caller, action, resource)` | `PublisherAccessDecision.decide(user, action, { siteId, type, documentId \| null })` → `{ allowed, reason? }`, where `action` is a permission such as `publisher.<type>.publish`. `reason: 'step-up'` becomes `insufficient-assurance`. Required |
| Approval | Not a shared shape | `PublisherApproval`, for types with `lifecycle.approval`: `request({ siteId, documentId, type, version, digest, permission, requesterId, correlationId })` → `{ approvalId }`; `decision({ approvalId })` → `{ state, digest }`. Publishes only on `approved` for that exact digest; who approves is the approvals process's rule |
| Mail | `send(...)` | None: the layer sends nothing |
| Events | The outbox, drained by `relay()` | `relayPublisherOutbox({ limit? })` → `PublisherEventSink.publish(events)`, at least once, in order |
| Scheduled work | `tasks: { name, every, run }[]` | `runPublisherMaintenance()` every minute (scheduled publishing and archiving, retention); `relayPublisherOutbox()` every minute. Both idempotent; never endpoints |
| Clock | `now()`, system clock by default | `providePublisherClock({ now })`, or none |
| Assets, titles | Not shared shapes | Optional. `PublisherAssetResolver.resolve({ siteId, assetIds })` → each id's `{ url, width?, height? }` or `null`; without it images are refused. `PublisherTitleTemplate.format({ siteId, title, type, locale })`, e.g. Configuration's `seo.title-template`; without it titles stand alone |

Every port rejects on failure; the layer then answers `unavailable`, never a partial answer.

## Client and server functions

| Side | Function | Does |
|---|---|---|
| Client | `usePublisher()` | Calls the HTTP API: `resolve(path, preview)`, `list(query)`, `types()`, `documents(query)`, `document(id, version?)`, `history(id)`, `backlinks(id)`, `create(type, content)`, `act(id, action)`. Decides nothing; `publisherErrorOf(error)` reads `{ code, reason? }` |
| Server | `createPublisherDocument({ siteId, subject, correlationId, type, content })` | A draft at version 1 |
| Server | `transitionPublisherDocument({ siteId, subject, correlationId, documentId, request })` | One action: `save`, `submit`, `withdraw`, `publish` (`publishAt?`, `unpublishAt?`), `unpublish`, `archive` (both with `acknowledgedLinks`), `reopen`, `restore` (`version`); each with `expectedVersion` |
| Server | `resolvePublisherPath({ siteId, path, viewer?, preview? })` | `{ kind: 'document', rendered }`, `{ kind: 'redirect', to, status: 301 }` or `{ kind: 'none' }` |
| Server | `getPublishedDocument`, `listPublishedDocuments`, `getPublisherFeed`, `listPublisherSitemapEntries` | One document (by path or id), a listing (up to 100, equality filters), RSS or Atom, sitemap paths |
| Server | `getPublisherDocument`, `listPublisherDocuments`, `listPublisherHistory`, `listPublisherBacklinks` | Administration reads under `view-draft` (the queue under `moderate`) |
| Server only | `exportPublisherContent`, `importPublisherContent` | A site's bundle out and in; import is also how a host seeds content |
| Server only | `exportPublisherPersonData({ identityId })`, `erasePublisherPerson({ identityId, correlationId })` | For iam-integration's data-subject requests; every site and version |

The HTTP API, under `/api/publisher`: `GET /resolve`, `GET /documents`, `GET /feeds/{type}/rss` and `/atom` for anyone; `GET /admin/types`, `GET`/`POST /admin/documents`, `GET /admin/documents/{id}`, `POST /admin/documents/{id}/actions`, `GET .../history`, `.../backlinks`, `.../preview` for the signed in.

**The editor slot.** `GET /admin/types` (`usePublisher().types()`) answers each type the subject may touch with its `label`, `address`, `schema` (the fields as JSON Schema) and `richTextFields` (`{ path, profile, max }`), and what the subject `may` do. `content-editor` plugs in there: it builds the form from that answer and saves through `create` and `act`. Plain form controls work too: the server checks every save.

Errors are `{ code, reason? }`: `unauthenticated` 401, `forbidden` 403, `not-found` 404, `insufficient-assurance` 403, `validation-failed` 400 (a content problem such as `not-in-profile`, `image-without-alt`, `unknown-type`), `conflict` 409 (`version-stale`, `invalid-transition`, `address-taken`, `review-required`, `approval-missing`, `consent-missing`, `scheduling-disabled`, `still-linked`, `erased`), `unavailable` 503. A server function throws `PublisherFailure` with the same `code` and `reason`.

## Permissions

Four per registered type, from `publisherPermissions(usePublisherRegistry())`, for Authorisation's catalogue, which sets each one's risk and step-up. Approvers are the approvals process's rule.

| Permission | Allows |
|---|---|
| `publisher.<type>.view-draft` | Drafts, history, backlinks, administration lists, previews |
| `publisher.<type>.edit` | Create, save, submit, withdraw, reopen, restore |
| `publisher.<type>.publish` | Publish, schedule, unpublish, archive |

## Screens

None. Publisher is fully headless (ADR-0009, in [Resources](RESOURCES.md)): no pages, routes, components, styles or message catalogue, so there is nothing to move or switch off. The host owns every route, including the catch-all that resolves addresses, draws content with `ui`'s rich-text renderer or its own, and takes editing from `content-editor` through the editor slot.

## Headless surface

A screen the host draws must still:

- take the signed-in person and the site only from the server's resolvers, never from a request; decide nothing, since every action is decided again on the server;
- send every action with the `expectedVersion` the editor saw, reloading on `version-stale`;
- show `unpublish` and `archive` only after showing the backlinks, and send their count as `acknowledgedLinks`;
- answer `{ kind: 'redirect' }` with a 301 to `to`, and `{ kind: 'none' }` or `not-found` with a 404, the same for a hidden document as for a missing one;
- draw each `richText` field (`{ path, profile, nodes }`) from its safe tree, with links and images through the answer's `links`; never as HTML, and never parse a field as markup;
- set title, description, canonical URL, Open Graph and `noindex` on a preview from the answer's `head`;
- name people (`authors`) only through Profile's lookup: the layer holds identity identifiers only;
- never let administration screens be framed, cached or sent as a Referer (`frame-ancestors 'none'`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`); one `<main>` per screen; accessibility tested in light and dark mode.

## You will hit this

- **Hidden is absent.** A draft, an erased document, a document on another site and a preview without `view-draft` all answer exactly as a missing one: `null`, `{ kind: 'none' }`, HTTP 404. `forbidden` never says whether a document exists.
- **Rich text is a safe tree.** Answers carry `rich-text` nodes, never HTML. Raw HTML in a field is its text; only `https:`, `mailto:`, `doc:`, `asset:` and site-relative links survive. Images must be `asset:` with alt text, and are refused without an asset resolver.
- **The API can be off.** With `NUXT_PUBLISHER_API_ENABLED=false` the client's calls 404; use the server functions. On, state-changing requests need an `Origin` on the request's own host.
- Documents, people and events are lower-case UUIDv7; `correlationId` is any lower-case UUID the host issues. A site id is lower-case letters, digits and `-`, up to 64.
- A type key is lower-case ASCII with `-`, 1 to 40, starting with a letter. A slug is up to 8 `/`-separated segments of `[a-z0-9]` words joined by `-`, at most 200 characters. Paths are unique per site among published documents, across types and locales (`address-taken` on publishing; drafts may share).
- Saving after submitting asks for approval again: consent binds to the version's digest.
- Content from people who are not editors is the host's to take in (later `workflow`): it creates an ordinary draft as a service user, and an editor publishes it.
- Personal-data types need the consent field before publishing (`consent-missing`); their subject and consent fields never reach a reader.
- A missing required port throws `PublisherCompositionError` at first use; nothing falls back, and there is no in-memory store. Stored documents of a type the host stopped registering fail `checkPublisherComposition()`.
- Your lockfile must record `@nuxt-layers/rich-text` as its `codeload.github.com` tarball, never `git@github.com`.
- Events carry identifiers, codes, counts and times only: read content through the server functions.
