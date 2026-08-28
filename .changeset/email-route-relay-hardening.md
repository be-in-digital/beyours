---
"@be-in-digital/core": minor
---

Harden `POST /api/email/send` so the body cannot choose where a link points.

This route sends from the restaurant's SES-verified domain, so anything it will
put in front of a recipient is signed by the client's own brand. Three things
were wrong with that:

- **Links came from the request body, unchecked.** `resetLink` and
  `dashboardLink` were validated by `z.string().url()`, which is as happy with
  `https://evil.example/harvest` as with the real thing. Verified against the
  pre-fix handler: it returned 200 and the attacker's host was in the rendered
  "Reset my password" button. Both links are now required to share an origin
  with `linkOrigin` (normally `SITE_URL`), falling back to the request's own
  origin when the config omits it.
- **An unusable secret weakened the route instead of closing it.**
  `timingSafeEqual` over two EMPTY buffers returns `true`, so a secret of `''`
  matched an empty token. A secret under `MIN_EMAIL_API_SECRET_BYTES` (32) now
  disables the route: every request gets 503 and a log naming what to set,
  rather than an authentication check that can be satisfied by nothing. The
  comparison also digests both operands first, so it no longer returns early on
  a length mismatch — which leaked the secret's length.
- **The mail relay shared the session-signing key.** `EMAIL_API_SECRET` is now
  read and declared, with `BETTER_AUTH_SECRET` kept as a transitional fallback
  on both the route and the caller so existing deployments keep sending. Set it
  on the Next env *and* the Convex deployment — they are two halves of one
  handshake.

`EmailRouteConfig` gains an optional `linkOrigin`. Callers that pass nothing
keep working and get the request-origin behaviour.
