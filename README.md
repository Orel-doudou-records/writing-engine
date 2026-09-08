# Writing Engine

Shared writing infrastructure for Orel-doudou-records applications.

`writing-engine` hosts only primitives whose semantics are genuinely shared by multiple writing products. Domain concepts remain in their owning repositories.

Initial consumers:

- `Orel-doudou-records/auto-essay`
- `Orel-doudou-records/auto-fiction`

## Current foundations

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
