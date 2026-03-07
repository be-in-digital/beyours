# Blog CMS & Mediatheque v2 — Design Spec

**Date**: 2026-02-27
**Status**: Validated

---

## Understanding Summary

- **What**: Blog CMS pour articles + Mediatheque v2 (traitement images + dossiers)
- **Why**: SEO (referencement Google) + communication client (nouveautes, promotions)
- **Who**: Admin (proprietaires restaurant) cree/gere, visiteurs lisent
- **Scope**: Blog global a la marque (brandId), pas par store, avec ciblage local optionnel
- **Non-goals**: Pas de commentaires, pas de page auteur dediee, pas de newsletter/RSS, pas de blocs composables

---

## Assumptions

- Les articles heritent du systeme de traduction existant (GPT-3.5-turbo)
- Le rich text editor Tiptap existant est reutilise et etendu
- Les images des articles utilisent la mediatheque CMS existante (`cmsMedia`)
- Pagination cote serveur (Convex cursor-based)
- Le sitemap existant sera etendu pour inclure les articles
- `brandId` est une string identifiant unique la marque/tenant

---

## Decision Log

### D1: Architecture blog
- **Decision**: Tables dediees (Option A), infra partagee (cmsMedia, traductions, Tiptap, S3)
- **Alternative**: Extension du modele CMS registry (Option B)
- **Raison**: Le blog est du contenu dynamique infini, le registry CMS est concu pour des pages statiques finies. Tables dediees = indexes optimises, modele de donnees adapte

### D2: Structure article
- **Decision**: Hybride — squelette fixe (titre, cover, extrait, auteur) + zone contenu riche libre
- **Alternatives**: Simple (titre + contenu), Modulaire (blocs composables)
- **Raison**: Equilibre simplicite/flexibilite, pas de complexite inutile des blocs

### D3: Categorisation
- **Decision**: 1 categorie obligatoire + 0..N tags optionnels
- **Alternatives**: Categories seules, tags seuls
- **Raison**: Navigation propre (categories) + filtrage flexible (tags)

### D4: Tags — table de jointure
- **Decision**: `blogArticleTags` avec `publishedAt` denormalise
- **Alternative**: Array `tagIds` dans l'article
- **Raison**: Pagination/tri efficace pour `/blog/tag/[slug]`, pas de N+1 ni tri memoire

### D5: Workflow publication
- **Decision**: Draft -> Scheduled -> Published -> Archived
- **Raison**: Workflow complet, archived = accessible par URL, retire des listes

### D6: Draft/Published
- **Decision**: 2 payloads dans le meme record (`draftContent` / `publishedContent`) + `hasUnpublishedChanges`
- **Alternative**: Record unique avec status seul
- **Raison**: Permet d'editer un article publie sans casser le live

### D7: Champs versionnes
- **Decision**: slug, categoryId, authorId tous versionnes (draft/published)
- **Raison**: Un changement en brouillon ne doit pas impacter le live

### D8: SEO
- **Decision**: Semi-auto admin (slug auto, suggestions IA meta) + auto systeme (sitemap, JSON-LD Article, canonical)
- **Alternative**: Full manuel, full auto
- **Raison**: Equilibre controle admin / automatisation technique

### D9: Auteur
- **Decision**: Simple — nom + photo, lie au user admin, versionne
- **Alternative**: Profil complet avec page dediee
- **Raison**: YAGNI, pas de page auteur necessaire

### D10: Scope articles
- **Decision**: `brandId` global + `scope` (global/store_specific/multi_store) + `storeIds` optionnel
- **Alternative**: storeId par article
- **Raison**: Blog global a la marque, ciblage local optionnel

### D11: Pipeline images
- **Decision**: Hybride — compression client (resize 2048px, format conserve) + variantes serveur (sharp, WebP)
- **Alternatives**: Client only, serveur only, CDN externe
- **Raison**: Bon compromis performance/qualite, pas de double lossy

### D12: Variantes images
- **Decision**: Champ `variants: { thumb, card, og? }` au lieu de champs individuels
- **Alternative**: `thumbnailUrl`, `optimizedUrl`, etc.
- **Raison**: Scalable, extensible sans migration schema

### D13: Dossiers mediatheque
- **Decision**: Dossiers virtuels (champ `folder` string, pas de table dediee)
- **Alternative**: Table `mediaFolders`
- **Raison**: Pas de hierarchie, pas de metadonnees, simplicite maximale

