# AGENTS.md

## Project orientation

Writing Engine is the shared writing-infrastructure repository for products such as AutoEssay and AutoFiction. Before changing architecture or shared contracts, read `CONTEXT.md` and the relevant ADRs under `docs/adr/`.

## Agent skills

### Issue tracker

Work is tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Domain docs

This repository uses a single-context domain layout: `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Guardrails

- Use `.guardrails/matt-skills/skills/engineering/ask-matt/SKILL.md` to select the engineering workflow when work is not already well scoped.
- Use Matt's writing-for-agents guidance when editing agent-facing documentation.
- Apply Ponytail before implementation: prefer reuse, platform capabilities and the smallest sufficient change. Simplicity must not remove validation, provenance, author governance, data-integrity guards or transactional safety.
- A primitive enters Writing Engine only after at least two real consumers need the same semantics.
- Extraction must preserve consumer behavior before introducing improvements.
- Domain-specific concepts stay in their owning repositories.

See `docs/agents/guardrails.md` for pinned upstream sources and usage rules.

## Repository boundary

Writing Engine may own shared execution and writing primitives. It must not own `Claim`, `Evidence`, `Citation`, `ContentRelation`, `NarrativeArc`, `SceneContract`, `ReaderModel`, `StoryState` or other product-domain objects.

The first shared extraction is Litcraft. Diffract follows only through a domain-neutral core contract, while essay-specific and fiction-specific projections remain in their respective repositories.
