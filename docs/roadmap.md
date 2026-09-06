# Roadmap

## Phase 0: repository foundation

- [x] establish shared-engine boundary;
- [x] pin Matt Skills and Ponytail as engineering guardrails;
- [x] define Litcraft as shared writing infrastructure;
- [x] record Diffract as a shared domain-neutral decision-reading core;
- [x] write the initial Litcraft extraction spec;
- [x] specify the minimal Diffract core.

## Phase 1: minimal Diffract foundation

- [x] implement the domain-neutral four-pass/cut/tradeoff discipline;
- [x] expose generic `{kind,id}` references and consumer-projected context blocks;
- [x] validate context before reasoning and reject invented impact identifiers after reasoning;
- [x] keep reading artifacts immutable and non-executable;
- [x] validate with deterministic fake-client tests and CI;
- [x] leave AutoEssay and AutoFiction adapters for their owning repositories.

This phase does not require Litcraft and does not implement style-state feedback by itself.

## Phase 2: Litcraft extraction

1. verify current AutoEssay Litcraft contracts and tests on its integration/default implementation branch;
2. implement the smallest domain-neutral Litcraft module in Writing Engine;
3. add behavior-parity tests;
4. add a thin AutoEssay adapter;
5. switch AutoEssay to the shared module without changing product behavior;
6. validate existing AutoEssay demonstrators/evaluations;
7. consume the same shared primitives from AutoFiction.

## Phase 3: long-form style continuity in AutoFiction

Owned by AutoFiction, using shared Litcraft primitives:

- `BookStyleContract`;
- `NarrativeStyleState`;
- local versus persistent style transitions;
- `NarrativeStyleArticulation`;
- style-effect feedback into narrative decision making.

These remain outside Writing Engine unless a second consumer later proves identical semantics.

## Phase 4: post-writing Diffract integration

After Litcraft exposes shared style-effect evaluations:

1. project evaluated style effects into generic Diffract context blocks;
2. support post-writing re-diffraction of intended, observed and unintended effects;
3. keep essay-specific plan/bibliography interpretations in AutoEssay;
4. keep fiction-specific arc/reader/style interpretations in AutoFiction;
5. preserve author/product governance: readings never mutate consumer state directly;
6. add automatic semantic triggers only if a real consumer workflow proves them necessary.

## Deferred until proven

- package splitting such as `@writing-engine/core`, `@writing-engine/litcraft`, `@writing-engine/diffract`;
- shared persistence service;
- event bus;
- vector or graph database;
- plugin framework;
- generic manuscript orchestration beyond actual two-consumer needs.
