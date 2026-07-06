# Design V1 — Programme Apporteur d'Affaires Be in Digital

> Document validé le 2026-03-26. Prêt pour implémentation.

---

## 1. Objectif

Mettre en place un programme d'apporteur d'affaires permettant :

- à un apporteur de s'inscrire,
- d'obtenir un code/lien,
- de partager ce code,
- de générer une réduction pour le client parrainé,
- et de recevoir une commission une fois la commande validée.

---

## 2. Decision Log

### 1. Modèle d'inscription apporteur

**Décision :** inscription en deux temps.

- étape 1 : création rapide du compte
- étape 2 : complétion du profil + Stripe Connect avant premier versement

**Pourquoi :** réduire la friction à l'entrée tout en gardant un onboarding paiement propre.

### 2. Type de programme

**Décision :** programme mono-niveau.

- un seul apporteur par client/commande
- pas de sous-parrainage
- pas de MLM

**Pourquoi :** simplicité métier et technique pour la V1.

### 3. Récompense apporteur

**Décision :** commission par défaut de 500 €, modifiable par l'admin par apporteur.

- stockée en `commissionOverrideCents` si override
- snapshot dans `referrals.commissionCents` au moment du paiement

**Pourquoi :** permettre des cas particuliers sans casser l'historique.

### 4. Réduction client parrainé

**Décision :** réduction par défaut de 10 % sur le paiement initial uniquement.

- jamais sur la maintenance
- modifiable par apporteur
- snapshot dans `referrals.discountPercent` et `discountAmountCents`

**Pourquoi :** garder une offre simple et protéger les revenus récurrents.

### 5. Validation d'un parrainage

**Décision :** un referral devient validé après un délai business de 14 jours.

- il ne s'agit pas d'une vérité juridique universelle
- c'est un tampon anti-remboursement / litige / annulation

**Pourquoi :** sécuriser les versements sans attendre plusieurs mois.

### 6. Moment de création du referral

**Décision :** le referral est créé uniquement au paiement initial confirmé.

- jamais à la simple saisie du code
- jamais à la création de la session Stripe seule

**Pourquoi :** éviter les faux positifs et garder un modèle financier propre.

### 7. Attribution du parrainage

**Décision :** champ manuel dans le checkout, avec support de `?ref=CODE` en préremplissage/auto-validation.

- un seul code actif appliqué par checkout
- calcul côté serveur uniquement

**Pourquoi :** rester simple sans se fermer à une future V2 plus trackée.

### 8. Stockage de la vérité métier

**Décision :** toute validation, réduction et création de referral se fait côté serveur.

- le front ne sert qu'à l'UX
- Stripe reçoit le montant recalculé par le backend

**Pourquoi :** sécurité, cohérence, anti-fraude.

### 9. Authentification

**Décision :** Convex Auth.

- pas de `passwordHash` dans la table métier `users`
- `users.authUserId` sert de lien avec l'identité auth

**Pourquoi :** éviter de reconstruire la couche auth.

### 10. Versements

**Décision :** Stripe Connect Express.

- onboarding hébergé par Stripe
- statut réel basé sur `account.updated` + relecture Account
- `active` seulement si compte réellement payable (`payouts_enabled`, `capabilities.transfers`, pas de blocage)

**Pourquoi :** onboarding simple, conformité Stripe, faible charge d'implémentation.

### 11. Payout model V1

**Décision :** pas de table `payouts` en V1.

- les versements sont dérivés des referrals
- `stripeTransferId` stocké directement dans referrals

**Pourquoi :** limiter la complexité initiale.

### 12. Dashboard admin

**Décision :** intégration dans le dashboard existant sous `/dashboard/affiliation/*`

**Pourquoi :** cohérence produit, pas de deuxième univers admin.

### 13. Dashboard apporteur

**Décision :** espace dédié sous `/parrainage/dashboard/*`

**Pourquoi :** expérience claire, orientée partage, gains et onboarding paiement.

### 14. États d'un referral

**Décision :** machine à états : `pending` → `validated` → `payable` → `paid` | `cancelled` | `blocked`

**Pourquoi :** couvrir le cycle automatique et les exceptions manuelles.

### 15. Garde-fous principaux

**Décision :**

