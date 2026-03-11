# Design — Kitchen Display, Ecran Salle & Tracking Client

**Date** : 2026-02-23
**Statut** : Valide — pret pour implementation
**Branche** : kitchen

---

## 1. Understanding Summary

### Ce qu'on construit

3 interfaces liees par le flux de commande + 1 systeme d'impression browser kiosk :

- **KDS cuisine** : Kanban ameliore avec gros boutons tactiles, alertes sonores/visuelles configurables, impression browser kiosk via `window.print()` + Chrome `--kiosk-printing`
- **Ecran salle** : Double zone "en preparation" / "prets a recuperer", validation pickup par staff + auto-dismiss configurable, optimise TV
- **Tracking mobile client** : Timeline statut + temps estime restant, acces par token opaque nanoid 21+

### Pour qui

| Interface | Utilisateur | Acces |
|-----------|------------|-------|
| KDS | Staff cuisine | Auth staff existante |
| Ecran salle | Clients en salle + staff comptoir | URL publique + storeId, pas d'auth |
| Tracking mobile | Client final | Lien avec token opaque nanoid 21+ |

### Flux complet

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

### Non-goals explicites

- Pas de multi-station KDS en V1
- Pas d'impression cloud en V1 (architecture prete, implementation plus tard)
- Pas de vue livreur dediee
- Pas de tracking position livreur sur carte
- Pas de notifications push/SMS au client
- Pas de tiroir-caisse automatique (limite browser kiosk)
- Pas de detail items dans le tracking client (le client connait sa commande)

---

## 2. Assumptions

- L'impression browser kiosk est declenchee **cote client dans le navigateur du KDS** via `window.print()` sur subscription Convex
- Chrome `--kiosk-printing` bypass le dialog d'impression et envoie a l'imprimante par defaut
- Le temps estime par produit est un **champ optionnel** — si absent, pas affiche au client
- L'ecran salle est une **page full-screen** optimisee TV (gros texte, fond sombre, pas de header/nav)
- Les alertes sonores necessitent un **clic initial** du staff pour debloquer l'autoplay audio (restriction navigateur)
- Les APIs cloud (Sunmi/Star/Epson) seront appelees depuis Convex actions — **hors scope V1**
- Le layout 58mm est identique au 80mm mais sans QR code et avec espacement reduit
- `window.print()` ne garantit pas que le papier est sorti — on sait seulement que le process a ete declenche
- Le token opaque nanoid 21+ est suffisamment long pour empecher le brute-force
- Un ticket avec `status="done"` et `completedAt > 24h` est considere expire pour le tracking

---

## 3. Decision Log

