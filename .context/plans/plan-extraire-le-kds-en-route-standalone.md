# Plan: move the KDS onto a standalone route

## Context
The KDS (Kitchen Display System) currently lives inside the admin layout at `app/(admin)/orders/kitchen/`. A KDS runs on a dedicated screen in the kitchen, so it should be a standalone full-screen page like `/display/[storeId]`. The admin dashboard will keep nothing but a link that opens the KDS in a new tab.

Bonus: this also fixes the runtime error where `"kitchen"` was being captured by `[orderId]`.

## Changes

### 1. Create `app/kitchen/[storeId]/page.tsx`
A standalone KDS page, following the same pattern as `/display/[storeId]`:
- `useParams` to pull out `storeId`
- Imports `KitchenContent` and passes it the `storeId` prop
- A minimal header (title plus a link back to the admin)
- Includes `SeedKitchenButton` for dev and test

### 2. Create `app/kitchen/[storeId]/layout.tsx`
A minimal full-screen layout:
- No admin sidebar or header
- `Toaster` (sonner) for notifications
- Full viewport height

### 3. Move `SeedKitchenButton.tsx`
From `app/(admin)/orders/kitchen/SeedKitchenButton.tsx` to `app/kitchen/[storeId]/SeedKitchenButton.tsx`

### 4. Change `KitchenContent` — add a `storeId` prop
**File**: `components/admin/kitchen/KitchenContent.tsx`
- Add a `storeId?: Id<"stores">` prop
- Use it directly when it's supplied, otherwise fall back to `useAdminStoreId()`
- This lets the component work in both the admin context and the standalone one

### 5. Update nav-config — external link
**File**: `packages/admin/src/config/nav-config.ts`
- Add `external?: boolean` to the `NavItem` type
- Change the Cuisine (KDS) item to `href: "/kitchen"`, `external: true`

### 6. Update the sidebar — support dynamic external links
**File**: `packages/admin/src/components/app-sidebar.tsx`
- Import `useStoreStore` from `@be-in-digital/restaurant`
- For items marked `external: true`:
  - Build the href dynamically: `${entry.href}/${currentStore._id}`
  - Use `<a target="_blank">` instead of `<Link>`

### 7. Delete the old route
- Delete `app/(admin)/orders/kitchen/page.tsx`
- Delete `app/(admin)/orders/kitchen/SeedKitchenButton.tsx`

### 8. Keep the `isValidOrderId` guard
**File**: `packages/admin/src/pages/orders/order-detail-page.tsx`
- The validation already present in the working copy stays as defensive protection

## Affected files

| Action | File |
|--------|---------|
| Create | `apps/restaurant-theme/app/kitchen/[storeId]/page.tsx` |
| Create | `apps/restaurant-theme/app/kitchen/[storeId]/layout.tsx` |
| Move | `SeedKitchenButton.tsx` → `app/kitchen/[storeId]/` |
| Change | `apps/restaurant-theme/components/admin/kitchen/KitchenContent.tsx` |
| Change | `packages/admin/src/config/nav-config.ts` |
| Change | `packages/admin/src/components/app-sidebar.tsx` |
| Delete | `apps/restaurant-theme/app/(admin)/orders/kitchen/page.tsx` |
| Delete | `apps/restaurant-theme/app/(admin)/orders/kitchen/SeedKitchenButton.tsx` |
| Keep | `packages/admin/src/pages/orders/order-detail-page.tsx` (the existing guard) |

## Verification
1. `/kitchen/{storeId}` shows the KDS full-screen with no admin sidebar
2. The "Cuisine (KDS)" link in the admin nav opens `/kitchen/{storeId}` in a new tab
3. `/orders/{invalidId}` shows "Commande introuvable" without crashing
4. `pnpm build` passes with no errors
