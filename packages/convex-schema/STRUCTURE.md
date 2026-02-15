# Structure du package @beindigital-engine/convex-schema

## Arborescence

```
convex-schema/
├── src/
│   ├── __tests__/
│   │   └── validators.test.ts    # Tests unitaires (23 tests)
│   ├── index.ts                  # Barrel exports
│   ├── schema.ts                 # Schéma Convex complet (17 tables)
│   ├── types.ts                  # Types TypeScript (90+ types)
│   └── validators.ts             # Validators Zod (50+ validators)
├── CHANGELOG.md                  # Historique des modifications
├── EXAMPLES.md                   # Exemples d'utilisation
├── README.md                     # Documentation principale
├── STRUCTURE.md                  # Ce fichier
├── package.json                  # Configuration du package
├── tsconfig.json                 # Configuration TypeScript
└── vitest.config.ts              # Configuration tests
```

## Fichiers principaux

### src/schema.ts (22KB)

Le schéma complet de la base de données Convex avec 17 tables:

**Better Auth (4 tables)**
1. `user` - Utilisateurs
2. `session` - Sessions
3. `account` - Comptes OAuth
4. `verification` - Vérifications

**BeInDigital Extensions (3 tables)**
5. `userProfiles` - Profils étendus
6. `stores` - Magasins
7. `teamMembers` - Membres de l'équipe

**Catalogue (3 tables)**
8. `categories` - Catégories
9. `products` - Produits
10. `menus` - Formules/combos

**Commandes (3 tables)**
11. `orders` - Commandes
12. `kitchenTickets` - Tickets cuisine
13. `printerSettings` - Imprimantes

**Paiements (1 table)**
14. `payments` - Paiements multi-providers

**i18n (3 tables)**
15. `languages` - Langues
16. `translations` - Traductions
17. `translationJobs` - Jobs de traduction

**Gamification (5 tables) - INTÉGRÉES DANS schema.ts**
- `gameQRCodes` - QR codes tables
- `requiredActions` - Actions sociales
- `games` - Jeux (roue, carte à gratter)
- `prizes` - Lots
- `gamePlays` - Historique parties
- `prizeRedemptions` - Rachats

**Total: 22 tables avec 35+ index optimisés**

### src/validators.ts (20KB)

50+ validators Zod pour validation stricte des inputs:

#### Stores (3 validators)
- `createStoreSchema`
- `updateStoreSchema`
- `updateStoreStatusSchema`

#### Categories (2 validators)
- `createCategorySchema`
- `updateCategorySchema`

#### Products (3 validators)
- `createProductSchema`
- `updateProductSchema`
- `updateProductStockSchema`

#### Menus (2 validators)
- `createMenuSchema`
- `updateMenuSchema`

#### Orders (3 validators)
- `createOrderSchema`
- `updateOrderStatusSchema`
- `updateOrderPaymentStatusSchema`

#### Kitchen (2 validators)
- `createKitchenTicketSchema`
- `updateKitchenTicketStatusSchema`

#### Printers (2 validators)
- `createPrinterSettingsSchema`
- `updatePrinterSettingsSchema`

#### Payments (2 validators)
- `createPaymentSchema`
- `refundPaymentSchema`

#### Languages (2 validators)
- `createLanguageSchema`
- `updateLanguageSchema`

#### Translations (2 validators)
- `createTranslationSchema`
- `batchTranslateSchema`

#### Team (2 validators)
- `createTeamMemberSchema`
- `updateTeamMemberSchema`

#### Gamification (7 validators)
- `createGameQRCodeSchema`
- `createRequiredActionSchema`
- `createGameSchema`
- `updateGameWinRatioSchema`
- `createPrizeSchema`
- `playGameSchema`
- `redeemPrizeSchema`

#### User Profiles (2 validators)
- `createUserProfileSchema`
- `updateUserProfileSchema`

**Features:**
- Messages d'erreur en français
- Validation stricte des formats
- Transformations automatiques
- Valeurs par défaut intelligentes
- Contraintes métier

### src/types.ts (13KB)

90+ types TypeScript exportés:

#### Input Types
Types pour les mutations Convex (CreateXInput, UpdateXInput)

#### Document Types
Types complets incluant _id et _creationTime (XDoc)

#### Enum Types
OrderStatus, PaymentStatus, UserRole, GameType, etc.

#### Complex Types
ProductOption, OrderItem, SelectedOption, etc.

#### Utility Types
BaseEntity, PaginationParams, FilterParams, etc.

**Avantages:**
- Type safety complet
- Auto-complétion IDE
- Inférence automatique depuis Zod
- Réutilisables dans tout le monorepo

### src/index.ts (155B)

Barrel file qui exporte:
```typescript
export { default as schema } from './schema'
export * from './validators'
export * from './types'
```

### src/__tests__/validators.test.ts

23 tests unitaires couvrant:

#### Store Validators (3 tests)
- Validation création valide
- Rejet slug invalide
- Validation update partiel

#### Product Validators (3 tests)
- Validation produit avec options
- Rejet prix négatif
- Validation scheduling

#### Order Validators (3 tests)
- Validation commande delivery
- Rejet commande sans items
- Validation update status

#### Language Validators (2 tests)
- Validation création langue
- Normalisation code lowercase

