# Design — Kitchen Display, Front-of-House Screen & Customer Tracking

**Date**: 2026-02-23
**Status**: Approved — ready for implementation
**Branch**: kitchen

---

## 1. Understanding Summary

### What we are building

Three interfaces tied together by the order flow, plus a browser-kiosk printing system:

- **Kitchen KDS**: an upgraded kanban with large touch targets, configurable audio and visual alerts, and browser-kiosk printing through `window.print()` + Chrome `--kiosk-printing`
- **Front-of-house screen**: two zones, "en preparation" / "prets a recuperer", pickup confirmed by staff plus a configurable auto-dismiss, tuned for a TV
- **Customer mobile tracking**: a status timeline plus the estimated time remaining, reached through an opaque nanoid token of 21+ characters

### Who it is for

| Interface | User | Access |
|-----------|------------|-------|
| KDS | Kitchen staff | Existing staff auth |
| Front-of-house screen | Dine-in customers and counter staff | Public URL + storeId, no auth |
| Mobile tracking | End customer | Link carrying an opaque nanoid token (21+) |

### End-to-end flow

```
Commande (site / Uber Eats / Deliveroo)
    |
    v
Confirmation (auto ou manuelle — configurable par store)
    |
    v
Creation kitchenTicket + trackingToken (nanoid 21)
    |
    v
Impression auto ticket (si trigger "confirmed" actif)
    |  ticket: logo, #commande, source/type, client, items+options, notes, allergies, temps estime, QR reimpression, branding
    |
    +--> KDS (subscription Convex) --> staff cuisine voit le ticket
    +--> Ecran salle (subscription Convex) --> numero apparait dans "en preparation"
    +--> Tracking client (subscription Convex) --> statut "en preparation" + countdown
    +--> Impression (window.print() dans iframe isolee sur le navigateur KDS)
    |
    v
KDS cuisine — gros boutons (Commencer -> Pret -> Termine)
    |  alertes sonores configurables (nouveau ticket, depassement, imprimante offline)
    |
    v
Statut "pret" --> impression ticket pickup (si trigger "ready" actif)
    |
    v
Ecran salle --> numero passe de "en preparation" a "prets a recuperer" (flash 3s)
    |
    v
Staff comptoir valide pickup (depuis KDS ou admin orders)
    OU auto-dismiss apres delai configurable (default 15min)
    |
    v
Tracking mobile --> client voit "Votre commande est prete !"
    |
    v
Statut "done" --> completedAt = now, ticket disparait de tous les ecrans
```

### Explicit non-goals

- No multi-station KDS in V1
- No cloud printing in V1 (the architecture is ready, the implementation comes later)
- No dedicated courier view
- No courier position tracking on a map
- No push or SMS notifications to the customer
- No automatic cash drawer (a browser-kiosk limitation)
- No line-item detail in customer tracking (the customer already knows what they ordered)

---

## 2. Assumptions

- Browser-kiosk printing is triggered **client-side, in the KDS browser**, from a Convex subscription through `window.print()`
- Chrome `--kiosk-printing` skips the print dialog and sends straight to the default printer
- Per-product prep time is an **optional field** — when it is missing, nothing is shown to the customer
- The front-of-house screen is a **full-screen page** tuned for a TV (large text, dark background, no header or nav)
- Audio alerts need an **initial click** from staff to unlock audio autoplay (a browser restriction)
- The cloud APIs (Sunmi/Star/Epson) will be called from Convex actions — **out of scope for V1**
- The 58mm layout matches the 80mm one but drops the QR code and tightens the spacing
- `window.print()` does not guarantee that paper came out — all we know is that the process was triggered
- An opaque nanoid token of 21+ characters is long enough to make brute-forcing impractical
- A ticket with `status="done"` and `completedAt` older than 24h counts as expired for tracking

---

## 3. Decision Log

