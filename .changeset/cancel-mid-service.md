---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Let an order be cancelled while the kitchen is cooking

`ORDER_STATUS_TRANSITIONS` let `cancelled` be reached from `pending` and
`confirmed` and from nowhere else. Once an order was `preparing` it could never be
cancelled — so the commonest cancellation there is, the diner who telephones while
the kitchen is cooking, could not be recorded at all. The staff's only recourse was
to COMPLETE an order that never happened: money in the takings, an invoice in a
fiscal series, a sale in the customer book, for food nobody received.

The reason the window was narrow is a good one and it is about **one kind of
order**: Deliveroo and Uber Eats refuse a cancellation once the order is being
made, so honouring it on our side alone leaves the restaurant reading « annulée »
while a rider is still coming. The table is global and cannot express that, so the
constraint moved to `orders.updateStatus`, which has `order.source`.

`preparing`, `ready` and `out_for_delivery` can now reach `cancelled`, and the
admin offers « Annuler la commande » on all three. A marketplace order is refused
there with a sentence naming the platform's own dashboard — offered and explained
rather than hidden, so an operator is not left wondering why an order they can see
cannot be cancelled.

`delivered` and `completed` still cannot be cancelled: the diner has the food, and
money comes back through `payments.refundPayment`, which calls the provider.

The consequences of the wider window were checked rather than assumed. The stock
restore and the coupon release stay once-only — `cancelled` still has no outgoing
transition, so an order can only enter it once — and the kitchen ticket leaves the
pass, which is the whole point from the kitchen's side.
