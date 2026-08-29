---
"@be-in-digital/restaurant": minor
---

A service that crosses midnight is open.

`isStoreOpen` compared `"HH:mm"` strings with no wrap: `now >= open && now <
close`. For an 18:00–02:00 restaurant that is false at 23:00 (`"23:00" <
"02:00"`) and false at 01:00 (`"01:00" >= "18:00"`), so it read as closed all
evening, every evening. `09:00–00:00` read as closed at every hour of the day.
The boolean disables add-to-cart on every product card and blocks checkout, so
the shipped `fast-food-minuit` vertical and the food-truck templates could not
take a single order.

`close <= open` now means the service ends on the next calendar day, and the
*previous* day's row is read first: at 01:00 on Saturday the service still
running was declared on Friday. Saturday's own row cannot answer for it —
Saturday opens at 18:00, and Saturday may be closed altogether.

`nextChange` follows: a service that opened at 18:00 closes at 02:00 tomorrow,
not at 02:00 today.

Neither hours editor gained a `close > open` check. Typing 02:00 into a closing
field is a legitimate thing for an owner to do; the reading was wrong, not the
writing.
