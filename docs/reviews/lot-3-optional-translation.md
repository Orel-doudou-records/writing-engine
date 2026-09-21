# Lot 3 — optional translation review

Date: 2026-09-19. Baseline: `36a3bcd04381890d3a4cd738832b1a278b786fb0`. Implementation reviewed: `98331c4` (`feat: add opt-in translation process over collaborative core`). Two independent review agents inspected the diff; the implementation agent ran the checks below.

## Owner decision after review

On 2026-09-21 the owner authorized merging the capability into Writing Engine with one explicit condition: activation remains optional per consumer project. ADR 0005 records this incubating status. The code reviewed below already satisfies the condition because it performs no work, persistence or branch advance until a consumer calls its functions and persists returned values.

## Standards

No blocking correction identified for a draft proposal. Shared semantics, existing CC1 lifecycle, per-node contribution permissions, revision-aware source provenance and conflict-aware integration are preserved. No product-domain types, fixed language pair, mandatory business role or provider enter the module. ADR 0004 distribution remains unchanged.

The initial review identified the two-real-consumer rule as an adoption blocker. The later owner decision permits merge as a dormant incubating capability, not promotion to a proven shared primitive. Tests and examples remain contract demonstrations.

No smell-driven refactor requested. The local recursive freeze helper follows existing repository practice; extracting a cross-module abstraction is not justified by this change.

## Spec

No missing/partial requirement, scope creep or functional blocker identified. The process is explicitly invoked and language-configurable, accepts human/agent text under project policy, preserves source provenance, starts new review after source movement and reports only accepted units during partial integration. Persistence and trusted authorization belong to consumers, as specified.

One P3 documentation finding: source-head movement produces `stale` before the function checks for missing pinned snapshots/content. The guide now states that precedence explicitly. This is a documentation correction, with no implementation change after the independent reviews.

Findings: Standards 0 code corrections; Spec 1 minor documentation finding, corrected. The owner’s later opt-in merge decision changes status, not the reviewed implementation.

## Validation

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm test`: 14 files, 93 tests passed, including 37 translation tests.
- `node examples/optional-translation.mjs`: no translation requested or executed.
- `node examples/optional-translation.mjs --translate`: supplied Portuguese-to-Arabic text passes preparation, contribution, review and integration; the original branch remains unchanged.
- `git diff --check`: passed.

Environment: Node 24.19.0, TypeScript 5.9.3, Vitest 1.6.1, Zod 3.25.76. These were installed within the repository's existing declared ranges. No package/dependency or distribution change was made.

No live provider, production database transaction, deployment or real-consumer integration was exercised. The in-memory adapter does not prove transactional behavior of a future self-hosted deployment. Canonical integration authorization and atomic source validation plus destination persistence remain application responsibilities.
