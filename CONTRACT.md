# Publisher Host Contract

> **In short:** everything a host needs to install, compose and use Publisher, and nothing else (ADR-0012 §6). Publisher keeps documents of the types a host registers, moves them from draft to published, gives them addresses, and serves them; it draws nothing and decides nothing about who may act. Maintainers' detail lives under `docs/`; this page is complete without it.

## Install

```json
"@nuxt-layers/publisher": "github:nuxt-layers/publisher#master"
```

`extends: ['@nuxt-layers/publisher']` in `nuxt.config.ts`. One server plugin, one call (`composePublisher` and the server functions are auto-imported):

```ts
import { postsType } from '../content-types' // the host's own declarations

export default defineNitroPlugin(async () => {
  const { tasks } = await composePublisher({
    pool, // a pg pool; optionally migrationPool, schema, runtimeRole
    types: [postsType],
    resolveCaller, // ADR-0012: event → { tenantId, subjectId | null, ... }
    resolveSite: event => siteIdFor(event), // a constant for one site; needed for the HTTP API
    decide, // ADR-0012: (user, action, resource) → { allowed, reason? }
    approval, // only with `approval` types
    publish: events => bus.publish(events), // optional: without it events stay in the outbox
  })
  scheduler.add(tasks) // maintenance every minute; the event relay when `publish` is given
})
```

It runs Publisher's migrations and checks the composition, failing at start-up if anything required is missing. For tests, `createPublisherFakes()` from `@nuxt-layers/publisher/testing` gives every service as `fakes.options`; it is refused outside tests. `examples/minimal-host` in this repository is a complete, working host in 17 lines. `siteIdFor`, `bus` and `scheduler` above stand for the host's own code.

## Settings

| Setting | Default | Does |
|---|---|---|
| `runtimeConfig.publisher.api.enabled` (`NUXT_PUBLISHER_API_ENABLED`) | `true` | `false` switches the HTTP API off: every `/api/publisher/*` request answers a plain 404 before any port is asked, as if absent. Server functions still work |
| `schema` (a `composePublisher` option) | `publisher` | The PostgreSQL schema the layer owns |
| `migrationPool`, `runtimeRole` (options) | The runtime pool; none | Run migrations as another role and grant the runtime role |
| Each type's `personalData.retentionDays` | None | 30 to 2,190 days to keep superseded versions of a personal-data type |

The layer reads no other environment variable. Document types are code the host registers, never settings.

## Host passes

| Need | Shared shape (ADR-0012 §2) | What Publisher takes | Filled by |
|---|---|---|---|
| Database | A `pg` pool; the layer owns its schema | `pool`, and optionally `migrationPool`, `schema` (default `publisher`) and `runtimeRole`. Migrations run inside `composePublisher` | The host |
| Document types | Not a shared shape | `types`, each from `definePublisherDocumentType`, with `type`, `label`, `fields` (a `z.strictObject`, every string and array bounded), `address`, `listing`, `lifecycle`, `personalData`. No default type | The host |
| Caller | `resolveCaller(event)` | `resolveCaller(event)` → `{ tenantId, subjectId \| null, ... }`; `null`, or a `null` subject, is nobody signed in. Publisher records `subjectId` (a UUIDv7) as who acted and passes the rest to `decide` untouched. `resolveSite(event)` → the site id or `null`, needed for the HTTP API | `authentication`; the site from `site-hosting`, or the host until it exists |
| Access | `decide(caller, action, resource)` | `decide(user, action, { siteId, type, documentId \| null })` → `{ allowed, reason? }`, where `action` is a permission such as `publisher.<type>.publish`. `reason: 'step-up'` becomes `insufficient-assurance`. Required | `authorisation` |
| Approval | Not a shared shape | `approval`, for types with `lifecycle.approval`: `request({ siteId, documentId, type, version, digest, permission, requesterId, correlationId })` → `{ approvalId }`; `decision({ approvalId })` → `{ state, digest }`. Publishes only on `approved` for that exact digest; who approves is the approvals process's rule | `workflow`, or the host until it exists |
| Policy | Not a shared shape | Optional `policy`, a `PublisherPolicy` (later `policy-map`): `isHeld({ siteId, documentId, type })` → `boolean`. Anything but `false` refuses a delete (`held`). Without it, nothing is held | `policy-map` |
| Mail | `send(...)` | None: the layer sends nothing | — |
| Events | The outbox, drained by `relay()` | Optional `publish(events)`: the relay task sends events to it, at least once, in order. Without it, events stay in the outbox | `events-queue`, or the host |
| Scheduled work | `tasks: { name, every, run }[]` | `composePublisher` answers `tasks`: `publisher-maintenance` every minute (scheduled publishing and archiving, retention), and `publisher-relay` every minute when `publish` is given. Both idempotent; never endpoints | `scheduler`, or the host |
| Clock | `now()`, system clock by default | Optional `now()` → a `Date` or an ISO 8601 UTC string; anything else fails closed as `unavailable` | `clock`, or the system clock |
| Assets, titles | Not shared shapes | Optional. `assets.resolve({ siteId, assetIds })` → an object keyed by every asset id asked, each `{ url, width?, height? }` or `null` when unknown. `url` must be an `https:` address or a site path, and `width` and `height` positive integers; anything else, or a missing id, is answered as `null` in the rendered document's `links.assets`; without it images are refused. `titleTemplate.format({ siteId, title, type, locale })` → the page and feed title, e.g. Configuration's `seo.title-template`; without it titles stand alone | `media` or the host's asset store; `configuration` or the host |