### D14: Publish pattern
- **Decision**: `publishArticleCore` (sans auth) + wrapper admin + wrapper cron internalMutation
- **Raison**: Separation propre, le cron n'appelle pas une mutation admin

---

## Final Design

### Schema Convex

#### `blogCategories`

```typescript
blogCategories: defineTable({
  brandId: v.string(),
  name: v.string(),
  slug: v.string(),                    // unique par brand, slugified
  description: v.optional(v.string()),
  imageId: v.optional(v.id("cmsMedia")),
  sortOrder: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_brandId", ["brandId"])
  .index("by_brandId_slug", ["brandId", "slug"])
```

#### `blogTags`

```typescript
blogTags: defineTable({
  brandId: v.string(),
  name: v.string(),
  slug: v.string(),                    // unique par brand, slugified
  createdAt: v.number(),
})
  .index("by_brandId", ["brandId"])
  .index("by_brandId_slug", ["brandId", "slug"])
```

#### `blogArticles`

```typescript
// Shared content shape for draft/published
const blogContentFields = {
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(),                 // max ~300 chars
  coverImageId: v.id("cmsMedia"),
  coverImageAlt: v.optional(v.string()),
  content: v.string(),                 // HTML Tiptap
  metaTitle: v.optional(v.string()),   // fallback sur title
  metaDescription: v.optional(v.string()), // fallback sur excerpt
  ogImageId: v.optional(v.id("cmsMedia")), // fallback sur coverImage
  updatedAt: v.number(),
}

blogArticles: defineTable({
  brandId: v.string(),

  // Scope
  scope: v.union(
    v.literal("global"),
    v.literal("store_specific"),
    v.literal("multi_store")
  ),
  storeIds: v.optional(v.array(v.id("stores"))),

  // Workflow
  status: v.union(
    v.literal("draft"),
    v.literal("scheduled"),
    v.literal("published"),
    v.literal("archived")
  ),
  hasUnpublishedChanges: v.boolean(),
  scheduledPublishAt: v.optional(v.number()), // non-null SEULEMENT si status=scheduled
  publishedAt: v.optional(v.number()),
  archivedAt: v.optional(v.number()),

  // Slugs denormalises (top-level pour indexes)
  draftSlug: v.string(),
  publishedSlug: v.optional(v.string()),       // null si jamais publie

  // Categorie versionnee
  draftCategoryId: v.id("blogCategories"),
  publishedCategoryId: v.optional(v.id("blogCategories")), // null si jamais publie

  // Auteur versionne
  draftAuthorId: v.id("users"),
  publishedAuthorId: v.optional(v.id("users")), // null si jamais publie

  // Payloads
  draftContent: v.object(blogContentFields),
  publishedContent: v.optional(v.object(blogContentFields)), // null si jamais publie

  // Traduction (draft-only, clear au publish)
  scheduledTranslationJobId: v.optional(v.id("_scheduled_functions")),

  createdAt: v.number(),
  updatedAt: v.number(),
  updatedBy: v.string(),
})
  .index("by_brandId", ["brandId"])
  .index("by_brandId_status", ["brandId", "status"])
  .index("by_brandId_publishedSlug", ["brandId", "publishedSlug"])
  .index("by_brandId_publishedCategoryId_status_publishedAt", [
    "brandId", "publishedCategoryId", "status", "publishedAt"
  ])
  .index("by_brandId_status_publishedAt", ["brandId", "status", "publishedAt"])
  .index("by_status_scheduledPublishAt", ["status", "scheduledPublishAt"])
```

#### `blogArticleTags`

```typescript
blogArticleTags: defineTable({
  brandId: v.string(),
  articleId: v.id("blogArticles"),
  tagId: v.id("blogTags"),
  isDraft: v.boolean(),
  publishedAt: v.optional(v.number()), // rempli seulement si isDraft=false
})
  .index("by_articleId", ["articleId"])
  .index("by_articleId_isDraft", ["articleId", "isDraft"])
  .index("by_tagId", ["tagId"])
  .index("by_brandId_tagId_isDraft_publishedAt", [
    "brandId", "tagId", "isDraft", "publishedAt"
  ])
```

#### `cmsMedia` — Modifications

