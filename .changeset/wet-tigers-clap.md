---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Build the customer book, and give the Clients screen something to show

`/dashboard/customers` rendered a "coming soon" placeholder while the sales
page, the guided tour and the nav all pointed at it. The data was collected
four times over and grouped nowhere: one row per order in
`orders.customerInfo`, a second aggregate on `emailSubscribers.metadata` that
only covers people who opted into marketing, `gamePlays` for players and
`userProfiles` for account holders — and nothing at all for the diner who
ordered twice and subscribed to nothing.

A new `customers` table holds one row per person per establishment, keyed on
the lower-cased e-mail, maintained on the same order transitions as the
subscriber metadata: `recordOrder` on confirmation, `reverseOrder` on
cancellation. It is a trade record, not a marketing list — `emailSubscribers`
stays the only thing consent is read from.

The screen lists them with their order count, total spend, average basket and
last visit, sorts by recency or spend, opens one person's recent orders, and
exports the loaded page as CSV. Orders with no e-mail address are not people
here, so the screen states how many of them there are rather than quietly
leaving them out of every total.

Also in this change, because the book has to agree with the orders behind it:

- `customerEmailKey` is stamped on the order at the confirmation transition
  rather than only at creation, so an order inserted by any other path still
  has the key the detail view looks it up by.
- The backfill migration empties the book before it accumulates. The
  accumulation is incremental, so re-running an interrupted migration over a
  book it had already half-built would have doubled the totals it had reached.
- `customers` is registered in the store cascade, the erasure set and the
  backup classification — a table of names, e-mail addresses and phone numbers
  is personal data, and the erasure deletes those rows outright.
