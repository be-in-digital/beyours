# BeInDigital Engine - Plan d'Implementation Step-by-Step

## Phases couvertes : Phase 1 (MVP) + Phase 2 (Integrations)

**Date** : 14 Fevrier 2026
**Etat actuel** : ~5% (boilerplate Next.js 16 + Tailwind CSS)

---

## Vue d'ensemble des etapes

```
Phase 1 - MVP
├── Etape 1  : Fondation Monorepo & CI/CD
├── Etape 2  : Schema Convex & Fonctions Backend
├── Etape 3  : Package Core (Auth, i18n, AWS)
├── Etape 4  : Package UI (Composants shadcn/ui)
├── Etape 5  : Package Restaurant (Logique Metier)
├── Etape 6  : Package Themes (1er theme complet)
├── Etape 7  : App Restaurant - Storefront
├── Etape 8  : App Restaurant - Dashboard Admin
├── Etape 9  : Kitchen Display System (KDS)
├── Etape 10 : Systeme de Paiement
├── Etape 11 : i18n + Traduction GPT
└── Etape 12 : 5 Themes restants

Phase 2 - Integrations
├── Etape 13 : Package Integrations (Uber Eats)
├── Etape 14 : Integration Deliveroo
├── Etape 15 : Uber Direct (Livraison)
├── Etape 16 : Email Marketing (Basique)
├── Etape 17 : CMS (Pages Statiques)
├── Etape 18 : Gestion Clients
└── Etape 19 : App Admin Dashboard BeInDigital
```

---

## PHASE 1 - MVP

---

### Etape 1 : Fondation Monorepo & CI/CD

**Prerequis** : Aucun
**Livrable** : Monorepo Turborepo fonctionnel avec CI/CD

#### 1.1 - Restructuration en Monorepo Turborepo

- [ ] Sauvegarder le contenu actuel de `app/` et configs
- [ ] Installer Turborepo : `pnpm add -Dw turbo`
- [ ] Creer `turbo.json` avec pipelines (build, dev, test, lint)
- [ ] Creer `tsconfig.base.json` (config TypeScript partagee)
- [ ] Mettre a jour `pnpm-workspace.yaml` :
  ```yaml
  packages:
    - "packages/*"
    - "apps/*"
  ```
- [ ] Mettre a jour `package.json` racine (scripts Turborepo)

#### 1.2 - Creation de la structure des packages

```
packages/
├── ui/                    # Composants React
├── core/                  # Auth, i18n, AWS, Payments
├── restaurant/            # Logique metier restaurant
├── integrations/          # Uber Eats, Deliveroo, Uber Direct
├── marketing/             # Email, Gamification
├── cms/                   # CMS custom
├── convex-schema/         # Schemas DB partagees
├── convex-functions/      # Fonctions backend Convex
└── themes/                # 6 themes predeterminants

apps/
├── restaurant-theme/      # App principale (Next.js 16)
├── admin-dashboard/       # Dashboard BeInDigital
└── docs/                  # Documentation
```

Pour chaque package :
- [ ] `package.json` avec nom `@beindigital-engine/<nom>`
- [ ] `tsconfig.json` qui extend `tsconfig.base.json`
- [ ] `tsup.config.ts` pour le build
- [ ] `src/index.ts` (barrel file)
- [ ] `vitest.config.ts`

#### 1.3 - Configuration CI/CD GitHub Actions

- [ ] `.github/workflows/ci.yml` :
  - Lint (ESLint)
  - Type-check (tsc --noEmit)
  - Tests unitaires (Vitest)
  - Build (turbo build)
  - Sur push/PR vers `main`
- [ ] `.github/workflows/e2e.yml` :
  - Tests Playwright
  - Sur PR vers `main` uniquement
- [ ] Configurer Husky + lint-staged pour pre-commit

#### 1.4 - Outils de developpement

- [ ] ESLint config partagee (eslint-config-custom)
- [ ] Prettier config partagee
- [ ] Changesets pour le versioning (`@changesets/cli`)
- [ ] `.env.example` a la racine

#### Tests de validation Etape 1
- [ ] `pnpm install` reussit
- [ ] `pnpm build` compile tous les packages (vides)
- [ ] `pnpm lint` passe
- [ ] `pnpm test` passe (0 tests, 0 erreurs)
- [ ] GitHub Actions CI passe sur push

---

### Etape 2 : Schema Convex & Fonctions Backend

**Prerequis** : Etape 1
**Livrable** : Schema complet + fonctions CRUD de base

#### 2.1 - Setup Convex

- [ ] Installer Convex : `pnpm add convex --filter @beindigital-engine/convex-schema`
- [ ] Initialiser Convex dans le package
- [ ] Configurer `convex/` avec les fichiers generes

#### 2.2 - Schema de base (package convex-schema)

Tables core :
- [ ] `users` - Profils utilisateurs (extension Better Auth)
- [ ] `sessions` - Sessions (Better Auth)
- [ ] `accounts` - Comptes OAuth (Better Auth)
- [ ] `verifications` - Tokens de verification

Tables restaurant :
- [ ] `stores` - Configuration des etablissements
  - nom, adresse, geolocation, horaires, statut, tel, email
  - integrations (uberEats, deliveroo)
  - branding (couleurs, logo, favicon)
- [ ] `products` - Catalogue produits
  - nom, description, prix, images, categorie
  - options, variantes, allergenes, nutrition
  - stock, statut, scheduling
  - externalIds (uberEatsId, deliverooId)