| # | Decision | Choix | Alternatives considerees | Raison |
|---|----------|-------|-------------------------|--------|
| 1 | Confirmation commande | Configurable par store (auto ou manual) | Toujours auto, toujours manuelle, par canal | Chaque restaurant a ses habitudes |
| 2 | KDS interaction | Gros boutons dedies (min 64px, font 18px+) | Touch simple, swipe, mode plein ecran sequentiel | Mains sales/gantees en cuisine, cible tactile large |
| 3 | Multi-station KDS | Hors scope V1 | Implementer maintenant | YAGNI, a ajouter plus tard si besoin |
| 4 | Alertes sonores KDS | Configurables par evenement + volume, 1 bip par store (anti-cacophonie) | Son unique generique, pas de son | Adaptable a chaque ambiance, pas de cacophonie avec N tickets |
| 5 | Impression V1 | Browser kiosk (Chrome --kiosk-printing + window.print()) | Serveur d'impression local, Electron app, cloud direct | Zero cout, zero dependance, friction unique a l'install |
| 6 | Architecture impression | Multi-provider unifie (browser + 3 cloud) | Browser uniquement | Pret pour Sunmi/Star/Epson sans refactoring |
| 7 | Providers cloud (hors scope V1) | Sunmi NT311 (recommande), Star mC-Print3, Epson TM-m30II | Autres marques | Prix, robustesse IP52, maturite cloud API |
| 8 | Triggers impression | Configurable par store, defaults = confirmed + ready + reprint | Fixes, non configurables | Chaque restaurant a son setup (avec/sans comptoir pickup, food truck sans imprimante) |
| 9 | Format papier | 80mm default, 58mm supporte (sans QR, espacement reduit) | 80mm uniquement | Couvre tout le marche |
| 10 | Layout ticket | Logo, #commande, source/type, client, items+options+notes, allergies, temps estime, QR reimpression, branding | Layout simplifie | Complet et lisible, toutes les infos necessaires en cuisine |
| 11 | QR sur ticket | Declenche reimpression (staff scanne → reprint) | Lien tracking client, lien admin | Pratique sans chercher dans l'UI |
| 12 | Variant ticket | "TICKET COMMANDE" vs "TICKET RETRAIT" selon printTrigger | Ticket unique | Distinction visuelle claire pour le staff |
| 13 | Impression dans iframe | Iframe isolee pour le rendu ticket | CSS @media print avec display:none sur le body | Pas de CSS app qui parasite, impression stable |
| 14 | Queue impression | 1 job a la fois (isPrintingRef + currentTicketIdRef), timeout 20s | Parallele, sans timeout | Dedup, gestion echec, pas de race condition |
| 15 | Statut imprimante | 3 niveaux : badge rouge (30s) → toast (1min, une fois) → alerte sonore (2min) | Alerte immediate, pas d'alerte | Detection progressive, anti-spam |
| 16 | Fallback impression | Badge "non imprimee" + alerte sonore, reprint manuel toujours autorise | Backup auto vers autre imprimante | V1 simple, backup auto = V2 |
| 17 | Ecran salle format | Double zone classique fast-food, fond sombre, numeros 64px+ | Zone unique, liste scrollable | Lisible de loin (5m+), classique et reconnu |
| 18 | Ecran salle pickup | Validation manuelle staff (depuis KDS ou admin) + auto-dismiss configurable (default 15min) | Touch sur l'ecran TV, auto seulement | Ecran TV = display passif, double securite (manuel + auto) |
| 19 | Ecran salle pagination | Rotation auto toutes les 15s si > 10 numeros par zone | Scroll, pas de pagination | Pas de scroll sur TV, rotation lisible |
| 20 | Ecran salle heartbeat | Pastille "Live" qui pulse + horloge mise a jour chaque minute | Rien | Le staff sait que l'ecran n'est pas fige |
| 21 | Temps estime | Defini par produit dans le catalogue (champ optionnel) | Formule par nb items, dynamique base sur charge, combine catalogue+charge | Le restaurateur connait ses temps mieux qu'un algorithme |
| 22 | Tracking client contenu | Timeline statut + countdown temps estime | Statut simple, detail items, position livreur | Suffisant sans surcharger, pas de donnees sensibles |
| 23 | Tracking client acces | Token opaque nanoid 21+ dans l'URL | orderId Convex, token signe JWT | Anti brute-force, simple, pas d'expiration a gerer |
| 24 | Tracking client erreur | "Commande introuvable" + "Commande terminee" (> 24h) | Rien (404 generique) | UX propre avec lien retour vers le store |
| 25 | Temps reel | Convex subscriptions partout (KDS, ecran salle, tracking) | Polling pour tracking client | Stack existante, ~100-500ms de latence |
| 26 | Securite KDS | Auth staff existante | URL simple, PIN | Outil interne, doit etre protege |
| 27 | Securite ecran salle | URL + storeId, pas d'auth | Auth, PIN, token | Donnees non sensibles (numeros seulement), ecran TV dedie |
| 28 | Securite tracking | Token opaque nanoid 21+ | JWT signe, orderId | Suffisamment long pour empecher brute-force |
| 29 | Approche architecture | Modulaire par package (logique dans packages/, pages minces dans app/) | Tout dans l'app, micro-apps separees | Coherent avec l'architecture existante, reutilisable entre themes |
| 30 | Onboarding impression | Script auto (.bat/.sh) qui configure Chrome + raccourci KDS | Documentation manuelle, app Electron | 30 min max, faisable a distance, zero dependance |

