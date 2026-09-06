# ADR-0001: Writing Engine owns only proven shared semantics

## Status

Accepted

## Context

AutoEssay and AutoFiction are separate products with rapidly diverging domain models, but they both need some identical infrastructure for writing, style observation, evaluation and decision support.

Making AutoFiction depend on AutoEssay would incorrectly turn the essay product into a platform. Conversely, moving every vaguely reusable object into a shared repository would create an abstract framework before its consumers prove the abstraction.

## Decision

Writing Engine is a third repository consumed by AutoEssay and AutoFiction.

A primitive may move here only when at least two real consumers need the same semantics. Extraction is behavior-preserving before shared primitives are evolved.

Writing Engine may own shared execution and writing infrastructure. It must not own product-domain concepts.

Examples that remain outside Writing Engine:

- AutoEssay: Claim, Source, Evidence, Citation, ContentRelation, ContentStyleArticulation.
- AutoFiction: Canon, StoryState, ReaderModel, NarrativeArc, SceneContract, StoryThread, NarrativeStyleArticulation.

## Consequences

- Dependency direction is `auto-essay -> writing-engine` and `auto-fiction -> writing-engine`; neither product depends on the other.
- Each product can evolve its domain independently.
- Shared contracts must expose narrow seams rather than product-specific union types.
- A duplicated implementation is temporarily preferable to a false abstraction when semantics have not converged.

## Rejected alternatives

### AutoFiction depends on AutoEssay

Rejected because it makes essay-domain history an implicit platform contract.

### Move all common-looking types immediately

Rejected because names can match while semantics differ. The two-consumer rule is mandatory.
