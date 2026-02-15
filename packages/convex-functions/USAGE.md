# Guide d'utilisation - Convex Functions

## Installation dans une app Next.js

### Étape 1: Copier les fichiers dans le dossier convex/

Les fichiers de ce package doivent être copiés dans le dossier `convex/` de votre app Next.js.

```bash
# Depuis la racine du projet
cp packages/convex-functions/src/*.ts apps/restaurant-theme/convex/
```

**Note:** Ne copiez PAS `index.ts` car il n'est utilisé que pour l'export du package.

### Étape 2: Structure du dossier convex/

Après la copie, votre dossier `convex/` devrait ressembler à:

```
apps/restaurant-theme/convex/
├── _generated/          # Généré par Convex
├── schema.ts            # Votre schema Convex
├── helpers.ts           # Copié depuis convex-functions
├── stores.ts            # Copié depuis convex-functions
├── products.ts          # Copié depuis convex-functions
├── categories.ts        # Copié depuis convex-functions
├── orders.ts            # Copié depuis convex-functions
├── kitchenTickets.ts    # Copié depuis convex-functions
├── payments.ts          # Copié depuis convex-functions
├── teamMembers.ts       # Copié depuis convex-functions
├── languages.ts         # Copié depuis convex-functions
└── translations.ts      # Copié depuis convex-functions
```

### Étape 3: Définir le schema Convex

Dans `apps/restaurant-theme/convex/schema.ts`, définissez votre schema:

```typescript
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  stores: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    address: v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    hours: v.array(v.object({
      day: v.number(),
      open: v.string(),
      close: v.string(),
      isClosed: v.boolean(),
    })),
    status: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("temporarily_unavailable")
    ),
    settings: v.object({
      currency: v.string(),
      timezone: v.string(),
      deliveryEnabled: v.boolean(),
      pickupEnabled: v.boolean(),
      dineInEnabled: v.boolean(),
      minimumOrderAmount: v.optional(v.number()),
      deliveryFee: v.optional(v.number()),
      deliveryRadius: v.optional(v.number()),
      taxRate: v.optional(v.number()),
    }),
    branding: v.any(),
    integrations: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"]),

  products: defineTable({
    storeId: v.id("stores"),
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    // ... autres champs
  })
    .index("by_store", ["storeId"])
    .index("by_store_slug", ["storeId", "slug"]),

  // ... autres tables
})
```

### Étape 4: Utiliser dans votre app Next.js

#### Dans un composant client

```typescript
"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

export function StoresList() {
  const stores = useQuery(api.stores.list)
  const createStore = useMutation(api.stores.create)

  const handleCreate = async () => {
    await createStore({
      name: "Mon Restaurant",
      slug: "mon-restaurant",
      address: {
        street: "123 Rue Example",
        city: "Paris",
        postalCode: "75001",
        country: "France",
      },
      settings: {
        currency: "EUR",
        timezone: "Europe/Paris",
        deliveryEnabled: true,
        pickupEnabled: true,
        dineInEnabled: true,
      },
    })
  }

  if (!stores) return <div>Chargement...</div>

  return (
    <div>
      <button onClick={handleCreate}>Créer un store</button>
      <ul>
        {stores.map((store) => (
          <li key={store._id}>{store.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

#### Dans un Server Component (Next.js 15+)

```typescript
import { fetchQuery } from "convex/nextjs"
import { api } from "@/convex/_generated/api"

