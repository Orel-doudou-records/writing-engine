# ADR-0003: Diffract has a shared core and must consume evaluated style effects

## Status

Accepted as architectural direction; extraction follows Litcraft migration.

## Context

AutoEssay already implements a diffractive reading discipline with refraction, pattern/default inspection, entanglements, an explicit cut, tradeoffs and a forced verdict. Its current inputs and impacts are partly essay-specific.

AutoFiction needs the same decision discipline for narrative arcs, reader knowledge, scene planning and style transitions. In fiction, a stylistic change can itself become a narrative event and may alter future focalization, suspense, arc expression or reader interpretation.

A raw `text_changed` signal cannot express what an evaluated stylistic transformation actually did.

## Decision

Writing Engine will own a domain-neutral Diffract core only after Litcraft's shared seam is stabilized.

The shared core may own:

- pass orchestration;
- refraction;
- entanglements;
- cuts and exclusions;
- alternative paths and tradeoffs;
- verdict discipline;
- generic change/effect references;
- immutable reading artifacts and provenance.

Consumers own their context projectors and impact interpretations.

Diffract must support both pre-writing and post-writing use:

```text
proposed change -> pre-diffract -> product decision -> writer
writer -> style-effect evaluation -> post-diffract -> product decision
```

Post-Diffract consumes structured evaluated effects where available, including unintended effects and evidence, not only changed text.

Diffract never mutates `StoryState`, `NarrativeArc`, essay plans, style state or any other consumer state directly. A product-governed decision and normal commit path remain mandatory.

## Consequences

- AutoEssay may continue to expose plan and bibliography impacts.
- AutoFiction may expose arc, thread, reader and style impacts.
- Style-effect evaluation becomes a first-class signal for future diffractive re-reading.
- Automatic re-reading may add a semantic style-effect trigger rather than relying only on `text_changed`.
- The shared core must not contain claims, citations, arcs, scenes or reader-model types.

## Rejected alternatives

### Put AutoEssay's current Diffract implementation wholesale in Writing Engine

Rejected because current inputs and projections still encode essay-specific semantics.

### Run Diffract only before writing

Rejected because the produced text may create consequential, unintended stylistic effects that were absent from the proposal.

### Let post-Diffract update style state automatically

Rejected because evaluated consequences remain decision material under product and author governance.
