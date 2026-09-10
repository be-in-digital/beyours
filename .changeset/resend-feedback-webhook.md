---
"@be-in-digital/convex-functions": minor
"@be-in-digital/core": minor
---

Give a Resend deployment a feedback path.

`EMAIL_PROVIDER=resend` is the escape hatch for a client whose AWS SES
production-access request was refused. That deployment shipped with
`/webhooks/ses` as the only feedback endpoint in the app, and SNS never calls
it, so nothing suppressed a dead address, nothing recorded a spam report, and
`delivered` read 0 for ever. The first symptom available to anybody was the
sending domain being throttled.

- `convex-functions` gains `./resendSignature`: the Svix scheme's testable
  half — which headers carry the signature, exactly which bytes are signed,
  how old a message may be, and which Resend event maps onto which of ours.
- `core` declares `RESEND_WEBHOOK_SECRET`. The route refuses every delivery
  while it is unset rather than acting on an unverified body, because that
  body names the subscriber to suppress.