---

## 4. Schema — Modifications

### 4.1 `packages/convex-schema/src/tables/stores.ts` — Nouveaux champs

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

### 4.2 `packages/convex-schema/src/tables/products.ts` — Nouveau champ

```typescript
estimatedPrepTime?: number  // en minutes, optionnel
```

### 4.3 `packages/convex-schema/src/tables/kitchenTickets.ts` — Nouveaux champs

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

### 4.5 Invariants backend dans `updateStatus`

Toute transition de statut enforce les timestamps :
- `"in_progress"` → `startedAt = now` (si pas deja set)
- `"ready"` → `readyAt = now`
- `"done"` → `completedAt = now`

Toute mutation qui set `printStatus="pending"` DOIT aussi set `printRequestedAt=now`.
Si `printConfig.enabled=false` ou trigger pas actif → `printStatus="not_required"`.
Aucun ticket ne peut etre `printStatus="pending"` sans `printRequestedAt`. C'est un invariant.

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

## 6. KDS Cuisine — Design detaille

### 6.1 Structure fichiers

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

### 6.2 kitchen-page.tsx (MODIFIER)

Responsabilites :
- Charge storeId + storeSettings
- Monte 2 singletons : `<KitchenSoundManager>` + `<KitchenPrintTrigger>`
- Affiche `<PrintStatusBadge>`
- Le tout dans un `<ToastProvider>`

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

### 6.3 ticket-card.tsx (MODIFIER)

Layout tactile :

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

- Bouton principal (action suivante) : sticky footer, pleine largeur
  - `new` → "Commencer" (bleu)
  - `in_progress` → "Pret !" (vert)
  - `ready` → "Termine" (gris) + bouton secondaire "Marquer recupere"
- Bouton reprint : icone imprimante petit, a droite du badge print
- Badge print : pending → chrono, printed → check vert, failed → warning orange
- Label "Non imprimee" si pending > 2min

### 6.4 kitchen-sound-manager.tsx (CREER)

Inputs : storeId, soundConfig

Donnees ecoutees :
- `getOverdueCount(storeId)` → nombre de tickets en retard
- `getPrintStuckCount(storeId)` → nombre de tickets non imprimes

Comportement :
1. Au mount → overlay "Cliquer pour activer les alertes sonores"
2. Au clic → AudioContext initialise, overlay disparait
3. Regles (anti-cacophonie = 1 bip par store, pas par ticket) :
   - Nouveau ticket → son "ding" court (declenche sur changement de liste)
   - overdueCount > 0 → bip toutes les 30s
   - printStuckCount > 0 → bip toutes les 30s
4. Banniere visuelle quand un bip est actif : "X tickets en retard / X non imprimes"
5. Respecte soundConfig (enabled + volume par evenement)

Sons : fichiers mp3 dans `/public/sounds/` (3 fichiers legers)

### 6.5 kitchen-print-trigger.tsx (CREER)

Inputs : storeId, printConfig, soundConfig, onToast

Donnees : `printQueue = getPrintQueue(storeId)`

Regles :
- Si `!printConfig.enabled` → n'imprime jamais auto (sauf reprint = action staff)
- Verrouillage : `isPrintingRef` + `currentTicketIdRef` (dedup)

Flow :
1. Si `isPrintingRef.current === true` → ignore
2. Prendre `printQueue[0]` (premier en file)
3. `isPrintingRef.current = true`, `currentTicketIdRef.current = ticket._id`
4. Toast "Impression #A172..."
5. Rendre `<PrintTicketLayout>` dans iframe isolee
6. Appeler `iframe.contentWindow.print()`
7. Ecouter `onafterprint` → `markPrintSent(ticket._id)` + toast "Impression lancee"
8. Timeout 20s sans `onafterprint` → `markPrintFailed(ticket._id, "timeout")` + toast "Impression bloquee"
9. Clear handlers + `isPrintingRef.current = false` → prochain ticket se lance

### 6.6 print-ticket-layout.tsx (CREER)

Rendu dans iframe isolee (pas dans le DOM principal).

