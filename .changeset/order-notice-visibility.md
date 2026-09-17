---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Tell the owner when a transactional notice did not reach the diner (#530).

`readyEmailAt` and `confirmationEmailAt` are given back when a send fails, so a
later legitimate transition can still write — but nobody was told, and an outage
looked exactly like a delivered mail from the admin. The order now records WHY
the last dispatch gave up, and the order detail screen says so.

`reason` is a closed set of two, both decided at the call site rather than
inferred from the exception: `no_sender_address` is a configuration gap the
owner can close, `transport` is the provider failing. Nothing classifies an
error to choose between them. The send path deliberately does not sort failures
into transient and permanent, and a field that exists to be displayed must not
reintroduce that.

Only the sites where something actually failed record one. A claim released
because the order was cancelled or deleted between the claim and the send passes
nothing: reporting a failed notice on an order that no longer exists would be
worse than silence.
