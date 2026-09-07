# Ponytail design constraint

Ponytail is used here as a design constraint for shared primitives.

Before adding code:

1. Understand the problem end to end.
2. Reuse what already exists in this repository.
3. Prefer the platform and existing dependencies over new machinery.
4. Add no abstraction before a real second use requires it.
5. Prefer the smallest correct change.
6. Preserve trust boundaries, correctness, provenance, and explicit product constraints.
7. Leave one minimal runnable check for non-trivial logic.

For Lunette Ronde specifically:

- diagnose the cause, not the surface symptom;
- preserve meaning, facts, degree of certainty, citations, and author voice;
- prefer a precise open question over an invented correction;
- allow `keep` as a valid result;
- do not turn observable prose patterns into claims about AI authorship;
- do not add a rule engine, registry, plugin layer, persistence layer, or product-specific policy until real consumers prove identical semantics.

This document is a repository-local design rule. Ponytail does not become a runtime dependency of Writing Engine.
