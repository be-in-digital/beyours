# Convex API Reference

> Complete reference for all Convex backend functions.

## Table of Contents

- [Stores](#stores)
- [Products](#products)
- [Orders](#orders)
- [Kitchen](#kitchen)
- [Team](#team)
- [Games & Gamification](#games--gamification)
- [Languages & Translations](#languages--translations)
- [Email Campaigns](#email-campaigns)
- [CMS](#cms)
- [AI](#ai)

## Stores

### `api.stores.list`

List all stores for the current owner.

```typescript
const stores = useQuery(api.stores.list, { ownerId });
```

### `api.stores.get`

Get a single store by ID.

```typescript
const store = useQuery(api.stores.get, { storeId });
```

### `api.stores.create`

Create a new store.

```typescript
const storeId = await createStore({
  name: "La Bella - Paris",
  address: { street: "1 Rue de la Paix", city: "Paris", zip: "75001" },
  phone: "+33 1 23 45 67 89",
  location: { lat: 48.8566, lng: 2.3522 },
  openingHours: { /* ... */ },
});
```

### `api.stores.update`

Update store settings.

### `api.stores.delete`

Soft-delete a store (sets status to "closed").

## Products

### `api.products.listByStore`

```typescript
const products = useQuery(api.products.listByStore, { storeId });
```

### `api.products.get`

```typescript
const product = useQuery(api.products.get, { productId });
```

### `api.products.create`

```typescript
await createProduct({
  storeId,
  name: "Margherita",
  description: "Classic tomato and mozzarella",
  price: 1299, // cents
  categoryId,
  options: [
    {
      name: "Size",
      choices: [
        { label: "Medium", priceModifier: 0 },
        { label: "Large", priceModifier: 300 },
      ],
    },
  ],
});
```

### `api.products.update`

### `api.products.delete`

### `api.products.search`

```typescript
const results = useQuery(api.products.search, {
  storeId,
  query: "pizza",
  categoryId: optional,
});
```

## Orders

### `api.orders.create`

```typescript
const orderId = await createOrder({
  storeId,
  items: [
    { productId, quantity: 2, options: [{ name: "Size", value: "Large" }] },
  ],
  type: "delivery", // "delivery" | "pickup" | "dine-in"
  customerInfo: { name, email, phone, address },
  paymentMethod: "stripe",
});
```

#### Refusals

`orders.create` refuses an order it cannot honour by throwing a `ConvexError`.
Convex redacts the message of a plain `Error` in production — the browser
receives "Server Error" — so the reason travels in `data`, never in `message`:

```typescript
import { convexErrorMessage } from "@/lib/convex-error";

try {
  await createOrder({ ... });
} catch (error) {
  // Falls back to the server's own French sentence for a code this screen
  // does not know about, so a refusal added later still reads correctly.
  toast.error(convexErrorMessage(error, {}, "Erreur lors de la commande."));
}
```

`data.code` is what a screen switches on. Per line, from `orderLine`:
`invalid_quantity`, `inactive`, `insufficient_stock`, `outside_window`,
`unknown_choice`, `missing_required_option`, `too_many_choices` — each also
carries `data.productName`. For the order as a whole: `store_not_found`,
`store_not_published`, `store_not_accepting`, `outside_opening_hours`,
`service_not_offered`, `too_many_lines`, `line_without_product`,
`product_not_found`, `product_wrong_store`, `quote_required`,
`promotion_not_found`. Delivery adds `below_minimum`, `outside_radius`,
`not_located` and the quote reasons (`missing`, `wrong_store`, `expired`,
`already_used`, `address_not_located`, `address_mismatch`); a coupon adds the
`PromotionRejectionReason` set. Public-mutation limits raise `field_too_long`
and `rate_limited`.

`data.message` is customer-facing French copy and may be reworded; `data.code`
is the contract.

### `api.orders.listByStore`

```typescript
const orders = useQuery(api.orders.listByStore, {
  storeId,
  status: "preparing", // optional filter
  limit: 50,
});
```

### `api.orders.updateStatus`

```typescript
await updateOrderStatus({
  orderId,
  status: "preparing", // pending → confirmed → preparing → ready → delivered → completed
});
```

### `api.orders.get`

Real-time order tracking (auto-updates via subscription).

## Kitchen

### `api.kitchenTickets.listActive`

```typescript
// Real-time subscription - updates instantly
const tickets = useQuery(api.kitchenTickets.listActive, { storeId });
```

### `api.kitchenTickets.updateStatus`

```typescript
await updateTicketStatus({
  ticketId,
  status: "preparing", // new → preparing → ready → served
});
```

### `api.kitchenTickets.requestReprint`

```typescript
await requestReprint({ ticketId });
```

## Team

Roster and invitations. Reads are store-scoped and need `team:read`; writes run
through `requireCanManage`, which also reserves chain-wide members
(`allStores: true`) to a super administrator.

### `api.teamMembers.list`

The members of a store, plus the chain-wide members who cover it too.

```typescript
const members = useQuery(api.teamMembers.list, { storeId });
```

### `api.teamMembers.getByRole`

The members of a store holding one role.

### `api.teamMembers.getMyMemberships`

The caller's own memberships. Takes no argument: the account comes from the
session, never from the caller.

```typescript
const mine = useQuery(api.teamMembers.getMyMemberships, {});
```

### `api.teamMembers.getInvitationPreview`

What `/invite/[token]` renders before anyone signs in, and the only
unauthenticated function here: the token is the credential and the invitee has
no session yet. It answers rather than throws, because the page shows different
copy for `not_found`, `invitation_expired`, `invitation_not_pending` and
`pending`.

```typescript
const invitation = useQuery(api.teamMembers.getInvitationPreview, { token });
```

### `api.teamMembersEmail.sendInvitationEmail`

Invite somebody. This action is the only way a roster row is created: it mints
the invitation token server-side with `randomUUID()`, writes the pending member
through an internal mutation, and sends the email carrying the link.

```typescript
const sendInvitation = useAction(api.teamMembersEmail.sendInvitationEmail);
await sendInvitation({
  storeId,
  allStores: false,
  name: "Yanis Moreau",
  email: "yanis@resto.example",
  role: "manager",
  permissions: ["dashboard", "orders"],
  storeName: "Chez Luigi",
});
```

There is deliberately no public `teamMembers.invite` mutation. One existed, took
`invitationToken` as an argument and had no caller, which let anyone able to
manage the roster create a member under a token of their own choosing and skip
the email entirely. Removed in
[#275](https://github.com/be-yours/beyours/issues/275), along with
`resendInvitation`. Use the actions.

### `api.teamMembersEmail.resendInvitationEmail`

Send a pending invitation again under a freshly minted token. The previous link
stops resolving.

### `api.teamMembers.acceptInvitation`

Accept an invitation and receive the rights it promised. The token is the only
argument; the account bound is the caller's, from the session.

Acceptance is what provisions `userProfiles`, the record every authorisation
guard reads. Until it runs, a roster row grants nothing.

```typescript
const accept = useMutation(api.teamMembers.acceptInvitation);
await accept({ token });
```

### `api.teamMembers.update`

Change a member's role, modules or store. Carries through to `userProfiles`, so
restricting somebody on the team screen actually restricts them.

### `api.teamMembers.toggleActive`

Enable or disable a member. Disabling revokes the profile access with it.

### `api.teamMembers.remove`

Remove a member, revoking their profile access first.

> `teamMembers.create` and `teamMembers.getByEmail` are still exported and have
> no caller. Do not build on them:
> [#281](https://github.com/be-yours/beyours/issues/281) removes them.

## Games & Gamification

### `api.games.create`

```typescript
await createGame({
  storeId,
  type: "WHEEL_OF_FORTUNE",
  winRatio: 30,
});
```

### `api.games.updateWinRatio`

```typescript
await updateWinRatio({ gameId, winRatio: 40 });
```

### `api.gameQRCodes.create`

```typescript
const qrCode = await createQRCode({
  storeId,
  tableNumber: 12,
});
```

### `api.gamePlays.play`

```typescript
const result = await playGame({
  gameId,
  customerId,
  qrCodeId,
});
// { won: true, prize: { name: "Free Dessert", ... } }
// or { won: false }
```

### `api.prizeRedemptions.redeem`

```typescript
await redeemPrize({ redemptionCode: "PRIZE-ABC123" });
```

## Languages & Translations

### `api.languages.list`

```typescript
const languages = useQuery(api.languages.list, { storeId });
```

### `api.languages.add`

```typescript
await addLanguage({ storeId, code: "es", name: "Spanish" });
```

### `api.autoTranslate.translateProduct`

```typescript
await translateProduct({
  productId,
  sourceLocale: "en",
  targetLocale: "es",
});
```

### `api.autoTranslate.batchTranslate`

```typescript
await batchTranslate({
  storeId,
  sourceLocale: "en",
  targetLocale: "de",
});
```

## Email Campaigns

### `api.emailCampaigns.create`

```typescript
await createCampaign({
  storeId,
  subject: "Spring Menu",
  template: { blocks: [...] },
  segment: "all",
});
```

### `api.emailCampaigns.send`

```typescript
await sendCampaign({ campaignId });
```

### `api.emailCampaigns.getStats`

```typescript
const stats = useQuery(api.emailCampaigns.getStats, { campaignId });
// { sent: 1000, opened: 350, clicked: 120, ... }
```

## CMS

### `api.cms.getPage` — removed

`cms.getPage` had no caller and was removed by #413. The storefront reads a
page through `api.cms.getPageBlocks`, and the admin editor through
`getAdminPageBlocks` / `getPreviewPageBlocks`.

> Treat the rest of this page with suspicion. Measured on 2026-09-09, **19 of
> the 43 `api.*` names it documents did not exist** — before #413 touched
> anything. `cms.updatePage`, `products.search`, `orders.get`,
> `emailCampaigns.send` and fifteen more are aspirational, not a contract. This
> file needs regenerating from the tree; until then it is a wish list.

### `api.cms.updatePage`

```typescript
await updatePage({
  storeId,
  slug: "about",
  blocks: [
    { type: "hero", data: { title: "About Us", image: "..." } },
    { type: "text", data: { content: "..." } },
  ],
});
```

## AI

### `api.imageToProduct.extract`

Extract products from a menu photo using AI:

```typescript
const products = await extractFromImage({
  imageUrl: "https://s3.../menu-photo.jpg",
  locale: "en",
});
// [{ name: "Margherita", description: "...", price: 1299 }, ...]
```
