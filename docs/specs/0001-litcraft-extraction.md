# Spec 0001: Extract Litcraft into Writing Engine

## Status

Ready for ticketing after consumer compatibility details are verified against AutoEssay's default integration branch.

## Goal

Move the genuinely shared Litcraft semantics out of AutoEssay into Writing Engine without changing AutoEssay behavior, while creating a clean seam that AutoFiction can consume without inheriting essay-domain types.

## Non-goals

This spec does not:

- move `ContentStyleArticulation` out of AutoEssay;
- implement AutoFiction's `NarrativeStyleArticulation`, `NarrativeStyleState` or `BookStyleContract`;
- extract Diffract yet;
- introduce a graph database, vector store or new persistence layer;
- create a global style preset or author-imitation prompt;
- redesign AutoEssay's current editorial workflow during extraction.

## Source behavior to preserve

AutoEssay's current Litcraft integration establishes these invariants:

1. style is represented through observable mechanisms and evidence, not adjective-only labels;
2. an `AuthorStyleConstellation` is derived and non-executable;
3. a proposed stylistic operation cannot become executable until product/author governance validates the surrounding decision;
4. writer transformation traces are declarations of attempted operations, not proof of success;
5. an independent evaluator inspects produced text for actual content/form effects and textual evidence;
6. product-specific documentary/editorial gates remain separate from style-effect evaluation.

The migration must keep these behaviors intact.

## Shared module boundary

Initial logical module:

```text
writing-engine/
  litcraft/
    style-operation
    style-observation
    author-style-constellation
    transformation-trace
    style-effect-evaluation
```

Physical package boundaries are deferred until implementation demonstrates that separate packages add value. A single package/module is preferred initially.

## Shared contracts

### Stylistic operation vocabulary

Writing Engine owns the domain-neutral operation vocabulary and target semantics needed by both consumers, including voice, distance, syntax, rhythm, tempo, lexicon, figuration, fragmentation, ambiguity, silence and related observable mechanisms.

Consumer-only categories may be added by consumer extension rather than forcing every product term into the shared enum.

### Style observation

A shared style observation must contain:

- stable id;
- author id;
- source text id;
- situated context supplied without product-domain imports;
- one or more observable formal operations;
- one or more observed effects;
- exact excerpt and/or text location;
- provenance;
- confidence;
- maturity.

The shared contract must not import `ClaimType`, `SourceRegime`, `NarrativeArc` or `ReaderModel`.

#### Context seam

The implementation should use the smallest context seam that preserves useful provenance. Preferred direction:

```ts
interface StyleObservationContext {
  summary?: string;
  tags?: string[];
  refs?: Array<{
    kind: string;
    id: string;
  }>;
}
```

AutoEssay can adapt claims, source regimes, relations, tensions and concepts into this seam while retaining its richer canonical data in AutoEssay. AutoFiction can adapt arcs, threads, scene functions and reader-state references similarly.

Do not make the shared engine the canonical store of either product's domain context.

### AuthorStyleConstellation

Preserve these properties:

- derived from observations and explicit declarations;
- longitudinal rather than single-passage authority;
- explicit validated signatures, productive tensions and unwanted drifts;
- ethical boundary that preserves mechanisms rather than surface wording and forbids verbatim reuse;
- never executable directly by a writer or projection compiler.

### Planned stylistic operation

The shared contract describes a concrete operation, target, rationale and intensity. Products decide why it is appropriate and how it participates in their own decision objects.

### Transformation trace

The shared trace links:

- unit/version;
- execution/projection reference;
- directive/decision reference when supplied by the consumer;
- declaration;
- exact text location;
- timestamp/provenance.

A trace status means only that an operation was declared/attempted.

### Style-effect evaluation

Split the reusable effect-evaluation semantics from AutoEssay's `IntegratedEvaluation` composition.

The shared evaluation must support:

- `absent`;
- `present_ineffective`;
- `partially_effective`;
- `effective`;
- `harmful`;
- findings about produced form/content;
- textual evidence;
- unintended effects;
- repair suggestion when not effective;
- provenance to the evaluated unit/version and expected operation/criterion.

AutoEssay retains its documentary integrity gate and final essay verdict composition.

## AutoEssay adapter

AutoEssay remains responsible for translating its richer essay context into the shared Litcraft seam.

Expected mapping includes:

```text
ClaimType / SourceRegime / ContentRelation / tensions / concepts
    -> AutoEssay-owned situated context
    -> shared StyleObservation refs/tags/summary
```

`ContentStyleArticulation`, `EditorialDecision`, `EditorialPlan` and essay projections remain AutoEssay-owned unless a later two-consumer analysis proves identical semantics.

## AutoFiction consumption

AutoFiction may consume the shared Litcraft contracts directly, but owns its narrative articulation and persistent style state.

Expected mapping includes:

```text
NarrativeArc / StoryThread / scene function / ReaderModel
    -> AutoFiction-owned situated context
    -> shared StyleObservation refs/tags/summary
```

A local stylistic variation does not automatically update `NarrativeStyleState`. A persistent transition requires AutoFiction governance and commit rules.

## Diffract integration contract

Litcraft must expose evaluated style effects in a structured form usable by a future shared Diffract core.

Minimum downstream signal:

```ts
interface EvaluatedStyleEffect {
  scopeRef: string;
  operationRef?: string;
  status:
    | "absent"
    | "present_ineffective"
    | "partially_effective"
    | "effective"
    | "harmful";
  intendedEffects: string[];
  observedEffects: string[];
  unintendedEffects: string[];
  evidence: Array<{ excerpt: string }>;
}
```

This is decision input only. Writing Engine does not decide whether a product's style state changes.

## Migration sequence

1. Add shared Litcraft contracts and tests in Writing Engine.
2. Add AutoEssay adapters while its existing implementation remains authoritative.
3. Run compatibility tests against representative AutoEssay Litcraft flows.
4. Switch AutoEssay imports to Writing Engine with no behavior change.
5. Remove or tombstone duplicated shared implementation only after parity is established.
6. Consume the shared module from AutoFiction.
7. Use the two consumers to refine extension seams only where real divergence appears.
8. Start Diffract-core extraction as a separate spec.

## Compatibility requirements

- Existing AutoEssay persisted data must not be silently reinterpreted.
- No automatic converter may legitimize legacy global style-profile conclusions that bypass provenance.
- Stable identifiers/provenance used by evaluations and traces must remain resolvable across the migration.
- Consumer-specific evaluation gates and commit rules must remain unchanged during the extraction phase.

## Acceptance criteria

- Writing Engine contains no import from AutoEssay or AutoFiction domain packages.
- Shared Litcraft tests cover observation evidence/provenance, constellation derivation, non-executability, trace validation and effect-evaluation evidence requirements.
- AutoEssay passes its existing Litcraft tests and demonstrators after switching to the shared module.
- AutoEssay's `ContentStyleArticulation` still belongs to AutoEssay.
- AutoFiction can represent a style observation and evaluated style effect using Writing Engine without depending on AutoEssay.
- An evaluated unintended style effect can be passed as structured input to a later diffractive reader without parsing free-form writer logs.

## Ponytail check

The extraction should prefer one shared Litcraft module and thin consumer adapters. Do not introduce a plugin framework, event bus, database, registry service or generic workflow engine unless a concrete consumer requirement proves it necessary.