Props : ticket data + paperSize + variant ("order" | "pickup")

Layout (80mm, largeur utile 72mm) :

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

Layout 58mm (largeur utile 48mm) : identique mais sans QR, espacement reduit, identifiant court "Reprint: A172".

Variant : affiche "TICKET COMMANDE" ou "TICKET RETRAIT" selon `printTrigger`.

### 6.7 print-status-badge.tsx (CREER)

Badge dans le header du KDS :
- Vert si aucun probleme
- Rouge si `hasPendingOlderThan(30s)` OU `hasFailedRecent(10min)`
- Toast si pending > 1min (une seule fois, `lastToastAtRef` anti-spam)
- Son delegue au SoundManager via `getPrintStuckCount`

---

## 7. Ecran Salle — Design detaille

### 7.1 Structure fichiers

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

### 7.2 Constantes

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

### 7.5 Composants

**page.tsx** : subscription Convex `getForDisplay(storeId)`, full-screen, pas d'auth, import display.css

**display-header.tsx** : logo store centre, horloge live (update chaque minute), jour de la semaine, pastille "Live" qui pulse

**display-column.tsx** : composant colonne reutilisable, titre + liste de numeros, pagination si > max (rotation auto 15s), affichage "Page 1/2"

**display-ticket-number.tsx** : numero de commande en gros (64px+), animation flash 3s quand le ticket apparait nouvellement dans "ready" (detection via Set local des tickets deja vus)

**display-footer.tsx** : URL du restaurant + "Powered by Be In Digital"

### 7.6 Hooks

**use-pagination.ts** : timer de rotation (15s), calcul nb pages selon limites, reset a page 1 quand les donnees changent

**use-flash-detection.ts** : maintient un Set des IDs deja vus, retourne les IDs a flasher (nouveaux depuis le dernier render)

### 7.7 Styles (display.css)

- Mode sombre par defaut (fond sombre, texte clair)
- Numeros en 64px minimum
- Contraste eleve pour lisibilite TV
- Curseur cache (mode kiosk)
- Animation flash (clignotement subtil 3s)
- Animation pulse pour pastille "Live"
- Pas de scroll (`overflow: hidden`)

### 7.8 Pickup validation

Le staff valide depuis le KDS (bouton "Marquer recupere" quand status=ready) ou depuis la page admin orders. L'ecran salle est un **display passif** — pas de touch sur la TV.

Disparition d'un numero :
1. Staff clique "Marquer recupere" → `markPickedUp(ticketId)` → `pickedUpAt = now` → disparition immediate
2. Auto-dismiss : `readyAt + autoDismissMinutes > now` → disparition auto
3. Ticket passe en status "done" → disparition immediate

### 7.9 Settings display (optionnel V1)

Page admin : toggle autoDismissEnabled + input autoDismissMinutes, sauvegarde dans `store.displayConfig`.

---

## 8. Tracking Mobile Client — Design detaille

### 8.1 Structure fichiers

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

### 8.2 Route et acces

```
/track/[token]  — ex: /track/V1StGXR8_Z5jdHi6B-myT
```

URL publique, pas d'auth, page standalone (pas de header app, pas de menu).

### 8.3 Ecrans d'erreur

- Token introuvable → "Commande introuvable — le lien est invalide." + lien "Retourner sur {storeName}"
- Ticket done + completedAt > 24h → "Cette commande est terminee depuis le {date}." + meme lien
- Si store branding non resolvable → branding generique BeInDigital

### 8.4 Layout mobile

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

### 8.5 Composants

**page.tsx** : subscription Convex `getByTrackingToken(token)`, gestion erreurs (introuvable, expire), meta viewport mobile, theme clair

**tracking-header.tsx** : logo + nom store + numero commande + type (livraison/pickup/sur place)

**tracking-timeline.tsx** : 4 etapes verticales adaptees selon orderType
- pickup/dine_in : "Recue" → "En preparation" → "Prete" → "Recuperee"
- delivery : "Recue" → "En preparation" → "Prete" → "Livree"
- Icone par etape : check (done), cercle pulse (current), cercle vide (future)
- Timestamp si deja passe (ex: "19:42")
- "Estime ~19:56" si c'est l'etape suivante et estimatedReadyAt existe

