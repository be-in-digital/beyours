---
"@be-in-digital/admin": patch
---

Let a cook open an order they are allowed to read

`kitchen` and `delivery` hold `orders:read`, so « Commandes » is drawn for them
and every row links to `/orders/[orderId]`. That page mounted
`payments.getByOrder`, which enforces `payments:read` — a permission neither role
holds. Convex rethrows a refusal out of `useQuery` during render, so it was not
an empty panel: it was an error page, on a screen the role had been invited to
open.

Hiding the block would not have fixed it — a mounted `useQuery` runs whether or
not its result is rendered — so the gate is on the query.

`usePermittedQuery` is new, and it exists because a ternary passing `"skip"`
would have fixed the behaviour and nothing else. `nav-permission-surface.test.ts`
reads SOURCE: `packages/admin` receives the Convex API as `api: any`, so no type
connects a screen to the function it calls, and a gate expressed as an argument
is invisible to it. The helper names the permission beside the call, and the
sweep reads it there.

That sweep now walks every routed page rather than only the ones a sidebar entry
points at — which is why it missed this one, `/orders/[orderId]` being reached by
clicking a row.
