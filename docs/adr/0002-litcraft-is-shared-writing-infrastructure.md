# ADR-0002: Litcraft is shared writing infrastructure

## Status

Accepted

## Context

AutoEssay already contains an integrated Litcraft path for observing stylistic mechanisms, deriving an author style constellation, proposing situated operations, tracing writer transformations and evaluating effects in produced text.

Those responsibilities are not inherently essay-specific. AutoFiction needs the same underlying capabilities for long-form voice continuity, stylistic variation and post-writing effect analysis.

However, the current AutoEssay implementation still embeds essay-domain concepts in some style contexts, including claims, source regimes and argumentative functions.

## Decision

Litcraft moves conceptually into Writing Engine as a shared module, but it is extracted through a domain-neutral seam rather than copied wholesale from AutoEssay.

Writing Engine owns the shared semantics of:

- observable stylistic operation vocabulary;
- grounded style observations with textual evidence and provenance;
- derived `AuthorStyleConstellation` behavior;
- planned stylistic operations;
- transformation traces;
- independent style-effect evaluation primitives.

Consumer repositories own the reason a style operation matters in their domain.

AutoEssay keeps `ContentStyleArticulation`, argumentative/documentary context and essay-specific evaluation gates.

AutoFiction keeps `NarrativeStyleArticulation`, `NarrativeStyleState`, `BookStyleContract`, narrative/reader impacts and fiction-specific judges.

`AuthorStyleConstellation` remains analytical and non-executable. It never feeds the writer directly as a global imitation profile.

## Consequences

- The initial migration must preserve AutoEssay behavior before adding fiction-specific capabilities.
- Shared style observations cannot require `ClaimType`, `SourceRegime`, `NarrativeArc` or `ReaderModel`.
- Products provide situated context through adapters or product-owned references.
- The engine preserves mechanisms, provenance and effects rather than surface imitation.

## Rejected alternatives

### Keep Litcraft in AutoEssay and duplicate it in AutoFiction

Rejected because the core semantics already have two real consumers and would drift quickly.

### Copy AutoEssay's Litcraft folder unchanged

Rejected because it would leak essay-specific domain types into the shared engine.

### Restore a global style-profile-to-prompt engine

Rejected because it bypasses situated decisions, author governance and effect verification, and risks self-reinforcing stylistic caricature.
