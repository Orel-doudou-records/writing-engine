# Spec 0002: Minimal Diffract Core

## Status

Implementation in progress.

## Goal

Provide the smallest domain-neutral Diffract engine that AutoEssay and AutoFiction can both consume without importing one another's domain concepts.

The core reads one proposed change through consumer-projected context and returns a structured, immutable reading artifact. It produces decision material only. It never mutates product state and never commands a writer directly.

## Shared inputs

A consumer supplies:

- one `DiffractiveFragment` containing a statement and optional generic references;
- one or more `ContextBlock` values, each with a generic reference, label and text projection;
- optional existing cuts already accepted by product/author governance.

The core does not know whether a reference points to a claim, source, scene, arc, reader state, style effect, plan entry or other product object.

## Four passes

### Pass 1: refraction

Read the fragment through the supplied context. Record what becomes different or newly visible when the proposed change is placed here.

An empty result is valid when there is no honest non-obvious refraction.

### Pass 2: defaults and patterns

Read the context back through the fragment. Name patterns and defaults that the proposal reveals as choices rather than neutral background.

A prior cut may be recorded when known.

### Pass 3: entanglements

Identify at most four meaningful entanglements. Each names:

- the entanglement;
- the cut created if integrated;
- what becomes intelligible;
- what becomes unintelligible.

Empty is preferable to fabricated insight.

### Pass 4: cut

Name an explicit cut:

- included;
- excluded;
- what non-adoption would itself exclude.

The cut is decision material, not a state mutation.

## Verdict discipline

The shared verdict vocabulary remains compatible with AutoEssay's current Diffract semantics:

- `integrate_now`
- `adapt_differently`
- `incubate`
- `archive`
- `discard`

A reading also contains:

- concise verdict detail;
- a non-executable recommended action;
- optional tradeoff paths;
- optional generic impacts targeted only at references supplied by the consumer.

## Generic impacts

An impact contains only:

```ts
{
  target: { kind: string; id: string };
  impact: string;
}
```

Consumers interpret impacts themselves. The core rejects an impact aimed at an identifier not present in the request.

## Structured model seam

The only model dependency is:

```ts
interface StructuredJsonClient {
  generateJson(prompt: string): Promise<unknown>;
}
```

No provider, retry policy, persistence system or workflow framework belongs in the minimal core.

## Prompt rules

The shared prompt must require:

- the four passes;
- explicit composition with existing cuts;
- no invented identifiers;
- empty arrays instead of synthetic insight;
- a forced verdict rather than `it depends`;
- a tradeoff path that considers doing nothing and a path that adapts the proposal differently;
- structured findings only, never hidden chain-of-thought.

## Validation

Before model invocation:

- the fragment statement must be non-empty;
- at least one context block is required;
- context references must be unique.

After model invocation:

- output must satisfy the shared schema;
- entanglements are capped at four;
- every impact target must have been supplied by the request.

## Non-goals

This version does not implement:

- AutoEssay plan or bibliography impacts;
- AutoFiction arc, reader or style-state projectors;
- automatic triggers or worker queues;
- post-Diffract state commits;
- Litcraft extraction;
- graph/vector databases;
- persistence;
- provider adapters;
- batch execution;
- a plugin architecture.

## Compatibility

AutoEssay can later adapt:

- `claimIds` and `sourceIds` to generic fragment references;
- book parts, plan entries and source projections to context blocks;
- plan/bibliography impacts to consumer-specific interpretation of generic impacts or a thin adapter layer.

AutoFiction can project scenes, arcs, reader state, story state and evaluated style effects into the same core contract.

## Acceptance criteria

- Writing Engine contains a runnable TypeScript Diffract core with no imports from AutoEssay or AutoFiction.
- The core accepts consumer-projected context and existing cuts.
- The output contains the four passes, cut, verdict, tradeoffs and generic impacts.
- Duplicate context references fail before model invocation.
- Invented impact targets fail after model output validation.
- Empty Pass 1/2/3 findings remain valid.
- No code mutates consumer state.
- Tests use a deterministic fake structured client; no network/model provider is required.

## Ponytail check

One reader, one schema family, one generic reference type, one model-client interface. No registry, event bus, plugin system, database or extra package split.
