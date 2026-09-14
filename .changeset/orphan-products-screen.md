---
"@be-in-digital/admin": minor
---

Show the imported dishes that matched nothing, and let the owner resolve them

`orphanProducts` exists because a menu import from Uber Eats or Deliveroo leaves
items with no counterpart in the catalogue — a dish renamed on the platform, a
new one added there, a modifier no product covers. The table has five functions
for handling them. Only `match` was ever wrapped as a Convex function, and
nothing in the admin called it.

So every import wrote rows nobody could read. An owner whose platform menu had
drifted from their own carte had no way to see the drift, no way to fix it, and
no way to clear the backlog; the rows accumulated, invisible, for as long as the
integration ran.

The store's Integrations tab now carries the unresolved list: each item with the
platform it came from and its price there, a picker over the establishment's own
active products, and two outcomes. **Rattacher** binds it to a dish.
**Mettre de côté** records that a human looked and decided — a platform carries
combos and discontinued dishes this establishment does not sell here, and forcing
every row to be matched would put a wrong product in the catalogue. Ignored rows
are kept rather than deleted, so the next import does not present them as new.

Matching is disabled until a dish is chosen. The panel renders nothing when there
is nothing to resolve, which is the ordinary state.

Server side, `listPending` and `ignore` gain wrappers under `products:read` and
`products:write`: what this lists is the establishment's own catalogue seen from
the outside, so the person who resolves an unmatched dish is whoever maintains
the menu. `match` already refused a product belonging to another establishment;
that refusal now has a test, along with the seek in `listPending` that keeps one
establishment's unmatched dishes off another's screen.

## The connection itself

`uberEatsConnections.getStatus` was written to be the admin's view of the
merchant connection — its docblock says "safe metadata for the admin UI" — and
it had no Convex wrapper and no caller. Neither did `disconnect`. An owner who
completed the OAuth consent had no way to tell whether it had taken, and no way
to end it: the only evidence a connection existed was a menu sync succeeding or
failing, after the fact.

Both now have wrappers, under `settings:read` and `settings:write` to match
`storeIntegrations` — the row is one connection for the whole deployment, with no
store to scope a guard against — and the Integrations tab carries a card above
the per-store ones stating which it is.

The one thing the card tells an owner that they could not work out for
themselves: `status` is written at the moment of the token exchange and never
revised, so a row keeps saying `connected` over an access token that has since
expired. With a refresh token the next sync renews it and the card says nothing;
without one, nothing will, and the card asks for a fresh consent instead of
showing a green badge over a dead credential.

Encrypted tokens are still never returned to the client — the handler was always
metadata-only, and the wrapper does not widen it.
