# Spec 0001: Minimal shared Litcraft

## Status

Audited against AutoEssay's default integration branch (`feat/init-core-engine`) and ready for ticketing.

## Goal

Establish the smallest shared Litcraft foundation in Writing Engine that both AutoEssay and AutoFiction can use without either product leaking its domain model into the engine.

The first implementation is deliberately smaller than AutoEssay's current integrated Literacraft path. It extracts only semantics already proven useful across essay and fiction: observable style mechanisms, grounded observations, longitudinal author practice, transformation traces and structured evaluated style effects.

## Audit findings

The AutoEssay implementation proves the following behavior:

1. a style observation must connect a situated content configuration, a concrete formal operation, an observed effect and textual evidence;
2. an isolated adjective is not a valid stylistic operation;
3. one observation remains a `single_observation` unless stronger evidence explicitly promotes it;
4. `AuthorStyleConstellation` is derived, longitudinal and non-executable;
5. a writer transformation trace records an attempted operation and is not proof that the effect succeeded;
6. an independent evaluator distinguishes absent, ineffective, partially effective, effective and harmful effects and grounds non-absent findings in text;
7. AutoEssay's documentary gate remains independent from editorial/style success.

The audit also shows that AutoEssay's current `StyleObservation` is not directly portable: its `contentConfiguration` imports essay-only `ClaimType` and `SourceRegime`, and `ObservationAnalyzer` renders those exact essay fields in its model prompt.

Therefore Writing Engine must not copy AutoEssay's Litcraft folder wholesale.

## Ponytail challenge

The initial design proposed extracting analyzers, evaluators, generic context references and planned-operation abstractions at once. That is more machinery than the shared engine currently needs.

The minimal foundation therefore does **not** extract:

- `ObservationAnalyzer`;
- `EditorialEffectEvaluator` or any model prompt;
- provider/retry policy;
- `ContentStyleArticulation`;
- planned-operation contracts that only product articulations currently consume;
- writer/evaluator/revision projection compilers;
- product evaluation gates;
- persistence or registries;
- a plugin/factory framework for consumer-specific schemas.

Products may keep those services and planning objects while consuming the shared pure contracts.

## Shared module boundary

One logical module is sufficient:

```text
src/litcraft/
  index.ts
```

Do not split it into packages or service layers until a concrete change becomes difficult without that split.

## Shared primitives

### Generic references

Where Litcraft needs object references for traces, evaluated effects or Diffract projection, it reuses Writing Engine's existing domain-neutral reference contract:

```ts
{ kind: string; id: string }
```

Do not introduce a second generic identifier abstraction.

### StyleSituation

A style observation needs structured situation data without knowing the product domain.

Use only a small signal list:

```ts
interface StyleSignal {
  kind: string;
  value: string;
}

interface StyleSituation {
  signals: StyleSignal[];
}
```

At least one signal is required.

Examples:

```text
AutoEssay
argumentative_function = maintain a documentary contradiction
claim_type = interpretation
source_regime = testimony
relation = incompatible chronologies

AutoFiction
scene_function = rupture
arc_pressure = trust collapses
reader_state = narrator reliability becomes uncertain
```

The product owns the vocabulary of `kind`. Writing Engine only requires non-empty kinds and values.

### ObservedStylisticOperation

A shared observed operation represents an observable mechanism rather than a style label.

Keep the five proven operation families:

- `enunciation_structure`
- `syntax_rhythm_musicality`
- `tone_lexicon`
- `figuration_genre`
- `creative_imperfection`

The shared `category` and `target` are non-empty strings rather than closed engine enums. Consumers may validate narrower vocabularies themselves. This avoids a cross-product extension framework.

An observed operation contains:

- family;
- category;
- trigger;
- operation;
- target;
- observed effect;
- intensity (`subtle | moderate | structuring`).

### StyleEffect

Represent effects as structured statements rather than a closed essay-specific object:

```ts
interface StyleEffect {
  kind: string;
  statement: string;
}
```

Examples of `kind` include `argumentative`, `epistemic`, `emotional`, `reception`, `narrative`, `perceptual`, `rhythmic` and `reader`.

Writing Engine does not own that vocabulary.

### Text evidence

A reusable evidence value contains:

- optional exact excerpt;
- optional text location label;
- optional start/end offsets.

It requires either an excerpt or a location. If offsets are supplied, both are required and `end > start`.

Grounding an excerpt against actual manuscript text remains a consumer/service responsibility because the shared pure contract does not own the manuscript.

### StyleObservation

A shared observation contains:

- stable id;
- author id;
- source text id;
- `StyleSituation`;
- one or more observed stylistic operations;
- one or more `StyleEffect` values;
- text evidence;
- provenance;
- confidence (`low | medium | high`);
- maturity (`single_observation | recurring_pattern | validated_practice`);
- creation time.

Default maturity is `single_observation`.

