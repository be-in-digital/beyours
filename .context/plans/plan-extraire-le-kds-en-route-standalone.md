# Plan : Extraire le KDS en route standalone

## Contexte
Le KDS (Kitchen Display System) est actuellement dans le layout admin à `app/(admin)/orders/kitchen/`. Un KDS est affiché sur un écran dédié en cuisine — il doit être une page standalone plein écran, comme `/display/[storeId]`. Le dashboard admin gardera juste un lien qui ouvre le KDS dans un nouvel onglet.

Bonus : résout l'erreur runtime (`"kitchen"` capturé par `[orderId]`).

## Changements

### 1. Créer `app/kitchen/[storeId]/page.tsx`
Page KDS standalone, même pattern que `/display/[storeId]` :
- `useParams` pour extraire `storeId`
- Importe `KitchenContent` avec prop `storeId`
- Header minimal (titre + lien retour admin)
- Inclut `SeedKitchenButton` pour dev/test

### 2. Créer `app/kitchen/[storeId]/layout.tsx`
Layout minimal plein écran :
- Pas de sidebar/header admin
- `Toaster` (sonner) pour les notifications
- Full viewport height

### 3. Déplacer `SeedKitchenButton.tsx`
De `app/(admin)/orders/kitchen/SeedKitchenButton.tsx` vers `app/kitchen/[storeId]/SeedKitchenButton.tsx`

### 4. Modifier `KitchenContent` — ajouter prop `storeId`
**Fichier** : `components/admin/kitchen/KitchenContent.tsx`
- Ajouter prop `storeId?: Id<"stores">`
- Si fourni → utiliser directement ; sinon → fallback `useAdminStoreId()`
- Permet d'utiliser le composant en contexte admin ET standalone

### 5. Mettre à jour nav-config — lien externe
**Fichier** : `packages/admin/src/config/nav-config.ts`
- Ajouter `external?: boolean` au type `NavItem`
- Changer l'item Cuisine (KDS) : `href: "/kitchen"`, `external: true`

### 6. Mettre à jour le sidebar — supporter liens externes dynamiques
**Fichier** : `packages/admin/src/components/app-sidebar.tsx`
- Importer `useStoreStore` de `@be-in-digital/restaurant`
- Pour les items `external: true` :
  - Construire le href dynamique : `${entry.href}/${currentStore._id}`
  - Utiliser `<a target="_blank">` au lieu de `<Link>`

### 7. Supprimer l'ancienne route
- Supprimer `app/(admin)/orders/kitchen/page.tsx`
- Supprimer `app/(admin)/orders/kitchen/SeedKitchenButton.tsx`

### 8. Conserver le garde `isValidOrderId`
**Fichier** : `packages/admin/src/pages/orders/order-detail-page.tsx`
- La validation déjà en place dans le working copy reste (protection défensive)

## Fichiers impactés

| Action | Fichier |
|--------|---------|
| Créer | `apps/restaurant-theme/app/kitchen/[storeId]/page.tsx` |
| Créer | `apps/restaurant-theme/app/kitchen/[storeId]/layout.tsx` |
| Déplacer | `SeedKitchenButton.tsx` → `app/kitchen/[storeId]/` |
| Modifier | `apps/restaurant-theme/components/admin/kitchen/KitchenContent.tsx` |
| Modifier | `packages/admin/src/config/nav-config.ts` |
| Modifier | `packages/admin/src/components/app-sidebar.tsx` |
| Supprimer | `apps/restaurant-theme/app/(admin)/orders/kitchen/page.tsx` |
| Supprimer | `apps/restaurant-theme/app/(admin)/orders/kitchen/SeedKitchenButton.tsx` |
| Garder | `packages/admin/src/pages/orders/order-detail-page.tsx` (garde existant) |

## Vérification
1. `/kitchen/{storeId}` affiche le KDS plein écran sans sidebar admin
2. Lien "Cuisine (KDS)" dans la nav admin → ouvre `/kitchen/{storeId}` dans un nouvel onglet
3. `/orders/{invalidId}` affiche "Commande introuvable" sans crash
4. `pnpm build` passe sans erreur
