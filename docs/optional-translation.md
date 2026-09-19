# Optional translation process

Status: draft implementation proposal. The repository's two-real-consumer adoption gate is not yet satisfied. These contracts are available on this branch for review, not an assertion of production adoption by AutoEssay or AutoFiction.

Translation is an optional CC1 process. A consumer calls it when a person or workflow requests a translation. Importing Writing Engine, opening a project or changing text does not start translation. There is no global enable switch, prescribed language pair, literary genre, translator role, provider or remote service.

## Use the existing lifecycle

1. Authorize source read access. Choose source and target language tags, source revision, destination workspace and explicit paragraph mappings. The consumer creates any destination paragraphs using existing CC1 operations.
2. Call `prepareTranslation(store, input)`. Its immutable, JSON-serializable request holds exact source text, node/version/hash and revision provenance. Persist that request under a unique ID in consumer-owned storage.
3. Obtain translated text through the consumer's chosen human workflow or agent. This is outside the engine. Keep whitespace and line breaks as supplied; the engine does not judge or rewrite language.
4. Call `createTranslationContribution(store, { request, texts, contributor, roleBinding, policy, permissionGrants, revisionId, changeSetId, proposalId, createdAt })`. Each mapped target needs whole-node `replace_content` permission. Human and agent contributors follow the same project policy. A node requiring `propose` makes the entire batch a submitted CC1 proposal; `direct` only produces a workspace commit.
5. Persist the commit, binding and proposal together. Use `reviewProposalSelection` for normal editorial decisions. The application authorizes reviewers; approval flags are not client input.
6. For a proposal, authorize the integrator and call `integrateTranslationProposal(store, { binding, proposal, expectedHeadRevisionId, revisionId, integrationId, integrator, createdAt, editorialConflicts? })`. It revalidates source provenance and heads, binds the reviewed items to the recorded contribution and uses the conflict-aware CC1 integrator. Persist its result atomically. `integratedUnits` contains only accepted mappings.

The returned commit is a value, not a stored change. None of these functions persists it or advances a branch. A request, binding and reviewed proposal must come from trusted server-side records. Request hashes detect mismatched provenance; they are not signatures or authorization tokens.

## Source and destination

Language tags use `Intl.getCanonicalLocales`, for example `pt-br` becomes `pt-BR`. Tags unsupported by the runtime and equal normalized source/target tags are rejected. Language tags express the caller's intent; the engine does not detect the text's language.

One source paragraph maps to one existing target paragraph, and each node appears once. Source paragraphs need content; targets can be empty. A batch may contain many paragraphs. Resegmentation, sentence alignment and automatic target creation are not part of this contract.

The destination must be a non-canonical workspace. For same-project translation, the source branch must differ from both the destination workspace and the destination project's canonical branch: integration must never overwrite the source branch. To translate a canonical original, use a separate destination project, or retain the source on a separate protected branch. Separate projects permit each language to have its own canonical text. The host application governs those branches and projects.

The request records the target canonical head as the proposal's base. That head must be an ancestor of the destination workspace for CC1 proposal creation to succeed. Required target paragraphs must also exist on canonical before integration; unintegrated structural changes in a workspace are not included in a translation proposal.

`assessTranslationSource(store, request)` returns `current`, `stale` or `missing`, with `currentRevisionId` when known. This is a freshness indicator, not an approval or quality score. Any source-branch head change is conservatively stale, even an unrelated paragraph edit. A changed source head takes priority and reports stale. When the head is unchanged, missing pinned snapshots/content report missing; storage errors propagate. An absent source project, branch or pinned revision reports missing.

A moved source, workspace or canonical target blocks the old operation. Prepare a new request with a new ID and current revisions, obtain/recheck the translated text and create a new contribution/proposal with new IDs. Reviews start empty. Do not reuse CC1 proposal adaptation to carry approvals to a different source.

## Transaction and security boundary

The supplied store contains literary data. The application must authenticate callers and enforce read access to the source and write/review/integration permissions at its boundary. Use server-owned identities, role bindings, policies and grants. Do not expose store access or `authorized: true` as caller-selected HTTP fields. Do not treat the returned provenance as proof of identity.

Use a consistent transaction covering these operations:

- Lock or compare the source head against the request's source revision.
- Load the immutable request/binding and current trusted policy or reviews.
- Execute the relevant engine function and revalidate the destination head.
- Persist the commit using `persistCommit`, its snapshot/content, the immutable request/binding and the proposal or integration/review records; atomically compare-and-swap the target head.

The source must remain locked/validated until the transaction commits. The store interface alone does not guarantee this, and `persistCommit` is not a transaction wrapper. Rolling back only a target head while leaving partially written records is insufficient. For two projects the transaction must cover both; independently committing two stores is not supported by this workflow. Read-only freshness assessment can use ordinary reads, but its answer may immediately become stale.

For an agent/provider, the host decides whether any source text may leave the self-hosted system. This implementation has no network call, queue, model credential, telemetry or persistence dependency. It adds no authentication, HTTPS or database server: those remain deployment/application responsibilities.

## Executable example

From the repository root after installing its declared dependencies:

```sh
npm run build
node examples/optional-translation.mjs
node examples/optional-translation.mjs --translate
```

The first invocation does no translation work. The second demonstrates a Portuguese-to-Arabic human contribution, review and integration using supplied text and the real in-memory CC1 store. It needs no network, credentials or provider. The store is an educational, single-process example, not a transactional production database.

Tests also exercise a separate same-project French-to-Traditional-Chinese configuration, branch-local content-version collisions, direct contribution, per-node permissions, fresh review after source movement and partial integration. These examples are contract checks, not the two real consumers required for adoption.

Existing consumers need no code or configuration change. If a consumer adopts this draft after the repository gate is resolved, pin the reviewed Writing Engine commit as required by ADR 0004.
