---
"@be-in-digital/restaurant": patch
---

Read the storefront's opening hours on the same clock the order path uses

`useStoreStatus` computes two answers from one moment and says so — "Both
answers off one reading of the clock, so they cannot describe two different
moments" — but they came from two functions that fell back differently.
`openNow` goes through `isWithinBusinessHours` → `restaurantClock`;
`hoursStatus` goes through `isStoreOpen` → `readingFrame`. Given no
`globalSettings.timezone`, the first read the server's clock and the second read
the visitor's.

`globalSettings` is a singleton nothing seeds, so "no timezone" is not an
unusual caller: it is every deployment whose settings have never been saved. On
those, one screen showed "Ouvert" decided in one zone beside "ferme à 02:00"
computed in another, and the order was then refused by a mutation reading a
third.

`readingFrame` now falls back to `DEFAULT_RESTAURANT_TIMEZONE`, the same
constant `restaurantClock` uses for the same absence — including for a zone
`Intl` refuses, which used to drop to the visitor's clock. The visitor's clock
survives only where even the default cannot be read.

`store-service.test.ts` now says which clock each case means. Its date literals
carry no offset, so they are parsed in the environment's zone; a zone-less
`isStoreOpen` read them on that same clock and the two cancelled, which is what
made those cases true in any runner. Left bare they would have become cases
about Paris, so the ones about midnight arithmetic pin the reading frame to the
zone their own literals are written in, and the ones about zones were already
explicit.
