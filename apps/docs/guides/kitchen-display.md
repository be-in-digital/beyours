# Kitchen Display System Guide

> Real-time order display with browser ticket printing and multi-station routing.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Kitchen Display](#kitchen-display)
- [Ticket Printing](#ticket-printing)
- [Multi-Station Routing](#multi-station-routing)
- [Ticket Lifecycle](#ticket-lifecycle)

## Overview

The Kitchen Display System (KDS) provides real-time order management for kitchen staff:

- Real-time ticket display via Convex subscriptions
- Auto-print on order confirmation
- Multi-station support (grill, fryer, drinks, etc.)
- Ticket status tracking
- Reprint capability

## Setup

### 1. Add Schema

```typescript
// convex/schema.ts
import { kitchenTicketsTable } from "@be-yours/convex-schema/tables";

export default defineSchema({
  // ...
  kitchenTickets: kitchenTicketsTable,
});
```

### 2. Create Kitchen Page

```tsx
// app/(admin)/kitchen/page.tsx
import { KitchenPage } from "@be-yours/admin/pages";

export default function Kitchen() {
  return <KitchenPage />;
}
```

## Kitchen Display

The `KitchenPage` component displays tickets in real-time:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  NEW (3)     │  │ PREPARING   │  │  READY (1)  │
│             │  │   (2)       │  │             │
│ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │
│ │ #045    │ │  │ │ #043    │ │  │ │ #041    │ │
│ │ Table 3 │ │  │ │ Table 7 │ │  │ │ Table 1 │ │
│ │ 2x Pizza│ │  │ │ 1x Steak│ │  │ │ 3x Salad│ │
│ │ 1x Pasta│ │  │ │ 2x Fries│ │  │ │         │ │
│ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │
│ ┌─────────┐ │  │ ┌─────────┐ │  │             │
│ │ #044    │ │  │ │ #042    │ │  │             │
│ └─────────┘ │  │ └─────────┘ │  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Features

- **Real-time updates** — Tickets appear instantly when orders are confirmed
- **Drag-and-drop** — Move tickets between columns
- **Timer** — Shows elapsed time since ticket creation
- **Priority indicators** — Color-coded by urgency
- **Sound alerts** — Audio notification for new tickets

## Ticket Printing

What ships is **browser printing**, and only that. The kitchen screen renders
the ticket into a hidden iframe and calls `print()`
(`components/admin/kitchen/KitchenPrintTrigger.tsx`). Paired with
`scripts/kiosk-print.sh`, which launches Chrome with `--kiosk-printing`, no
dialog appears and the slip goes straight to the station's default printer. Set
a thermal printer as the OS default and you get a thermal ticket — through the
vendor driver, not through ESC/POS bytes this codebase emits.

There is no `configurePrinter()`, no `POST /api/print`, no port 9100, no USB
transport and no printer status polling. A `printerSettings` table was declared
for that path and removed once measurement confirmed it had never had a reader
or a writer. Live configuration is `stores.printConfig`, edited in
Établissements → Cuisine.

### Turning it on

Printing is off until an owner enables it: `DEFAULT_PRINT_CONFIG.enabled` is
`false` (`packages/admin/src/lib/kitchen-print.ts`). Once on, every paid order
is queued, claimed by exactly one tablet, and retried on failure.

```typescript
// Reprint from the kitchen screen
await requestReprint({ ticketId });
```

One limitation worth stating, because the code states it too: no browser reports
whether the cook printed or pressed Cancel. `onafterprint` fires identically for
both, so a cancelled dialog is recorded as printed.

### What comes next

The thermal path will be **cloud printing** — Star CloudPRNT and Epson Server
Direct Print, where the printer polls an HTTP endpoint and the server answers
with the bytes. A browser cannot open a raw socket and Convex cannot reach a
restaurant's LAN, so the alternative would be a signed desktop agent per
operating system; cloud printing gets real ESC/POS output without it. The three
providers are already catalogued in `packages/admin/src/lib/kitchen-print.ts`
with `available: false`.

## Multi-Station Routing

Route ticket items to different kitchen stations:

```typescript
// Configure stations
await configureStations(storeId, [
  { name: "Grill", categories: ["burgers", "steaks"] },
  { name: "Fryer", categories: ["fries", "wings"] },
  { name: "Cold", categories: ["salads", "desserts"] },
  { name: "Bar", categories: ["drinks", "cocktails"] },
]);
```

Each station gets a filtered ticket showing only their items:

- **Grill Station**: Shows 2x Steak, 1x Burger
- **Fryer Station**: Shows 3x Fries
- **Bar**: Shows 2x Cola, 1x Beer

## Ticket Lifecycle

```
NEW → PREPARING → READY → SERVED
 ↓
CANCELLED
```

| Status | Description | Action |
|--------|-------------|--------|
| `new` | Just received | Staff acknowledges |
| `preparing` | Being prepared | Kitchen working |
| `ready` | Ready for service | Ring bell / notify |
| `served` | Delivered to table | Complete |
| `cancelled` | Order cancelled | Remove from display |

### Status Updates

```typescript
// Kitchen staff updates ticket status
await updateTicketStatus(ticketId, "preparing");
await updateTicketStatus(ticketId, "ready");
```

## Prize Scanner

The Kitchen Display also includes a prize scanner for the gamification system:

```typescript
// Staff scans a prize QR code
await scanPrizeQR(qrCodeData);
// Validates and redeems the prize
```
