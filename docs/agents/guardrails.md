# Engineering guardrails

Writing Engine pins two upstream guardrails as Git submodules under `.guardrails/`.

## Matt Pocock skills

- upstream: `https://github.com/mattpocock/skills`
- pinned commit: `3cca18b368ae95cdbdebbff572ccafa662551015`
- local path: `.guardrails/matt-skills`

Use `skills/engineering/ask-matt/SKILL.md` as the workflow router. For this repository, the initial bootstrap follows the documented greenfield/setup path but does not repeat decisions already settled in the originating design thread.

## Ponytail

- upstream: `https://github.com/DietrichGebert/ponytail`
- pinned commit: `974d940a1c5344210874150b98ff0d2c861fab6a`
- local path: `.guardrails/ponytail`

Apply Ponytail as a simplicity guard before implementation and review. Prefer, in order, existing behavior, standard/platform capabilities, already-adopted dependencies, then the minimum new mechanism required.

Simplicity does not justify removing validation, provenance, author governance, transactional safety, security or accessibility.

## Local rule

The guardrails guide engineering decisions but are not runtime dependencies of Writing Engine.

Do not copy or fork their source into this repository. Update pins deliberately through a dedicated change so guardrail changes remain reviewable.