```typescript
// Champs ajoutes/modifies:
// - url → sourceUrl
// - thumbnailUrl → SUPPRIME
// + variants: { thumb?, card?, og? }
// + errorCode?, errorMessage?

// Nouveau champ variants
variants: v.optional(v.object({
  thumb: v.optional(v.object({
    url: v.string(),
    width: v.number(),
    height: v.number(),
  })),
  card: v.optional(v.object({
    url: v.string(),
    width: v.number(),
    height: v.number(),
  })),
  og: v.optional(v.object({
    url: v.string(),
    width: v.number(),
    height: v.number(),
  })),
})),
errorCode: v.optional(v.string()),
errorMessage: v.optional(v.string()),

// Index mis a jour
.index("by_brandId_folder", ["brandId", "folder"])
```

---

### Convex Functions

#### Queries publiques (storefront, pas d'auth)

| Fonction | Description | Index |
|---|---|---|
| `listPublishedArticles` | Liste paginee, status=published, tri publishedAt desc | `by_brandId_status_publishedAt` |
| `listByCategory` | Articles publies d'une categorie, pagines | `by_brandId_publishedCategoryId_status_publishedAt` |
| `listByTag` | Lookup jointure (isDraft=false), pagine par publishedAt | `by_brandId_tagId_isDraft_publishedAt` |
| `getArticleBySlug` | Article publie par slug + media resolus + traductions | `by_brandId_publishedSlug` |
| `listCategories` | Toutes les categories de la brand, triees | `by_brandId` |
| `listTags` | Tous les tags de la brand | `by_brandId` |

#### Queries admin (auth required)

| Fonction | Description |
|---|---|
| `listAdminArticles` | Paginee + filtre `status?` optionnel |
| `getAdminArticle` | Draft + published cote-a-cote, media resolus, traductions |
| `listAdminCategories` | Categories avec count articles |
| `listAdminTags` | Tags avec count articles |

#### Mutations admin (auth required)

| Fonction | Logique cle |
|---|---|
| `createArticle` | Init draftContent, `status=draft`, slug auto depuis title, `hasUnpublishedChanges=false` |
| `saveDraft` | Update draft*, recalcul `hasUnpublishedChanges`, verif unicite slug (draft+published), schedule traduction |
| `publishArticle` | Auth → `publishArticleCore` |
| `scheduleArticle` | Validation draft complet + date future → `status=scheduled`, set `scheduledPublishAt` |
| `unscheduleArticle` | `status=draft`, `scheduledPublishAt=null` |
| `archiveArticle` | `status=archived`, `archivedAt=now()`, `scheduledPublishAt=null` |
| `unarchiveArticle` | `publishedContent !== null` → published, sinon → draft |
| `deleteArticle` | Suppression definitive + cleanup tags + traductions + media usageCount |
| `createCategory` | Slug auto, validation unicite |
| `updateCategory` | Update name/slug/description/image |
| `deleteCategory` | Bloque si articles lies |
| `createTag` | Slug auto, validation unicite |
| `deleteTag` | Cleanup `blogArticleTags` |
| `updateArticleTags` | Sync jointure (isDraft=true) — diff add/remove |

#### Internal functions

| Fonction | Description |
|---|---|
| `publishArticleCore` | Logique pure sans auth: copie draft→published (content, slug, category, author), sync tags (isDraft=false, publishedAt=derniere publication), sync traductions, `hasUnpublishedChanges=false`, `scheduledTranslationJobId=null`, `scheduledPublishAt=null` |
| `_publishScheduled` | internalMutation → appelle publishArticleCore |
| `executeScheduledPublish` | Cron action → query `by_status_scheduledPublishAt` <= now() → `_publishScheduled` par article |

#### Invariantes mutations

- `scheduledPublishAt` non-null **uniquement** si `status === "scheduled"`
- `hasUnpublishedChanges` recalcule a chaque save/publish
- `scheduledTranslationJobId = null` au publish
- Media `usageCount` incremente/decremente sur save/publish/delete
- Unicite slug verifiee au `saveDraft` ET au `publishArticleCore`
- `publishedAt` dans `blogArticleTags` = date de derniere publication live
- `scheduleArticle` valide: draftContent complet + draftCategoryId non-null + date future stricte
- Traductions: `entityType: "blogArticleDraft"` / `"blogArticlePublished"` pour separer draft/published

---

### Pipeline Images (Mediatheque v2)

#### S3 Keys
```
cms/{mediaId}/source.{ext}     ← format conserve du client
cms/{mediaId}/thumb.webp        ← 400x400 carre, center crop
cms/{mediaId}/card.webp         ← 800x450 landscape
cms/{mediaId}/og.webp           ← 1200x630 (V2)
```