| # | Decision | Choice | Alternatives considered | Rationale |
|---|----------|-------|-------------------------|--------|
| 1 | Order confirmation | Configurable per store (auto or manual) | Always auto, always manual, per channel | Every restaurant has its own habits |
| 2 | KDS interaction | Dedicated large buttons (min 64px, 18px+ font) | Plain touch, swipe, sequential full-screen mode | Dirty or gloved hands in the kitchen need a large touch target |
| 3 | Multi-station KDS | Out of scope for V1 | Build it now | YAGNI — add it later if the need shows up |
| 4 | KDS audio alerts | Configurable per event plus volume, one beep per store (anti-cacophony) | A single generic sound, or no sound at all | Adapts to each room, and N tickets do not turn into noise |
| 5 | V1 printing | Browser kiosk (Chrome --kiosk-printing + window.print()) | Local print server, Electron app, direct cloud | No cost, no dependency, friction only at install time |
| 6 | Printing architecture | Unified multi-provider (browser + 3 cloud) | Browser only | Ready for Sunmi/Star/Epson without a refactor |
| 7 | Cloud providers (out of scope for V1) | Sunmi NT311 (recommended), Star mC-Print3, Epson TM-m30II | Other brands | Price, IP52 ruggedness, maturity of the cloud API |
| 8 | Print triggers | Configurable per store, defaults = confirmed + ready + reprint | Fixed, not configurable | Every restaurant has its own setup (with or without a pickup counter, food trucks with no printer) |
| 9 | Paper format | 80mm by default, 58mm supported (no QR, tighter spacing) | 80mm only | Covers the whole market |
| 10 | Ticket layout | Logo, order number, source/type, customer, items+options+notes, allergies, estimated time, reprint QR, branding | A simplified layout | Complete and readable — everything the kitchen needs |
| 11 | QR on the ticket | Triggers a reprint (staff scans → reprint) | Customer tracking link, admin link | Handy, no hunting through the UI |
| 12 | Ticket variant | "TICKET COMMANDE" vs "TICKET RETRAIT" depending on printTrigger | A single ticket for everything | An obvious visual distinction for staff |
| 13 | Printing inside an iframe | An isolated iframe renders the ticket | CSS @media print with display:none on the body | No app CSS bleeding in, printing stays stable |
| 14 | Print queue | One job at a time (isPrintingRef + currentTicketIdRef), 20s timeout | Parallel, no timeout | Dedup, failure handling, no race conditions |
| 15 | Printer status | Three levels: red badge (30s) → toast (1min, once) → audio alert (2min) | Alert immediately, or no alert at all | Escalates gradually, does not spam |
| 16 | Print fallback | A "non imprimee" badge plus an audio alert, with a manual reprint always allowed | Automatic failover to a backup printer | Keep V1 simple — automatic failover is a V2 concern |
| 17 | Front-of-house screen format | The classic fast-food two-zone board, dark background, 64px+ numbers | A single zone, or a scrolling list | Readable from 5m+, and a format people already recognise |
| 18 | Front-of-house pickup | Manual staff confirmation (from the KDS or the admin) plus a configurable auto-dismiss (default 15min) | Touch on the TV itself, or auto-dismiss only | The TV is a passive display, and manual plus auto gives two safety nets |
| 19 | Front-of-house pagination | Auto-rotate every 15s once a zone holds more than 10 numbers | Scrolling, or no pagination | You cannot scroll a TV, and rotation stays readable |
| 20 | Front-of-house heartbeat | A pulsing "Live" dot plus a clock that ticks every minute | Nothing | Staff can tell the screen has not frozen |
| 21 | Estimated time | Set per product in the catalog (an optional field) | A formula based on item count, a dynamic load-based estimate, or catalog plus load combined | The owner knows their own timings better than an algorithm does |
| 22 | Customer tracking content | A status timeline plus a countdown to the estimated time | Bare status, line-item detail, courier position | Enough without overloading, and no sensitive data |
| 23 | Customer tracking access | An opaque nanoid token (21+) in the URL | The Convex orderId, or a signed JWT | Brute-force resistant, simple, and no expiry to manage |
| 24 | Customer tracking errors | "Commande introuvable" and "Commande terminee" (past 24h) | Nothing (a generic 404) | Clean UX with a link back to the store |
| 25 | Real time | Convex subscriptions everywhere (KDS, front-of-house screen, tracking) | Polling for customer tracking | It is the stack we already have, ~100-500ms of latency |
| 26 | KDS security | Existing staff auth | A plain URL, or a PIN | An internal tool — it has to be protected |
| 27 | Front-of-house security | URL + storeId, no auth | Auth, PIN, token | Nothing sensitive (order numbers only) on a dedicated TV |
| 28 | Tracking security | An opaque nanoid token (21+) | A signed JWT, or the orderId | Long enough to make brute-forcing impractical |
| 29 | Architectural approach | Modular by package (logic in packages/, thin pages in app/) | Everything in the app, or separate micro-apps | Consistent with the existing architecture and reusable across themes |
| 30 | Printing onboarding | An automated script (.bat/.sh) that configures Chrome and creates a KDS shortcut | Manual documentation, or an Electron app | 30 minutes at most, doable remotely, no dependencies |

