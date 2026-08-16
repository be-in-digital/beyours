# Plan: add a "Terminées" tab to the KDS

## Context
Today the KDS only shows the three active columns (En attente, En cours, Prêt). The user wants to browse completed orders in a separate tab, with search and filters.

## Approach
Add an `Actif / Terminées` tab system to the KDS using the `Tabs variant="line"` component (a pattern already used in OrdersContent and ProductsContent).

## Files to change

### 1. `apps/restaurant-theme/components/admin/kitchen/KitchenContent.tsx`
- Wrap it in `<Tabs defaultValue="active">` with two tabs:
  - **Actif**: the current kanban (three columns)
  - **Terminées**: a new `CompletedTickets` component
- The KDS singletons (SoundManager, PrintTrigger, PrintStatusBadge, StationFilter) stay outside the tabs so they remain visible at all times

### 2. `apps/restaurant-theme/components/admin/kitchen/CompletedTickets.tsx` (new)
- Uses `api.kitchenTickets.getByStatus` with `status: "completed"` (an existing indexed query)
- **Search bar**: an `Input` with a Search icon (filters on orderNumber, customerName, productName)
- **Filters**:
  - Source (Tous / Site web / Uber Eats / Deliveroo / Caisse) through a `Select`
  - Type (Tous / Livraison / A emporter / Sur place) through a `Select`
- **Card grid**: reuses `TicketCard` in compact mode (the action buttons stay hidden because `status === "completed"`)
- Client-side filtering (an existing pattern in this project)

### 3. `apps/restaurant-theme/components/admin/kitchen/index.ts`
- Export `CompletedTickets`

## Implementation details

**The "Actif" tab** (current content unchanged):
- StationFilter + PrintStatusBadge
- The three-column kanban

**The "Terminées" tab**:
```
[Rechercher par numero, client, produit...]  [Source: Tous v]  [Type: Tous v]
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ #TEST-0001  │ │ #TEST-0005  │ │ #TEST-0008  │
│ ...         │ │ ...         │ │ ...         │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Verification
- Navigate to `/orders/kitchen`
- Check that the "Actif" tab shows the current kanban
- Click "Terminées" and check the list of completed orders
- Test the search (by number, customer, product)
- Test the source and type filters
