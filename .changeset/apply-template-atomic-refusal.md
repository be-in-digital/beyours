---
"@be-in-digital/convex-functions": patch
---

No behaviour change in this package: the coupon-budget refusal in
`resolvePromotionDiscount` is now held by tests.

#532 measured that deleting the `exhausted` branch left all 38 cases of
`promotionDiscount.test.ts` green — every other guard there is about who may use
a code and when, and none of them counts. Six cases now pin both sources of the
verdict (the public lookup's flag, the server's counters) and the precedence
between them, so both inversions fail.

The same change fixes `pnpm template:apply`, which half-applied a template it was
about to refuse: the existence check sat inside the copy loop, so a template
missing its last source had already had `theme.css` and `fonts.ts` written over
it before the throw. That fix lives in `apps/themes`, which this repository does
not version, so it carries no release note of its own.
