# @beindigital-engine/convex-schema

Schéma de base de données Convex et validateurs Zod pour BeInDigital Engine.

## Description

Ce package contient le schéma complet de la base de données Convex ainsi que tous les validateurs Zod pour l'application BeInDigital Engine. Il s'agit d'un système multi-tenant avec intégration Better Auth.

## Architecture

### Multi-tenant
- **1 instance Convex par client restaurant**
- Filtrage par `storeId` pour la séparation des données
- Support de 1 à 4 emplacements physiques par restaurant

### Tables principales

#### Authentification (Better Auth)
- `user` - Utilisateurs
- `session` - Sessions
- `account` - Comptes OAuth
- `verification` - Vérifications email

#### Extensions BeInDigital
- `userProfiles` - Profils étendus avec rôles et permissions
- `stores` - Magasins/emplacements
- `teamMembers` - Membres de l'équipe

#### Catalogue
- `categories` - Catégories de produits (hiérarchiques)
- `products` - Produits avec options, allergènes, horaires
- `menus` - Formules/combos

#### Commandes
- `orders` - Commandes complètes (delivery, pickup, dine-in)
- `kitchenTickets` - Tickets cuisine avec stations
- `printerSettings` - Configuration imprimantes ESC/POS
- `payments` - Paiements multi-providers

#### Internationalisation
- `languages` - Langues dynamiques (illimitées)
- `translations` - Traductions par entité
- `translationJobs` - Jobs de traduction GPT-3.5

#### Gamification
- `gameQRCodes` - QR codes sur tables
- `requiredActions` - Actions sociales requises
- `games` - Jeux (roue, carte à gratter)
- `prizes` - Lots gagnables
- `gamePlays` - Parties jouées
- `prizeRedemptions` - Rachats de lots

## Usage

### Import du schéma

```typescript
import { schema } from '@beindigital-engine/convex-schema'

// Dans convex/schema.ts
export default schema
```

### Import des validators

```typescript
import {
  createStoreSchema,
  createProductSchema,
  createOrderSchema,
  // etc.
} from '@beindigital-engine/convex-schema'

// Validation
const result = createStoreSchema.parse(data)
```

## Validateurs disponibles

### Stores
- `createStoreSchema` - Création de magasin
- `updateStoreSchema` - Mise à jour de magasin
- `updateStoreStatusSchema` - Mise à jour du statut

### Categories
- `createCategorySchema` - Création de catégorie
- `updateCategorySchema` - Mise à jour de catégorie

### Products
- `createProductSchema` - Création de produit
- `updateProductSchema` - Mise à jour de produit
- `updateProductStockSchema` - Mise à jour du stock

### Menus
- `createMenuSchema` - Création de menu/combo
- `updateMenuSchema` - Mise à jour de menu

### Orders
- `createOrderSchema` - Création de commande
- `updateOrderStatusSchema` - Mise à jour du statut
- `updateOrderPaymentStatusSchema` - Mise à jour du paiement

### Kitchen
- `createKitchenTicketSchema` - Création de ticket cuisine
- `updateKitchenTicketStatusSchema` - Mise à jour du statut

### Printers
- `createPrinterSettingsSchema` - Configuration imprimante
- `updatePrinterSettingsSchema` - Mise à jour imprimante

### Payments
- `createPaymentSchema` - Création de paiement
- `refundPaymentSchema` - Remboursement

### Languages
- `createLanguageSchema` - Ajout de langue
- `updateLanguageSchema` - Mise à jour de langue

### Translations
- `createTranslationSchema` - Création de traduction
- `batchTranslateSchema` - Traduction en lot (GPT-3.5)

### Team
- `createTeamMemberSchema` - Ajout de membre
- `updateTeamMemberSchema` - Mise à jour de membre

### Gamification
- `createGameQRCodeSchema` - Création de QR code
- `createRequiredActionSchema` - Création d'action requise
- `createGameSchema` - Création de jeu
- `updateGameWinRatioSchema` - Mise à jour du taux de gain
- `createPrizeSchema` - Création de lot
- `playGameSchema` - Jouer à un jeu
- `redeemPrizeSchema` - Racheter un lot

### User Profiles
- `createUserProfileSchema` - Création de profil
- `updateUserProfileSchema` - Mise à jour de profil

## Index et performances

### Index critiques
Tous les index sont optimisés pour les requêtes multi-tenant :

- `by_storeId` - Filtrage par magasin
- `by_storeId_status` - Filtrage par magasin + statut
- `by_storeId_createdAt` - Tri chronologique
- `by_email` - Recherche utilisateurs
- `by_token` - Validation sessions
- etc.

## Types de données

### Prix
Tous les prix sont stockés en **centimes** (integer) pour éviter les problèmes de précision.

```typescript
// Bon
price: 1250 // 12.50 EUR

// Mauvais
price: 12.50 // Float imprécis
```

### Timestamps
Tous les timestamps sont en **millisecondes** (Date.now())

```typescript
createdAt: Date.now()
updatedAt: Date.now()
```

### Horaires
Format **HH:mm** (24h)

```typescript
open: "09:00"
close: "22:00"
```

### Codes pays
Format **ISO 3166-1 alpha-2** (2 lettres majuscules)

```typescript
country: "FR"
country: "ES"
```

### Codes langue
Format **ISO 639-1** (2-5 lettres minuscules)

```typescript
languageCode: "fr"
languageCode: "en"
languageCode: "zh-CN"
```

## Règles métier

### Multi-store
- 1 propriétaire = nombre illimité de restaurants
- Chaque store a son propre `storeId`
- Les utilisateurs peuvent avoir accès à plusieurs stores

### Gamification
- **Taux de gain contrôlé par l'admin** (0-100%)
- **Cooldown de 24h** entre les parties
- Actions sociales requises avant de jouer
- Les lots ont une durée de validité

### Traduction
- **GPT-3.5-turbo** pour traduction automatique
- Coût: ~$0.001 par produit
- Support de langues illimitées
- Traduction manuelle possible

### Kitchen
- **Auto-print** des tickets sur confirmation commande
- Support multi-stations (entrées, plats, desserts, etc.)
- Imprimantes ESC/POS (network, USB, Bluetooth)

## Dépendances

- `convex` ^1.18.0 - Backend BaaS
- `zod` ^3.24.0 - Validation de schémas

## Scripts

```bash
# Vérification des types
pnpm type-check

# Lint
pnpm lint

# Tests
pnpm test
pnpm test:watch

# Nettoyage
pnpm clean
```

## License

Private - BeInDigital Team
