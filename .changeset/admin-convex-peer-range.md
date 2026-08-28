---
"@be-in-digital/admin": minor
---

`convex` peer narrowed from `>=1.0.0` to `^1.44.0`.

`>=1.0.0` was not a considered range, it was an absent one: it claims this
package works against Convex 1.0 and every version since, including a future
2.x, none of which is built or tested. The package uses `useQuery`,
`useMutation` and `useAction` from `convex/react` and nothing else, so the range
now states what it is actually shipped and exercised against.

**This does not prevent the duplicate-copy failure**, and it should not be read
as doing so. That was measured rather than assumed: with `apps/reference` put
back on 1.31.7, `packages/admin` still resolves to 1.44.0 while the app resolves
to 1.31.7 — the exact configuration that produced *"Could not find Convex
client! useQuery must be used in the React component tree under
ConvexProvider"*. pnpm satisfies a peer from any copy it can find, so narrowing
which copies qualify does not stop it finding a different one from the app's.
Adding `strict-peer-dependencies=true` did not change the outcome either; the
install still succeeded, so that setting was not kept.

What prevents it is every manifest in the monorepo declaring the same exact
`convex`, which is already the case. This change makes the declaration honest,
and gives consumers on npm or yarn — which do fail loudly on an unmet peer,
unlike pnpm here — a true statement to fail against.

No consumer is excluded: the boilerplate and both apps are on 1.44.0.
