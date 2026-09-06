# Domain documentation

Writing Engine uses a single-context domain layout.

Before architectural work, agents must read:

1. `CONTEXT.md` for current shared vocabulary and boundaries;
2. relevant accepted ADRs under `docs/adr/`;
3. the active spec under `docs/specs/` when implementing a defined feature.

`CONTEXT.md` is the operational map. ADRs preserve hard-to-reverse decisions and their rationale. Specs describe buildable behavior and acceptance criteria.

Consumer repositories remain primary sources for their product-domain semantics. Writing Engine documentation must not silently redefine AutoEssay or AutoFiction concepts.