- [ ] `categories` - Categories de produits
- [ ] `menus` - Menus/Formules
- [ ] `orders` - Commandes
  - items, total, statut, type (delivery/pickup/dine-in)
  - clientId, storeId, paiement, timestamps
- [ ] `orderItems` - Lignes de commande

Tables KDS :
- [ ] `kitchenTickets` - Tickets cuisine
  - orderId, storeId, station, statut, priorite
  - prepTime, assignedTo, timestamps
- [ ] `printerSettings` - Config imprimantes
  - storeId, nom, type (network/usb), ip, port
  - station, autoPrint, statut

Tables equipe :
- [ ] `teamMembers` - Membres de l'equipe
  - userId, storeId, role, permissions
  - horaires, statut

Tables paiement :
- [ ] `payments` - Transactions
  - orderId, montant, provider, statut
  - externalId, metadata

#### 2.3 - Index pour la performance

- [ ] Index par `storeId` sur toutes les tables multi-store
- [ ] Index par `status` sur orders, kitchenTickets
- [ ] Index par `userId` sur users, sessions, orders
- [ ] Index par `categoryId` sur products
- [ ] Index composites (storeId + status, storeId + createdAt)

#### 2.4 - Fonctions backend (package convex-functions)

Fonctions Stores :
- [ ] `stores.create` / `stores.update` / `stores.get` / `stores.list`
- [ ] `stores.updateHours` / `stores.updateStatus`
- [ ] `stores.updateBranding`

Fonctions Products :
- [ ] `products.create` / `products.update` / `products.delete`
- [ ] `products.list` (par storeId, avec pagination)
- [ ] `products.getByCategory`
- [ ] `products.updateStock`
- [ ] `products.toggleStatus`

Fonctions Orders :
- [ ] `orders.create` / `orders.get` / `orders.list`
- [ ] `orders.updateStatus`
- [ ] `orders.getByStore` (avec filtres)
- [ ] `orders.getByCustomer`

Fonctions Kitchen :
- [ ] `kitchenTickets.create` / `kitchenTickets.update`
- [ ] `kitchenTickets.getByStore` (real-time)
- [ ] `kitchenTickets.assignStation`
- [ ] `kitchenTickets.markComplete`

Fonctions Team :
- [ ] `teamMembers.create` / `teamMembers.update` / `teamMembers.list`
- [ ] `teamMembers.getByStore`

#### 2.5 - Validators Zod partagees

- [ ] `validators/store.ts` - Schema Zod pour les stores
- [ ] `validators/product.ts` - Schema Zod pour les produits
- [ ] `validators/order.ts` - Schema Zod pour les commandes
- [ ] `validators/user.ts` - Schema Zod pour les utilisateurs

#### Tests de validation Etape 2
- [ ] Schema Convex deploye sur un projet dev
- [ ] Toutes les fonctions CRUD testees unitairement
- [ ] Validators Zod couvrent tous les inputs
- [ ] Index performants (pas de scan complet)

---

### Etape 3 : Package Core (Auth, i18n, AWS)

**Prerequis** : Etape 2
**Livrable** : Authentification, internationalisation et services AWS

#### 3.1 - Authentification Better Auth

- [ ] Installer Better Auth : `pnpm add better-auth --filter @beindigital-engine/core`
- [ ] Configuration Better Auth avec adaptateur Convex
- [ ] Auth email/password avec verification email
- [ ] OAuth providers : Google, Facebook, Apple
- [ ] Magic Link (passwordless)
- [ ] Session management (7 jours, refresh apres 1 jour)
- [ ] 2FA plugin (TOTP, SMS, Email)
- [ ] Client auth hooks (`useAuth`, `useSession`)

#### 3.2 - RBAC (Role-Based Access Control)

- [ ] Definition des 7 roles :
  - `super_admin` (droits complets)
  - `client_admin` (tout sur son restaurant)
  - `manager` (gestion operationnelle)
  - `kitchen` (KDS uniquement)
  - `waiter` (commandes)
  - `delivery` (livraisons)
  - `customer` (ses propres commandes)
- [ ] Systeme de permissions granulaires (resource:action)
- [ ] Middleware de verification `requirePermission()`
- [ ] Hook client `usePermission()`

#### 3.3 - i18n (Internationalisation)

- [ ] Systeme i18n base sur cookies (primaire) + localStorage (fallback)
- [ ] Detection automatique de la langue navigateur
- [ ] Structure de traductions dynamique (pas de fichiers statiques)
- [ ] Hook `useTranslation()`
- [ ] Composant `<LanguageSwitcher />`
- [ ] Support RTL (arabe, hebreu)

#### 3.4 - Service AWS S3

- [ ] Client S3 configure (region eu-west-1)
- [ ] Upload de fichiers avec presigned URLs
- [ ] Dossiers organises : `products/`, `branding/`, `stores/`, `cms/`
- [ ] Suppression de fichiers
- [ ] Validation type MIME + taille max
- [ ] Generation URL publique

#### 3.5 - Service AWS SES

- [ ] Client SES configure
- [ ] Envoi email simple (`sendEmail`)
- [ ] Envoi email template (`sendTemplatedEmail`)
- [ ] Templates : confirmation commande, reset password, bienvenue
- [ ] Gestion bounces et complaints

#### Tests de validation Etape 3
- [ ] Login/Register email + OAuth fonctionnels
- [ ] 2FA active et verifie
- [ ] RBAC bloque les acces non autorises
- [ ] Upload S3 et envoi SES fonctionnels
- [ ] i18n change la langue dynamiquement
- [ ] Tests unitaires couvrent auth + RBAC (>80%)

