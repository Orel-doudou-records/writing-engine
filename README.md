# Writing Engine

Shared writing infrastructure for Orel-doudou-records applications.

`writing-engine` hosts only primitives whose semantics are genuinely shared by multiple writing products. Domain concepts remain in their owning repositories.

Initial consumers:

- `Orel-doudou-records/auto-essay`
- `Orel-doudou-records/auto-fiction`

The first extraction candidate is Litcraft. Diffract is the second candidate once its domain-neutral contract is proven.
