# Changelog - @beindigital-engine/convex-schema

Toutes les modifications notables de ce package seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [0.1.0] - 2026-02-14

### Ajouté

#### Schéma de base de données Convex complet

**Tables Better Auth**
- `user` - Utilisateurs avec authentification
- `session` - Gestion des sessions
- `account` - Comptes OAuth et mots de passe
- `verification` - Vérifications email et tokens

**Extensions BeInDigital**
- `userProfiles` - Profils utilisateurs étendus avec rôles et permissions
- `stores` - Gestion multi-magasins (illimité par propriétaire)
- `teamMembers` - Membres de l'équipe avec rôles spécifiques

**Catalogue**
- `categories` - Catégories de produits (hiérarchiques)
- `products` - Produits complets avec options, allergènes, horaires, stock
- `menus` - Formules et combos

**Commandes**
- `orders` - Commandes complètes (delivery, pickup, dine-in)
- `kitchenTickets` - Tickets cuisine avec stations
- `printerSettings` - Configuration imprimantes ESC/POS
- `payments` - Paiements multi-providers (Stripe, SumUp, PayPal, Square, Cash)

**Internationalisation**
- `languages` - Langues dynamiques (illimitées)
- `translations` - Traductions par entité et champ
- `translationJobs` - Jobs de traduction automatique GPT-3.5

**Gamification**
- `gameQRCodes` - QR codes sur tables restaurant
- `requiredActions` - Actions sociales requises (Google review, Instagram follow, etc.)
- `games` - Jeux (Roue de la Fortune, Carte à gratter) avec taux de gain contrôlable
- `prizes` - Lots gagnables avec types et validité
- `gamePlays` - Historique des parties avec cooldown 24h
- `prizeRedemptions` - Rachats de lots avec QR codes

#### Validators Zod complets

**50+ validators** pour toutes les opérations CRUD:
- Stores (create, update, status)
- Categories (create, update)
- Products (create, update, stock)
- Menus (create, update)
- Orders (create, update status, update payment)
- Kitchen (create ticket, update status)
- Printers (create, update)
- Payments (create, refund)
- Languages (create, update)
- Translations (create, batch translate)
- Team (create, update)
- Gamification (QR codes, actions, games, prizes, play, redeem)
- User Profiles (create, update)

**Features des validators:**
- Messages d'erreur en français
- Validation stricte des formats (emails, URLs, codes pays, horaires)
- Transformations automatiques (uppercase, lowercase, normalization)
- Valeurs par défaut intelligentes
- Contraintes métier (prix en centimes, win ratio 0-100%, etc.)

#### Types TypeScript

**90+ types exportés** incluant:
- Types d'entrée (CreateXInput, UpdateXInput)
- Types de documents (XDoc avec _id et _creationTime)
- Types énumérés (OrderStatus, PaymentStatus, UserRole, etc.)
- Types complexes (ProductOption, OrderItem, etc.)
- Types utilitaires (BaseEntity, PaginationParams, etc.)

#### Documentation complète

- `README.md` - Vue d'ensemble du package
- `EXAMPLES.md` - Exemples d'utilisation concrets (7+ scénarios)
- `CHANGELOG.md` - Historique des modifications

#### Tests unitaires

- 23 tests Vitest couvrant tous les validators principaux
- Tests de validation positive et négative
- Tests de cas limites (edge cases)
- Couverture des transformations automatiques

#### Index optimisés

**35+ index** pour des requêtes performantes:
- Index simples (`by_storeId`, `by_email`, etc.)
- Index composés (`by_storeId_status`, `by_storeId_categoryId`, etc.)
- Index pour tri (`by_storeId_createdAt`, `by_storeId_sortOrder`, etc.)

### Configuration

- Support TypeScript strict mode
- Configuration ESLint
- Configuration Vitest pour tests unitaires
- Build configuration avec tsconfig.json
- Package privé pour monorepo

### Dépendances

- `convex` ^1.18.0 - Backend BaaS
- `zod` ^3.24.0 - Validation de schémas

### Notes techniques

- **Multi-tenant**: 1 instance Convex par restaurant
- **Prix**: Stockés en centimes (integer) pour éviter problèmes de précision
- **Timestamps**: En millisecondes (Date.now())
- **Codes pays**: Format ISO 3166-1 alpha-2 (2 lettres)
- **Codes langue**: Format ISO 639-1 (2-5 lettres)
- **Horaires**: Format HH:mm (24h)

### Architecture

- Schéma centralisé réutilisable dans tous les apps
- Validators partagés pour cohérence de validation
- Types TypeScript inférés automatiquement depuis Zod
- Barrel exports pour facilité d'utilisation

---

## [Unreleased]

### À venir

- Validators pour webhooks (Stripe, Uber Eats, Deliveroo)
- Types pour événements temps réel
- Helpers pour calculs de prix
- Utilities pour génération de slugs
- Migration scripts
- Performance benchmarks
- Documentation API auto-générée

---

[0.1.0]: https://github.com/be-in-digital/beindigital-engine/releases/tag/convex-schema-v0.1.0
