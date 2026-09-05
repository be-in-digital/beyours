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
pnpm add @be-in-digital/core @be-in-digital/restaurant @be-in-digital/convex-schema
```

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
} from "@be-in-digital/convex-schema/tables";

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

```tsx
// app/game/[qrCodeId]/page.tsx
import { GameFlow } from "@be-in-digital/restaurant";

export default function GamePage({ params }: { params: { qrCodeId: string } }) {
  return <GameFlow qrCodeId={params.qrCodeId} />;
}
```

## QR Codes

Each QR code is linked to a specific table/location in the restaurant.

```typescript
// Admin: Create QR code
const qrCode = await createGameQRCode({
  storeId: store._id,
  tableNumber: 12,
  label: "Table 12",
});
// Returns URL: https://yourdomain.com/game/qr_abc123
```

### Printing QR Codes

QR codes can be printed as table tent cards or stickers from the admin dashboard.

## Social Actions

Configure which actions customers must complete before playing:

```typescript
// Admin: Configure required actions
await setRequiredActions(storeId, [
  {
    type: "google_review",
    label: "Leave a Google Review",
    url: "https://g.page/your-restaurant/review",
    required: true,
  },
  {
    type: "instagram_follow",
    label: "Follow us on Instagram",
    url: "https://instagram.com/your-restaurant",
    required: false, // Optional
  },
  {
    type: "newsletter",
    label: "Subscribe to our newsletter",
    required: false,
  },
]);
```

### Supported Action Types

| Type | Description |
|------|-------------|
| `google_review` | Leave a Google Maps review |
| `instagram_follow` | Follow on Instagram |
| `facebook_like` | Like on Facebook |
| `tiktok_follow` | Follow on TikTok |
| `newsletter` | Subscribe to newsletter |
| `custom` | Custom action with URL |

## Games

### Wheel of Fortune

A spinning wheel with configurable segments:

```typescript
await createGame({
  storeId: store._id,
  type: "WHEEL_OF_FORTUNE",
  winRatio: 30, // 30% chance to win
  segments: [
    { label: "Free Dessert", prizeId: "prize_1", color: "#e74c3c" },
    { label: "10% Off", prizeId: "prize_2", color: "#3498db" },
    { label: "Try Again", prizeId: null, color: "#95a5a6" },
    { label: "Free Drink", prizeId: "prize_3", color: "#2ecc71" },
    { label: "Try Again", prizeId: null, color: "#95a5a6" },
    { label: "Free Appetizer", prizeId: "prize_4", color: "#f39c12" },
  ],
});
```

### Scratch Card

A digital scratch card:

```typescript
await createGame({
  storeId: store._id,
  type: "SCRATCH_CARD",
  winRatio: 25, // 25% chance to win
});
```

## Prizes

```typescript
// Create prizes
await createPrize({
  storeId: store._id,
  name: "Free Dessert",
  description: "Any dessert from our menu",
  stock: 100,        // Limited stock
  expiresInDays: 30, // Prize expires 30 days after winning
});
```

### Prize Redemption Flow

1. Winner receives email with QR code
2. Customer shows QR code at restaurant
3. Staff scans QR in Kitchen Display or admin
4. Prize marked as redeemed

```typescript
// Staff: Redeem prize
await redeemPrize({
  redemptionCode: "PRIZE-ABC123",
  staffId: currentUser._id,
});
```

## Admin Controls

### Win Ratio

The admin sets the win ratio (0-100%), which determines the probability of winning:

```typescript
// Update win ratio
await updateGame(gameId, { winRatio: 40 }); // 40% win rate

// How it works internally:
// random() < (winRatio / 100) → WIN
// random() >= (winRatio / 100) → LOSE
```

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

Players have a 24-hour cooldown between games:

```typescript
// Automatically enforced
const canPlay = await checkCooldown(customerId, storeId);
// { allowed: true } or { allowed: false, nextPlayAt: "2026-04-02T15:30:00Z" }
```

If a customer tries to play again within 24 hours, they see a countdown timer.