### AuthorStyleConstellation

Preserve the proven AutoEssay semantics:

- derive only from observations belonging to the requested author;
- group observed practices by operation family/category;
- keep the weakest confidence in a grouped practice;
- aggregate operations, triggers and effects without duplicates;
- preserve explicit author declarations;
- keep validated signatures, productive tensions and unwanted drifts explicit;
- enforce the ethical boundary `preserveMechanismsNotSurface = true` and `forbiddenVerbatimReuse = true`;
- never expose generation directives or become executable by a writer.

### TransformationTrace

A shared trace records an attempted operation:

- stable id;
- unit reference and version;
- operation reference;
- optional additional provenance references such as a consumer decision/projection;
- declaration;
- text evidence/location;
- status `declared`;
- creation time.

A trace is not evidence that the intended effect succeeded.

### EvaluatedStyleEffect

The first shared evaluation artifact is a **result contract**, not an evaluator service.

It contains:

- stable id;
- scope reference;
- optional operation reference;
- optional trace references;
- status `absent | present_ineffective | partially_effective | effective | harmful`;
- intended effects;
- observed effects;
- unintended effects;
- textual evidence;
- optional repair suggestion;
- evaluation timestamp and evaluator provenance.

Rules:

- any status other than `absent` requires textual evidence;
- any status other than `effective` requires a repair suggestion;
- `absent` may have no evidence;
- product-specific scores and gates stay in the product.

This captures the common signal without moving AutoEssay's `contentScore`, `formScore`, documentary integrity gate or final essay verdict into Writing Engine.

## Diffract integration

Diffract is already present in Writing Engine. Litcraft must expose a minimal projection from `EvaluatedStyleEffect` to a Diffract `ContextBlock`.

The projection must:

- use a `style-effect` generic reference;
- include status, intended, observed and unintended effects in bounded text;
- preserve the effect identifier;
- never trigger a Diffract read or mutate state by itself.

This enables the proven loop:

```text
writer
  -> TransformationTrace
  -> consumer evaluation
  -> EvaluatedStyleEffect
  -> Diffract ContextBlock
  -> post-Diffract reading
  -> product/author decision
```

## AutoEssay compatibility

AutoEssay keeps its current product-facing representation and services during the first Writing Engine implementation.

A later AutoEssay adapter may map:

```text
argumentativeFunction -> StyleSignal(kind="argumentative_function")
claimTypes            -> StyleSignal(kind="claim_type")
sourceRegimes         -> StyleSignal(kind="source_regime")
relations             -> StyleSignal(kind="relation")
tensions              -> StyleSignal(kind="tension")
concepts              -> StyleSignal(kind="concept")
```

and map its effect arrays to `StyleEffect` values by kind.

The adapter is not part of the minimal Writing Engine foundation. AutoEssay remains authoritative until compatibility tests prove the mapping and dependency mechanism.

## AutoFiction compatibility

AutoFiction can use the same shared primitives while owning:

- `BookStyleContract`;
- `NarrativeStyleState`;
- `NarrativeStyleArticulation`;
- planned stylistic operations;
- local versus persistent transition rules;
- narrative/reader-specific judges and commit rules.

No shared Litcraft object may update `NarrativeStyleState` directly.

## Implementation slices

The minimal foundation should land as three independently verifiable tracer bullets:

1. observe one situated style mechanism with grounded evidence;
2. derive a non-executable longitudinal author constellation;
3. record/evaluate a transformation result and project it into Diffract context.

The second and third slices may proceed independently once the first shared observation vocabulary exists.

## Deferred migration

After the minimal foundation is stable:

1. decide the smallest cross-repository dependency mechanism;
2. build an AutoEssay compatibility adapter;
3. run AutoEssay's existing Litcraft tests and demonstrators against that adapter;
4. switch shared semantics only after parity;
5. consume the same primitives from AutoFiction;
6. reconsider planned-operation sharing only when both products implement the same semantics;
7. remove duplicated product implementation only when no caller remains.

## Acceptance criteria

- Writing Engine contains no import from AutoEssay or AutoFiction.
- The Litcraft foundation contains no model-provider dependency.
- A valid observation cannot be reduced to a style adjective because trigger, mechanism, effect and evidence are required.
- A single observation does not become an author signature automatically.
- `AuthorStyleConstellation` is longitudinal and non-executable.
- A transformation trace remains a declaration, not proof.
- An evaluated non-absent style effect requires evidence.
- An evaluated non-effective style effect requires a repair suggestion.
- An `EvaluatedStyleEffect` can become a Diffract `ContextBlock` without parsing free-form writer logs.
- No Litcraft artifact mutates product state.

## Ponytail check

One module, reused generic references, plain Zod contracts and pure functions. No observation context references, planned-operation abstraction, schema factory, plugin system, event bus, registry, persistence layer, analyzer service or evaluator service in this phase.
