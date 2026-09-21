# ADR-0005: Incubating capabilities are opt-in per consumer project

## Status

Accepted on 2026-09-21.

## Context

Writing Engine normally requires two real consumers before treating a primitive as shared. The optional translation process has a reviewed, domain-neutral implementation but has not yet demonstrated two production adopters. The owner nevertheless wants the capability available in the engine while allowing every consumer project to activate it or ignore it independently.

## Decision

An owner-approved incubating capability may be merged into Writing Engine before the two-consumer threshold only when all of these conditions hold:

1. Importing or upgrading Writing Engine performs no capability work automatically.
2. A consumer must explicitly invoke the public API.
3. Policy, authorization, persistence, interface and external providers remain consumer-owned.
4. Existing consumers require no configuration or migration.
5. Documentation labels the capability as incubating until two real adopters prove shared semantics.

The translation process satisfies these conditions. There is no global engine switch: activation is the presence of an explicit consumer workflow that calls and persists the translation operations.

## Consequences

- Different projects can pin the same engine commit while choosing independently whether to expose translation.
- Writing Engine does not silently translate, detect language, select a provider or mutate a project.
- Availability in `main` does not claim production adoption or stable shared status.
- Consumer integrations remain separately specified, reviewed and tested.
- If translation later proves product-specific or its semantics diverge, the incubating API may change or be removed before promotion.