**tracking-countdown.tsx** :
- `status in ["new","in_progress"]` → "Pret dans ~X min" (Math.max(0, Math.ceil((estimatedReadyAt - now) / 60000)))
- Si `estimatedReadyAt` n'existe pas → ne rien afficher
- Si `estimatedReadyAt < now` (en retard) → "Bientot pret"
- Si `status = "ready"` → "Votre commande est prete !" avec animation
- Si `status = "done"` → "Commande terminee — merci !"
- Update toutes les 30s

**tracking-store-info.tsx** : seulement si orderType = "pickup" ou "dine_in"
- Nom + adresse complete du store
- Lien Google Maps : `https://www.google.com/maps/search/?api=1&query={encodedAddress}`

**tracking-footer.tsx** : URL du restaurant + "Powered by BeInDigital"

### 8.6 Considerations UX

- Convex subscription = temps reel automatique, pas de pull-to-refresh
- Meta viewport : `width=device-width, initial-scale=1`
- Theme clair par defaut (telephone, pas TV)
- Animation subtile : pulse sur l'etape en cours, transition douce au changement de statut
- Favicon dynamique : pastille verte quand "pret" (visible dans les onglets)
- Page standalone : pas de login, pas de navigation

---

## 9. Impression — Onboarding browser kiosk

### Scenario d'installation (30 min, faisable a distance)

1. Le restaurateur recoit un email avec un lien de telechargement → script .bat (Windows) ou .sh (Mac)
2. Double-clic sur le script :
   - Chrome detecte ou installe automatiquement
   - Raccourci "KDS BeInDigital" cree sur le bureau
   - Le raccourci pointe vers : `chrome.exe --kiosk-printing https://app.beindigital.com/kds?store=XXX`
3. Le restaurateur ouvre Parametres Imprimantes :
   - Selectionne l'imprimante thermique comme imprimante par defaut
   - Configure le format papier (80mm x continu)
   - C'est une seule fois
4. Double-clic sur le raccourci KDS :
   - Chrome s'ouvre, plein ecran possible avec F11
   - Clic "Tester l'impression" dans le dashboard
   - Le ticket sort sans dialog
   - C'est termine

### Limites browser kiosk

- Mise en page via CSS `@media print` (pas ESC/POS natif)
- Pas de coupure papier auto
- Pas d'ouverture tiroir-caisse
- Largeur papier configuree dans les parametres imprimante (une seule fois)
- Si le client n'a pas besoin du tiroir-caisse, couvre 95% des cas

---

## 10. Alertes imprimante — 3 niveaux

| Niveau | Declencheur | Action |
|--------|-------------|--------|
| Badge rouge | Ticket pending > 30s OU failed recent < 10min | Pastille rouge dans le header KDS |
| Toast staff | Ticket pending > 1min | Notification dans le KDS (une seule fois, anti-spam) |
| Alerte sonore | Ticket pending > 2min | Bip repete toutes les 30s via SoundManager |

Fallback si offline :
1. Alerte visuelle immediate (badge + toast)
2. Si imprimante backup configuree → basculer auto (V2)
3. Si pas de backup → alerte sonore + commande marquee "Non imprimee"

---

## 11. Recap complet des fichiers

### Fichiers a MODIFIER

| Fichier | Modifications |
|---------|--------------|
| `packages/convex-schema/src/tables/stores.ts` | orderConfirmation, printConfig, displayConfig, soundConfig |
| `packages/convex-schema/src/tables/products.ts` | estimatedPrepTime |
| `packages/convex-schema/src/tables/kitchenTickets.ts` | startedAt, readyAt, completedAt, pickedUpAt, trackingToken, estimatedReadyAt, printStatus, printAttempts, printRequestedAt, printTrigger, lastPrintAt, printFailedAt, lastPrintError + 5 indexes |
| `packages/convex-functions/src/kitchenTickets.ts` | getPrintQueue, getOverdueCount, getPrintStuckCount, getForDisplay, getByTrackingToken, markPrintSent, markPrintFailed, requestReprint, markPickedUp + invariants updateStatus |
| `packages/admin/src/pages/kitchen/kitchen-page.tsx` | Monte singletons + PrintStatusBadge |
| `packages/admin/src/pages/kitchen/ticket-card.tsx` | Gros boutons + badge print + reprint + marquer recupere |

