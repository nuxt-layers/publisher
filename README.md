# @nuxt-layers/publisher

Nuxt foundation layer for publishing: which version of which document is published at which address, for whom, now. It owns the lifecycle every published document shares (drafts, versions and history; review, approval and moderation; scheduled publishing and unpublishing; addresses, redirects and links between documents; safe rich text; listings and feeds) and knows nothing about what any document is. Every document type is the host's registration.

A headless platform foundation layer (ADR-0009): it draws nothing. It reaches Authorisation, the approvals process, the asset store and the title template only through ports the host supplies, and imports no other layer, only the stateless `rich-text` library.

**Composing it?** Read [CONTRACT.md](CONTRACT.md), the one-page host contract, and nothing else ([changelog](CHANGELOG.md)).

**Documents:** the [guide](docs/guide.md), the full [contract](docs/contracts.md), the [threat model](docs/threat-model.md), the [storage register](STORAGE-REGISTER.md), the [plan](PLAN.md) and the [manifest](capability.json).

## Owns

- The lifecycle of documents of the types a host registers, and every version of each.
- The addresses of published documents, the redirects from their old addresses and the links between documents, by id.
- Checking every formatted field against its profile on save, using the shared `rich-text` format (ADR-0011), and rendering it safely.
- Listings, RSS and Atom feeds, and sitemap entries.

## Never owns

| Not here | Owned by |
|---|---|
| Any particular document type (pages, posts, menus, reviews …) | The host, by registration |
| Site name, legal entity, contacts, SEO defaults, `security.txt` | The host, from Configuration |
| The site shell, routes, every screen, contact forms and sending mail | The host, a kit or `ui` |
| Images and files | The host's asset store: the publisher holds references only |
| People's names | Profile, asked by the host's screens |
| Who may do what, and approvals | The host, through the access-decision and approval ports |
| Editing content: forms, rich-text editing, authoring | `content-editor`, or the host's own form controls; the server checks every save |

## Interfaces

| Direction | Interface | Purpose |
|---|---|---|
| Consumes from the host | `providePublisherDocumentTypes` | The document types: fields (formatted ones by profile), address, listing, lifecycle, personal data |
| Consumes from the host | Database, subject resolver, access decision, approval, clock, event sink, asset resolver, title template | Storage under ADR-0002; the signed-in subject; permissions; consent to publish; time; events; images; titles |
| Provides to the host's screens | The HTTP API and `usePublisher()`, its typed client | Data and actions; content as `rich-text` safe trees |
| Provides to the host's server | `getPublishedDocument`, `listPublishedDocuments`, feeds, sitemap entries, export and import, personal-data export and erasure, maintenance | Reading, seeding and data-subject requests |
| Publishes | `publisher.*` events | Identifiers, codes and times only |

## Development

Use the Node in `.node-version` with Corepack, which supplies the pnpm in `packageManager`: `corepack enable`, `pnpm install`, `pnpm dev:prepare`, then `pnpm check` (type check and tests). Database suites need `PUBLISHER_TEST_DATABASE_URL`, the admin URL of a disposable PostgreSQL 16. `python3 scripts/check_markdown.py` checks the documentation.

## Governing decisions

ADR-0002 and ADR-0006 (persistence), ADR-0008 (delivery), ADR-0009 (headless), ADR-0010 (documents), ADR-0011 (rich text), ADR-0012 (composition) and ADR-0013 (toolchain), with the security, privacy and layer standards. [RESOURCES.md](RESOURCES.md) lists each with the revision relied on.