---

## 4. Schema — Changes

### 4.1 `packages/convex-schema/src/tables/stores.ts` — New fields

```typescript
orderConfirmation: "auto" | "manual"  // default: "manual"

printConfig: {
  provider: "browser" | "star_cloud" | "epson_cloud" | "sunmi_cloud"
  printerId?: string        // cloud seulement
  apiKey?: string           // cloud seulement
  triggers: ("confirmed" | "ready" | "reprint")[]  // default: ["confirmed", "ready", "reprint"]
  paperSize: "80mm" | "58mm"  // default: "80mm"
  enabled: boolean           // default: false
}

displayConfig: {
  autoDismissEnabled: boolean   // default: true
  autoDismissMinutes: number    // default: 15
}

soundConfig: {
  newTicket: { enabled: boolean, volume: number }     // default: true, 80
  overdue: { enabled: boolean, volume: number }        // default: true, 100
  printerOffline: { enabled: boolean, volume: number } // default: true, 100
}
```

### 4.2 `packages/convex-schema/src/tables/products.ts` — New field

```typescript
estimatedPrepTime?: number  // en minutes, optionnel
```

### 4.3 `packages/convex-schema/src/tables/kitchenTickets.ts` — New fields

```typescript
// Timestamps de lifecycle (invariants backend)
startedAt?: number          // set quand status -> "in_progress" (si pas deja set)
readyAt?: number            // set quand status -> "ready" (obligatoire)
completedAt?: number        // set quand status -> "done" (obligatoire)
pickedUpAt?: number         // set par markPickedUp()

// Tracking
trackingToken: string       // nanoid(21), OBLIGATOIRE, genere a la creation
estimatedReadyAt?: number   // timestamp = createdAt + max(prepTime des items)

// Impression
printStatus: "pending" | "printed" | "failed" | "not_required"
printAttempts: number        // default: 0
printRequestedAt?: number    // set a chaque trigger (confirmed/ready/reprint)
printTrigger?: "confirmed" | "ready" | "reprint"
lastPrintAt?: number         // timestamp du dernier markPrintSent
printFailedAt?: number       // timestamp explicite du dernier echec
lastPrintError?: string      // court ("timeout", "window_closed", etc.)
```

### 4.4 Indexes

```typescript
kitchenTickets.index("by_store_printStatus_printRequestedAt",
  ["storeId", "printStatus", "printRequestedAt"])

kitchenTickets.index("by_store_status_createdAt",
  ["storeId", "status", "createdAt"])

kitchenTickets.index("by_trackingToken",
  ["trackingToken"])

kitchenTickets.index("by_store_printStatus_printFailedAt",
  ["storeId", "printStatus", "printFailedAt"])

kitchenTickets.index("by_store_status_readyAt",
  ["storeId", "status", "readyAt"])
```

### 4.5 Backend invariants in `updateStatus`

Every status transition enforces the timestamps:
- `"in_progress"` → `startedAt = now` (unless already set)
- `"ready"` → `readyAt = now`
- `"done"` → `completedAt = now`

Any mutation that sets `printStatus="pending"` MUST also set `printRequestedAt=now`.
If `printConfig.enabled=false` or the trigger is not active → `printStatus="not_required"`.
No ticket may sit at `printStatus="pending"` without a `printRequestedAt`. That is an invariant.

---

## 5. Convex — Queries & Mutations

### 5.1 Queries

