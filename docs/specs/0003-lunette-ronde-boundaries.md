# Spec 0003: Lunette Ronde shared review boundaries

## Status

Implemented in Writing Engine PR #15 and proven by two consumers:

- AutoFiction PR #72;
- AutoEssay PR #157.

This spec stabilizes the semantics already exercised by those integrations. It does not introduce a new runtime or expand the shared API.

## Goal

Define the smallest shared editorial-review contract that lets multiple writing products ask the same kind of question:

> What in this passage deserves a minimal editorial intervention, an explicit author question, or deliberate preservation?

Lunette Ronde is a read-only editorial reader. It helps identify unnecessary complexity, imprecision, genericity, weakly mastered abstraction, over-explanation, rhythm/syntax problems and passages that should be left alone.

It is not a writer, a humanizer, an AI detector, a literary-quality scorer or a product governance layer.

## Consumer proof

The extraction rule is satisfied because AutoEssay and AutoFiction now consume the same shared semantics rather than merely sharing a name.

Both products use:

- the modes `lite | full | ultra`;
- the same structured `LunetteRondeReview` result;
- exact evidence excerpts;
- intervention findings with a diagnosis and suggestion;
- `open_question` when a correction would require missing information or an author decision;
- `keep` when a passage should be protected rather than rewritten;
- product-side verification that every evidence excerpt exists in the reviewed text;
- advisory/read-only execution with no direct mutation authority;
- the prohibition on inferring human or AI authorship.

The products differ only in domain context.

AutoEssay adds documentary constraints such as citations, conceptual distinctions, uncertainty and evidence integrity.

AutoFiction adds narrative constraints such as POV, canon, ReaderModel, voice continuity, rhythm and author-governed withholding.

Those domain rules remain product-owned.

## Shared module boundary

One module is sufficient:

```text
src/lunette-ronde/
  index.ts
```

The shared module contains only:

- schemas and types for the review contract;
- the three review modes;
- generic editorial instructions shared by both products.

It does not own model routing, context retrieval, manuscript loading, persistence, revision application or product decisions.

## Review semantics

### Review scope

The current shared primitive is a review of a supplied text unit or passage.

It is not yet a corpus-wide or longitudinal audit primitive.

A product may review a paragraph, scene, section or other bounded unit, but the shared contract does not define cross-document aggregation, recurrence thresholds or corpus statistics.

### Evidence

Every finding contains an exact non-empty textual excerpt.

The shared schema validates the presence of that excerpt as data. It cannot prove that the excerpt belongs to a particular manuscript because Writing Engine does not own the manuscript.

Therefore grounding remains a consumer responsibility. Both current consumers reject a finding whose excerpt is absent from the reviewed text.

Do not add product references, scene IDs, claim IDs or provenance objects to shared evidence until at least two consumers need the same semantics.

### Intervention findings

The shared intervention vocabulary is deliberately small:

- `cut`;
- `clarify`;
- `concretize`;
- `rhythm`;
- `genericity`;
- `syntax`.

Every intervention finding requires:

- exact evidence;
- a situated diagnosis;
- a non-empty suggestion.

The category describes the intervention pressure, not a universal defect class. A rhythmic or syntactic difficulty may be correct and should instead produce `keep` when it serves the text.

### Open questions

`open_question` is a first-class successful result.

Use it when an honest correction would require information, intention or judgment that is not present in the text available to the reviewer.

An open question requires:

- exact evidence;
- diagnosis;
- a precise `authorQuestion`.

It must not include a correction suggestion. The reviewer must not invent the missing answer and then rewrite from that invention.

### Keep

`keep` protects a situated passage that already works or whose difficulty is functional.

A `keep` finding contains evidence and diagnosis only. It must not prescribe a rewrite.

An entirely empty `findings` array is also valid. It means that the review found no actionable or explicitly preservable local finding worth returning.

Therefore:

- `findings: []` = no useful finding to report at this review scope;
- `keep` = an explicit local reason to preserve a particular passage.

The engine does not need a second top-level `holds` status to express either case.

## Modes

The modes are intervention policies over the same contract, not separate engines.

### lite

Intervene only on obvious local heaviness or clarity problems. Preserve almost all structure.

### full

Allow measured clarification, cutting and reordering while preserving voice and productive difficulty.

