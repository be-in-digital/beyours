# Gamification Guide

> QR code-based games to drive customer engagement: Wheel of Fortune and Scratch Cards.

## Table of Contents

- [Overview](#overview)
- [Flow](#flow)
- [Setup](#setup)
- [QR Codes](#qr-codes)
- [Social Actions](#social-actions)
- [Games](#games)
- [Prizes](#prizes)
- [Admin Controls](#admin-controls)
- [Cooldown System](#cooldown-system)

## Overview

The gamification system increases customer engagement by offering games (Wheel of Fortune, Scratch Cards) that customers can play after completing social actions (Google review, Instagram follow, etc.).

**Key features:**
- Admin controls the **win ratio** (0-100%)
- 24-hour cooldown between plays
- Prize redemption via QR code email
- Full analytics in admin dashboard

## Flow

```
1. Customer scans QR code on restaurant table
   ↓
2. Redirected to game page
   ↓
3. Completes required social actions
   (e.g., Google review, Instagram follow)
   ↓
4. Plays game (Wheel of Fortune or Scratch Card)
   ↓
5a. WIN → Fills contact form → Receives prize QR by email
5b. LOSE → "Better luck next time!" message
   ↓
6. Winner redeems prize at restaurant (staff scans QR)
   ↓
7. 24-hour cooldown before next play
```

## Setup

### 1. Install Packages

```bash
pnpm add @be-yours/admin @be-yours/convex-schema @be-yours/convex-functions
```

`@be-yours/admin` carries both halves of the feature: the dashboard screens
under `pages/games` and the customer-facing player flow under `/game`.

### 2. Add Schema Tables

```typescript
// convex/schema.ts
import {
  gameQRCodesTable,
  requiredActionsTable,
  gamesTable,
  prizesTable,
  gamePlaysTable,
  prizeRedemptionsTable,
} from "@be-yours/convex-schema/tables";

export default defineSchema({
  // ... other tables
  gameQRCodes: gameQRCodesTable,
  requiredActions: requiredActionsTable,
  games: gamesTable,
  prizes: prizesTable,
  gamePlays: gamePlaysTable,
  prizeRedemptions: prizeRedemptionsTable,
});
```

### 3. Create Game Route

The player flow is a packaged component, but it is **not** in
`@be-yours/restaurant` — there is no `GameFlow` anywhere in the engine. The
eleven player screens live in `@be-yours/admin/game` and are exported as
`GamePlayerFlow`.

They are deliberately kept off the `@be-yours/admin` root barrel:
`game/lib/sounds.ts` ends in a module-scope `new GameAudioEngine()`, and pulling
that barrel into the package root would drag the audio and particle engines into
every dashboard bundle. Import from the `/game` subpath.

The flow reaches its backend through **props**, not through the admin API store:
a customer scanning a table QR code never mounts the `(admin)` layout that fills
that store, so it is empty on this route. The `api` prop is the injection point,
and it is typed (`GamePlayApi`) rather than `any` so that a function which exists
in one app and not the other is a compile error instead of a 500 on a client's
site.

```tsx
// app/game/[qrCodeId]/_components/GameContent.tsx
"use client";

import { useParams } from "next/navigation";
import { GamePlayerFlow } from "@be-yours/admin/game";
import { api } from "@/convex/_generated/api";

export default function GamePageContent() {
  const params = useParams<{ qrCodeId: string }>();

  return (
    <GamePlayerFlow
      qrCode={params.qrCodeId}
      api={{
        getSession: api.gamePlay.getSession,
        recordScan: api.gamePlay.recordScan,
        play: api.gamePlay.play,
        claim: api.gamePlay.claim,
        ensureReferralCode: api.gamePlay.ensureReferralCode,
      }}
    />
  );
}
```

The page itself only wraps it in a `Suspense` boundary — `useParams` and the
`?ref=` lookup both need one:

```tsx
// app/game/[qrCodeId]/page.tsx
import { Suspense } from "react";
import GamePageContent from "./_components/GameContent";

export default function GamePage() {
  return (
    <Suspense>
      <GamePageContent />
    </Suspense>
  );
}
```

`copy` is an optional third prop (`Partial<GameCopy>`: `heroTitle`,
`heroSubtitle`, `winTitle`, `winDescription`, `loseTitle`, `loseDescription`).
Omit it entirely in an app with no CMS and every field falls back to the flow's
own French defaults. `apps/reference` fills it from the CMS `game` page.

The staff-facing redemption screen is the other export of the same barrel,
`PrizeTicket`, taking `{ code, api }` where `api` is
`{ getRedemptionByCode, canRedeem, redeemByCode }`.

## QR Codes

Each QR code is linked to a specific table/location in the restaurant.

```typescript
// Admin: gameQRCodes.create
const qrCodeId = await createQRCode({
  storeId: store._id,
  code: "qr_abc123",     // the [qrCodeId] route segment; supplied, not generated
  tableNumber: "12",     // a string, not a number
  location: "Terrasse",  // optional free text; there is no `label` field
  isActive: true,
});
// The customer URL is https://yourdomain.com/game/qr_abc123
```

`scannedCount` is never passed by the caller — the mutation seeds it at `0` and
`gamePlay.recordScan` accumulates it.

### Printing QR Codes

QR codes can be printed as table tent cards or stickers from the admin dashboard.

## Social Actions

Configure which actions customers must complete before playing:

Actions are created one at a time through `requiredActions.create`. There is no
bulk `setRequiredActions`; the display name is `name`, not `label`, and the flag
is `isRequired`, not `required`.

```typescript
// Admin: requiredActions.create
await createRequiredAction({
  storeId,
  type: "google_review",
  name: "Leave a Google Review",
  url: "https://g.page/your-restaurant/review",
  isRequired: true,
});

await createRequiredAction({
  storeId,
  type: "instagram_follow",
  name: "Follow us on Instagram",
  url: "https://instagram.com/your-restaurant",
  isRequired: false, // optional
});
```

### Supported Action Types

`RequiredActionType` in `@be-yours/convex-schema` is a closed union of five
values. There is no `newsletter` and no `custom` — a free-form action type does
not exist.

| Type | Description |
|------|-------------|
| `google_review` | Leave a Google Maps review |
| `instagram_follow` | Follow on Instagram |
| `facebook_like` | Like on Facebook |
| `tiktok_follow` | Follow on TikTok |
| `email_subscribe` | Subscribe to the newsletter |

Actions are managed by the `requiredActions` Convex functions
(`list`, `create`, `update`, `remove`).

## Games

### Wheel of Fortune

A spinning wheel with configurable segments. `GameType` is `"wheel" |
"scratch_card"` — lowercase, snake_case; the screaming-caps spellings are not
accepted anywhere.

```typescript
// games.create — note there is no `segments` argument here
await createGame({
  storeId: store._id,
  type: "wheel",
  name: "Roue de la fortune",
  winRatio: 30, // 30% chance to win; rejected outside 0-100
  isActive: true,
});

// The wheel's sections live on the game's `config` blob, written by games.update
await updateGame({
  id: gameId,
  config: {
    wheelSections: [
      { label: "Dessert offert", color: "#e74c3c", prizeId: "prize_1" },
      { label: "-10%", color: "#3498db", prizeId: "prize_2" },
      { label: "Rejouez", color: "#95a5a6" }, // no prizeId = losing section
    ],
  },
});
```

### Scratch Card

A digital scratch card:

```typescript
await createGame({
  storeId: store._id,
  type: "scratch_card",
  winRatio: 25, // 25% chance to win
});
```

## Prizes

```typescript
// prizes.create
await createPrize({
  storeId: store._id,
  name: "Dessert offert",
  description: "Any dessert from our menu",
  type: "free_product",  // discount_percentage | discount_fixed | free_product | free_menu | custom
  totalAvailable: 100,   // limited stock — the field is not called `stock`
  validityDays: 30,      // days the won prize stays redeemable
  isActive: true,
});
```

`remainingCount` is the live counter derived from `totalAvailable`; `rollOutcome`
refuses to declare a win when no prize has any left.

### Prize Redemption Flow

1. Winner receives email with QR code
2. Customer shows QR code at restaurant
3. Staff scans QR in Kitchen Display or admin
4. Prize marked as redeemed

```typescript
// Staff: gamePlay.redeemByCode
await redeemByCode({
  code: "PRIZE-ABC123",
  redeemedBy: currentUser._id, // optional
});
```

It throws by name rather than returning a flag: `REDEMPTION_NOT_FOUND`,
`ALREADY_REDEEMED`, `REDEMPTION_CANCELLED`, `REDEMPTION_EXPIRED`. The staff-facing
screen is the `PrizeTicket` component from `@be-yours/admin/game`.

## Admin Controls

### Win Ratio

The admin sets the win ratio (0-100%), which determines the probability of winning:

```typescript
// Update win ratio — games.updateWinRatio
await updateWinRatio({ id: gameId, winRatio: 40 }); // 40% win rate
```

The roll is `rollOutcome` in `packages/convex-functions/src/gamePlay.ts`, and it
runs **server-side** — the client only animates toward the result it receives:

```typescript
// clamped to 0-100, and a play cannot win when nothing is in stock
if (prizeCount === 0) return false;
return random() * 100 < Math.min(100, Math.max(0, winRatio));
```

The stock check is not a detail: a game set to 100% still loses while no prize
has `remainingCount` left. When a play does win, `pickPrize` chooses among the
prizes still in stock with equal weight.

### Stats

The `GamesPage` admin component shows four counters, from
`api.prizeRedemptions.getStats` plus the store's QR codes:

- Total plays
- Wins
- QR scans (summed from each code's `scannedCount`)
- Prizes awaiting redemption

`getStats` also returns `winRate` and `totalRedeemed`, which `GamesPage` does
not render today. There is no revenue attribution and no breakdown by time of
day.

## Cooldown System

The cooldown defaults to 24 hours (`DEFAULT_COOLDOWN_HOURS`) and is overridable
per game through `game.config.cooldownHours` — `cooldownMsForGame` resolves the
two.

There is no separate cooldown call to make. `gamePlay.getSession` reports the
state up front, keyed on the device fingerprint, so the flow can open straight
onto the countdown screen instead of letting a player complete the actions and
then refusing the play:

```typescript
// gamePlay.getSession returns, among the rest of the session:
cooldown: { active: true, nextPlayAt: 1775000000000 } // epoch ms
// or
cooldown: { active: false }
```

If a customer tries to play again within the window, they see a countdown timer.