- auto-parrainage interdit
- code désactivé = inutilisable
- apporteur suspendu = pas de nouveaux referrals
- 1 `orderId` = 1 referral max
- `programEnabled = false` = pause globale

**Pourquoi :** fiabilité métier minimale indispensable.

---

## 3. Modèle de données

### Table `users`

| Champ | Type | Notes |
|-------|------|-------|
| `authUserId` | string | Lien Convex Auth |
| `email` | string, unique | |
| `role` | `"affiliate"` \| `"admin"` | |
| `firstName` | string, optionnel | Requis avant versement |
| `lastName` | string, optionnel | Requis avant versement |
| `phone` | string, optionnel | |
| `status` | `"pending"` \| `"active"` \| `"suspended"` \| `"rejected"` | |
| `stripeConnectAccountId` | string, nullable | |
| `stripeConnectStatus` | `"not_started"` \| `"pending"` \| `"active"` \| `"disabled"` | |
| `commissionOverrideCents` | number, nullable | Override admin |
| `discountOverridePercent` | number, nullable | Override admin |
| `createdAt` | number | |
| `updatedAt` | number | |

**Index :** `by_email`, `by_authUserId`, `by_status`, `by_role`

### Table `referralCodes`

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | ref `users` | |
| `code` | string, unique | Personnalisable |
| `isCustom` | boolean | |
| `status` | `"active"` \| `"disabled"` | |
| `createdAt` | number | |
| `updatedAt` | number | |

**Index :** `by_code`, `by_userId`
**Règle V1 :** 1 code actif principal par apporteur.

### Table `referrals`

| Champ | Type | Notes |
|-------|------|-------|
| `referrerId` | ref `users` | L'apporteur |
| `referralCodeId` | ref `referralCodes` | |
| `orderId` | ref `orders`, unique | 1 order = 1 referral max |
| `customerEmail` | string | Snapshot |
| `customerName` | string, nullable | Snapshot |
| `status` | `"pending"` \| `"validated"` \| `"payable"` \| `"paid"` \| `"cancelled"` \| `"blocked"` | |
| `statusReason` | string, nullable | `"refund"`, `"chargeback"`, `"fraud_suspected"`, `"self_referral"`, `"manual_admin_block"`, `"duplicate"` (extensible) |
| `commissionCents` | number | Snapshot (50000 par défaut) |
| `discountPercent` | number | Snapshot (10 par défaut) |
| `discountAmountCents` | number | Montant réel appliqué |
| `stripeTransferId` | string, nullable | |
| `adminNote` | string, nullable | |
| `createdAt` | number | |
| `updatedAt` | number | |
| `validatedAt` | number, nullable | |
| `payableAt` | number, nullable | |
| `paidAt` | number, nullable | |
| `blockedAt` | number, nullable | |
| `cancelledAt` | number, nullable | |

**Index :** `by_referrerId`, `by_orderId`, `by_status`, `by_referralCodeId`

### Table `affiliateSettings` (1 document)

| Champ | Type | Notes |
|-------|------|-------|
| `defaultCommissionCents` | number | 50000 (500 €) |
| `defaultDiscountPercent` | number | 10 |
| `validationDelayDays` | number | 14 |
| `programEnabled` | boolean | Coupe-circuit |
| `updatedAt` | number | |

---

## 4. Architecture des routes

### Public

```
/parrainage                → Landing page programme + CTA inscription
/parrainage/inscription    → Formulaire d'inscription
/parrainage/connexion      → Formulaire de connexion
/parrainage/conditions     → Règles, éligibilité, montants, cas de blocage
```

### Apporteur (auth requise)

```
/parrainage/dashboard              → Stats, graphiques, revenus cumulés
/parrainage/dashboard/filleuls     → Liste filleuls + statuts
/parrainage/dashboard/versements   → Historique versements
/parrainage/dashboard/profil       → Profil + Stripe Connect onboarding
/parrainage/dashboard/partage      → Code, lien, partage réseaux
```

### Admin (auth + rôle admin)

```
/dashboard/affiliation              → KPIs + actions prioritaires
/dashboard/affiliation/apporteurs   → Liste apporteurs, actions
/dashboard/affiliation/parrainages  → Referrals, filtres, actions manuelles
/dashboard/affiliation/versements   → Suivi payouts / transfers
/dashboard/affiliation/parametres   → Config globale, coupe-circuit
```

