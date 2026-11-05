# Storage Register

> **In short:** Publisher stores everything in one PostgreSQL schema that the host's database holds. It sets no cookies, uses no browser storage and keeps no cache or file of its own. This register lists what is implemented today (Privacy §5, in [Resources](RESOURCES.md)); legal notices, consent and exemptions are the consuming application's.

## Facts common to every table

| Property | Value |
|---|---|
| Owner | Publisher |
| Technology | PostgreSQL 18-alpine or higher, in the schema the host names (default `publisher`), created by Publisher's own append-only migrations |
| Location | The host's database, under the host's hosting and storage providers |
| Isolation | Every document, and every row reached through one, belongs to one site (`site_id`); every query names the site. Nothing crosses sites |
| Access | The host's runtime role is granted `select`, `insert`, `update` and `delete` on `document`, `version`, `link`, `redirect` and `outbox` only; migrations run with the host's migration pool. All SQL is parameterised; rows are checked against the contract's schemas before they leave the layer. Endpoints act only after the access-decision port allows |
| Encryption at rest and backups | The host's database. Unverified here |
| Essential | Yes: Publisher cannot work without it. Without a database the required port fails closed (`PublisherCompositionError`), and a failing one answers `unavailable`, recording nothing |
| Consent | Not needed to store; this is the service's core function. For document types that declare personal data, Publisher refuses to publish a version without its consent field; whether consent is the legal basis is the host's call |

## Tables

| Table | Purpose | Contents | Personal data | Retention and deletion |
|---|---|---|---|---|
| `document` | One row per document: its lifecycle and published address | Id, site, type, status, version numbers, approval id, the requester's identity identifier, a moderation column no longer used (always empty for new documents), schedule and times, published and preview paths | The requester's identity identifier (pseudonymous). Paths may reflect content | Kept until the document is erased with a person's data. No other deletion is implemented |
| `version` | Every saved version of each document | Content (JSON, of the host's registered type), its digest, when and by whom it was saved, what it was restored from, and the person it names | Content may hold anything the host's type allows. For types declaring personal data: the person's identity identifier (`subject_id`), their words and their consent. `saved_by` is an identity identifier | Superseded versions of personal-data types are deleted after the type's `retentionDays` by `runPublisherMaintenance()`. A person's erasure deletes every version naming them. Otherwise kept with the document |
| `link` | Links between documents, by id | Source and target document ids | None | Deleted with either document |
| `redirect` | A document's old addresses | Site, path, document id | None directly; paths may reflect content | Deleted with the document, or when a document claims the address |
| `outbox` | Events written in the same transaction as each change, for the host's relay | Event JSON: identifiers, codes, counts and times only, never content; when written and when relayed | `publisher.person-erased` carries the erased person's identity identifier | Relayed rows are kept. No deletion is implemented. Unverified whether erasure should also remove earlier events about that person's documents |
| `migration` | Which migrations have run | Migration id and time | None | Kept for the life of the schema |

## Client side

None. `usePublisher()` holds no cookies, local or session storage, IndexedDB or cache. Any storage a host's screens add is the host's to register.