### Fichiers a CREER

| Fichier | Description |
|---------|------------|
| `packages/restaurant/src/constants/display.ts` | Constantes ecran salle |
| `packages/restaurant/src/types/display.ts` | Types DisplayTicket, DisplayPayload |
| `packages/admin/src/pages/kitchen/kitchen-sound-manager.tsx` | Alertes sonores configurables |
| `packages/admin/src/pages/kitchen/kitchen-print-trigger.tsx` | Queue impression browser kiosk |
| `packages/admin/src/pages/kitchen/print-ticket-layout.tsx` | Layout HTML/CSS du ticket |
| `packages/admin/src/pages/kitchen/print-status-badge.tsx` | Badge statut imprimante |
| `packages/admin/src/pages/settings/display-settings.tsx` | Settings ecran salle (optionnel V1) |
| `apps/restaurant-theme/app/display/[storeId]/page.tsx` | Page ecran salle |
| `apps/restaurant-theme/app/display/[storeId]/display-column.tsx` | Colonne avec pagination |
| `apps/restaurant-theme/app/display/[storeId]/display-ticket-number.tsx` | Numero avec flash |
| `apps/restaurant-theme/app/display/[storeId]/display-header.tsx` | Header avec horloge + Live |
| `apps/restaurant-theme/app/display/[storeId]/display-footer.tsx` | Footer branding |
| `apps/restaurant-theme/app/display/[storeId]/display.css` | Styles mode sombre TV |
| `apps/restaurant-theme/app/display/[storeId]/use-pagination.ts` | Hook pagination rotation |
| `apps/restaurant-theme/app/display/[storeId]/use-flash-detection.ts` | Hook detection nouveaux tickets |
| `apps/restaurant-theme/app/(storefront)/track/[token]/page.tsx` | Page tracking client |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-timeline.tsx` | Timeline verticale |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-countdown.tsx` | Countdown temps estime |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-store-info.tsx` | Adresse store + Google Maps |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-header.tsx` | Header logo + commande |
| `apps/restaurant-theme/app/(storefront)/track/[token]/tracking-footer.tsx` | Footer branding |

**Total : 6 fichiers modifies + 21 fichiers crees**

---

## 12. Ordre d'implementation suggere

### Phase 1 — Schema & Backend
1. Modifier schemas (stores, products, kitchenTickets)
2. Ajouter indexes
3. Implementer mutations (updateStatus invariants, markPickedUp, markPrintSent/Failed, requestReprint)
4. Implementer queries (getPrintQueue, getOverdueCount, getPrintStuckCount, getForDisplay, getByTrackingToken)

### Phase 2 — KDS ameliore
5. Modifier ticket-card (gros boutons + badge print + reprint)
6. Creer print-ticket-layout (iframe, layout 80mm/58mm)
7. Creer kitchen-print-trigger (queue impression)
8. Creer print-status-badge
9. Creer kitchen-sound-manager
10. Modifier kitchen-page (integration singletons)

### Phase 3 — Ecran salle
11. Creer constantes + types
12. Creer page display + composants (header, column, ticket-number, footer)
13. Creer hooks (pagination, flash-detection)
14. Creer display.css
15. Ajouter bouton "Marquer recupere" dans ticket-card

### Phase 4 — Tracking client
16. Creer page tracking + composants (header, timeline, countdown, store-info, footer)
17. Gerer ecrans d'erreur (introuvable, expire)

### Phase 5 — Settings admin
18. Creer display-settings (optionnel V1)
19. Integrer print settings dans les settings existants du store

### Phase 6 — Tests
20. Tests unitaires (services, utils)
21. Tests E2E (flux complet KDS, ecran salle, tracking)