### Existant modifié

```
/checkout   → + champ "Code parrainage" optionnel
Footer      → + lien "Devenir apporteur d'affaires" → /parrainage
```

### Protection des routes — Défense en profondeur

1. `proxy.ts` → filtrage amont, redirection non-connectés
2. Layout serveur protégé → contrôle d'accès avec `redirect()`
3. Vérification de rôle dans les queries/mutations Convex

---

## 5. Flow Stripe Connect + Versements

### Onboarding Stripe Connect Express

1. Clic "Configurer mon compte de paiement"
2. Action Convex : créer/récupérer Connected Account Express
3. Créer Account Link (`return_url` + `refresh_url`)
4. Redirection Stripe hosted onboarding
5. `refresh_url` = recrée un Account Link côté serveur
6. `return_url` = retour UI (indicatif seulement)
7. Vérité métier : webhook `account.updated` + relecture Account API
8. `stripeConnectStatus = "active"` SEULEMENT si `payouts_enabled = true` + `capabilities.transfers = active` + pas de blocage

### Création du referral (idempotent)

1. Écouter `checkout.session.completed`
2. (V2+) Écouter aussi `checkout.session.async_payment_succeeded`
3. Vérifier `payment_status`
4. Créer referral en `"pending"` — idempotent sur `orderId`
5. Metadata Stripe : `referralId`, `referrerId`, `orderId`

### Validation (cron quotidien)

1. Referrals `"pending"` où `createdAt + 14j < now`
2. Vérifier absence remboursement / annulation / litige
3. Si OK → `"validated"`
4. Si problème → `"cancelled"` + `statusReason`

### Passage à payable

1. Cron : referrals `"validated"` + `stripeConnectStatus "active"` → `"payable"`
2. Aussi sur webhook `account.updated` → promouvoir referrals `"validated"` si compte vient de passer `"active"`

### Versement

1. Pour chaque referral `"payable"` non bloqué
2. Transfer Stripe vers Connected Account (metadata + `transfer_group`)
3. Succès → `"paid"`, stocker `stripeTransferId`, set `paidAt`
4. Échec → garder `"payable"`, stocker erreur, retenter via job, notifier admin
5. Stripe ne retente PAS un transfer raté automatiquement

---

## 6. Modification du checkout

### Zustand store

```
referralInput: string
referralStatus: "idle" | "checking" | "applied" | "error"
appliedReferral: { code, referralCodeId, referrerFirstName, percent, amountCents } | null
referralError: string | null
```

### UX

- Champ optionnel à l'étape "info"
- `?ref=CODE` → auto-injection + auto-validation au chargement
- Si valide : "Code de parrainage appliqué"
- Si invalide : message d'erreur
- Bouton "Retirer le code" disponible
- Récapitulatif : ligne réduction visible, total ajusté

### Serveur — `createCheckoutSession()`

1. Recalcul complet du prix côté serveur
2. Validation code (actif, apporteur actif, programme activé)
3. Anti auto-parrainage : `email client ≠ email apporteur` (best effort V1)
4. Calcul réduction sur mise en service uniquement
5. Session Stripe : `client_reference_id` + metadata
6. Aucun referral créé à ce stade

### Webhook

1. `checkout.session.completed`
2. Lire `client_reference_id` + metadata
3. Si `referralCodeId` → créer referral idempotent sur `orderId`

---

## 7. Dashboard apporteur

### Vue d'ensemble

- KPIs : revenus totaux, en attente, nombre filleuls
- 1 graphique : revenus par mois
- 5 derniers filleuls

### Filleuls

- Tableau : Date, Client, Plan (si dispo), Statut, Commission
- Filtres par statut, pastilles couleur

### Versements

- Tableau : Date, Montant, Statut (Payé / Versable / En attente)
- Solde disponible + total versé

### Profil

- Infos personnelles (prénom, nom, email readonly, téléphone)
- Stripe Connect : statut + action selon état
- Bandeau prioritaire si commissions validated mais Stripe pas actif

### Partage

- Code affiché en gros (copiable)
- Lien complet copiable
- Personnalisation du code (1 fois en V1)
- Boutons partage : WhatsApp, Email, X, LinkedIn, Copier

