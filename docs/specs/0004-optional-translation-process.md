# Lot 3 — optional translation process

## Scope

The owner clarified the scope on 2026-09-19: « Reste général c’est un processus de traduction intégré à Writing Engine, mobilisable si besoin ».

Translation is an explicitly invoked, domain-neutral process over CC1. Languages, literary genre, roles, translation providers and user interfaces belong to consumers. Nothing runs automatically. Existing consumers behave identically when they do not call this API. The bilingual workshop is one possible application; this change does not modify that application.

The repository requires two real consumers before adopting a shared primitive. No two real translation consumers have been demonstrated. This branch is a reviewable implementation proposal, to remain a draft pending that adoption gate. Executable examples demonstrate contracts, not production adoption; this spec does not amend the rule.

## Contracts

- Prepare a request from explicit source and target projects, branches, expected revisions and one-to-one paragraph mappings. Normalize language tags with the runtime’s `Intl.getCanonicalLocales`. Preserve exact text, including whitespace.
- Resolve source content in its revision context, never by a branch-local version ordinal alone. Keep source revision, node, version, content hash and text in a serializable request.
- Require an existing non-canonical target workspace, separate from the source branch. A target can be in the same project or a separate project. In the same project, the source must also differ from the canonical integration destination. Never write to the source branch.
- Accept text supplied by a human or agent under the same per-node permissions and contribution policy. Require complete mapping coverage. A single `propose` decision makes the whole contribution a normal submitted proposal with no inherited review decisions; `direct` only changes the workspace.
- Before contribution and integration, check the pinned source and target revisions and revalidate recorded source content. Any source-branch advance conservatively requires a fresh request and fresh review. Source assessment reports current, stale or missing.
- Reuse normal review decisions and conflict-aware proposal integration. Bind integration to the recorded request and contribution; report only accepted mappings when review is partial.
- Functions read a supplied store and return immutable values. They do not persist, advance branches, call a provider or perform network requests.

## Consumer responsibilities

Authenticate contributors and reviewers; enforce read permissions before preparing a request; supply trusted policies, grants and reviewed proposals. Keep request and contribution records in trusted immutable storage. Authorize canonical integration as with other CC1 proposals. Bind any HTTP route to server-side identities rather than accepting grants or approval flags from clients.

Persist the result through the existing CC1 store in a consumer-owned transaction, including the request/contribution binding and proposal/review records. Recheck or lock the source head and compare-and-swap the target head in that same transaction. For cross-project translation the transaction must cover both projects. A read-then-write sequence outside that boundary cannot prevent a concurrent source update.

## Validation and delivery

Public-API tests use the real in-memory store and CC1 commits/reviews. Cover language pairs, human and agent contributions, per-node permissions, source and target drift, revision-local version collisions, provenance mismatch, partial acceptance, JSON round trips and absence of automatic persistence. Supply an executable, provider-free example and activation documentation.

No automatic language detection, model choice, quality assessment, glossary, queue, new storage port, application UI or database migration is included. Source movement requires a new request, not an adaptation that carries prior approvals.