### ultra

Permit a frank review when the text does not hold, but do not equate depth with aggressive shortening. Irreducible uncertainty still becomes `open_question`, not an invented correction.

Changing mode must not change the output ontology, author-governance rules or evidence requirements.

## Editorial invariants

Shared guidance must preserve:

- supplied meaning;
- supplied facts;
- degree of certainty;
- citations when present;
- explicit constraints;
- author voice;
- technical precision;
- functional rhythm, ellipse and ambiguity;
- productive difficulty.

A shorter sentence that is less exact is a regression.

The reviewer should diagnose causes rather than smooth symptoms: badly ordered thought, undefined concept, missing logical relation, abstraction without referent, repetition or over-explanation.

## Genericity is not AI detection

`genericity` names observable textual genericity only.

It may describe patterns such as formulaic transitions, mechanical symmetry, repeated rhetorical staging, abstract filler or over-explanation when those patterns are actually present in the passage.

It must never become:

- an AI-origin probability;
- a human-likeness score;
- a detector-evasion signal;
- evidence that a text was written by a particular model or process.

`GenericityRisk`, `VoiceDrift`, literary quality and authorship origin remain distinct concepts.

## Relation to Litcraft

Litcraft observes and records style mechanisms, longitudinal author practices, transformation traces and evaluated effects.

Lunette Ronde performs an advisory editorial review of a supplied passage.

A Lunette Ronde finding does not automatically become:

- a `StyleObservation`;
- an `AuthorStyleConstellation` entry;
- a `TransformationTrace`;
- an `EvaluatedStyleEffect`.

A product may explicitly map one artifact into another only when it has enough context and governance to preserve the destination semantics.

Writing Engine must not introduce an automatic bridge merely because the modules both concern prose.

## Relation to Diffract

Diffract reads proposals and their consequences through product-projected context. Lunette Ronde identifies situated editorial pressure in existing text.

A review result does not automatically trigger Diffract and a Diffract verdict does not authorize a Lunette Ronde suggestion.

Products may place selected review material into later decision context, but the shared engine does not orchestrate this loop.

## Product responsibilities

Each consumer owns:

- what text unit is reviewed;
- bounded context supplied to the reviewer;
- model/provider selection;
- prompt additions specific to its domain;
- evidence-excerpt grounding against the actual text;
- whether a finding is shown, ignored, adapted or escalated;
- any author approval;
- any actual rewrite or state mutation.

No shared result is executable by itself.

## Explicit non-goals

This spec does not add:

- a rewrite engine;
- an automatic fixer;
- a corpus audit service;
- longitudinal repetition detection;
- style or humanity scores;
- genericity metrics;
- AI-origin detection;
- model/provider configuration;
- persistence or registry;
- MCP/plugin infrastructure;
- author-memory storage;
- an event bus or worker queue;
- automatic Litcraft or Diffract projection;
- product-specific evidence/provenance identifiers.

## Deferred candidates

The following may be reconsidered only after separate consumer proof:

1. corpus/long-form `LunetteRondeAudit` semantics if at least two products independently need the same cross-unit recurrence model;
2. descriptive style/genericity metrics if they are proven useful without becoming quality scores;
3. richer shared evidence provenance if both products need identical reference semantics;
4. a shared review-to-Diffract projection if both consumers independently build the same mapping.

None of these is implied by the current review contract.

## Acceptance criteria

- [x] AutoEssay and AutoFiction consume the same shared modes and finding semantics.
- [x] Product-specific guidance remains in the product repositories.
- [x] Every finding requires an exact textual excerpt.
- [x] Current consumers verify excerpts against the reviewed text.
- [x] `open_question` is non-prescriptive and requires an author question.
- [x] `keep` cannot prescribe a rewrite.
- [x] Empty findings remain valid.
- [x] The shared contract has no mutation authority.
- [x] The shared instructions forbid AI-origin inference.
- [x] No literary-quality or humanity score exists.
- [x] No corpus-audit, persistence, plugin or orchestration layer is introduced.

## Ponytail check

One small schema family, one instruction builder, one output vocabulary and two proven consumers. The implementation remains smaller than the editorial systems around it and deliberately leaves manuscript ownership, domain policy, author decisions and rewriting outside the shared engine.
