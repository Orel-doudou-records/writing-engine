# ADR-0003: Diffract has a shared core and must consume evaluated style effects

## Status

Accepted. The minimal domain-neutral core may be established before Litcraft migration; full style-effect integration follows Litcraft's shared seam.

## Context

AutoEssay already implements a diffractive reading discipline with refraction, pattern/default inspection, entanglements, an explicit cut, tradeoffs and a forced verdict. Its current inputs and impacts are partly essay-specific.

AutoFiction needs the same decision discipline for narrative arcs, reader knowledge, scene planning and style transitions. In fiction, a stylistic change can itself become a narrative event and may alter future focalization, suspense, arc expression or reader interpretation.

A raw `text_changed` signal cannot express what an evaluated stylistic transformation actually did.

## Decision

Writing Engine owns a domain-neutral Diffract core.

The first implementation is intentionally minimal and may be established before Litcraft extraction. It owns only:

- pass orchestration;
- refraction;
- pattern/default inspection;
- entanglements;
- cuts and exclusions;
- alternative paths and tradeoffs;
- verdict discipline;
- generic references and impacts;
- immutable reading artifacts;
- one structured-JSON model-client seam.

Consumers own their context projectors and impact interpretations.

The minimal core must not depend on Litcraft. Once Litcraft exposes shared evaluated style effects, those effects become first-class consumer-projected inputs to post-writing Diffract.

Diffract must support both pre-writing and post-writing use:

```text
proposed change -> pre-diffract -> product decision -> writer
writer -> style-effect evaluation -> post-diffract -> product decision
```

Post-Diffract consumes structured evaluated effects where available, including unintended effects and evidence, not only changed text.

Diffract never mutates `StoryState`, `NarrativeArc`, essay plans, style state or any other consumer state directly. A product-governed decision and normal commit path remain mandatory.

## Consequences

- A minimal Diffract foundation can be tested independently now.
- AutoEssay may continue to expose plan and bibliography impacts through its own adapter.
- AutoFiction may expose arc, thread, reader and style impacts through its own adapter.
- Litcraft extraction is not blocked by Diffract and Diffract is not blocked by Litcraft.
- Style-effect evaluation becomes a first-class signal for future post-writing diffractive re-reading once the shared Litcraft contract exists.
- Automatic re-reading may later add a semantic style-effect trigger rather than relying only on `text_changed`.
- The shared core must not contain claims, citations, arcs, scenes or reader-model types.

## Rejected alternatives

### Put AutoEssay's current Diffract implementation wholesale in Writing Engine

Rejected because current inputs and projections still encode essay-specific semantics.

### Wait to define any Diffract core until Litcraft migration is complete

Rejected because the four-pass/cut/verdict discipline and domain-neutral reference seam can be established independently. Waiting would couple two separable migrations without adding safety.

### Run Diffract only before writing

Rejected because the produced text may create consequential, unintended stylistic effects that were absent from the proposal.

### Let post-Diffract update style state automatically

Rejected because evaluated consequences remain decision material under product and author governance.
