# Auto Blog Engine — Feature Spec

> Upsell premium : generation automatique d'articles de blog via LLM.

---

## 1. Modele d'abonnement

| | Starter | Pro | Enterprise |
|---|---------|-----|------------|
| Articles/mois | 2 | 8 (2/semaine) | ~30 (quotidien) |
| Thematiques | 3 max | Illimitees | Illimitees |
| Traduction multi-langue | Non | Non | Oui |
| Mode approbation | Brouillon uniquement | Brouillon ou auto-publish | Brouillon ou auto-publish + multi-langue |

- **Billing** : Stripe Subscriptions, au niveau **owner account** (pas par store)
- **1 owner = N stores** : les droits viennent de l'abonnement owner, pas du store
- **Config editoriale** : par store (chaque store peut avoir ses propres reglages)

---

## 2. Parametres configurables (`blogAutoConfig`)

| Parametre | Type | Description |
|-----------|------|-------------|
| `themes` | `string[]` | Liste libre guidee (ex: "recettes de saison", "evenements locaux") |
| `frequency` | `"weekly" \| "monthly"` | Frequence de generation |
| `preferredWeekday` | `number? (0-6)` | Jour prefere si weekly |
| `preferredMonthDay` | `number? (1-28)` | Jour prefere si monthly |
| `preferredHour` | `number (0-23)` | Heure locale preferee |
| `timezone` | `string` | Ex: "Europe/Paris" |
| `tone` | `"formel" \| "decontracte" \| "storytelling"` | Ton de redaction |
| `primaryLocale` | `string` | Langue source (ex: "fr") |
| `autoTranslate` | `boolean` | Branche sur le pipeline i18n existant |
| `approvalMode` | `"draft_review" \| "auto_publish"` | Mode d'approbation |
| `targetStoreIds` | `Id<"stores">[]?` | Stores pour contexte local (optionnel) |
| `categoryId` | `Id<"blogCategories">?` | Categorie par defaut pour les articles generes |

**Regles d'approbation par plan** :
- Starter : `draft_review` uniquement
- Pro : `draft_review` ou `auto_publish`
- Enterprise : `draft_review` ou `auto_publish` + multi-langue

---

## 3. Generation du contenu

### 3.1 LLM — Approche model-agnostic

Config par type de tache (pas de SKU fige) :

```
generationModel: string   // ex: "gpt-4o-mini" (eco) ou "gpt-4o" (qualite)
seoModel: string           // pour meta/keywords
translationModel: string   // deja existant via i18n
```

- **Standard (Starter/Pro)** : modele eco
- **Enterprise** : modele qualite pour reecriture + multi-langue

### 3.2 Sources de contexte

Le LLM recoit un contexte structure, jamais un prompt vide :

1. **Restaurant/marque** : nom, positionnement, specialites, ton de marque
2. **Menu/produits/categories** : plats populaires, nouveautes, prix
3. **Localisation** : ville, quartier, saisonnalite locale, evenements
4. **Donnees internes** : promos, horaires speciaux, actualites
5. **Historique articles** : titres/sujets deja publies → eviter les doublons

**Types d'articles generes** :
- Recettes de saison
- Focus produit / plat signature
- Actualites du restaurant
- Evenements locaux lies a la marque
- Coulisses / storytelling
- Accords mets-vins

### 3.3 Images

Ordre de priorite :
1. **cmsMedia existant** en priorite (coherent avec la marque)
2. **Fallback stock photos** (Unsplash/Pexels API) si aucun visuel interne
3. **Generation IA** : hors scope V1