export default async function StoresPage() {
  const stores = await fetchQuery(api.stores.list)

  return (
    <div>
      <h1>Stores</h1>
      <ul>
        {stores.map((store) => (
          <li key={store._id}>{store.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

#### Dans une API Route

```typescript
import { fetchMutation } from "convex/nextjs"
import { api } from "@/convex/_generated/api"

export async function POST(request: Request) {
  const data = await request.json()

  const storeId = await fetchMutation(api.stores.create, {
    name: data.name,
    slug: data.slug,
    // ... autres champs
  })

  return Response.json({ storeId })
}
```

## Exemples d'utilisation

### Créer une commande avec calcul automatique des totaux

```typescript
const createOrder = useMutation(api.orders.create)

await createOrder({
  storeId: store._id,
  customer: {
    name: "John Doe",
    email: "john@example.com",
    phone: "+33612345678",
  },
  items: [
    {
      productId: product._id,
      name: "Pizza Margherita",
      quantity: 2,
      price: 12.90,
      selectedOptions: [
        {
          optionId: "size",
          optionName: "Taille",
          choiceId: "large",
          choiceName: "Grande",
          price: 2.00,
        },
      ],
    },
  ],
  type: "delivery",
  deliveryAddress: {
    street: "123 Rue Example",
    city: "Paris",
    postalCode: "75001",
    country: "France",
  },
  paymentMethod: "stripe",
})
// Les champs subtotal, taxAmount, deliveryFee, total sont calculés automatiquement
```

### Gérer les tickets de cuisine

```typescript
const tickets = useQuery(api.kitchenTickets.getByStatus, {
  storeId: store._id,
  status: "pending",
})

const updateStatus = useMutation(api.kitchenTickets.updateStatus)

// Démarrer la préparation
await updateStatus({
  id: ticket._id,
  status: "in_progress",
})
// startedAt est automatiquement défini

// Marquer comme prêt
await updateStatus({
  id: ticket._id,
  status: "ready",
})
// completedAt est automatiquement défini
```

### Gérer les traductions

```typescript
const upsert = useMutation(api.translations.upsert)

// Créer/mettre à jour une traduction
await upsert({
  storeId: store._id,
  entityType: "product",
  entityId: product._id,
  field: "name",
  languageCode: "fr",
  value: "Pizza Margherita",
  isAutoTranslated: false,
})

// Bulk upsert
const bulkUpsert = useMutation(api.translations.bulkUpsert)

await bulkUpsert({
  translations: [
    {
      storeId: store._id,
      entityType: "product",
      entityId: product._id,
      field: "name",
      languageCode: "es",
      value: "Pizza Margarita",
      isAutoTranslated: true,
    },
    {
      storeId: store._id,
      entityType: "product",
      entityId: product._id,
      field: "description",
      languageCode: "es",
      value: "Tomate, mozzarella, albahaca",
      isAutoTranslated: true,
    },
  ],
})
```

### Gérer les langues

```typescript
const setDefault = useMutation(api.languages.setDefault)

// Définir le français comme langue par défaut
// Tous les autres langues seront automatiquement mis à isDefault: false
await setDefault({
  storeId: store._id,
  languageId: frenchLanguage._id,
})
```

## Bonnes pratiques

### 1. Toujours filtrer par storeId

```typescript
// ✅ Bon
const products = useQuery(api.products.list, { storeId: store._id })

// ❌ Mauvais (ne pas utiliser query sans filtre store)
```

### 2. Gérer les états de chargement

```typescript
const stores = useQuery(api.stores.list)

if (stores === undefined) {
  return <LoadingSpinner />
}

if (stores.length === 0) {
  return <EmptyState />
}

return <StoresList stores={stores} />
```

### 3. Gérer les erreurs

```typescript
const createStore = useMutation(api.stores.create)

try {
  await createStore({ ... })
  toast.success("Store créé")
} catch (error) {
  toast.error("Erreur lors de la création")
  console.error(error)
}
```

### 4. Utiliser les helpers

```typescript
import { generateOrderNumber, generateSlug } from "@/convex/helpers"

// Dans une mutation personnalisée
const orderNumber = generateOrderNumber() // "ORD-2026-ABC123"
const slug = generateSlug("Mon Super Produit") // "mon-super-produit"
```

## Tests

### Tester les mutations

```typescript
import { test, expect } from "vitest"
import { ConvexTestingHelper } from "convex-test"
import { api } from "./_generated/api"

test("create store", async () => {
  const t = new ConvexTestingHelper()

  const storeId = await t.mutation(api.stores.create, {
    name: "Test Store",
    slug: "test-store",
    // ... autres champs
  })

  expect(storeId).toBeDefined()

  const store = await t.query(api.stores.getById, { id: storeId })
  expect(store?.name).toBe("Test Store")
})
```

## Migration depuis une version précédente

Si vous avez des fonctions existantes, voici comment migrer:

1. Sauvegardez vos fonctions personnalisées
2. Copiez les nouvelles fonctions depuis `convex-functions`
3. Réintégrez vos fonctions personnalisées
4. Testez que tout fonctionne

## Support

Pour toute question ou problème:
- Consultez la documentation Convex: https://docs.convex.dev
- Vérifiez le schema dans `convex-schema` package
- Consultez les exemples dans ce fichier