```typescript
// --- KDS ---
getPrintQueue(storeId)
  // filtre: printStatus="pending" AND printRequestedAt != null
  // tri: printRequestedAt ASC
  // index: by_store_printStatus_printRequestedAt
  // retour: header ticket, items+options+notes+allergies, trackingToken, printTrigger
  //         client nom+tel SEULEMENT si livraison
  //         PAS d'email, PAS d'ID interne, PAS de paiement

getOverdueCount(storeId)
  // status in ["new", "in_progress"]
  // ET estimatedReadyAt != null
  // ET estimatedReadyAt < now
  // index: by_store_status_createdAt

getPrintStuckCount(storeId)
  // (printStatus="pending" ET printRequestedAt < now - 30s ET status in ["new","in_progress","ready"])
  // OU (printStatus="failed" ET printFailedAt > now - 10min ET status in ["new","in_progress","ready"])
  // Exclut les tickets "done"

getWithAlerts(storeId)
  // tickets + flags overdue/printFailed (alternative aux 2 queries separees)

// --- ECRAN SALLE ---
getForDisplay(storeId)
  // preparing: status in ["new", "in_progress"], tri createdAt ASC
  // ready: status="ready" ET pickedUpAt=null ET dans fenetre auto-dismiss, tri readyAt DESC
  // + displayConfig (autoDismissEnabled, autoDismissMinutes)
  // + storeBranding (logoUrl, name)
  // + serverNow (timestamp serveur pour alignement)
  // retour minimal: _id, orderNumber, status, createdAt, readyAt
  // PAS de donnees client, PAS d'items, PAS d'allergies

// --- TRACKING CLIENT ---
getByTrackingToken(token)
  // index: by_trackingToken
  // retour: orderNumber, status, createdAt, startedAt, readyAt, completedAt,
  //         estimatedReadyAt, orderType, storeBranding (logo, nom, adresse)
  // PAS de donnees staff, PAS d'items, PAS de paiement
```

### 5.2 Mutations

```typescript
// --- IMPRESSION ---
markPrintSent(ticketId)
  // printStatus = "printed"
  // lastPrintAt = now
  // printAttempts += 1
  // printFailedAt = undefined
  // NE PAS modifier printRequestedAt (audit)

markPrintFailed(ticketId, reason?)
  // printStatus = "failed"
  // printAttempts += 1
  // printFailedAt = now
  // lastPrintError = reason

requestReprint(ticketId)
  // printStatus = "pending"
  // printRequestedAt = now
  // printTrigger = "reprint"
  // Autorise meme si printConfig.enabled=false (action staff manuelle)

// --- ECRAN SALLE ---
markPickedUp(ticketId)
  // pickedUpAt = now
```

---

## 6. Kitchen KDS — Detailed design

### 6.1 File structure

```
packages/admin/src/pages/kitchen/
  kitchen-page.tsx              MODIFIER : monte singletons + PrintStatusBadge
  ticket-card.tsx               MODIFIER : gros boutons + badge print + reprint
  ticket-timer.tsx              existant, pas de changement
  station-filter.tsx            existant, pas de changement
  kitchen-sound-manager.tsx     CREER
  kitchen-print-trigger.tsx     CREER
  print-ticket-layout.tsx       CREER
  print-status-badge.tsx        CREER
```

### 6.2 kitchen-page.tsx (MODIFY)

Responsibilities:
- Loads storeId + storeSettings
- Mounts two singletons: `<KitchenSoundManager>` + `<KitchenPrintTrigger>`
- Renders `<PrintStatusBadge>`
- All of it inside a `<ToastProvider>`

```tsx
<ToastProvider>
  <KitchenSoundManager storeId={storeId} soundConfig={store.soundConfig} />
  <KitchenPrintTrigger
    storeId={storeId}
    printConfig={store.printConfig}
    soundConfig={store.soundConfig}
    onToast={enqueueToast}
  />
  <PrintStatusBadge storeId={storeId} />
  {/* Kanban existant */}
</ToastProvider>
```

### 6.3 ticket-card.tsx (MODIFY)

Touch layout:

```
+-------------------------------------+
|  #A172 . Uber Eats . Livraison      |
|  timer 8 min  .  [V] imprime  [R]   |  <- badge print + bouton reprint icone
|------------------------------------- |
|  2x Burger Classic                   |
|     - Sans oignons, Sauce a part     |
|  1x Menu Tenders                     |
|     - Coca, Frites large             |
|--------------------------------------|
|  +-------------------------------+   |  <- sticky footer
|  |        > COMMENCER            |   |     min-height: 64px
|  +-------------------------------+   |     font-size: 18px+
+--------------------------------------+
```

- Primary button (the next action): sticky footer, full width
  - `new` → "Commencer" (blue)
  - `in_progress` → "Pret !" (green)
  - `ready` → "Termine" (grey) plus a secondary "Marquer recupere" button
- Reprint button: a small printer icon, to the right of the print badge
- Print badge: pending → stopwatch, printed → green check, failed → orange warning
- A "Non imprimee" label once pending exceeds 2min

### 6.4 kitchen-sound-manager.tsx (CREATE)

