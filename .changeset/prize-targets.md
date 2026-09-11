---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
"@be-in-digital/convex-schema": patch
---

Give a prize that gives something away a way to say what.

`prizes.productId` and `prizes.menuId` were declared in the schema and written
by nothing, which cost two things. The delete guards that read them —
`menus.remove`'s `menu_in_prize` and the matching refusal in `products.remove`
— could not fire outside their own tests, because no production path could put
a prize in that state. And an owner could create a « Menu offert » that named
no menu: it read « Menu offert » on the wheel, on the winning screen and on the
QR code the diner brought to the counter, where nobody could tell what had been
promised.

`PRIZE_TARGET_FIELDS` declares the rule beside the code that enforces it — the
shape `HONOURABLE_DISCOUNT_TYPES` established for promotions. A target is
required for the type that gives something away, refused for every other type,
and checked to belong to the same establishment. The admin prize form offers the
picker for exactly those two types.