---

## 8. Dashboard admin

### Vue d'ensemble

- KPIs : apporteurs actifs, parrainages du mois, commissions versées/en attente
- `programEnabled` affiché (pas de toggle direct, lien vers paramètres)
- Bloc actions prioritaires : payable à verser, bloqués récents, Stripe incomplets, transfers en erreur

### Apporteurs

- Tableau : Prénom Nom, Email, Statut, Code, Stripe Connect (badge), Overrides, Filleuls, Revenus
- Actions : activer/suspendre/rejeter, modifier commission/réduction, désactiver code
- Route future : `/apporteurs/[userId]` (modale en V1)

### Parrainages

- Tableau : Date, Apporteur, Client, Plan (si dispo), Montant commande, Commission, Réduction, Statut
- Actions : bloquer (statusReason + adminNote obligatoires), débloquer (retour intelligent), forcer validation
- Déblocage intelligent : retour vers statut cohérent (payable/validated/pending selon conditions)

### Versements et transferts

- Vue dérivée des referrals
- Tableau : Date, Apporteur, Referral/orderId, Montant, Statut, stripeTransferId, Erreur
- Filtres : payable, paid, failed/retry
- Action : retenter transfer échoué

### Paramètres

- Commission par défaut, réduction par défaut, délai validation, programEnabled
- Validation stricte (commission > 0, discount 0-100, délai >= 0)
- Avertissement fort si programEnabled = false
- Confirmation visuelle après sauvegarde

---

## 9. Règles métier finales

### Éligibilité

- Inscription publique
- 1 compte par personne
- Compte suspendable/rejetable
- 1 code actif principal en V1

### Checkout

- Code optionnel
- Réduction sur mise en service uniquement
- Calcul serveur uniquement
- Aucun referral avant paiement confirmé

### Validation / Versement

- Validation après délai business (14j)
- Versement si Stripe Connect actif
- Blocage admin possible à tout moment
- Retry si transfer échoué

### Unicité

- 1 orderId = 1 referral max
- 1 checkout = 1 code appliqué max
- Code désactivé = plus de nouveaux referrals

### Audit V1

- Toute action manuelle met à jour : `updatedAt` + `adminNote` + `statusReason`

---

## 10. Non-goals V1

- Multi-level referral
- Tracking clics avancé
- Table payouts
- Page détail filleul
- Analytics marketing poussées
- Édition email apporteur depuis dashboard
- Gestion financière self-service

---

## 11. Prévus V2+

- Tracking clics → conversions
- Page détail referral
- Historique modifications paramètres
- Table payouts
- Vue détaillée apporteur admin
- Campagnes de referral
- Attribution avancée
- Lien public enrichi avec tracking

---

## 12. Critères d'acceptation

Le système est correct si :

- [ ] Un apporteur peut s'inscrire et se connecter
- [ ] Un code de parrainage actif est disponible dans son espace
- [ ] Un client peut appliquer ce code dans le checkout
- [ ] La réduction est calculée uniquement sur la mise en service
- [ ] Le paiement Stripe reflète le montant recalculé
- [ ] Un referral est créé après paiement confirmé
- [ ] Le referral passe correctement par les statuts attendus
- [ ] Stripe Connect permet de débloquer les versements
- [ ] Un transfer réussi marque le referral en `paid`
- [ ] L'admin peut superviser, bloquer, débloquer et configurer

---

## 13. Ordre d'implémentation recommandé

### Phase 1 — Fondations

- Tables Convex (users, referralCodes, referrals, affiliateSettings)
- Auth Convex

### Phase 2 — Inscription + Dashboard basique

- Pages publiques : /parrainage, inscription, connexion
- Dashboard apporteur minimal
- Génération code principal

### Phase 3 — Checkout + Tracking

- Intégration checkout : champ code, validation serveur
- Metadata Stripe
- Webhook : création referral

### Phase 4 — Validation + Paiements

- Cron validation (14j)
- Onboarding Stripe Connect
- Passage payable → paid

### Phase 5 — Admin

- Dashboard admin complet
- Actions manuelles
- Paramètres globaux

### Phase 6 — Polish

- UX polish
- Tests
- Observabilité
- Retries payout / erreurs Stripe
