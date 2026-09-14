---
"@be-in-digital/core": patch
---

Declare the engine update feed, so it can be provisioned at all

`convex/system.ts` in both apps reads `ENGINE_RELEASE_PACKUMENT_URL` and
`ENGINE_RELEASE_REGISTRY_TOKEN` to tell an operator which engine version they
could move to. Neither key was in `envManifest` or in the Infisical scopes, and
`infisical-bootstrap.mjs migrate` refuses an out-of-spec key — so there was no
documented way to provision the feed. The Système screen reported "unconfigured"
on every deployment, and the only way to learn the names was to read the source.

Both are optional, and unset stays a real state: the screen says the feed is not
configured rather than blaming a registry. The token is separate because a public
feed needs none.

The manifest and the schema are pinned to each other by
`packages/core/src/env/__tests__` — adding a name to one and not the other is a
test failure, which is how this was caught the moment the manifest moved.