Inputs: storeId, soundConfig

Data it subscribes to:
- `getOverdueCount(storeId)` → the number of late tickets
- `getPrintStuckCount(storeId)` → the number of unprinted tickets

Behavior:
1. On mount → an overlay reading "Cliquer pour activer les alertes sonores"
2. On click → the AudioContext initializes and the overlay disappears
3. Rules (anti-cacophony = one beep per store, not per ticket):
   - New ticket → a short "ding" (fired when the list changes)
   - overdueCount > 0 → a beep every 30s
   - printStuckCount > 0 → a beep every 30s
4. A visual banner while a beep is active: "X tickets en retard / X non imprimes"
5. Honors soundConfig (enabled + volume per event)

Sounds: mp3 files in `/public/sounds/` (three lightweight files)

### 6.5 kitchen-print-trigger.tsx (CREATE)

Inputs: storeId, printConfig, soundConfig, onToast

Data: `printQueue = getPrintQueue(storeId)`

Rules:
- If `!printConfig.enabled` → never print automatically (a reprint is a staff action and is exempt)
- Locking: `isPrintingRef` + `currentTicketIdRef` (dedup)

Flow:
1. If `isPrintingRef.current === true` → skip
2. Take `printQueue[0]` (head of the queue)
3. `isPrintingRef.current = true`, `currentTicketIdRef.current = ticket._id`
4. Toast "Impression #A172..."
5. Render `<PrintTicketLayout>` inside an isolated iframe
6. Call `iframe.contentWindow.print()`
7. Listen for `onafterprint` → `markPrintSent(ticket._id)` plus an "Impression lancee" toast
8. 20s with no `onafterprint` → `markPrintFailed(ticket._id, "timeout")` plus an "Impression bloquee" toast
9. Clear the handlers, set `isPrintingRef.current = false` → the next ticket starts

### 6.6 print-ticket-layout.tsx (CREATE)

Rendered inside an isolated iframe, not in the main DOM.

Props: ticket data + paperSize + variant ("order" | "pickup")

Layout (80mm, 72mm of usable width):

```
[LOGO STORE]
COMMANDE #A172 (ou TICKET RETRAIT)
12/03/2026 19:42
Source: Uber Eats
Type: Livraison
---
Client: Mamadou S.
Tel: 06 00 00 00 00
---
2x BURGER CLASSIC
   - Sans oignons
   - Sauce a part
   > Extra croustillant
1x MENU TENDERS
   - Coca
   - Frites large
---
Note: Sonner a l'interphone 4B
---
ALLERGIE: Arachides
---
Temps estime: 12 min
---
[QR CODE] (lien reimpression)
sharuka78.fr
Powered by Be In Digital
```

58mm layout (48mm of usable width): the same, minus the QR, with tighter spacing and a short identifier, "Reprint: A172".

Variant: prints "TICKET COMMANDE" or "TICKET RETRAIT" depending on `printTrigger`.

### 6.7 print-status-badge.tsx (CREATE)

A badge in the KDS header:
- Green when nothing is wrong
- Red on `hasPendingOlderThan(30s)` OR `hasFailedRecent(10min)`
- A toast once pending exceeds 1min (once only, with `lastToastAtRef` guarding against spam)
- Sound is delegated to the SoundManager through `getPrintStuckCount`

---

## 7. Front-of-House Screen — Detailed design

### 7.1 File structure

```
packages/convex-schema/src/tables/stores.ts              MODIFIER (displayConfig)
packages/convex-schema/src/tables/kitchenTickets.ts       MODIFIER (startedAt, readyAt, pickedUpAt, completedAt)
packages/convex-functions/src/kitchenTickets.ts            MODIFIER (getForDisplay, markPickedUp, invariants updateStatus)
packages/restaurant/src/constants/display.ts               CREER
packages/restaurant/src/types/display.ts                   CREER
packages/admin/src/pages/kitchen/ticket-card.tsx           MODIFIER (bouton "Marquer recupere")
packages/admin/src/pages/settings/display-settings.tsx     CREER (optionnel V1)

apps/restaurant-theme/app/display/[storeId]/
  page.tsx                    CREER
  display-column.tsx          CREER
  display-ticket-number.tsx   CREER
  display-header.tsx          CREER
  display-footer.tsx          CREER
  display.css                 CREER
  use-pagination.ts           CREER
  use-flash-detection.ts      CREER
```

