# Writing Engine Context

## Purpose

Writing Engine contains shared infrastructure for long-form writing products. It exists to prevent AutoEssay and AutoFiction from duplicating genuinely identical writing primitives while keeping each product free to develop its own domain model.

## Consumers

- **AutoEssay**: documentary, argumentative and essay-writing domain.
- **AutoFiction**: fictional, narrative and scene-based writing domain.

Neither consumer depends conceptually on the other. Both may depend on Writing Engine.

## Extraction rule

A primitive belongs here only when at least two real consumers use it with the same semantics. Shared-looking names are not enough.

Extraction proceeds behavior-preserving first. Product-specific improvements happen in the owning product or through explicit extension points after the shared seam is stable.

## Shared vocabulary

### Litcraft

The shared style-observation and style-effect infrastructure. Litcraft describes observable writing mechanisms rather than adjective-only style profiles. It records provenance, situated operations, transformations and evaluated effects while preserving author governance.

Litcraft does not decide why an essay or a fiction should use a stylistic operation. Each product owns that domain articulation.

### StyleObservation

A grounded observation that connects a writing situation, an observable formal operation, an effect and textual evidence/provenance.

The shared contract must not require essay-only concepts such as claims or source regimes, nor fiction-only concepts such as arcs or reader state. Consumers supply their situated context.

### AuthorStyleConstellation

A longitudinal, derived view over grounded observations and explicit author declarations. It is analytical and non-executable. It must never connect directly to a writer as a global imitation profile.

### StylisticOperation

A structured writing operation with a concrete mechanism, target, rationale or trigger, intensity and intended/observed effect. It is not a prose preset.

### TransformationTrace

A provenance record that says a writer attempted a validated operation at a specific text location. A trace is a declaration, never proof that the intended effect succeeded.

### StyleEffectEvaluation

An independent evaluation of effects actually visible in written text. It may report intended effects, observed effects, unintended effects and evidence excerpts. Product-specific evaluation gates remain outside Writing Engine.

### Diffract

A shared decision-reading discipline that reads changes through the rest of a writing system: refraction, entanglements, cuts, alternatives/tradeoffs and a verdict. Diffract produces decision material. It never mutates product state or commands the writer directly.

A product supplies domain context and interprets impacts. AutoEssay may project plan/bibliography impacts; AutoFiction may project arc/reader/style impacts.

## Product-owned concepts

### AutoEssay owns

- Claim
- Source / Evidence / Citation
- ContentRelation
- ContentStyleArticulation
- argumentative and documentary evaluation
- essay-specific editorial gates

### AutoFiction owns

- Canon
- StoryState
- ReaderModel
- NarrativeArc
- SceneContract
- StoryThread
- NarrativeStyleArticulation
- NarrativeStyleState
- BookStyleContract
- fiction-specific judges and commit rules

## Style continuity principle

Long-form style continuity means continuity of writing logic, not stylistic uniformity. A book may intentionally change voice, rhythm, focalization or syntax.

Writing Engine should therefore support both:

- local stylistic variations that do not alter the long-lived style state;
- persistent stylistic transitions whose consequences are explicitly evaluated and accepted.

The product decides whether an observed change becomes persistent.

## Diffract feedback principle

Diffract must be able to consume both proposed style changes and evaluated style effects after writing. A raw `text_changed` event is insufficient when a structured style-effect evaluation exists.

The intended loop is:

```text
style proposal
  -> pre-diffract
  -> author-governed decision
  -> writer
  -> transformation trace
  -> style-effect evaluation
  -> post-diffract
  -> product decision
  -> optional product style-state transition
```

No post-diffract result becomes canonical without the product's governance and commit rules.