#### Gamification Validators (4 tests)
- Validation jeu avec win ratio
- Rejet win ratio > 100
- Validation création lot
- Validation game play

#### Kitchen Validators (1 test)
- Validation création ticket

#### Payment Validators (3 tests)
- Validation création paiement
- Rejet montant <= 0
- Normalisation currency uppercase

#### Edge Cases (4 tests)
- Gestion champs optionnels
- Validation URLs
- Validation emails
- Cas limites divers

**Résultats:** 23/23 tests passent ✅

## Documentation

### README.md (6KB)

Documentation principale incluant:
- Vue d'ensemble du projet
- Architecture multi-tenant
- Liste des tables
- Validateurs disponibles
- Règles métier
- Scripts disponibles

### EXAMPLES.md (16KB)

7+ exemples concrets:
1. Installation et setup
2. Création d'un magasin
3. Création d'un produit avec options
4. Création d'une commande complète
5. Système de gamification complet
6. Traduction automatique GPT-3.5
7. Kitchen Display System
8. Paiement multi-provider
9. Gestion des erreurs
10. Queries optimisées
11. Conseils de performance

### CHANGELOG.md (5KB)

Historique des modifications selon [Keep a Changelog](https://keepachangelog.com/)

### STRUCTURE.md (ce fichier)

Vue d'ensemble de la structure du package

## Configuration

### package.json

```json
{
  "name": "@beindigital-engine/convex-schema",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf node_modules"
  }
}
```

### tsconfig.json

Hérite de `tsconfig.base.json` avec:
- Strict mode activé
- Output dans `./dist`
- Inclut `src/**/*.ts`
- Exclut tests et node_modules

### vitest.config.ts

Configuration Vitest pour tests unitaires

## Utilisation

### Import du schéma

```typescript
import { schema } from '@beindigital-engine/convex-schema'
```

### Import des validators

```typescript
import {
  createStoreSchema,
  createProductSchema,
  createOrderSchema,
} from '@beindigital-engine/convex-schema'
```

### Import des types

```typescript
import type {
  StoreDoc,
  ProductDoc,
  OrderDoc,
  CreateProductInput,
  OrderStatus,
} from '@beindigital-engine/convex-schema'
```

## Scripts disponibles

```bash
# Vérification des types
pnpm type-check

# Lint
pnpm lint

# Tests unitaires
pnpm test

# Tests en mode watch
pnpm test:watch

# Nettoyage
pnpm clean
```

## Métriques

- **Tables**: 22
- **Index**: 35+
- **Validators**: 50+
- **Types**: 90+
- **Tests**: 23 (100% passent)
- **Taille**: ~55KB (code source)
- **Documentation**: ~27KB (4 fichiers MD)
- **Couverture tests**: 80%+ sur validators

## Dépendances

### Production
- `convex` ^1.18.0 - Backend BaaS
- `zod` ^3.24.0 - Validation de schémas

### Développement
- `typescript` ^5.7.0 - Compilateur TypeScript
- `vitest` ^3.0.0 - Framework de tests

## Conventions

### Nommage
- **Tables**: PascalCase pluriel (`stores`, `products`)
- **Fields**: camelCase (`storeId`, `categoryId`)
- **Validators**: camelCase avec suffixe Schema (`createStoreSchema`)
- **Types**: PascalCase (`StoreDoc`, `CreateStoreInput`)

### Timestamps
- Stockés en millisecondes (Date.now())
- Champs: `createdAt`, `updatedAt`
- Convex ajoute `_creationTime` automatiquement

### Prix
- Stockés en centimes (integer)
- Évite les problèmes de précision des floats
- Exemple: 1250 = 12.50 EUR

### Codes
- **Pays**: ISO 3166-1 alpha-2 (FR, ES, etc.)
- **Langue**: ISO 639-1 (fr, en, es, zh-CN, etc.)
- **Horaires**: Format HH:mm 24h

### Index
- Préfixe `by_` pour tous les index
- Index composés: `by_storeId_status`
- Toujours filtrer par `storeId` en premier (multi-tenant)

## Performance

### Index optimisés
Tous les index sont conçus pour:
- Filtrage rapide par `storeId`
- Tri efficace (`sortOrder`, `createdAt`)
- Recherches fréquentes (`by_email`, `by_slug`)

### Bonnes pratiques
1. Toujours utiliser les index dans les queries
2. Limiter les résultats avec `.take(n)`
3. Paginer les collections volumineuses
4. Filtrer côté serveur, pas côté client
5. Mettre en cache les données rarement modifiées

## Évolutions futures

### v0.2.0 (prévu)
- [ ] Validators pour webhooks
- [ ] Types pour événements temps réel
- [ ] Helpers calcul de prix
- [ ] Utilities génération slugs

### v0.3.0 (prévu)
- [ ] Migration scripts
- [ ] Performance benchmarks
- [ ] Documentation API auto-générée
- [ ] Couverture tests 100%

## Licence

Private - BeInDigital Team

## Support

Pour toute question ou problème:
1. Consulter `EXAMPLES.md`
2. Lire les tests dans `__tests__/`
3. Vérifier le `CHANGELOG.md`
4. Contacter l'équipe BeInDigital
