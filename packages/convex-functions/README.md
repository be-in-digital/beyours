# @beindigital-engine/convex-functions

Package partagé contenant toutes les fonctions backend Convex pour BeInDigital Engine.

## Structure

```
src/
├── helpers.ts          # Fonctions utilitaires
├── stores.ts           # Fonctions Stores
├── products.ts         # Fonctions Products
├── categories.ts       # Fonctions Categories
├── orders.ts           # Fonctions Orders
├── kitchenTickets.ts   # Fonctions Kitchen Tickets
├── payments.ts         # Fonctions Payments
├── teamMembers.ts      # Fonctions Team Members
├── languages.ts        # Fonctions Languages
├── translations.ts     # Fonctions Translations
└── index.ts            # Barrel file (exports)
```

## Utilisation

### Dans une app Convex

Ces fichiers doivent être copiés dans le dossier `convex/` de chaque app Next.js.

```typescript
// convex/stores.ts (copié depuis ce package)
import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
// ... fonctions stores
```

### Imports dans l'app

```typescript
import { api } from "@/convex/_generated/api"
import { useQuery, useMutation } from "convex/react"

// Query
const stores = useQuery(api.stores.list)

// Mutation
const createStore = useMutation(api.stores.create)
```

## Modules disponibles

### Stores
- `list()` - Liste tous les stores
- `getById(id)` - Récupère un store par ID
- `getBySlug(slug)` - Récupère un store par slug
- `create(...)` - Crée un nouveau store
- `update(id, ...)` - Met à jour un store
- `updateHours(id, hours)` - Met à jour les horaires
- `updateBranding(id, branding)` - Met à jour le branding
- `updateSettings(id, settings)` - Met à jour les paramètres
- `remove(id)` - Supprime un store

### Products
- `list(storeId)` - Liste tous les produits d'un store
- `getById(id)` - Récupère un produit par ID
- `getByCategory(storeId, categoryId)` - Produits par catégorie
- `getBySlug(storeId, slug)` - Produit par slug
- `getFeatured(storeId)` - Produits en vedette
- `create(...)` - Crée un nouveau produit
- `update(id, ...)` - Met à jour un produit
- `updateStock(id, quantity)` - Met à jour le stock
- `toggleStatus(id)` - Active/désactive un produit
- `remove(id)` - Supprime un produit

### Categories
- `list(storeId)` - Liste toutes les catégories
- `getById(id)` - Récupère une catégorie par ID
- `create(...)` - Crée une nouvelle catégorie
- `update(id, ...)` - Met à jour une catégorie
- `reorder(ids)` - Réorganise les catégories
- `remove(id)` - Supprime une catégorie

### Orders
- `list(storeId)` - Liste toutes les commandes
- `getById(id)` - Récupère une commande par ID
- `getByCustomer(customerId)` - Commandes d'un client
- `getByStatus(storeId, status)` - Commandes par statut
- `create(...)` - Crée une nouvelle commande (calcule automatiquement les totaux)
- `updateStatus(id, status, ...)` - Met à jour le statut
- `remove(id)` - Supprime une commande

### Kitchen Tickets
- `getByStore(storeId)` - Tickets d'un store
- `getByStatus(storeId, status)` - Tickets par statut
- `getByStation(storeId, station)` - Tickets par station
- `getByOrder(orderId)` - Tickets d'une commande
- `create(...)` - Crée un nouveau ticket
- `updateStatus(id, status)` - Met à jour le statut
- `assignStation(id, station)` - Assigne à une station
- `assignTo(id, userId)` - Assigne à un utilisateur
- `incrementPrintCount(id)` - Incrémente le compteur d'impression

### Payments
- `getByOrder(orderId)` - Paiements d'une commande
- `getByStore(storeId)` - Paiements d'un store
- `create(...)` - Crée un nouveau paiement
- `updateStatus(id, status, ...)` - Met à jour le statut
- `refund(id, amount, reason)` - Rembourse un paiement

### Team Members
- `list(storeId)` - Liste tous les membres
- `getByUser(userId)` - Membre par utilisateur
- `getByRole(storeId, role)` - Membres par rôle
- `create(...)` - Crée un nouveau membre
- `update(id, ...)` - Met à jour un membre
- `toggleActive(id)` - Active/désactive un membre
- `remove(id)` - Supprime un membre

### Languages
- `list(storeId)` - Liste toutes les langues
- `create(...)` - Crée une nouvelle langue
- `update(id, ...)` - Met à jour une langue
- `toggleActive(id)` - Active/désactive une langue
- `setDefault(storeId, languageId)` - Définit comme langue par défaut
- `remove(id)` - Supprime une langue

### Translations
- `getForEntity(storeId, entityType, entityId)` - Traductions d'une entité
- `getByLanguage(storeId, languageCode)` - Traductions d'une langue
- `upsert(...)` - Crée ou met à jour une traduction
- `bulkUpsert(translations)` - Crée/met à jour plusieurs traductions
- `remove(id)` - Supprime une traduction

### Helpers
- `generateOrderNumber()` - Génère un numéro de commande unique (ORD-YYYY-XXXX)
- `generateSlug(text)` - Génère un slug depuis un texte
- `now()` - Retourne le timestamp actuel

## Notes importantes

### Multi-tenant
Toutes les fonctions filtrent par `storeId` pour garantir l'isolation des données entre restaurants.

### Timestamps
Les fonctions `create` et `update` gèrent automatiquement `createdAt` et `updatedAt`.

### Validation
Tous les arguments utilisent les types Convex (`v.string()`, `v.number()`, etc.) pour une validation stricte.

### Indexes
Les fonctions utilisent les indexes définis dans le schema Convex:
- `by_store` - Pour filtrer par store
- `by_slug` - Pour rechercher par slug
- `by_customer` - Pour filtrer par client
- `by_order` - Pour filtrer par commande
- `by_entity` - Pour filtrer les traductions
- `by_language` - Pour filtrer par langue

## Développement

### Tests
```bash
pnpm test          # Run unit tests
pnpm test:watch    # Watch mode
```

### Type checking
```bash
pnpm type-check
```

### Linting
```bash
pnpm lint
```

## Version
0.1.0
