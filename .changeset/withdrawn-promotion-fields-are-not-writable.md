---
"@be-in-digital/convex-functions": patch
"@be-in-digital/convex-schema": patch
"@be-in-digital/admin": patch
---

Stop `promotions.create` and `promotions.update` accepting the configuration of a withdrawn offer type

#403 withdrew « Produit offert » and « Offre BOGO » as discount **types** — both
alter the item list rather than the order total and no code path builds those
items, so `assertHonourableDiscountType` refuses them on create and on update,
and the promotion form stopped offering them. It left their five configuration
fields on both args validators: `freeProductId`, `bogoTriggerProductId`,
`bogoRewardProductId`, `bogoTriggerQuantity`, `bogoRewardQuantity`. Both
handlers spread `args` straight into the row, so all five went on reaching the
database unexamined for another five commits.

**One of them was live.** `products.remove` reads the first three to refuse
deleting a dish a promotion still points at. Measured against the real
mutations: a plain `percentage` promotion given a `freeProductId` made that dish
**undeletable**, and the refusal named a promotion that used the product in no
way the owner could find — the field is on no form, and `update` has no way to
clear an optional field, only to overwrite it with another product. There was no
route back short of deleting the promotion.

The five are gone from both validators. That is the whole guard: a Convex
mutation refuses an argument no validator declares — `Validator error:
Unexpected field \`freeProductId\` in object` — which the tests measure rather
than assume. `discountTypeValidator` keeps all five **literals** deliberately:
`update` reads `existing.discountType` to refuse an edit that would keep a
withdrawn type, and that refusal is a French sentence an owner can act on. A
narrowed union would turn it into an untranslated validator error.

**The schema keeps the five as `v.optional`**, because rows written before the
withdrawal still hold them — the treatment `stores.integrations` already has.
The comments there described a feature that cannot be created ("for discountType
=== \"free_product\"", "BOGO fields"); they now say that nothing writes these,
that one thing reads three of them, and what implementing `bogo` would take.
`WITHDRAWN_PROMOTION_CONFIG_FIELDS` lives in `promotionDiscount.ts` next to the
withdrawal itself, so the args that must refuse them, the delete guard that
still reads them and the tests that hold both name one list.

**The delete refusal now names an action that exists.** The guard still blocks —
a legacy row pointing at a deleted dish is the dangling reference it was written
to stop — but « Modifiez ou supprimez cette promotion » was half an instruction
nobody could follow. The two references are told apart: `targetProductIds` is
the promotion's product scope, which the form renders and the owner can unpick,
and keeps that sentence; the three withdrawn fields get their own, saying that
the reference is not on the promotion form and cannot be removed there, and that
deleting the promotion is what frees the dish. Deactivating does not clear it,
so the message does not suggest it.

`promotion-discount-types.test.ts` asserted the form source held no
`bogoTriggerQuantity` and no `bogoRewardQuantity`, and nothing at all about the
server — which is exactly how the server half survived the #403 cleanup. It now
covers all five names on both ends, against the validator objects rather than a
source scan.