#### Flow
1. `createMedia(status="processing")` → reserve ID + cles S3
2. Client: compress (resize 2048px, compression legere, format source conserve)
3. `getPresignedUrl(s3Key)` → presigned URL
4. Client: PUT source vers S3
5. `confirmUpload(mediaId)` → HEAD request S3 pour verifier existence, sinon → `setMediaFailed`
6. `processImage` (Convex action Node.js, sharp):
   - Fetch source depuis S3
   - Extraire width/height
   - Generer thumb 400x400 (center crop, WebP)
   - Generer card 800x450 (center crop, WebP)
   - PUT variantes vers S3
7. `setMediaReady(mediaId, { width, height, sourceUrl, variants })`

#### Regles par type

| Type | Client | Serveur |
|---|---|---|
| Image (jpeg/png/webp) | Resize 2048px + compress, format conserve | sharp: dimensions + thumb + card en WebP |
| SVG | Sanitize seulement | Aucun, status=ready immediat |
| Video | Aucune | Aucun V1, status=ready immediat |
| Fichier | Aucune | Aucun, status=ready immediat |

#### Invariantes pipeline
- `confirmUpload` verifie l'existence S3 (HEAD) avant processing
- `setMediaFailed` inclut `errorCode` + `errorMessage`
- `processImage` est idempotent (memes cles, ecrasement, retry safe)

---

### Dossiers Mediatheque

#### Modele: dossiers virtuels (champ `folder` string)
- `null` = racine (jamais `""`)
- Normalisation: trim + slugify/lowercase (`"Blog Covers"` → `"blog-covers"`)
- Un dossier "nait" quand un media recoit cette valeur, "meurt" quand plus aucun media

#### Queries
- `listFolders`: query medias par brandId → deduplique folder → retourne `{ name, count }[]`
- `listMedia`: ajout param `folder?` pour filtrer

#### Mutations
- `moveToFolder`: update `folder` sur un ou plusieurs medias (bulk)
- `renameFolder`: update `folder` sur tous les medias du dossier (bulk rename)

#### UI
- Sidebar gauche: liste dossiers + "Tous" + bouton "Nouveau dossier"
- Selection multiple → "Deplacer vers..."
- Nouveau dossier = nom cible, dossier vide affiche cote client mais pas persiste backend

---

### Pages Storefront

#### Routes
```
app/blog/page.tsx                    → liste paginee
app/blog/[slug]/page.tsx             → article complet
app/blog/category/[slug]/page.tsx    → articles par categorie
app/blog/tag/[slug]/page.tsx         → articles par tag
```

#### SEO automatique

| Route | meta title | JSON-LD | sitemap |
|---|---|---|---|
| `/blog` | "Blog - {restaurant}" | CollectionPage | oui |
| `/blog/[slug]` | `metaTitle \|\| title` | Article (author, publishedAt, image) | oui (lastmod=updatedAt) |
| `/blog/category/[slug]` | "Categorie: {name}" | CollectionPage | oui |
| `/blog/tag/[slug]` | "Tag: {name}" | CollectionPage | oui |

#### Composants storefront
- `BlogArticleCard` — card dans les listes (cover variant `card`, title, excerpt, date, categorie)
- `BlogArticlePage` — page article complete (cover, titre, auteur, date, contenu Tiptap rendu, tags)
- `BlogPagination` — navigation paginee (cursor-based)
- `BlogCategoryFilter` — liste des categories (header ou sidebar)

---

## Implementation Priority

### Phase 1: Mediatheque v2 — Traitement images
- Pipeline processing (sharp, variantes)
- Modification schema cmsMedia (sourceUrl, variants, errorCode/errorMessage)
- Flow upload mis a jour (createMedia→upload→confirmUpload→processImage→setMediaReady)

### Phase 2: Mediatheque v2 — Dossiers
- UI dossiers (sidebar, deplacer, renommer)
- Normalisation folder (slugify)

### Phase 3: Blog — Schema & Functions
- Tables blogCategories, blogTags, blogArticles, blogArticleTags
- Toutes les mutations admin (CRUD categories, tags, articles)
- publishArticleCore + wrappers
- Cron publication programmee
- Auto-traduction

### Phase 4: Blog — Admin UI
- Page liste articles (paginee, filtre status)
- Editeur article (squelette fixe + Tiptap etendu)
- Gestion categories et tags
- Preview

### Phase 5: Blog — Storefront
- Routes /blog, /blog/[slug], /blog/category/[slug], /blog/tag/[slug]
- Composants (ArticleCard, ArticlePage, Pagination, CategoryFilter)
- SEO (meta, JSON-LD, sitemap, canonical)
