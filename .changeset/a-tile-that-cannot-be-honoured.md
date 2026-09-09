---
"@be-in-digital/restaurant": minor
"@be-in-digital/convex-functions": minor
---

Withhold a payment tile the order cannot use, and record a routing refusal

`isPaymentMethodSelectable` knew whether the establishment offers cards and
whether it can charge one. It did not know what the order costs — and below a
provider's floor there is no card payment to be had however well the deployment
is configured, while at zero there is no payment at all. The tile was offered,
the diner chose it, and the refusal arrived from inside Stripe as a redacted
"Server Error" on an order no retry could settle.

`PaymentMethodContext` gains `amountDue` and `cardMinimum`, both optional so a
caller that has not priced the basket keeps today's behaviour exactly — greying
every tile while a delivery quote lands would be worse than the defect. Card and
PayPal are withheld below the floor; an order that owes nothing is a fourth
state (`nothingIsDue`) where the cash branch — the one that places the order
without calling a provider — is offered whatever the cash settings say, so a
free order does not become uncompletable.

Alongside it, `assertChargeableOnPlatform` now records its refusal.
`resolveStripeCharge` throws before any call to Stripe, so the credentials
verdict `createCheckoutSession` writes on a refused key is never reached —
correctly, since nothing has asked Stripe anything, but the consequence was that
a deployment turning every diner away for a routing reason left no trace
anywhere. It writes a `payment_collection_refused` line through
`recordRefusedCollection`. `paymentAvailability` already greys the tile from the
same rule; a new test drives both over every status the schema declares, so the
two cannot drift.
