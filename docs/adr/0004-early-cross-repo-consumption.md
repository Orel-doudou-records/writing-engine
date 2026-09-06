# ADR-0004: Early consumers use a pinned Git dependency

## Status

Accepted as a temporary migration strategy.

## Context

Writing Engine now has two real consumers but is not yet a published package. AutoEssay needs to exercise the shared Litcraft contracts before a permanent distribution system is justified.

The repository is a TypeScript package whose runtime entry points live under `dist/`. npm supports dependencies pinned to a Git commit. For Git dependencies with a `prepare` script, npm installs the dependency's development dependencies, runs the preparation step, then packs and installs the result.

The repository also contains Matt Skills and Ponytail as Git submodules. npm Git dependencies clone repository submodules, so this path has avoidable install-time overhead. That cost is accepted only for the early compatibility phase.

## Decision

For the first AutoEssay compatibility migration:

1. Writing Engine adds the minimum `prepare` build hook needed to make its TypeScript package consumable directly from Git.
2. AutoEssay depends on Writing Engine through a GitHub dependency pinned to an exact Writing Engine commit.
3. The consumer lockfile records the resolved commit.
4. No automatic floating reference to `main` is allowed.
5. No registry, publishing credentials, release automation or package-hosting service is introduced yet.

This is a bridge, not the final release architecture.

## Upgrade rule

Revisit package publication when at least one of these becomes true:

- more than two repositories consume Writing Engine regularly;
- install-time Git/submodule overhead becomes material;
- consumers need semantic-version ranges rather than exact commit pins;
- external users need a stable install surface;
- release notes, provenance or independent package versioning become operational requirements.

At that point, prefer a standard package registry over inventing a custom artifact service.

## Consequences

- AutoEssay can test the real shared package without copying source or introducing a monorepo.
- Early migrations remain reproducible because every consumer pins an exact commit.
- Updating Writing Engine is an explicit consumer change rather than an implicit pull from `main`.
- Git installs temporarily clone the guardrail submodules as part of dependency preparation.
- The repository remains `private: true` in npm terms, which prevents accidental registry publication but does not define the Git consumption strategy.

## Ponytail challenge

### Registry now

Rejected for the migration phase. It requires package naming, publication credentials and release automation before the two consumers have proven the shared API.

### Git submodule inside each consumer

Rejected. It adds checkout/setup rules and a local-file dependency path to every consumer while still requiring a build step.

### Copy shared files into AutoEssay

Rejected. It creates immediate drift and defeats the purpose of the shared repository.

### Floating Git dependency

Rejected. `main` would make consumer installs non-reproducible.

The pinned Git dependency is the smallest reversible bridge that exercises the actual package boundary.