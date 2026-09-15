---
"@be-in-digital/convex-functions": patch
"@be-in-digital/admin": patch
"@be-in-digital/restaurant": patch
---

Four places where a failure or a limit was invisible to the person it affected.

`recordOrderStatusChange` promised "Never throws" and wrapped only the identity
lookup; the insert sat outside the try, in the caller's transaction, so a failed
audit line took the order's status change with it. It is inside now.

The unmatched-import panel rendered nothing for both "still loading" and
"nothing to resolve", which mean opposite things on a screen an owner opens
right after an import. The unresolved state now says it is still counting; the
clean one stays silent.

« Taux de retour » read 2,000 customer rows and said nothing when it stopped
there, so an establishment with more distinct diners than that in the period
read a rate over an arbitrary slice of its book. `DashboardDiners` carries its
own `truncated` — the orders read beside it has its own, and a period can
exhaust either cap alone — and the card qualifies the figure when it is set.

A refused card payment told every diner « Choisissez un autre moyen de
paiement », including on a delivery order at an establishment that takes neither
cash nor PayPal, where card is the only tile on the page. `cardUnavailableMessage`
decides the second sentence from the same context the tiles were rendered from.