---

### Etape 4 : Package UI (Composants shadcn/ui)

**Prerequis** : Etape 1
**Livrable** : Librairie de composants reutilisables

#### 4.1 - Setup shadcn/ui

- [ ] Configurer shadcn/ui dans le package `ui`
- [ ] Utilitaire `cn()` (clsx + tailwind-merge)
- [ ] Systeme de design tokens (couleurs, spacing, typography)

#### 4.2 - Composants de base

Layout :
- [ ] `Container`, `Section`, `Grid`
- [ ] `Header`, `Footer`, `Sidebar`
- [ ] `PageHeader`, `PageTitle`

Navigation :
- [ ] `Navbar`, `MobileMenu`
- [ ] `Breadcrumb`
- [ ] `Tabs`, `TabPanel`

Formulaires :
- [ ] `Input`, `Textarea`, `Select`
- [ ] `Checkbox`, `Radio`, `Switch`
- [ ] `DatePicker`, `TimePicker`
- [ ] `FileUpload` (avec preview)
- [ ] `Form` (wrapper React Hook Form)

Affichage :
- [ ] `Button` (variantes : primary, secondary, danger, ghost)
- [ ] `Badge`, `Tag`
- [ ] `Card`, `CardHeader`, `CardContent`
- [ ] `Avatar`
- [ ] `Table`, `DataTable` (avec tri, filtres, pagination)
- [ ] `Modal`, `Dialog`
- [ ] `Toast`, `Notification`
- [ ] `Skeleton`, `Spinner`
- [ ] `EmptyState`
- [ ] `Alert`

Specifiques restaurant :
- [ ] `ProductCard` (image, nom, prix, ajout panier)
- [ ] `CartItem` (produit, quantite, prix, supprimer)
- [ ] `OrderStatusBadge` (pending, preparing, ready, delivered)
- [ ] `StoreSelector` (carte + liste des etablissements)
- [ ] `QuantitySelector` (+/-)
- [ ] `PriceDisplay` (formatage devise)
- [ ] `AllergenBadge` (icones allergenes)
- [ ] `SpiceLevelIndicator`

#### 4.3 - Composants admin