En V1 : si pas d'image pertinente, l'article sort sans cover (le restaurateur peut l'ajouter en review).

### 3.4 SEO

Le moteur genere automatiquement :
- `slug`
- `metaTitle`
- `metaDescription`
- Mots-cles cibles
- Angle SEO avant redaction

**Override admin** : le restaurateur peut corriger slug, metas, titre final apres generation.

---

## 4. Architecture technique

### 4.1 Nouvelles tables Convex

#### `blogAutoConfig` — Configuration editoriale par store

```typescript
{
  ownerId: string,              // Better Auth userId
  storeId: Id<"stores">,        // config par store

  isEnabled: boolean,

  themes: string[],
  frequency: "weekly" | "monthly",
  preferredWeekday?: number,    // 0-6 si weekly
  preferredMonthDay?: number,   // 1-28 si monthly
  preferredHour: number,        // heure locale
  timezone: string,             // ex: "Europe/Paris"

  tone: "formel" | "decontracte" | "storytelling",
  primaryLocale: string,
  autoTranslate: boolean,

  approvalMode: "draft_review" | "auto_publish",

  categoryId?: Id<"blogCategories">,
  targetStoreIds?: Id<"stores">[],

  lastPlannedAt?: number,
  lastGeneratedAt?: number,

  createdAt: number,
  updatedAt: number,
}
```

**Index** : `by_storeId`, `by_ownerId`, `by_isEnabled`

#### `blogAutoQueue` — File d'attente / journal de jobs

```typescript
{
  ownerId: string,
  storeId: Id<"stores">,
  configId: Id<"blogAutoConfig">,

  status: "pending" | "generating" | "draft_created" | "published" | "failed" | "cancelled",

  scheduledFor: number,
  startedAt?: number,
  completedAt?: number,

  theme: string,
  locale: string,

  generatedTitle?: string,
  generatedSlug?: string,

  articleId?: Id<"blogArticles">,

  errorCode?: string,
  errorMessage?: string,

  retryCount: number,
  maxRetries: number,           // default 3
  idempotencyKey: string,       // ex: storeId + yyyy-mm + slot + theme

  createdAt: number,
  updatedAt: number,
}
```

**Index** : `by_storeId`, `by_status_scheduledFor`, `by_configId`, `by_idempotencyKey`

#### `blogAutoUsage` — Quotas mensuels

```typescript
{
  ownerId: string,
  periodKey: string,        // "2026-02"
  generatedCount: number,
  publishedCount: number,
  updatedAt: number,
}
```

**Index** : `by_ownerId_periodKey`

### 4.2 Crons Convex (2 crons separes)

#### A. `planAutoBlogJobs` — Toutes les heures

Role :
1. Lire les `blogAutoConfig` avec `isEnabled=true`
2. Verifier le plan owner + quota restant (`blogAutoUsage`)
3. Calculer si un article doit etre planifie selon frequence/jour/heure/timezone
4. Creer un `blogAutoQueue(status="pending")` avec `idempotencyKey` pour eviter doublons

**Ce cron ne genere PAS le contenu.** Il ne fait que planifier.

#### B. `executeAutoBlogQueue` — Toutes les 5-15 minutes

Role :
1. Recuperer les jobs `pending` avec `scheduledFor <= now`
2. Passer le job en `generating`
3. Appeler le pipeline de generation (Convex action → API OpenAI)
4. Marquer `draft_created` / `published` / `failed`
5. Incrementer `blogAutoUsage.generatedCount`

**Separer planification et execution** → plus fiable, plus debogable.

### 4.3 Pipeline de generation

```
1. Selection du job
   └─ blogAutoQueue.status = "pending"

2. Assemblage du contexte
   ├─ Infos restaurant/marque (stores, nom, specialites)
   ├─ Menu / produits / categories
   ├─ Localisation (ville, quartier, saison)
   ├─ Donnees internes (promos, horaires speciaux)
   ├─ Theme choisi
   ├─ Ton et langue
   └─ Historique articles publies (anti-doublon)

3. Prompt LLM
   └─ Genere : title, excerpt, content (HTML), metaTitle, metaDescription, keywords, suggestion d'image

4. Selection d'image
   ├─ Recherche cmsMedia par mots-cles
   └─ Fallback : pas d'image (ou stock photo en V2)

5. Creation article (fonctions existantes)
   ├─ createArticle({ storeId, title, categoryId })
   ├─ saveDraft({ articleId, draftContent, categoryId, tagIds })
   └─ Si auto_publish : publishArticle({ articleId })

6. Traduction (si autoTranslate=true et plan le permet)
   └─ Declenche le pipeline i18n existant

7. Mise a jour queue
   ├─ articleId
   ├─ status: "draft_created" | "published"
   └─ timestamps
```

**Important** : l'auto-blog est une surcouche d'orchestration, PAS un second systeme d'articles. Il reutilise `createArticle`, `saveDraft`, `publishArticle`.

---

## 5. Gating / Controle d'acces

### 5.1 Hierarchie

```
Stripe = source de verite (paie ou non)
    ↓
Owner Entitlements = ce qu'il a le droit d'utiliser
    ↓
Store Config = comment il veut l'utiliser sur ce store
```

`blogAutoConfig.isEnabled` est un toggle de config locale, PAS la source de verite billing.

### 5.2 Owner Feature Entitlements

Derives de Stripe, stockes cote app :

```typescript
autoBlog: {
  enabled: boolean,
  plan: "starter" | "pro" | "enterprise" | null,
  monthlyQuota: number,       // 2, 8, 30
  maxTopics: number | null,   // 3, null, null
  allowMultiLanguage: boolean, // false, false, true
  allowAutoPublish: boolean,  // false, true, true
}
```

### 5.3 Trois niveaux de gating

#### A. UI Admin
- Pas de plan → section masquee + upsell CTA
- Quota atteint → bouton desactive + message
- Starter → max 3 themes, draft only
- Badge plan actuel + compteur usage mensuel

#### B. Backend (mutations/actions Convex)
Chaque mutation sensible reverifie :
- Feature active
- Quota restant
- Limites du plan (themes, auto-publish, multi-langue)

**Ne jamais faire confiance a l'UI seule.**

#### C. Cron
Le cron ignore les stores si :
- Abonnement expire
- Quota atteint
- Feature desactivee

### 5.4 Webhooks Stripe

Events a ecouter :
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Effets :
- Activer/desactiver `autoBlog`
- Mettre a jour le plan
- Recalculer les limites

Etats intermediaires :
- `past_due` → acces lecture seule, pas de nouvelles generations
- `canceled` → feature coupee

### 5.5 Tables de gating

```
ownerSubscription / billing table     ← synchro Stripe webhooks
ownerFeatureEntitlements              ← droits derives
blogAutoConfig (par store)            ← config editoriale
blogAutoUsage (par owner/mois)        ← quotas
```

---

## 6. UX Admin — Ecrans

### 6.1 Page Auto Blog (`/content/blog/auto`)

**Si pas d'abonnement** : page d'upsell avec presentation des plans

**Si abonne** :
- Header : "Blog Automatique" + badge plan + compteur usage (ex: "3/8 articles ce mois")
- Config editoriale (formulaire)
- Historique des generations (table blogAutoQueue)
- Toggle activer/desactiver

### 6.2 Configuration

- Themes : input multi-values (chips + add)
- Frequence : radio weekly/monthly + selects jour/heure
- Ton : radio 3 options
- Langue : select
- Auto-traduction : toggle (gate par plan)
- Mode approbation : radio draft/auto-publish (gate par plan)
- Categorie par defaut : select depuis blogCategories

### 6.3 Historique / Queue

Table avec colonnes :
- Theme
- Statut (pending/generating/draft/published/failed)
- Date planifiee
- Article (lien vers editeur si cree)
- Actions (annuler si pending, relancer si failed)

### 6.4 Badge dans la liste blog

Articles generes automatiquement : badge "Auto" distinctif dans BlogArticlesTable.

---

## 7. Phases d'implementation

### Phase 1 — Schema + Gating (P0)
- Tables : `blogAutoConfig`, `blogAutoQueue`, `blogAutoUsage`
- Owner entitlements / feature flags
- Stripe webhooks pour auto-blog
- Page upsell si pas d'abonnement

### Phase 2 — Config UI (P1)
- Page `/content/blog/auto`
- Formulaire configuration
- Validation des limites par plan

### Phase 3 — Pipeline generation (P1)
- Convex action pour appel LLM
- Assemblage contexte restaurant
- Creation article via fonctions existantes
- Cron `executeAutoBlogQueue`

### Phase 4 — Planification (P1)
- Cron `planAutoBlogJobs`
- Logique frequence/timezone/jours preferes
- Deduplication via `idempotencyKey`

### Phase 5 — Traduction + Polish (P2)
- Integration pipeline i18n existant
- Selection d'images cmsMedia
- Historique/queue UI
- Metriques usage

---

## 8. Decisions techniques

| Decision | Choix | Raison |
|----------|-------|--------|
| Billing level | Owner account | 1 owner = N stores |
| Config level | Par store | Chaque store a ses reglages |
| Source verite billing | Stripe | Pas de statut billing dans blogAutoConfig |
| LLM | GPT (model-agnostic config) | eco pour standard, qualite pour Enterprise |
| Images V1 | cmsMedia existant | Coherence marque, pas de generation IA |
| Article creation | Fonctions blog existantes | Surcouche, pas de duplication |
| Crons | 2 separes (plan + execute) | Fiabilite, debuggabilite |
| Anti-doublon | idempotencyKey | storeId + period + slot + theme |
| Approbation default | draft_review | Securite, gate par plan |

---

## 9. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Contenu LLM hors sujet | Contexte structure + review obligatoire (Starter) |
| Doublons d'articles | idempotencyKey + historique anti-doublon |
| Quota depasse | Double check : cron + mutation |
| Stripe webhook rate | Idempotent handlers + retry |
| Cout LLM eleve | Modele eco par defaut, qualite gate par plan |
| Restaurateur oublie de review | Notification/email quand draft genere |