### 7.2 Constants

```typescript
// packages/restaurant/src/constants/display.ts
DISPLAY_LIMITS.maxPreparing = 10
DISPLAY_LIMITS.maxReady = 10
DISPLAY_LIMITS.rotationSeconds = 15
```

### 7.3 Types

```typescript
// packages/restaurant/src/types/display.ts
type DisplayTicket = { _id, orderNumber, status, createdAt, readyAt }
type DisplayPayload = { preparing, ready, displayConfig, storeBranding, serverNow }
```

### 7.4 Layout

```
+----------------------------------------------------------+
|                    [LOGO RESTAURANT]                      |
|                 19:42 — Lundi   [Live .]                  |
+----------------------------+-----------------------------+
|                            |                             |
|     EN PREPARATION         |      PRETS                  |
|                            |                             |
|     A172                   |      A168  <- flash 3s      |
|     A175                   |      A170                   |
|     A176                   |      A171                   |
|     A178                   |                             |
|     A179                   |                             |
|                            |                             |
|                  Page 1/2  |                             |
+----------------------------+-----------------------------+
|              sharuka78.fr — Powered by BeInDigital        |
+----------------------------------------------------------+
```

### 7.5 Components

**page.tsx**: a Convex subscription to `getForDisplay(storeId)`, full-screen, no auth, imports display.css

**display-header.tsx**: the store logo centered, a live clock (updated every minute), the weekday, and a pulsing "Live" dot

**display-column.tsx**: a reusable column component — a title plus a list of numbers, paginated past the max (auto-rotating every 15s), showing "Page 1/2"

**display-ticket-number.tsx**: the order number in large type (64px+), with a 3s flash animation the first time a ticket shows up in "ready" (detected with a local Set of already-seen tickets)

**display-footer.tsx**: the restaurant URL plus "Powered by Be In Digital"

### 7.6 Hooks

**use-pagination.ts**: the rotation timer (15s), the page count derived from the limits, and a reset to page 1 whenever the data changes

**use-flash-detection.ts**: keeps a Set of already-seen IDs and returns the ones to flash (new since the last render)

### 7.7 Styles (display.css)

- Dark mode by default (dark background, light text)
- Numbers at 64px minimum
- High contrast for TV readability
- Cursor hidden (kiosk mode)
- Flash animation (a subtle 3s blink)
- Pulse animation for the "Live" dot
- No scrolling (`overflow: hidden`)

### 7.8 Pickup validation

Staff confirm from the KDS (the "Marquer recupere" button once status=ready) or from the admin orders page. The front-of-house screen is a **passive display** — nobody touches the TV.

A number disappears when:
1. Staff click "Marquer recupere" → `markPickedUp(ticketId)` → `pickedUpAt = now` → it vanishes immediately
2. Auto-dismiss: `readyAt + autoDismissMinutes > now` → it vanishes on its own
3. The ticket moves to status "done" → it vanishes immediately

### 7.9 Display settings (optional in V1)

An admin page: an autoDismissEnabled toggle and an autoDismissMinutes input, saved to `store.displayConfig`.

---

## 8. Customer Mobile Tracking — Detailed design

### 8.1 File structure

```
packages/convex-functions/src/kitchenTickets.ts    MODIFIER (getByTrackingToken)

apps/restaurant-theme/app/(storefront)/track/[token]/
  page.tsx                  CREER
  tracking-timeline.tsx     CREER
  tracking-countdown.tsx    CREER
  tracking-store-info.tsx   CREER
  tracking-header.tsx       CREER
  tracking-footer.tsx       CREER
```

### 8.2 Route and access

```
/track/[token]  — ex: /track/V1StGXR8_Z5jdHi6B-myT
```

A public URL, no auth, a standalone page (no app header, no menu).

### 8.3 Error screens

- Token not found → "Commande introuvable — le lien est invalide." plus a "Retourner sur {storeName}" link
- Ticket done with completedAt older than 24h → "Cette commande est terminee depuis le {date}." plus the same link
- If store branding cannot be resolved → fall back to generic BeInDigital branding

### 8.4 Mobile layout

