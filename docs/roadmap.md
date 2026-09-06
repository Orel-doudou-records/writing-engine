# Roadmap

## Phase 0: repository foundation

- [x] establish shared-engine boundary;
- [x] pin Matt Skills and Ponytail as engineering guardrails;
- [x] define Litcraft as the first shared extraction;
- [x] record Diffract as the second shared extraction;
- [x] write the initial Litcraft extraction spec.

## Phase 1: Litcraft extraction

1. verify current AutoEssay Litcraft contracts and tests on its integration/default implementation branch;
2. implement the smallest domain-neutral Litcraft module in Writing Engine;
3. add behavior-parity tests;
4. add a thin AutoEssay adapter;
5. switch AutoEssay to the shared module without changing product behavior;
6. validate existing AutoEssay demonstrators/evaluations;
7. consume the same shared primitives from AutoFiction.

## Phase 2: long-form style continuity in AutoFiction

Owned by AutoFiction, using shared Litcraft primitives:

- `BookStyleContract`;
- `NarrativeStyleState`;
- local versus persistent style transitions;
- `NarrativeStyleArticulation`;
- style-effect feedback into narrative decision making.

These remain outside Writing Engine unless a second consumer later proves identical semantics.

## Phase 3: Diffract core extraction

After Litcraft is consumed by both products:

1. isolate the domain-neutral four-pass/cut/tradeoff discipline from AutoEssay;
2. define generic change/effect inputs;
3. keep essay and fiction context projectors in their products;
4. support pre-writing and post-writing diffractive readings;
5. accept structured Litcraft effect evaluations as post-writing inputs;
6. preserve author/product governance: readings never mutate consumer state directly.

## Deferred until proven

- package splitting such as `@writing-engine/core`, `@writing-engine/litcraft`, `@writing-engine/diffract`;
- shared persistence service;
- event bus;
- vector or graph database;
- plugin framework;
- generic manuscript orchestration beyond actual two-consumer needs.
