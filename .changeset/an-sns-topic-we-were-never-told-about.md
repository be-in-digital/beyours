---
"@be-in-digital/convex-functions": major
"@be-in-digital/core": minor
---

Refuse an SNS notification from a topic this deployment was never told about

`isAllowedTopic` answered `true` on an empty list, and the argument for it was
that SNS delivers only to a confirmed subscription while `/webhooks/ses` refuses
to confirm one. The argument has a hole and the hole is the attack: **nothing
requires a subscription at all.** The endpoint is an HTTPS URL that takes a POST
from anyone. An attacker publishes on a topic in their own AWS account, keeps
the envelope Amazon signed for them, and replays it here — genuine signature,
certificate on an allowed host, topic check waved through — after which the
handler marks whichever subscribers the body names bounced and complained,
suppressing a client's mail to real customers.

So a deployment with no `SES_SNS_TOPIC_ARN` now refuses notifications as well as
confirmations, logging `topic_not_configured` and the ARN it saw, which is the
value to paste in. `tasks/webhook-migration-checklist.md` already required the
variable to be set before a subscription is confirmed, and the SES subscription
has not yet been repointed, so nothing in the fleet is currently relying on the
old behaviour.

`SES_SNS_ALLOW_ANY_TOPIC=true` restores it for a deployment caught
mid-configuration with a subscription an operator already confirmed. It is a
separate variable on purpose — restoring a fail-open should be an act somebody
performed — and it never re-opens subscription confirmation, which is the half
that made a forged topic self-service.
