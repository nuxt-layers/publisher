# Design Review

> **In short:** Publisher manages documents: it keeps them, versions them, moves them through drafting to publication, gives them addresses and serves them to readers. It should decide nothing about who someone is or what they may do. This review lists what goes in and out, and what must leave before composition (ADR-0012) is built. It is deleted once its decisions are in the code and `CONTRACT.md`.

## Inputs

| From | What |
|---|---|
| The application, once at start-up | The document types it wants, with their fields; a database connection; optionally a clock, an asset look-up and a page-title format |
| An editor | Create, save, submit for review, publish, schedule, unpublish, archive, restore an old version |
| Someone who is not an editor, through the application's own form | A submission, such as a review, hidden until a moderator accepts it (proposed for removal, below) |
| A reader | "Show me the document at this address", a listing, a feed |
| Other layers, through the application | Who is asking; whether they may; whether a version is approved |
| The application, on a timer | "Do scheduled work now" (publish and archive on time, apply retention); "send pending events" |

## Outputs

| To | What |
|---|---|
| Readers and screens | A published document as data, with rich text as a safe tree, never HTML; listings, RSS and Atom feeds, sitemap entries; a redirect when an address has moved |
| Editors | Drafts, history, links to a document, the moderation queue (proposed for removal) |
| Other layers | Events, such as "document published", carrying identifiers and times only |
| The application | Export and import of a site's content; a person's data, exported or erased |
| Its own database schema | Documents, versions, links, redirects and an event outbox |

## What Publisher enforces, and what it does not

Publisher is the **enforcement point**: it asks before every action and refuses when the answer is no. Authorisation is the **decision point**: it alone decides the answer.

| Publisher enforces | Publisher does not decide |
|---|---|
| The type's declared fields, on every save | Who the caller is (`authentication`) |
| Only allowed status changes: nothing publishes from archived, and so on | Roles, permissions, risk and step-up (`authorisation`) |
| No lost updates: every action names the version it expects | Approval rules: how many approvers, and who (the approvals process) |
| One document per address per site; redirects follow moves | Who may send content in, and spam or abuse (workflow, or the application) |
| Nothing crosses sites | Files and images (`storage`, `media`) |
| Unpublished content is never served to readers | People's names (`profile`) and site settings (`configuration`) |
| Publishing only the exact version that was approved | How anything looks (`ui`, the application) |
| Consent and retention for types holding personal data | |

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
4. **Moderation leaves Publisher.** It is workflow: who may send content in, and someone accepting or rejecting it. A submission becomes an ordinary draft, created through Publisher's normal create function by the service that took it in; an editor publishes or archives it through the normal lifecycle.
5. **Checking content on save stays.** Publisher refuses content that breaks its type's declared shape, applying `rich-text`'s rules; it cleans nothing. Every layer validates what it stores, because a screen can be bypassed.
6. **Then composition.** With the above gone, the single call takes the database pool, `resolveCaller`, `decide`, the approval port and the document types, runs migrations, and returns the scheduled tasks. Everything else has a default.

## What is removed, and its new home

Every removed function is still needed; each moves, none disappears.

| Removed from Publisher | New home | How the function survives |
|---|---|---|
| Risk levels per action, their floors, and `lifecycle.risks` | `authorisation` | It holds each action's risk, and `decide` answers for it |
| Step-up and sign-in freshness (`meetsStepUp`, `CRITICAL_FRESHNESS_MINUTES`) | `authorisation`, using `authentication`'s assurance | `decide` refuses with a reason, such as step-up needed |
| Approvers needed, and no approving one's own request (`APPROVAL_FLOOR`) | The IAM approvals process (`iam-integration`) | It approves only when its own rules are met; Publisher checks the approved digest |
| The subject's shape: identity format, `kind`, assurance | `authentication` | `resolveCaller` gives an opaque caller |
| The site resolver | The caller's tenant | `resolveCaller` names the tenant, which is the site |
| `receivePublisherSubmission`, `lifecycle.moderation`, the `moderate` action and permission, the moderation queue, and the `submission-received` and `submission-moderated` events | Not yet built: the catalogue's candidate `workflow-service`; until then, the application's own form handling | The form handler checks the sender and filters abuse, then creates a draft as a service caller; an editor publishes or archives it |

## Depends on

- `authorisation`: `decide` must cover risk and step-up for Publisher's action names. To check against its `CONTRACT.md`.
- The IAM approvals process: approver counts and self-approval must be enforced there. To check against `iam-integration`'s `CONTRACT.md`.
- A home for moderation: the application until `workflow-service`, a candidate in the catalogue, is built. Whether to promote it is the owner's call.

## Decided (5 November 2026)

- Proposals 1–5 agreed. The contract version rises to 2. Moderation's home is the application until `workflow-service` is built.

## Checked against other contracts

- `iam-integration`: Authorisation's `authorise({ subject, permission, resource })` already answers with a step-up requirement, and its permission catalogue already carries risk (`high` needs aal2; `critical` a phishing-resistant sign-in within 15 minutes). Publisher's copy is redundant. `resolveCaller` and `decide` in ADR-0012's shape are **not offered yet**.
- The IAM approvals process covers Identity's own changes only. **Nothing yet approves a document.** Publisher keeps its approval port; until something fills it, types needing approval cannot publish.
- `authorisation` has no `CONTRACT.md`. Needed before Publisher relies on it.

## Decisions needed

1. Composition before IAM offers `resolveCaller` and `decide`: wait, or have Publisher take `getAuthenticatedPrincipal` and `authorise` through a small adapter until it does.
2. Document actions not built today: **duplicate** ("save as") and **delete**. Today a document is only archived, or erased with a person's data. Add both, and should delete be limited to documents never published?
3. What fills the approval port for documents: the application for now, or `workflow-service`.
