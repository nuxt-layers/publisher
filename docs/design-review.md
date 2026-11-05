# Design Review

> **In short:** Publisher manages documents: it keeps them, versions them, moves them through drafting to publication, gives them addresses and serves them to readers. It should decide nothing about who someone is or what they may do. This review lists what goes in and out, and what must leave before composition (ADR-0012) is built. It is deleted once its decisions are in the code and `CONTRACT.md`.

## Inputs

| From | What |
|---|---|
| The application, once at start-up | The document types it wants, with their fields; a database connection; optionally a clock, an asset look-up and a page-title format |
| An editor | Create, save, submit for review, publish, schedule, unpublish, archive, restore an old version |
| A member of the public, through the application | A submission (a review, a comment), held until moderated |
| A reader | "Show me the document at this address", a listing, a feed |
| Other layers, through the application | Who is asking; whether they may; whether a version is approved |
| The application, on a timer | "Do scheduled work now" (publish and archive on time, apply retention); "send pending events" |

## Outputs

| To | What |
|---|---|
| Readers and screens | A published document as data, with rich text as a safe tree, never HTML; listings, RSS and Atom feeds, sitemap entries; a redirect when an address has moved |
| Editors | Drafts, history, links to a document, the moderation queue |
| Other layers | Events, such as "document published", carrying identifiers and times only |
| The application | Export and import of a site's content; a person's data, exported or erased |
| Its own database schema | Documents, versions, links, redirects and an event outbox |

## Finding: security decisions are made inside Publisher

Publisher asks others whether someone may act, but it also makes security decisions itself. These belong in `authentication` and `authorisation` (and the IAM approvals process), not here.

| In Publisher today | Where | Belongs to |
|---|---|---|
| A risk level for each action, with floors, raised per type (`lifecycle.risks`) | `shared/types.ts`, `publisherPermissions` | Authorisation |
| Step-up: `high` needs aal2; `critical` needs a phishing-resistant sign-in within 15 minutes (`meetsStepUp`, `CRITICAL_FRESHNESS_MINUTES`) | `shared/lifecycle.ts`, checked in `server/internal/store.ts` | Authorisation, using Authentication's assurance |
| How many approvers a publish needs, and that the requester cannot approve their own request (`APPROVAL_FLOOR`) | `shared/lifecycle.ts`, `server/internal/writing.ts` | The IAM approvals process |
| The subject's shape: identity format (UUIDv7), `kind`, assurance level and sign-in time | `shared/lifecycle.ts` | Authentication |

## Proposal

1. **Publisher names actions; Authorisation decides.** Publisher keeps its action names (`publisher.<type>.edit`, `.publish`, `.view-draft`, `.moderate`) and asks `decide(caller, action, { site, type, documentId })` in ADR-0012's shape. Risk levels, step-up and freshness go; a refusal's reason, such as step-up needed, comes back from `decide`.
2. **Publisher only checks that approval matches the version.** It asks the approval port for a decision on a version's digest and publishes only on approval of that exact digest. Approver counts and self-approval rules go.
3. **The caller is opaque.** Publisher takes `resolveCaller(event)` in ADR-0012's shape and stores only the subject identifier it is given. The tenant becomes the site, so the separate site resolver goes.
4. **Then composition.** With the above gone, the single call takes the database pool, `resolveCaller`, `decide`, the approval port and the document types, runs migrations, and returns the scheduled tasks. Everything else has a default.

## Depends on

- `authorisation`: `decide` must cover risk and step-up for Publisher's action names. To check against its `CONTRACT.md`.
- The IAM approvals process: approver counts and self-approval must be enforced there. To check against `iam-integration`'s `CONTRACT.md`.

## Decisions needed

1. Agree the finding and proposal 1–3.
2. Whether Publisher's contract version rises to 2 with this change.
