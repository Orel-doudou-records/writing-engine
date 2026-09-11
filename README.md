# Writing Engine

Shared writing infrastructure for Orel-doudou-records applications.

`writing-engine` hosts only primitives whose semantics are genuinely shared by multiple writing products. Domain concepts remain in their owning repositories.

Initial consumers:

- `Orel-doudou-records/auto-essay`
- `Orel-doudou-records/auto-fiction`

## Current foundations

### Collaborative Manuscript Core

The Collaborative Manuscript Core is the phase-agnostic lifecycle seam shared by writing products. It owns literary-node identity, content revisions, workspaces and variants, contribution policies, tasks, proposals, reviews, integrations, conflict checks and storage ports.

The same contracts support authoring-in-progress and later editorial collaboration. A consumer may write directly in an authorized workspace or require `Proposal -> Review -> Integration`; the Core does not infer that policy from whether the contributor is a human or an agent.

Product semantics stay outside the Core. Consumers attach opaque `DomainEntityRef { kind, id }` values such as claim-like or scene-like references, but Writing Engine never interprets those kinds and never imports product-domain types.

Dependency direction is one-way:

```text
AutoEssay ----\
               > Collaborative Manuscript Core
AutoFiction --/

Collaborative Manuscript Core -X-> AutoEssay / AutoFiction domain models
```

Contract fixtures under `tests/fixtures/` prove both an essay-style direct-writing consumer and a fiction-style proposal/review consumer against the same public APIs. They are deliberately tiny proofs of the shared seam, not product-domain implementations.

### Diffract

A minimal domain-neutral Diffract core lets consumers project their own objects into generic context blocks and receive a structured four-pass reading with an explicit cut, tradeoffs, verdict and validated generic impacts.

The core never knows what a claim, source, scene, arc or reader state is, and it never mutates consumer state.

### Litcraft

Litcraft is the shared style-observation and style-effect infrastructure: style observations, author-style constellation, transformation traces and evaluated style effects.

Products can project evaluated effects back into Diffract for post-writing re-reading without coupling the two modules. Product-specific style articulation and state transitions remain outside Writing Engine.

### Lunette Ronde

Lunette Ronde is the shared read-only editorial-review contract proven by AutoEssay and AutoFiction. It returns situated intervention findings, explicit author questions or `keep` findings from exact textual evidence while preserving meaning, certainty, voice and productive difficulty.

It is advisory only: no automatic rewrite, no literary-quality or humanity score, no AI-origin inference and no product-state mutation. Corpus-wide audit semantics remain deferred until two consumers prove the same need.

See `CONTEXT.md`, `docs/adr/` and `docs/specs/` for the authoritative boundaries.
