# Kitchen Display System Guide

> Real-time order display with ESC/POS thermal printing and multi-station support.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Kitchen Display](#kitchen-display)
- [Thermal Printing](#thermal-printing)
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
import {
  kitchenTicketsTable,
  printerSettingsTable,
} from "@be-in-digital/convex-schema/tables";

export default defineSchema({
  // ...
  kitchenTickets: kitchenTicketsTable,
  printerSettings: printerSettingsTable,
});
```

### 2. Create Kitchen Page

```tsx
// app/(admin)/kitchen/page.tsx
import { KitchenPage } from "@be-in-digital/admin/pages";

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

## Thermal Printing

### Printer Configuration

```typescript
// Admin: Configure printer
await configurePrinter({
  storeId: store._id,
  name: "Kitchen Printer 1",
  type: "network", // "network" | "usb"
  address: "192.168.1.100", // IP for network printers
  port: 9100,
  paperWidth: 80, // mm (58 or 80)
  autoPrint: true, // Auto-print on new orders
});
```

### ESC/POS Commands

The system generates ESC/POS commands for thermal printers:

```
┌────────────────────────────┐
│     LA BELLA PIZZERIA      │
│                            │
│ Order #045          Table 3│
│ ─────────────────────────  │
│ 2x Margherita       €25.98│
│   + Extra cheese            │
│ 1x Pasta Carbonara  €14.99│
│ ─────────────────────────  │
│ Total:              €40.97 │
│                            │
│ 15:32 - 01/04/2026         │
│                            │
│        [BARCODE]           │
└────────────────────────────┘
```

### Auto-Print

When enabled, tickets are automatically printed when:
1. A new order is confirmed
2. An order is modified
3. Staff requests a reprint

```typescript
// Reprint a ticket
await reprintTicket(ticketId);
```

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