- [ ] `AdminLayout` (sidebar + header + content)
- [ ] `StatCard` (icone, valeur, label, tendance)
- [ ] `Chart` (wrapper pour recharts ou chart.js)
- [ ] `ActionBar` (boutons d'action groupes)
- [ ] `FilterBar` (filtres inline)
- [ ] `StatusTimeline`

#### Tests de validation Etape 4
- [ ] Tous les composants rendus sans erreur
- [ ] Storybook (optionnel) ou fichiers de demo
- [ ] Tests unitaires sur les composants interactifs
- [ ] Responsive sur mobile/tablet/desktop
- [ ] Accessibilite (ARIA labels, focus, keyboard nav)

---

### Etape 5 : Package Restaurant (Logique Metier)

**Prerequis** : Etapes 2, 3
**Livrable** : Logique metier restaurant isolee

#### 5.1 - Gestion des stores

- [ ] `StoreService` : CRUD, heures d'ouverture, statut
- [ ] `StoreSelector` : logique de selection (geolocation, URL params)
- [ ] Hook `useCurrentStore()` - store actif dans le contexte
- [ ] Hook `useStoreHours()` - statut ouvert/ferme
- [ ] Zustand store : `useStoreStore`

#### 5.2 - Gestion des produits

- [ ] `ProductService` : CRUD, categories, options
- [ ] Calcul de prix avec options et variantes
- [ ] Gestion du stock (decrementation, alerte)
- [ ] Filtres : par categorie, allergene, disponibilite
- [ ] Hook `useProducts(storeId)`
- [ ] Hook `useProductsByCategory(storeId, categoryId)`

#### 5.3 - Panier (Cart)

- [ ] Zustand store : `useCartStore`
  - `addItem(product, quantity, options)`
  - `removeItem(itemId)`
  - `updateQuantity(itemId, quantity)`
  - `clearCart()`
  - `getTotal()` / `getItemCount()`
- [ ] Persistance localStorage
- [ ] Calcul sous-total, taxes, livraison, total
- [ ] Validation stock avant checkout

#### 5.4 - Commandes

- [ ] `OrderService` : creation, mise a jour statut
- [ ] Workflow de statuts :
  ```
  pending -> confirmed -> preparing -> ready -> completed
                                    -> out_for_delivery -> delivered
                    -> cancelled
  ```
- [ ] Generation numero de commande unique
- [ ] Calcul recap commande (items, options, total)
- [ ] Hook `useOrders(storeId)` - liste en temps reel
- [ ] Hook `useOrderStatus(orderId)` - suivi temps reel

#### 5.5 - Tickets cuisine

- [ ] `KitchenService` : creation ticket a partir de commande
- [ ] Attribution station (entrees, plats, desserts, boissons)
- [ ] Estimation temps de preparation
- [ ] Priorite (normal, urgent, VIP)
- [ ] Hook `useKitchenTickets(storeId)` - temps reel

#### Tests de validation Etape 5
- [ ] Cart : ajout, suppression, modification, total correct
- [ ] Orders : workflow de statuts complet
- [ ] Kitchen : creation et gestion tickets
- [ ] Store : selection, horaires, statut
- [ ] Tests unitaires >80% coverage

---

### Etape 6 : Package Themes (1er Theme Complet)

**Prerequis** : Etape 4
**Livrable** : Systeme de themes + theme Fast Food complet

#### 6.1 - Architecture du systeme de themes

- [ ] Interface `ThemeConfig` :
  ```typescript
  interface ThemeConfig {
    id: string
    name: string
    colors: { primary, secondary, accent, background }
    typography: { heading, body }
    layout: { hero, productGrid, checkout }
    features: Record<string, boolean>
    components: Record<string, ComponentType>
  }
  ```
- [ ] `ThemeProvider` : React context pour le theme actif
- [ ] `useTheme()` hook
- [ ] Systeme de resolution de composants par theme
- [ ] CSS variables generees dynamiquement

#### 6.2 - Theme Fast Food (complet)

- [ ] Config : couleurs (rouge/jaune), typo (Poppins/Inter)
- [ ] Hero : video produit appetissant
- [ ] ProductCard : images XXL, ajout rapide
- [ ] ProductGrid : grille dense, visuels dominants
- [ ] Checkout : page unique (quick checkout)
- [ ] Features activees : quickOrder, upselling, menuCombo
- [ ] Composants specifiques : `MenuCombo`, `QuickOrderButton`

#### 6.3 - Personnalisation client

- [ ] Override couleurs (primary, secondary, accent)
- [ ] Upload logo et favicon
- [ ] Choix polices (heading, body)
- [ ] Upload images hero
- [ ] Preview en temps reel dans le dashboard

#### Tests de validation Etape 6
- [ ] Theme Fast Food rendu completement
- [ ] Changement de couleurs applique en temps reel
- [ ] Logo et favicon personnalises
- [ ] Responsive mobile/tablet/desktop
- [ ] Fallback gracieux si un composant theme manque

---

### Etape 7 : App Restaurant - Storefront

**Prerequis** : Etapes 2, 3, 4, 5, 6
**Livrable** : Frontend client complet (menu, panier, commande)

#### 7.1 - Setup App Next.js 16

- [ ] Creer `apps/restaurant-theme/` avec Next.js 16 (App Router)
- [ ] Configurer Convex provider
- [ ] Configurer Better Auth provider
- [ ] Configurer theme provider
- [ ] Layout racine avec metadata SEO

#### 7.2 - Routes Storefront `(storefront)/`

Pages publiques :
- [ ] `/` - Page d'accueil (hero + produits populaires + categories)
- [ ] `/menu` - Menu complet (categories, filtres, recherche)
- [ ] `/menu/[categorySlug]` - Categorie specifique
- [ ] `/product/[productId]` - Detail produit (options, allergenes, ajout panier)
- [ ] `/cart` - Panier (liste items, modifier quantites, total)
- [ ] `/checkout` - Checkout (infos livraison, paiement, confirmation)
- [ ] `/order/[orderId]` - Suivi commande (statut temps reel)
- [ ] `/store-selector` - Selection etablissement (carte + liste)

Pages auth :
- [ ] `/login` - Connexion (email, OAuth, magic link)
- [ ] `/register` - Inscription
- [ ] `/forgot-password` - Reinitialisation mot de passe
- [ ] `/account` - Profil client (commandes, adresses, preferences)

#### 7.3 - Composants Storefront

- [ ] `StoreHeader` - Logo, nom, horaires, selection store
- [ ] `CategoryNav` - Navigation par categories (horizontal scroll)
- [ ] `ProductGrid` - Grille de produits (theme-aware)
- [ ] `ProductDetail` - Detail avec options, allergenes, nutritionnel
- [ ] `Cart` - Panier lateral ou page
- [ ] `CheckoutForm` - Formulaire multi-etapes
- [ ] `OrderTracker` - Suivi en temps reel (timeline)
- [ ] `StoreMap` - Carte des etablissements (Leaflet ou Google Maps)

#### 7.4 - Fonctionnalites

- [ ] Recherche produits (debounced, fuzzy)
- [ ] Filtres (allergenes, prix, disponibilite)
- [ ] Ajout au panier avec options
- [ ] Choix type commande (livraison, click & collect, sur place)
- [ ] Adresse de livraison (saisie + geolocalisation)
- [ ] Estimation temps de preparation
- [ ] Notifications commande (Convex subscriptions)

#### Tests de validation Etape 7
- [ ] Parcours complet : accueil -> menu -> panier -> checkout -> suivi
- [ ] Responsive mobile-first
- [ ] SEO : meta tags, og:image, structured data
- [ ] Performance : Lighthouse >90
- [ ] E2E Playwright : parcours commande complet

---

### Etape 8 : App Restaurant - Dashboard Admin

**Prerequis** : Etapes 2, 3, 4, 5
**Livrable** : Dashboard d'administration pour le restaurateur

#### 8.1 - Layout Admin

- [ ] `AdminLayout` : sidebar + topbar + content
- [ ] Navigation sidebar :
  - Dashboard (vue d'ensemble)
  - Commandes
  - Produits
  - Categories
  - Cuisine (KDS)
  - Clients
  - Equipe
  - Etablissements
  - Paiements
  - Design
  - Langues
  - Parametres

#### 8.2 - Dashboard principal

- [ ] Vue d'ensemble temps reel :
  - Commandes du jour (nombre, CA)
  - Commandes en cours
  - Produits les plus vendus
  - Graphique ventes (jour/semaine/mois)
- [ ] Alertes : stock bas, commandes en attente, imprimante hors ligne

#### 8.3 - Gestion des commandes

- [ ] Liste des commandes avec filtres (statut, date, type, source)
- [ ] Detail commande (items, client, paiement, timeline)
- [ ] Changement de statut (boutons d'action)
- [ ] Notification sonore nouvelle commande
- [ ] Badge source (site web, Uber Eats, Deliveroo)

#### 8.4 - Gestion des produits

- [ ] CRUD produits (formulaire complet)
- [ ] Upload images (multi-images, drag & drop)
- [ ] Gestion categories (CRUD, reordonner)
- [ ] Options et variantes (taille, supplements)
- [ ] Gestion allergenes (badges visuels)
- [ ] Infos nutritionnelles
- [ ] Gestion du stock
- [ ] Scheduling (disponibilite par horaire)
- [ ] Import/export CSV

#### 8.5 - Gestion des etablissements

- [ ] CRUD etablissements
- [ ] Horaires d'ouverture (par jour, periodes exceptionnelles)
- [ ] Adresse et geolocalisation
- [ ] Statut (ouvert, ferme, temporairement indisponible)
- [ ] Branding par etablissement (optionnel)

#### 8.6 - Gestion equipe

- [ ] CRUD membres d'equipe
- [ ] Attribution role (RBAC)
- [ ] Attribution etablissement(s)
- [ ] Logs d'activite

#### 8.7 - Design / Personnalisation

- [ ] Selection theme
- [ ] Editeur couleurs (color picker en temps reel)
- [ ] Upload logo / favicon
- [ ] Selection polices
- [ ] Preview du storefront

#### 8.8 - Parametres

- [ ] Informations restaurant
- [ ] Configuration paiements (activer/desactiver providers)
- [ ] Configuration livraison
- [ ] Configuration emails
- [ ] Gestion des imprimantes

#### Tests de validation Etape 8
- [ ] CRUD complet : produits, categories, stores, equipe
- [ ] Dashboard temps reel avec donnees live
- [ ] RBAC : chaque role voit uniquement ses pages
- [ ] Responsive tablet (usage principal)
- [ ] E2E : creation produit -> apparition sur storefront

---

### Etape 9 : Kitchen Display System (KDS)

**Prerequis** : Etapes 2, 5, 8
**Livrable** : Affichage cuisine temps reel + impression tickets

#### 9.1 - Ecran KDS

- [ ] Vue grille des tickets en cours
- [ ] Colonnes par statut : En attente / En preparation / Pret
- [ ] Drag & drop entre colonnes
- [ ] Timer par ticket (temps ecoule)
- [ ] Code couleur priorite (normal, urgent, VIP)
- [ ] Badge source commande (site, Uber Eats, Deliveroo)
- [ ] Notification sonore nouveau ticket

#### 9.2 - Multi-station

- [ ] Configuration stations (entrees, plats, desserts, boissons)
- [ ] Filtrage tickets par station
- [ ] Vue "tout" pour le chef

#### 9.3 - Impression tickets

- [ ] Support ESC/POS pour imprimantes thermiques
- [ ] Auto-impression a la confirmation de commande
- [ ] Impression manuelle (bouton reimpression)
- [ ] Multi-imprimantes (1 par station possible)
- [ ] Monitoring statut imprimantes
- [ ] Format ticket : numero commande, items, options, type, heure

#### 9.4 - Analytics cuisine

- [ ] Temps moyen de preparation par produit
- [ ] Temps moyen total par commande
- [ ] Taux d'achèvement dans les temps
- [ ] Pic d'activite par heure

#### Tests de validation Etape 9
- [ ] Tickets apparaissent en temps reel
- [ ] Drag & drop fonctionnel
- [ ] Impression fonctionne (mockee en dev)
- [ ] Multi-station filtre correctement
- [ ] Son de notification

---

### Etape 10 : Systeme de Paiement

**Prerequis** : Etapes 3, 7
**Livrable** : Paiement multi-provider fonctionnel

#### 10.1 - Architecture Payments

- [ ] Interface abstraite `PaymentProcessor`
- [ ] Factory `PaymentFactory.create(provider)`
- [ ] Types partages : `PaymentIntent`, `PaymentResult`, `RefundResult`

#### 10.2 - Stripe

- [ ] Installer `stripe` SDK
- [ ] `StripeProcessor` implementant `PaymentProcessor`
- [ ] Payment Intent (carte, Apple Pay, Google Pay)
- [ ] 3D Secure / SCA
- [ ] Webhooks (payment_succeeded, payment_failed, refund)
- [ ] API Route : `POST /api/payments/stripe/webhook`

#### 10.3 - SumUp

- [ ] `SumUpProcessor` implementant `PaymentProcessor`
- [ ] Checkout via SumUp API
- [ ] Support terminal physique (POS)
- [ ] Webhooks

#### 10.4 - PayPal

- [ ] Installer `@paypal/paypal-js`
- [ ] `PayPalProcessor` implementant `PaymentProcessor`
- [ ] Checkout standard
- [ ] Webhooks

#### 10.5 - Square

- [ ] `SquareProcessor` implementant `PaymentProcessor`
- [ ] Checkout via Square API
- [ ] Support Square Reader

#### 10.6 - Cash (en especes)

- [ ] `CashProcessor` (pas de transaction externe)
- [ ] Marquage paiement "en attente" -> "recu" par le staff

#### 10.7 - Dashboard paiements

- [ ] Liste transactions avec filtres (provider, statut, date)
- [ ] Detail transaction
- [ ] Remboursement (total/partiel)
- [ ] Export CSV/PDF

#### 10.8 - Checkout storefront

- [ ] Selection methode de paiement (dynamique selon config)
- [ ] Formulaire carte (Stripe Elements)
- [ ] Bouton PayPal
- [ ] Confirmation paiement + redirection
- [ ] Page erreur paiement avec retry

#### Tests de validation Etape 10
- [ ] Stripe : paiement test mode reussi
- [ ] PayPal : sandbox checkout reussi
- [ ] Remboursement fonctionne
- [ ] Webhooks traites correctement
- [ ] Fallback si provider indisponible
- [ ] E2E : checkout complet avec Stripe test

---

### Etape 11 : i18n + Traduction GPT

**Prerequis** : Etapes 3, 8
**Livrable** : Systeme multilingue avec traduction automatique

#### 11.1 - Gestion dynamique des langues

- [ ] Table `languages` : code, nom, drapeau, actif, RTL
- [ ] CRUD langues dans le dashboard admin
- [ ] Pas de limite de langues (admin ajoute ce qu'il veut)

#### 11.2 - Systeme de traduction

- [ ] Table `translations` : sourceText, targetLang, translatedText, type
- [ ] Traduction des produits (nom, description)
- [ ] Traduction des categories
- [ ] Traduction des pages CMS
- [ ] Traduction de l'interface admin (fichiers statiques)

#### 11.3 - Traduction automatique GPT-3.5-turbo

- [ ] API Route : `POST /api/translate`
- [ ] `translateWithGPT(text, sourceLang, targetLang, context)`
- [ ] Batch translate : `batchTranslate(items, sourceLang, targetLang)`
- [ ] Cout estime : ~$0.001/produit, ~$0.01/page
- [ ] File d'attente pour les traductions en masse
- [ ] Table `translationJobs` : suivi des traductions en cours

#### 11.4 - Dashboard i18n

- [ ] Liste des langues actives
- [ ] Ajout/suppression de langues
- [ ] Editeur de traductions manuelle
- [ ] Bouton "Traduire tout" (bulk)
- [ ] Progression traduction par langue
- [ ] Cout estime avant lancement

#### 11.5 - Storefront multilingue

- [ ] `<LanguageSwitcher />` dans le header
- [ ] Changement de langue sans rechargement
- [ ] Persistance cookie + localStorage
- [ ] Support RTL (direction, alignement)
- [ ] URLs localisees (optionnel)

#### Tests de validation Etape 11
- [ ] Ajout d'une langue et traduction d'un produit
- [ ] Traduction GPT retourne un resultat coherent
- [ ] Batch translate fonctionne pour 50+ produits
- [ ] Switch de langue instantane sur le storefront
- [ ] RTL fonctionne pour l'arabe

---

### Etape 12 : 5 Themes Restants

**Prerequis** : Etape 6
**Livrable** : 6 themes complets et fonctionnels

#### 12.1 - Theme Pizzeria
- [ ] Couleurs : rouge italien, vert basilic, orange fromage
- [ ] Layout : slider hero, masonry grid
- [ ] Features : pizza builder, selection taille visuelle, moitie-moitie
- [ ] Composants : `PizzaBuilder`, `SizeSelector`, `HalfAndHalf`

#### 12.2 - Theme Restaurant Chinois
- [ ] Couleurs : rouge chinois, noir, or
- [ ] Layout : grande image ambiance, liste avec icones
- [ ] Features : indicateur piment, menus A/B/C, icones ingredients
- [ ] Composants : `SpiceIndicator`, `MenuComboSelector`

#### 12.3 - Theme Fine Dining
- [ ] Couleurs : noir profond, or subtil, blanc casse
- [ ] Layout : minimal elegant, grille aere
- [ ] Features : descriptions detaillees, histoire du chef, accords vins
- [ ] Composants : `ChefStory`, `WinePairing`

#### 12.4 - Theme Cafe/Boulangerie
- [ ] Couleurs : marron cafe, sable dore, caramel
- [ ] Layout : carrousel, grille dense
- [ ] Features : menu petit-dejeuner, specials du jour, badges allergenes
- [ ] Composants : `DailySpecials`, `BreakfastMenu`

#### 12.5 - Theme Sushi Bar
- [ ] Couleurs : noir, rouge japonais, blanc pur
- [ ] Layout : video preparation, scroll horizontal
- [ ] Features : commande par pieces, systeme assiettes, roll visuel
- [ ] Composants : `PieceSelector`, `PlateSystem`, `WasabiLevel`

#### Tests de validation Etape 12
- [ ] Chaque theme rendu completement sans erreur
- [ ] Changement de theme dynamique
- [ ] Personnalisation couleurs fonctionne sur chaque theme
- [ ] Responsive mobile pour chaque theme
- [ ] Composants specifiques fonctionnels (pizza builder, etc.)

---

## PHASE 2 - INTEGRATIONS

---

### Etape 13 : Integration Uber Eats

**Prerequis** : Etapes 2, 5, 8
**Livrable** : Synchronisation menu + import commandes Uber Eats

#### 13.1 - Setup API Uber Eats

- [ ] Configuration credentials API
- [ ] Client HTTP avec auth OAuth2
- [ ] Gestion des tokens (refresh automatique)
- [ ] Rate limiting

#### 13.2 - Synchronisation menu

- [ ] Export menu vers Uber Eats (categories, produits, prix, images)
- [ ] Mapping des `externalIds.uberEatsId`
- [ ] Sync bidirectionnelle (statut stock)
- [ ] Sync automatique programmee (cron)
- [ ] Sync manuelle depuis dashboard

#### 13.3 - Import commandes

- [ ] Webhook reception commandes Uber Eats
- [ ] Conversion commande externe -> commande interne
- [ ] Creation automatique ticket cuisine
- [ ] Badge "Uber Eats" sur le KDS
- [ ] Auto-accept (configurable) ou accept manuel

#### 13.4 - Mise a jour statuts

- [ ] Sync statut commande vers Uber Eats
- [ ] Estimation temps preparation
- [ ] Annulation

#### 13.5 - Dashboard integration

- [ ] Page configuration Uber Eats
- [ ] Statut connexion
- [ ] Historique syncs
- [ ] Mapping produits

#### Tests de validation Etape 13
- [ ] Menu synchronise avec Uber Eats (sandbox)
- [ ] Commande recue et creee automatiquement
- [ ] Ticket cuisine cree avec badge Uber Eats
- [ ] Statuts synchronises bidirectionnellement

---

### Etape 14 : Integration Deliveroo

**Prerequis** : Etape 13 (meme pattern)
**Livrable** : Synchronisation menu + import commandes Deliveroo

#### 14.1 - Setup API Deliveroo
- [ ] Configuration credentials
- [ ] Client HTTP avec auth
- [ ] Rate limiting

#### 14.2 - Synchronisation menu
- [ ] Export menu vers Deliveroo
- [ ] Mapping `externalIds.deliverooId`
- [ ] Sync bidirectionnelle stock

#### 14.3 - Import commandes
- [ ] Webhook reception commandes
- [ ] Conversion + creation ticket cuisine
- [ ] Badge "Deliveroo" sur KDS
- [ ] Accept auto/manuel (configurable)

#### 14.4 - Dashboard integration
- [ ] Page configuration Deliveroo
- [ ] Statut + historique

#### Tests de validation Etape 14
- [ ] Memes criteres que Etape 13 pour Deliveroo

---

### Etape 15 : Uber Direct (Livraison)

**Prerequis** : Etape 7
**Livrable** : Livraison via Uber Direct pour les commandes du site

#### 15.1 - Setup API Uber Direct
- [ ] Configuration credentials (Customer ID)
- [ ] Client HTTP

#### 15.2 - Demande de livraison
- [ ] Creation delivery request : pickup (store) -> dropoff (client)
- [ ] Estimation cout et temps
- [ ] Validation zone de livraison

#### 15.3 - Suivi temps reel
- [ ] Tracking livreur (position GPS)
- [ ] Statuts : assignation, pickup, en route, livre
- [ ] Notifications client

#### 15.4 - Integration checkout
- [ ] Option "Livraison Uber Direct" au checkout
- [ ] Affichage cout livraison
- [ ] Estimation temps

#### Tests de validation Etape 15
- [ ] Livraison demandee et trackee (sandbox)
- [ ] Suivi temps reel fonctionnel
- [ ] Cout affiche au checkout

---

### Etape 16 : Email Marketing (Basique)

**Prerequis** : Etapes 3 (AWS SES), 8
**Livrable** : Systeme d'emails transactionnels + campagnes basiques

#### 16.1 - Emails transactionnels

- [ ] Template : Confirmation de commande
- [ ] Template : Commande prete (click & collect)
- [ ] Template : Commande en livraison
- [ ] Template : Commande livree
- [ ] Template : Bienvenue nouveau client
- [ ] Template : Reset mot de passe
- [ ] Template : Facture/Recu

#### 16.2 - Campagnes email basiques

- [ ] CRUD campagnes
- [ ] Editeur email simple (WYSIWYG)
- [ ] Selection destinataires (tous, segment basique)
- [ ] Programmation envoi
- [ ] Statistiques : envoyes, ouverts, cliques

#### 16.3 - Dashboard email

- [ ] Liste campagnes
- [ ] Statistiques par campagne
- [ ] Templates sauvegardees

#### Tests de validation Etape 16
- [ ] Emails transactionnels envoyes automatiquement
- [ ] Campagne creee et envoyee
- [ ] Statistiques trackees

---

### Etape 17 : CMS (Pages Statiques)

**Prerequis** : Etapes 3, 7
**Livrable** : Pages statiques editables par le restaurateur

#### 17.1 - Systeme de pages

- [ ] Table `cmsPages` : titre, slug, contenu, statut, SEO
- [ ] CRUD pages dans le dashboard
- [ ] Editeur de contenu (Markdown ou blocs simples)
- [ ] Preview avant publication
- [ ] Gestion brouillons / publie

#### 17.2 - Pages par defaut

- [ ] A propos
- [ ] Contact
- [ ] CGV (Conditions Generales de Vente)
- [ ] Mentions legales
- [ ] Politique de confidentialite

#### 17.3 - SEO

- [ ] Meta title, description, og:image par page
- [ ] Sitemap.xml automatique
- [ ] Robots.txt configurable
- [ ] Schema.org pour restaurant (structured data)

#### 17.4 - Storefront

- [ ] Route dynamique `/page/[slug]`
- [ ] Footer avec liens vers pages CMS
- [ ] 404 personnalisee

#### Tests de validation Etape 17
- [ ] Page creee dans admin -> visible sur storefront
- [ ] SEO meta tags corrects
- [ ] Sitemap genere
- [ ] 404 pour slugs inexistants

---

### Etape 18 : Gestion Clients

**Prerequis** : Etapes 3, 7, 8
**Livrable** : Profils clients et historique

#### 18.1 - Profils clients

- [ ] Table `customers` : nom, email, tel, adresses, preferences
- [ ] Creation automatique a la 1ere commande
- [ ] Lien avec le compte Better Auth

#### 18.2 - Espace client (storefront)

- [ ] `/account` - Profil (modifier infos)
- [ ] `/account/orders` - Historique commandes
- [ ] `/account/addresses` - Adresses sauvegardees
- [ ] `/account/favorites` - Produits favoris
- [ ] Re-commander en 1 clic

#### 18.3 - Dashboard admin clients

- [ ] Liste clients avec recherche
- [ ] Fiche client : infos, commandes, CA total, derniere visite
- [ ] Segmentation basique (nouveau, regulier, VIP)
- [ ] Export CSV

#### Tests de validation Etape 18
- [ ] Profil client cree automatiquement
- [ ] Historique commandes visible cote client
- [ ] Fiche client complete cote admin
- [ ] Re-commande en 1 clic

---

### Etape 19 : App Admin Dashboard BeInDigital

**Prerequis** : Toutes les etapes precedentes
**Livrable** : Dashboard interne BeInDigital pour gerer les clients

#### 19.1 - Setup app

- [ ] `apps/admin-dashboard/` avec Next.js 16
- [ ] Auth super_admin uniquement
- [ ] Design fixe BeInDigital (pas de theme)

#### 19.2 - Gestion clients (restaurants)

- [ ] Liste des clients restaurants
- [ ] Fiche client : infos, plan, maintenance, deployement
- [ ] Statut maintenance (actif, expire, grace)

#### 19.3 - Deploiement

- [ ] Creation repo client depuis template
- [ ] Configuration initiale automatisee
- [ ] Deploiement Vercel + Convex

#### 19.4 - Maintenance

- [ ] Notifications expiration maintenance
- [ ] Gestion renouvellements
- [ ] Historique mises a jour

#### Tests de validation Etape 19
- [ ] CRUD clients restaurants
- [ ] Deploiement automatise (ou semi-automatise)
- [ ] Alertes maintenance

---

## Dependances entre etapes

```
Etape 1 (Fondation)
├── Etape 2 (Convex Schema)
│   ├── Etape 3 (Core Auth/i18n)
│   │   ├── Etape 7 (Storefront)
│   │   │   ├── Etape 10 (Paiements)
│   │   │   ├── Etape 15 (Uber Direct)
│   │   │   ├── Etape 17 (CMS)
│   │   │   └── Etape 18 (Clients)
│   │   ├── Etape 8 (Admin Dashboard)
│   │   │   ├── Etape 9 (KDS)
│   │   │   ├── Etape 11 (i18n GPT)
│   │   │   ├── Etape 13 (Uber Eats)
│   │   │   ├── Etape 14 (Deliveroo)
│   │   │   └── Etape 16 (Email)
│   │   └── Etape 5 (Restaurant Logic)
│   └── Etape 5 (Restaurant Logic)
├── Etape 4 (UI Components)
│   └── Etape 6 (Theme Fast Food)
│       └── Etape 12 (5 Themes restants)
└── Etape 19 (Admin BeInDigital) [Apres tout]
```

### Parallelisation possible

Certaines etapes peuvent etre developpees en parallele :

- **Etape 4** (UI) en parallele avec **Etape 2** (Schema) et **Etape 3** (Core)
- **Etape 6** (Theme) des que Etape 4 est terminee
- **Etape 12** (Themes restants) en parallele avec Etape 7-8
- **Etape 13** (Uber Eats) et **Etape 14** (Deliveroo) en parallele
- **Etape 16** (Email) et **Etape 17** (CMS) en parallele

---

## Decision Log

| # | Decision | Alternatives | Raison |
|---|----------|-------------|--------|
| 1 | Turborepo monorepo complet | App unique, monorepo simplifie | Modele business de vente de themes necessite packages modulaires et publiables |
| 2 | AWS S3 + SES | Convex Storage + Resend | Plus de controle, moins cher a grande echelle, coherent avec CLAUDE.md |
| 3 | Tests des le debut | Tests apres MVP | Qualite et fiabilite, eviter la dette technique |
| 4 | Better Auth + Convex | NextAuth, Clerk, Auth0 | Framework-agnostic, type-safe, plugins modulaires, compatible Convex |
| 5 | 1 theme complet d'abord | Tous les themes en parallele | Valider l'architecture theme avant de multiplier |
| 6 | Phases 1+2 detaillees | Plan complet 5 phases | Focus sur le livrable prioritaire, phases 3-5 plus tard |
| 7 | GPT-3.5-turbo pour traduction | DeepL API, Google Translate | Cout tres bas ($0.001/produit), qualite suffisante, deja dans le stack |

---

## Hypotheses

1. **Convex** supporte le volume prevu (centaines de produits, milliers de commandes/mois)
2. **Better Auth** a un adaptateur Convex stable et maintenu
3. Les **API Uber Eats et Deliveroo** sont accessibles (besoin de partenariat commercial)
4. Le deploiement client sera sur **Vercel** (compatible Next.js 16)
5. Le **budget AWS** est gere par client (chaque restaurant paie ses propres couts S3/SES)

---

## Risques identifies

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Better Auth + Convex : adaptateur instable | Haut | Tester tot, avoir un plan B (auth custom) |
| APIs plateformes (Uber Eats, Deliveroo) : acces restreint | Moyen | Contacter les partenariats des Phase 1, mock en dev |
| Complexite monorepo | Moyen | Setup solide en Etape 1, CI stricte |
| Performance Convex avec beaucoup de tables | Bas | Index optimises, pagination systematique |
| Impression thermique ESC/POS | Moyen | Librairie existante (escpos), tester avec vrai materiel |

---

**Version** : 1.0.0
**Date** : 14 Fevrier 2026
**Auteur** : BeInDigital Team
