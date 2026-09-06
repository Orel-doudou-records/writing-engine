# Writing Engine

Shared writing infrastructure for Orel-doudou-records applications.

`writing-engine` hosts only primitives whose semantics are genuinely shared by multiple writing products. Domain concepts remain in their owning repositories.

Initial consumers:

- `Orel-doudou-records/auto-essay`
- `Orel-doudou-records/auto-fiction`

## Current foundations

### Diffract

A minimal domain-neutral Diffract core is being established first. Consumers project their own objects into generic context blocks and receive a structured four-pass reading with an explicit cut, tradeoffs, verdict and validated generic impacts.

The core never knows what a claim, source, scene, arc or reader state is, and it never mutates consumer state.

### Litcraft

Litcraft remains the first shared style-infrastructure extraction: style observations, author-style constellation, transformation traces and evaluated style effects. Its migration from AutoEssay is specified separately.

Once Litcraft exposes evaluated effects, products can project those effects back into Diffract for post-writing re-reading without coupling the two modules.

See `CONTEXT.md`, `docs/adr/` and `docs/specs/` for the authoritative boundaries.