```
+-------------------------+
|     [LOGO RESTAURANT]   |
|      Sharuka Burger      |
|                         |
|    Commande #A172       |
|    Livraison            |
|                         |
| - - - - - - - - - - - - |
|                         |
|  [V] Commande recue     |  <- 19:42
|  |                      |
|  [V] En preparation     |  <- 19:44
|  |                      |
|  [o] Prete              |  <- estime ~19:56
|  |                      |
|  [ ] Terminee           |
|                         |
| - - - - - - - - - - - - |
|                         |
|  timer Pret dans ~12 min|  <- countdown live
|                         |
| - - - - - - - - - - - - |
|                         |
|  pin Sharuka Burger     |
|  12 rue de la Paix      |  <- seulement pour pickup/dine_in
|  75001 Paris            |
|  [Ouvrir dans Maps]     |
|                         |
| - - - - - - - - - - - - |
|     sharuka78.fr        |
|  Powered by BeInDigital |
+-------------------------+
```

### 8.5 Components

**page.tsx**: a Convex subscription to `getByTrackingToken(token)`, error handling (not found, expired), a mobile viewport meta tag, light theme

**tracking-header.tsx**: logo, store name, order number, and type (delivery / pickup / dine-in)

**tracking-timeline.tsx**: four vertical steps, adapted to orderType
- pickup/dine_in: "Recue" → "En preparation" → "Prete" → "Recuperee"
- delivery: "Recue" → "En preparation" → "Prete" → "Livree"
- One icon per step: a check (done), a pulsing circle (current), an empty circle (upcoming)
- A timestamp once the step has passed (e.g. "19:42")
- "Estime ~19:56" when it is the next step and estimatedReadyAt exists

**tracking-countdown.tsx**:
- `status in ["new","in_progress"]` → "Pret dans ~X min" (Math.max(0, Math.ceil((estimatedReadyAt - now) / 60000)))
- If `estimatedReadyAt` does not exist → render nothing
- If `estimatedReadyAt < now` (running late) → "Bientot pret"
- If `status = "ready"` → "Votre commande est prete !", animated
- If `status = "done"` → "Commande terminee — merci !"
- Updates every 30s

**tracking-store-info.tsx**: only when orderType is "pickup" or "dine_in"
- The store name plus its full address
- A Google Maps link: `https://www.google.com/maps/search/?api=1&query={encodedAddress}`

**tracking-footer.tsx**: the restaurant URL plus "Powered by BeInDigital"

### 8.6 UX considerations

- A Convex subscription gives real time for free, so there is no pull-to-refresh
- Viewport meta: `width=device-width, initial-scale=1`
- Light theme by default (this is a phone, not a TV)
- Subtle animation: a pulse on the current step, and a soft transition when the status changes
- Dynamic favicon: a green dot when the order is ready (visible in the tab strip)
- Standalone page: no login, no navigation

---

## 9. Printing — Browser-kiosk onboarding

### Install walkthrough (30 min, doable remotely)

1. The owner receives an email with a download link → a .bat script (Windows) or a .sh script (Mac)
2. Double-click the script:
   - Chrome is detected, or installed automatically
   - A "KDS BeInDigital" shortcut is created on the desktop
   - The shortcut points at: `chrome.exe --kiosk-printing https://app.beindigital.com/kds?store=XXX`
3. The owner opens Printer Settings:
   - Sets the thermal printer as the default printer
   - Sets the paper format (80mm x continuous)
   - This is a one-time step
4. Double-click the KDS shortcut:
   - Chrome opens, and F11 gives full screen
   - Click "Tester l'impression" in the dashboard
   - The ticket prints with no dialog
   - Done

### Browser-kiosk limitations

- Layout comes from CSS `@media print`, not native ESC/POS
- No automatic paper cut
- No cash-drawer kick
- Paper width is configured in the printer settings (once)
- If the customer does not need the cash drawer, this covers 95% of cases

---

## 10. Printer alerts — three levels

| Level | Trigger | Action |
|--------|-------------|--------|
| Red badge | Ticket pending > 30s OR a recent failure < 10min | A red dot in the KDS header |
| Staff toast | Ticket pending > 1min | A notification in the KDS (once only, anti-spam) |
| Audio alert | Ticket pending > 2min | A beep repeated every 30s through the SoundManager |

Fallback when offline:
1. An immediate visual alert (badge + toast)
2. If a backup printer is configured → fail over automatically (V2)
3. With no backup → an audio alert and the order flagged "Non imprimee"

---

## 11. Full file recap

### Files to MODIFY