Every service rejects on failure; the layer then answers `unavailable`, never a partial answer. Each row is a requirement on the layer that fills it: until that layer exists, the host fills it, and `createPublisherFakes()` stands in for all of them in tests.

## Client and server functions

| Side | Function | Does |
|---|---|---|
| Server | `composePublisher(options)` | The one call, at start-up (see Install); answers `{ tasks }` |
| Client | `usePublisher()` | Calls the HTTP API: `resolve(path, preview)`, `list(query)`, `types()`, `documents(query)`, `document(id, version?)`, `history(id)`, `backlinks(id)`, `create(type, content)`, `act(id, action)`, `remove(id, expectedVersion)`. Decides nothing; `publisherErrorOf(error)` reads `{ code, reason? }` |
| Server | `createPublisherDocument({ siteId, subject, correlationId, type, content })` | A draft at version 1 |
| Server | `transitionPublisherDocument({ siteId, subject, correlationId, documentId, request })` | One action: `save`, `submit`, `withdraw`, `publish` (`publishAt?`, `unpublishAt?`), `unpublish`, `archive` (both with `acknowledgedLinks`), `reopen`, `restore` (`version`); each with `expectedVersion` |
| Server | `deletePublisherDocument({ siteId, subject, correlationId, documentId, expectedVersion })` | Deletes the document with every version, link, history and redirect; `{ versions }`. Needs `delete`; refused while held |
| Server | `resolvePublisherPath({ siteId, path, viewer?, preview? })` | `{ kind: 'document', rendered }`, `{ kind: 'redirect', to, status: 301 }` or `{ kind: 'none' }` |
| Server | `getPublishedDocument`, `listPublishedDocuments`, `getPublisherFeed`, `listPublisherSitemapEntries` | One document (by path or id), a listing (up to 100, equality filters), RSS or Atom, sitemap paths |
| Server only | `getPublisherAddresses({ siteId, documentId })` | `{ current, former[] }` for a published document, for `seo` and search; nothing otherwise |
| Server | `getPublisherDocument`, `listPublisherDocuments`, `listPublisherHistory`, `listPublisherBacklinks` | Administration reads, under `view-draft` |
| Server only | `exportPublisherContent`, `importPublisherContent` | A site's bundle out and in; import is also how a host seeds content |
| Server only | `exportPublisherPersonData({ identityId })`, `erasePublisherPerson({ identityId, correlationId })` | When a person asks for their data or its erasure (the host decides when) |

The HTTP API, under `/api/publisher`: `GET /resolve`, `GET /documents`, `GET /feeds/{type}/rss` and `/atom` for anyone; `GET /admin/types`, `GET`/`POST /admin/documents`, `GET /admin/documents/{id}`, `POST /admin/documents/{id}/actions`, `DELETE /admin/documents/{id}` (`{ expectedVersion }`), `GET .../history`, `.../backlinks`, `.../preview` for the signed in.

**The editor slot.** `GET /admin/types` (`usePublisher().types()`) answers each type the user may touch with its `label`, `address`, `schema` (the fields as JSON Schema) and `richTextFields` (`{ path, profile, max }`), and what the user `may` do. `content-editor` plugs in there: it builds the form from that answer and saves through `create` and `act`. Plain form controls work too: the server checks every save.

Errors are `{ code, reason? }`: `unauthenticated` 401, `forbidden` 403, `not-found` 404, `insufficient-assurance` 403, `validation-failed` 400 (a content problem such as `not-in-profile`, `image-without-alt`, `unknown-type`), `conflict` 409 (`version-stale`, `invalid-transition`, `address-taken`, `review-required`, `approval-missing`, `consent-missing`, `scheduling-disabled`, `still-linked`, `held`, `erased`), `unavailable` 503. A server function throws `PublisherFailure` with the same `code` and `reason`.

## Permissions

Four per registered type, from `publisherPermissions(usePublisherRegistry())`, for Authorisation's catalogue, which sets each one's risk and step-up. Approvers are the approvals process's rule.

| Permission | Allows |
|---|---|
| `publisher.<type>.view-draft` | Drafts, history, backlinks, administration lists, previews |
| `publisher.<type>.edit` | Create, save, submit, withdraw, reopen, restore |
| `publisher.<type>.publish` | Publish, schedule, unpublish, archive |
| `publisher.<type>.delete` | Delete a document with every version |

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
- A missing required port throws `PublisherCompositionError` at first use; nothing falls back, and there is no in-memory store. Stored documents of a type the host stopped registering fail `composePublisher` at start-up.
- Your lockfile must record `@nuxt-layers/rich-text` as its `codeload.github.com` tarball, never `git@github.com`.
- Events carry identifiers, codes, counts and times only: read content through the server functions, and addresses through `getPublisherAddresses`. The types: `publisher.document-created`, `document-saved`, `review-requested`, `review-withdrawn`, `document-scheduled`, `document-published`, `document-unpublished`, `document-reopened`, `address-changed`, `document-deleted`, `person-erased`, `content-imported` and `retention-applied`.
- **Storage.** Publisher stores only in its own PostgreSQL schema (documents, versions, links, redirects, the event outbox and its migrations); it sets no cookies and uses no browser storage. The host decides the notices and consent this needs where it operates; `STORAGE-REGISTER.md` has the detail.
- Server functions name the user `subject`: the result of `resolveCaller`, with `subjectId` as `identityId`.
