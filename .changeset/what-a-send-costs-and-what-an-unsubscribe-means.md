---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/core": minor
---

Bound the send path's last unbounded read, count an unsubscribe, and pin the SNS topic

**`alreadySentTo` grew with how much the audience liked the campaign.** It
collected every event on the (campaign, subscriber) pair and looked for a `sent`
among them in JavaScript. That pair holds one `sent` and one `delivered` — and
one `opened` for every reopening, without limit. Asked once per subscriber in
every batch of the send, it aborted at about 410 events per subscriber per
campaign: Convex refuses a transaction past 16,384 documents, and past that the
campaign can never complete. `by_campaignId_subscriberId` becomes
`by_campaign_subscriber_type`, and the read is a `.first()` over three
equalities. It was the one send-path query absent from `queryBounds.test.ts`;
it is there now.

**`campaign.stats.unsubscribed` never counted an unsubscribe.** Its only writer
was the SES *Complaint* branch of the webhook, so the figure labelled
« Désabonnements » counted spam reports and nothing else — a campaign that cost
a restaurant forty subscribers reported zero. Attribution has to come from the
link, because that is all an unsubscribe carries: the campaign now stamps its id
into the URL it sends, `emailSubscribers.unsubscribe` charges the removal to it
(refusing a campaign belonging to another store — the value arrives in a URL the
recipient holds) and writes the `emailEvents` row that was also missing. It is
idempotent, so a mail client pre-fetching the link, a provider retrying its
RFC 8058 one-click, and a recipient clicking twice are one person leaving.

**A valid SNS signature said Amazon sent it, not that our topic did.** Every SNS
topic in every AWS account is signed by the same infrastructure, with a
certificate on the same hosts the URL check allows — and `/webhooks/ses`
confirmed any subscription whose `SubscribeURL` was on such a host, so a
stranger pointed their own topic at the endpoint and the endpoint subscribed
itself. From then on their forged bounces carried a genuine signature and
suppressed real addresses. `SES_SNS_TOPIC_ARN` now names the topic: no
subscription is auto-confirmed without it, and notifications are checked against
it when it is set. `SignatureVersion: "1"` — SHA-1 — is refused; the sender
picks the version, and the "sender" of a body that has not been authenticated
yet is whoever POSTed it. Both are written up in
`tasks/webhook-migration-checklist.md`.