| File | Changes |
|---------|--------------|
| `packages/convex-schema/src/tables/stores.ts` | orderConfirmation, printConfig, displayConfig, soundConfig |
| `packages/convex-schema/src/tables/products.ts` | estimatedPrepTime |
| `packages/convex-schema/src/tables/kitchenTickets.ts` | startedAt, readyAt, completedAt, pickedUpAt, trackingToken, estimatedReadyAt, printStatus, printAttempts, printRequestedAt, printTrigger, lastPrintAt, printFailedAt, lastPrintError + 5 indexes |
| `packages/convex-functions/src/kitchenTickets.ts` | getPrintQueue, getOverdueCount, getPrintStuckCount, getForDisplay, getByTrackingToken, markPrintSent, markPrintFailed, requestReprint, markPickedUp + updateStatus invariants |
| `packages/admin/src/pages/kitchen/kitchen-page.tsx` | Mounts the singletons + PrintStatusBadge |
| `packages/admin/src/pages/kitchen/ticket-card.tsx` | Large buttons + print badge + reprint + mark as picked up |

### Files to CREATE

| File | Description |
|---------|------------|
| `packages/restaurant/src/constants/display.ts` | Front-of-house screen constants |
| `packages/restaurant/src/types/display.ts` | DisplayTicket and DisplayPayload types |
| `packages/admin/src/pages/kitchen/kitchen-sound-manager.tsx` | Configurable audio alerts |
| `packages/admin/src/pages/kitchen/kitchen-print-trigger.tsx` | Browser-kiosk print queue |
| `packages/admin/src/pages/kitchen/print-ticket-layout.tsx` | HTML/CSS layout of the ticket |
| `packages/admin/src/pages/kitchen/print-status-badge.tsx` | Printer status badge |
| `packages/admin/src/pages/settings/display-settings.tsx` | Front-of-house screen settings (optional in V1) |
| `apps/restaurant-theme/app/display/[storeId]/page.tsx` | Front-of-house screen page |
| `apps/restaurant-theme/app/display/[storeId]/display-column.tsx` | Column with pagination |
| `apps/restaurant-theme/app/display/[storeId]/display-ticket-number.tsx` | Number with flash |
| `apps/restaurant-theme/app/display/[storeId]/display-header.tsx` | Header with clock + Live |
| `apps/restaurant-theme/app/display/[storeId]/display-footer.tsx` | Branding footer |
| `apps/restaurant-theme/app/display/[storeId]/display.css` | Dark-mode TV styles |
| `apps/restaurant-theme/app/display/[storeId]/use-pagination.ts` | Pagination rotation hook |
| `apps/restaurant-theme/app/display/[storeId]/use-flash-detection.ts` | New-ticket detection hook |
| `apps/restaurant-theme/app/(storefront)/track/[token]/page.tsx` | Customer tracking page |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-timeline.tsx` | Vertical timeline |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-countdown.tsx` | Estimated-time countdown |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-store-info.tsx` | Store address + Google Maps |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-header.tsx` | Header with logo + order |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-footer.tsx` | Branding footer |

**Total: 6 files modified + 21 files created**

---

## 12. Suggested implementation order

### Phase 1 — Schema & Backend
1. Update the schemas (stores, products, kitchenTickets)
2. Add the indexes
3. Implement the mutations (updateStatus invariants, markPickedUp, markPrintSent/Failed, requestReprint)
4. Implement the queries (getPrintQueue, getOverdueCount, getPrintStuckCount, getForDisplay, getByTrackingToken)

### Phase 2 — Upgraded KDS
5. Update ticket-card (large buttons + print badge + reprint)
6. Create print-ticket-layout (iframe, 80mm/58mm layouts)
7. Create kitchen-print-trigger (print queue)
8. Create print-status-badge
9. Create kitchen-sound-manager
10. Update kitchen-page (wire in the singletons)

### Phase 3 — Front-of-house screen
11. Create the constants and types
12. Create the display page and its components (header, column, ticket-number, footer)
13. Create the hooks (pagination, flash-detection)
14. Create display.css
15. Add the "Marquer recupere" button to ticket-card

### Phase 4 — Customer tracking
16. Create the tracking page and its components (header, timeline, countdown, store-info, footer)
17. Handle the error screens (not found, expired)

### Phase 5 — Admin settings
18. Create display-settings (optional in V1)
19. Fold the print settings into the store's existing settings

### Phase 6 — Tests
20. Unit tests (services, utils)
21. E2E tests (the full KDS flow, front-of-house screen, tracking)
