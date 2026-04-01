# @be-in-digital/cms — Documentation Complète

> Package CMS générique pour BeInDigital Engine.
> Ce package ne contient **aucune page prédéfinie**. Chaque application définit ses propres pages CMS.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture](#2-architecture)
3. [Installation](#3-installation)
4. [Guide pas-à-pas : Ajouter le CMS à une nouvelle application](#4-guide-pas-à-pas--ajouter-le-cms-à-une-nouvelle-application)
5. [Référence des types](#5-référence-des-types)
6. [API du Registry](#6-api-du-registry)
7. [Blocs réutilisables](#7-blocs-réutilisables)
8. [Validation](#8-validation)
9. [Gestion des médias](#9-gestion-des-médias)
10. [Sanitisation SVG](#10-sanitisation-svg)
11. [Initialisation (Frontend + Backend)](#11-initialisation-frontend--backend)
12. [Exemples concrets](#12-exemples-concrets)
13. [Erreurs fréquentes et solutions](#13-erreurs-fréquentes-et-solutions)
14. [Diagrammes](#14-diagrammes)
15. [Glossaire](#15-glossaire)

---

## 1. Vue d'ensemble

### Qu'est-ce que ce package ?

`@be-in-digital/cms` est un **framework de définition de contenu** pour le CMS BeInDigital. Il fournit :

- Un **registre configurable** de pages et de groupes
- Des **types TypeScript** stricts pour définir la structure du contenu
- Une **validation** des données saisies (côté serveur, avant persistance)
- La **gestion des médias** (limites de taille, types MIME)
- La **sanitisation SVG** (sécurité)

### Ce que ce package NE fait PAS

- Il ne contient **aucune définition de page**. C'est l'application qui les définit.
- Il ne gère **aucune UI** (pas de composants React).
- Il ne gère **aucune persistance** (pas de base de données). C'est le package `convex-functions` qui s'en charge.
- Il ne gère **aucune authentification**.

### Principe fondamental

```
┌─────────────────────────────────┐
│   packages/cms                  │  ← Types, API, validation (générique)
│   Ne contient AUCUNE page       │
└────────────┬────────────────────┘
             │ importé par
             ▼
┌─────────────────────────────────┐
│   apps/mon-app/cms/             │  ← Définitions de pages (spécifique à l'app)
│   groups.ts + pages/*.ts        │
└────────────┬────────────────────┘
             │ setCmsRegistry()
             ▼
┌─────────────────────────────────┐
│   Registre en mémoire           │  ← Utilisé par admin UI, Convex, storefront
│   getPageDefinition(), etc.     │
└─────────────────────────────────┘
```

---

## 2. Architecture

### Structure du package

```
packages/cms/src/
├── index.ts                        # Point d'entrée — tous les exports
├── registry/
│   ├── types.ts                    # Types : PageDefinition, BlockDefinition, etc.
│   ├── index.ts                    # API : setCmsRegistry, getPageDefinition, etc.
│   ├── validation.ts               # Validation d'intégrité à l'initialisation
│   └── blocks/
│       └── seoBlock.ts             # Bloc SEO réutilisable
├── validation/
│   └── validateBlockValues.ts      # Validation des valeurs saisies
├── media/
│   └── types.ts                    # Limites médias, validation upload
└── sanitize/
    └── svgSanitizer.ts             # Nettoyage SVG (sécurité)
```

### Structure côté application (exemple : restaurant-theme)

```
apps/restaurant-theme/
├── cms/                             # Définitions CMS propres à l'app
│   ├── groups.ts                    # Groupes de pages (6 groupes)
│   ├── index.ts                     # Barrel → exporte appCmsConfig
│   └── pages/                       # 1 fichier par page (20 fichiers)
│       ├── homepage.ts
│       ├── sign-in.ts
│       ├── menu.ts
│       └── ...
├── lib/cms/
│   └── init.ts                      # Fichier d'initialisation (import side-effect)
├── app/
│   ├── (admin)/layout.tsx           # import "@/lib/cms/init"
│   ├── (storefront)/layout.tsx      # import "@/lib/cms/init"
│   └── preview/layout.tsx           # import "@/lib/cms/init"
└── convex/
    ├── cms.ts                       # import + setCmsRegistry() en haut du fichier
    └── cmsAutoTranslate.ts          # idem
```

---

## 3. Installation

Le package est déjà disponible dans le monorepo. Pour l'utiliser dans une app :

```json
// package.json de votre app
{
  "dependencies": {
    "@be-in-digital/cms": "workspace:*"
  }
}
```

Puis :

```bash
pnpm install
```

---

## 4. Guide pas-à-pas : Ajouter le CMS à une nouvelle application

Ce guide part de zéro. Suivez chaque étape dans l'ordre.

### Étape 1 : Créer le dossier `cms/` dans votre app

```bash
mkdir -p apps/mon-app/cms/pages
```

### Étape 2 : Définir les groupes

Les groupes organisent vos pages dans le dashboard admin. Chaque groupe a :
- `id` — identifiant unique (jamais de doublon)
- `label` — nom affiché dans l'interface
- `order` — ordre d'affichage (jamais de doublon, plus petit = en premier)

Créez `apps/mon-app/cms/groups.ts` :

```typescript
import type { CmsGroupDefinition } from "@be-in-digital/cms"

export const cmsGroups: CmsGroupDefinition[] = [
  { id: "main",    label: "Pages principales", order: 1 },
  { id: "auth",    label: "Authentification",   order: 2 },
  { id: "account", label: "Espace client",      order: 3 },
]
```

**Règles :**
- `id` doit être unique (sinon erreur à l'initialisation)
- `order` doit être unique (sinon erreur à l'initialisation)
- Chaque groupe doit avoir au moins une page assignée (sinon erreur à l'initialisation)
- Ne pas utiliser de strings libres pour les noms — toujours référencer `group.id`

### Étape 3 : Définir une page

Créez un fichier par page dans `apps/mon-app/cms/pages/`. Exemple pour une page d'accueil :

```typescript
// apps/mon-app/cms/pages/homepage.ts
import type { PageDefinition } from "@be-in-digital/cms"
import { seoBlock } from "@be-in-digital/cms"

export const homepagePage: PageDefinition = {
  slug: "homepage",           // Identifiant unique, correspond à la route
  label: "Page d'accueil",    // Nom affiché dans l'admin
  description: "Page d'accueil principale du site",  // Optionnel
  groupId: "main",            // Référence un groupe défini dans groups.ts

  blocks: [
    // Le bloc SEO est fourni par le package (réutilisable)
    seoBlock,

    // Bloc personnalisé
    {
      key: "hero",                     // Clé unique dans la page
      label: "Section principale",     // Nom affiché dans l'admin
      description: "Bannière en haut de la page",  // Optionnel
      fields: {
        title: {
          type: "text",                // Type du champ (voir section Types)
          label: "Titre principal",    // Nom affiché dans l'admin
          required: true,              // Champ obligatoire ?
          maxLength: 100,              // Longueur max (text/richtext uniquement)
          hasCodeFallback: true,       // Le code a une valeur par défaut ?
        },
        subtitle: {
          type: "richtext",
          label: "Sous-titre",
          maxLength: 500,
          hasCodeFallback: true,
        },
        backgroundImage: {
          type: "image",
          label: "Image de fond",
          translatable: false,         // Les images ne sont pas traduisibles
          hasCodeFallback: true,
        },
      },
    },
  ],
}
```

### Étape 4 : Créer le barrel file (index.ts)

Créez `apps/mon-app/cms/index.ts` pour tout rassembler :

```typescript
import type { PageDefinition } from "@be-in-digital/cms"
import { cmsGroups } from "./groups"
import { homepagePage } from "./pages/homepage"
import { signInPage } from "./pages/sign-in"
// ... importer toutes vos pages

const pages: Record<string, PageDefinition> = {
  homepage: homepagePage,
  "sign-in": signInPage,
  // ... toutes vos pages
}

export const appCmsConfig = {
  pages,
  groups: cmsGroups,
}
```

**Important :** La clé dans `pages` (`"homepage"`, `"sign-in"`) doit correspondre exactement au `slug` de la page.

### Étape 5 : Créer le fichier d'initialisation

Créez `apps/mon-app/lib/cms/init.ts` :

```typescript
import { setCmsRegistry } from "@be-in-digital/cms"
import { appCmsConfig } from "@/cms"

setCmsRegistry(appCmsConfig)
```

Ce fichier sera importé comme side-effect (juste `import "@/lib/cms/init"`, sans rien extraire).

### Étape 6 : Initialiser dans les layouts Next.js

Ajoutez l'import en haut de **chaque layout racine** qui utilise le CMS :

```typescript
// app/(admin)/layout.tsx
import "@/lib/cms/init"    // ← PREMIÈRE LIGNE après "use client"

// ... reste du layout
```

```typescript
// app/(storefront)/layout.tsx
import "@/lib/cms/init"    // ← PREMIÈRE LIGNE

// ... reste du layout
```

```typescript
// app/preview/layout.tsx (si vous avez un mode prévisualisation)
import "@/lib/cms/init"

// ... reste du layout
```

**Pourquoi chaque layout ?** Next.js peut charger n'importe quel layout indépendamment. Si un utilisateur arrive directement sur `/preview/homepage`, le registre doit être initialisé.

### Étape 7 : Initialiser dans les fichiers Convex

Chaque fichier Convex qui utilise le CMS (`getPageDefinition`, `getBlockDefinition`, etc.) doit initialiser le registre **en haut du fichier** :

```typescript
// convex/cms.ts
import { setCmsRegistry } from "@be-in-digital/cms"
import { appCmsConfig } from "../cms"   // ← Import RELATIF (pas @/cms)
setCmsRegistry(appCmsConfig)

// ... le reste du code Convex
```

**Pourquoi un import relatif ?** Le tsconfig de Convex et celui de Next.js résolvent `@/` différemment. L'import relatif `../cms` est plus sûr et fonctionne partout.

**Pourquoi dans chaque fichier Convex ?** Convex charge les modules indépendamment. Si `cms.ts` et `cmsAutoTranslate.ts` utilisent tous les deux le registre, ils doivent chacun l'initialiser.

### Étape 8 : Vérifier

```bash
# Build du package CMS
pnpm turbo build --filter=@be-in-digital/cms

# Lancer les tests
pnpm --filter @be-in-digital/cms test

# Déployer Convex
cd apps/mon-app && pnpx convex dev --once

# Build Next.js
pnpm turbo build --filter=@be-in-digital/mon-app
```

Si `setCmsRegistry()` détecte une erreur dans votre configuration, il affichera un message explicite :

```
Error: [CMS Registry] Invalid config:
  - Duplicate group id: "main"
  - Page "settings" references unknown groupId "admin"
  - Group "empty" (label: "Empty Group") has no pages assigned
```

---

## 5. Référence des types

### FieldType

Les types de champs supportés :

| Type       | Description                          | Données stockées            |
|------------|--------------------------------------|-----------------------------|
| `text`     | Texte simple (une ligne)             | `textValue: string`         |
| `richtext` | Texte riche (HTML)                   | `textValue: string`         |
| `image`    | Image (JPEG, PNG, WebP, SVG)         | `mediaId: string`           |
| `video`    | Vidéo (MP4, WebM) ou embed YouTube   | `mediaId` ou `embedUrl`     |
| `file`     | Fichier (PDF, DOCX, XLSX, PPTX)      | `mediaId: string`           |
| `select`   | Liste déroulante                     | `textValue: string`         |

### FieldDefinition

Définit un champ éditable dans un bloc.

```typescript
interface FieldDefinition {
  type: FieldType                    // OBLIGATOIRE — type du champ
  label: string                      // OBLIGATOIRE — nom affiché dans l'admin
  description?: string               // Texte d'aide affiché sous le champ
  required?: boolean                 // Le champ doit-il avoir une valeur ? (défaut: false)
  maxLength?: number                 // Longueur max (text/richtext uniquement)
  placeholder?: string               // Placeholder dans l'input
  translatable?: boolean             // Peut être traduit ? (défaut: true pour text, false pour media)
  hasCodeFallback: boolean           // OBLIGATOIRE — le code a-t-il une valeur par défaut ?
  options?: SelectOption[]           // OBLIGATOIRE pour type "select" uniquement
  group?: string                     // Grouper visuellement des champs ensemble dans l'admin
}
```

**`hasCodeFallback` expliqué :**

- `true` = le composant storefront affiche une valeur par défaut si rien n'est saisi dans le CMS. L'admin peut "réinitialiser" le champ pour revenir au code.
- `false` = pas de fallback. Si le champ est vide, rien ne s'affiche. Si `required: true` ET `hasCodeFallback: false`, le champ DOIT avoir une valeur pour publier.

### BlockDefinition

Un bloc est une section éditable dans une page (ex: "Hero", "Formulaire", "SEO").

```typescript
interface BlockDefinition {
  key: string                        // OBLIGATOIRE — clé unique dans la page
  label: string                      // OBLIGATOIRE — nom affiché dans l'admin
  description?: string               // Texte d'aide
  fields: Record<string, FieldDefinition>  // OBLIGATOIRE — champs du bloc
}
```

**Règle :** les `key` doivent être uniques au sein d'une même page.

### PageDefinition

Une page CMS complète.

```typescript
interface PageDefinition {
  slug: string                       // OBLIGATOIRE — identifiant interne unique (ex: "sign-in", "homepage")
  label: string                      // OBLIGATOIRE — nom affiché dans l'admin
  description?: string               // Description dans l'admin
  groupId?: string                   // ID du groupe (référence CmsGroupDefinition.id)
  blocks: BlockDefinition[]          // OBLIGATOIRE — au moins 1 bloc
}
```

**Slug vs Route :** Le `slug` est un identifiant interne CMS, pas un chemin URL. Il ne correspond pas toujours à la route Next.js. Exemples :

| Slug CMS       | Route Next.js     |
|----------------|-------------------|
| `homepage`     | `/`               |
| `sign-in`      | `/sign-in`        |
| `product-detail` | `/product/[productId]` |
| `storefront-layout` | *(layout, pas une route)* |

C'est l'application qui fait le lien entre le slug CMS et la route, via les requêtes Convex `getPageBlocks({ pageSlug: "homepage" })`.

### CmsGroupDefinition

Un groupe organise les pages dans le dashboard admin.

```typescript
interface CmsGroupDefinition {
  id: string                         // OBLIGATOIRE — identifiant unique
  label: string                      // OBLIGATOIRE — nom affiché
  order: number                      // OBLIGATOIRE — position (plus petit = en premier)
}
```

### CmsFieldValue

La valeur stockée en base pour un champ. Utilisé côté backend (Convex).

```typescript
interface CmsFieldValue {
  type: FieldType                    // Type du champ
  textValue?: string                 // Valeur texte (text, richtext, select)
  mediaId?: string                   // Référence vers cmsMedia (image, video, file)
  altText?: string                   // Texte alternatif (pour images)
  embedUrl?: string                  // URL d'embed (pour vidéos YouTube/Vimeo)
  embedProvider?: "youtube" | "vimeo"
  isCleared?: boolean                // Reset explicite vers le fallback code
}
```

### SelectOption

Option pour un champ de type `select`.

```typescript
interface SelectOption {
  value: string                      // Valeur stockée
  label: string                      // Texte affiché dans le dropdown
}
```

---

## 6. API du Registry

### setCmsRegistry(config)

Initialise le registre CMS. **Doit être appelé avant tout accès au registre.**

```typescript
import { setCmsRegistry } from "@be-in-digital/cms"

setCmsRegistry({
  pages: { ... },           // Record<string, PageDefinition>
  groups: [ ... ],          // CmsGroupDefinition[]
})
```

- Valide la configuration (voir section Validation)
- Trie les groupes par `order`
- Lève une erreur avec **toutes** les violations listées si la config est invalide
- Peut être appelé plusieurs fois (remplace la config précédente)

### getCmsRegistry()

Retourne le registre complet.

```typescript
const { pages, groups } = getCmsRegistry()
// pages: Record<string, PageDefinition>
// groups: CmsGroupDefinition[] (triés par order)
```

### getCmsGroups()

Retourne les groupes triés par `order`.

```typescript
const groups = getCmsGroups()
// [{ id: "main", label: "Principal", order: 1 }, ...]
```

### getPageDefinition(slug)

Retourne la définition d'une page par son slug.

```typescript
const page = getPageDefinition("homepage")
// PageDefinition | undefined
```

### getAllPageSlugs()

Retourne tous les slugs enregistrés.

```typescript
const slugs = getAllPageSlugs()
// ["homepage", "sign-in", "menu", ...]
```

### getBlockDefinition(pageSlug, blockKey)

Retourne un bloc spécifique d'une page.

```typescript
const block = getBlockDefinition("homepage", "hero")
// BlockDefinition | undefined
```

### getFieldDefinition(pageSlug, blockKey, fieldKey)

Retourne un champ spécifique d'un bloc.

```typescript
const field = getFieldDefinition("homepage", "hero", "title")
// FieldDefinition | undefined
```

---

## 7. Blocs réutilisables

### seoBlock

Bloc SEO prêt à l'emploi, à ajouter aux pages indexables.

```typescript
import { seoBlock } from "@be-in-digital/cms"

export const homepagePage: PageDefinition = {
  slug: "homepage",
  label: "Page d'accueil",
  groupId: "main",
  blocks: [
    seoBlock,        // ← Ajouter en premier bloc
    {
      key: "hero",
      // ...
    },
  ],
}
```

Le bloc `seoBlock` contient 4 champs :

| Champ            | Type     | Description                                  |
|------------------|----------|----------------------------------------------|
| `metaTitle`      | `text`   | Titre dans les résultats Google (max 70 car.) |
| `metaDescription`| `text`   | Description Google (max 160 car.)             |
| `ogImage`        | `image`  | Image partage réseaux sociaux                 |
| `robots`         | `select` | Directives robots (index/noindex, follow/nofollow) |

**Quand l'utiliser :** sur toutes les pages qui doivent apparaître dans Google (homepage, menu, catégories, fiches produit, etc.). Ne pas l'ajouter aux pages d'authentification ou au panier.

---

## 8. Validation

### Validation à l'initialisation (setCmsRegistry)

`setCmsRegistry()` exécute 4 vérifications automatiquement :

| #  | Vérification                          | Exemple d'erreur                                              |
|----|---------------------------------------|---------------------------------------------------------------|
| 1  | `group.id` unique                     | `Duplicate group id: "main"`                                  |
| 2  | `group.order` unique                  | `Duplicate group order: 1`                                    |
| 3  | Chaque `page.groupId` existe          | `Page "settings" references unknown groupId "admin"`          |
| 4  | Pas de groupe orphelin                | `Group "empty" (label: "Vide") has no pages assigned`         |

Si plusieurs violations existent, **toutes** sont listées dans le même message d'erreur.

### Validation des valeurs (validateBlockValues)

Utilisé côté Convex, avant de persister un brouillon. Valide les données saisies par l'admin contre la définition du bloc.

```typescript
import { validateBlockValues, getBlockDefinition } from "@be-in-digital/cms"

const blockDef = getBlockDefinition("homepage", "hero")
const result = validateBlockValues(values, blockDef)

if (!result.valid) {
  // result.errors contient les détails
  console.error(result.errors)
}
```

**Vérifications effectuées :**

| Code              | Description                                                    |
|-------------------|----------------------------------------------------------------|
| `unknown_field`   | Le champ n'existe pas dans la définition du bloc               |
| `type_mismatch`   | Le type de la valeur ne correspond pas (ex: texte dans un champ image) |
| `required`        | Champ requis sans fallback code et sans valeur                 |
| `max_length`      | Texte dépassant la longueur maximale (HTML strippé pour richtext) |
| `invalid_option`  | Valeur select non présente dans les options autorisées         |

**Note :** les champs avec `isCleared: true` ne sont pas validés (reset explicite vers le fallback).

---

## 9. Gestion des médias

### Types de médias supportés

| Type    | MIME acceptés                          | Taille max  |
|---------|----------------------------------------|-------------|
| `image` | JPEG, PNG, WebP, SVG                   | 10 MB       |
| `video` | MP4, WebM                              | 100 MB      |
| `file`  | PDF, DOCX, XLSX, PPTX                  | 25 MB       |

### validateMediaUpload(filename, mimeType, size)

Valide un fichier avant upload.

```typescript
import { validateMediaUpload } from "@be-in-digital/cms"

const result = validateMediaUpload("photo.jpg", "image/jpeg", 2_000_000)

if (result.valid) {
  console.log(result.kind)  // "image"
} else {
  console.error(result.error)
  // { code: "file_too_large", message: "Fichier trop volumineux..." }
}
```

**Codes d'erreur :**

| Code               | Description                                        |
|--------------------|----------------------------------------------------|
| `invalid_filename` | Nom de fichier vide                                |
| `invalid_mime`     | Type MIME non autorisé                             |
| `file_too_large`   | Fichier dépassant la taille maximale pour ce type  |

### Fonctions utilitaires

```typescript
import { getMediaKind, getExtensionFromMimeType, CMS_MEDIA_LIMITS } from "@be-in-digital/cms"

getMediaKind("image/jpeg")           // "image"
getMediaKind("video/mp4")            // "video"
getMediaKind("application/pdf")      // "file"
getMediaKind("text/html")            // null (non supporté)

getExtensionFromMimeType("image/png")     // "png"
getExtensionFromMimeType("video/mp4")     // "mp4"
getExtensionFromMimeType("unknown/type")  // "bin" (fallback)

CMS_MEDIA_LIMITS.image.maxSize       // 10485760 (10 MB en bytes)
CMS_MEDIA_LIMITS.image.mimeTypes     // ["image/jpeg", "image/jpg", ...]
```

---

## 10. Sanitisation SVG

Les SVG uploadés sont nettoyés automatiquement pour supprimer les éléments dangereux.

```typescript
import { sanitizeSvg } from "@be-in-digital/cms"

const result = sanitizeSvg(svgContent)
// result.sanitized    → SVG nettoyé
// result.removedElements → ["<script>", "onclick", ...]
```

**Éléments supprimés :**
- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<foreignObject>`, etc.
- Attributs `onclick`, `onload`, `onerror`, etc.
- URIs `javascript:` dans les attributs `href` / `xlink:href`

**Limite :** 1 MB maximum par SVG. Au-delà, une erreur est levée.

---

## 11. Initialisation (Frontend + Backend)

### Pourquoi initialiser ?

Le registre CMS est un **singleton en mémoire**. Il doit être rempli avant que le code puisse appeler `getPageDefinition()`, `getBlockDefinition()`, etc.

### Où initialiser ?

| Contexte              | Fichier                           | Méthode                                  |
|-----------------------|-----------------------------------|------------------------------------------|
| Layout admin          | `app/(admin)/layout.tsx`          | `import "@/lib/cms/init"`                |
| Layout storefront     | `app/(storefront)/layout.tsx`     | `import "@/lib/cms/init"`                |
| Layout preview        | `app/preview/layout.tsx`          | `import "@/lib/cms/init"`                |
| Convex `cms.ts`       | `convex/cms.ts`                   | `import { appCmsConfig } from "../cms"`  |
| Convex auto-translate | `convex/cmsAutoTranslate.ts`      | idem                                     |

### Pourquoi ça marche ?

- `setCmsRegistry()` est **idempotent** — l'appeler plusieurs fois ne pose aucun problème
- Les fonctions Convex (`getPageDefinition`, etc.) sont appelées **à l'intérieur des handlers**, pas au moment du chargement du module. Le registre est donc déjà initialisé quand elles s'exécutent.
- Les imports side-effect (`import "@/lib/cms/init"`) sont exécutés une seule fois par le bundler.

### Quand ajouter une nouvelle initialisation ?

Vous devez ajouter `setCmsRegistry()` si :
- Vous créez un **nouveau layout racine** Next.js qui utilise le CMS
- Vous créez un **nouveau fichier Convex** qui importe depuis `@be-in-digital/cms`

---

## 12. Exemples concrets

### Exemple 1 : Page simple (page de connexion)

```typescript
// cms/pages/sign-in.ts
import type { PageDefinition } from "@be-in-digital/cms"

export const signInPage: PageDefinition = {
  slug: "sign-in",
  label: "Page de connexion",
  groupId: "auth",
  blocks: [
    {
      key: "hero",
      label: "Section principale",
      fields: {
        title: {
          type: "text",
          label: "Titre",
          required: true,
          maxLength: 100,
          hasCodeFallback: true,
        },
        subtitle: {
          type: "richtext",
          label: "Sous-titre",
          maxLength: 500,
          hasCodeFallback: true,
        },
        image: {
          type: "image",
          label: "Image d'illustration",
          translatable: false,
          hasCodeFallback: true,
        },
      },
    },
    {
      key: "form",
      label: "Formulaire de connexion",
      fields: {
        heading: {
          type: "text",
          label: "Titre du formulaire",
          required: true,
          maxLength: 100,
          hasCodeFallback: true,
        },
        submitLabel: {
          type: "text",
          label: "Texte du bouton",
          required: true,
          maxLength: 50,
          hasCodeFallback: true,
        },
        forgotLink: {
          type: "text",
          label: "Texte lien mot de passe oublié",
          maxLength: 100,
          hasCodeFallback: true,
        },
        signupLink: {
          type: "text",
          label: "Texte lien inscription",
          maxLength: 100,
          hasCodeFallback: true,
        },
      },
    },
  ],
}
```

### Exemple 2 : Page avec bloc SEO et champs groupés visuellement

```typescript
// cms/pages/homepage.ts
import type { PageDefinition } from "@be-in-digital/cms"
import { seoBlock } from "@be-in-digital/cms"

export const homepagePage: PageDefinition = {
  slug: "homepage",
  label: "Page d'accueil",
  groupId: "storefront",
  blocks: [
    seoBlock,    // ← Bloc SEO réutilisable en premier
    {
      key: "features",
      label: "Section avantages",
      fields: {
        // Les champs avec le même `group` sont affichés ensemble dans l'admin
        feature1Image: {
          type: "image",
          label: "Icône",
          translatable: false,
          hasCodeFallback: true,
          group: "Avantage 1",      // ← Groupement visuel
        },
        feature1Label: {
          type: "text",
          label: "Texte",
          maxLength: 60,
          hasCodeFallback: true,
          group: "Avantage 1",      // ← Même groupe = même carte dans l'UI
        },
        feature2Image: {
          type: "image",
          label: "Icône",
          translatable: false,
          hasCodeFallback: true,
          group: "Avantage 2",
        },
        feature2Label: {
          type: "text",
          label: "Texte",
          maxLength: 60,
          hasCodeFallback: true,
          group: "Avantage 2",
        },
      },
    },
  ],
}
```

### Exemple 3 : Page avec champ select

```typescript
{
  key: "seo",
  label: "SEO",
  fields: {
    robots: {
      type: "select",
      label: "Directives robots",
      translatable: false,
      hasCodeFallback: true,
      options: [
        { value: "index, follow",     label: "Index, Follow (par défaut)" },
        { value: "noindex, follow",   label: "Noindex, Follow" },
        { value: "index, nofollow",   label: "Index, Nofollow" },
        { value: "noindex, nofollow", label: "Noindex, Nofollow" },
      ],
    },
  },
}
```

### Exemple 4 : Ajouter une nouvelle page à une app existante

1. Créer le fichier `cms/pages/faq.ts` :

```typescript
import type { PageDefinition } from "@be-in-digital/cms"

export const faqPage: PageDefinition = {
  slug: "faq",
  label: "Questions fréquentes",
  groupId: "storefront",  // Doit référencer un groupe existant
  blocks: [
    {
      key: "header",
      label: "En-tête",
      fields: {
        title: {
          type: "text",
          label: "Titre de la page",
          maxLength: 100,
          hasCodeFallback: true,
        },
        description: {
          type: "text",
          label: "Description",
          maxLength: 300,
          hasCodeFallback: true,
        },
      },
    },
  ],
}
```

2. L'importer dans `cms/index.ts` :

```typescript
import { faqPage } from "./pages/faq"

const pages: Record<string, PageDefinition> = {
  // ... pages existantes
  faq: faqPage,   // ← Ajouter ici (la clé DOIT correspondre au slug)
}
```

3. Redéployer Convex et rebuilder Next.js :

```bash
cd apps/mon-app && pnpx convex dev --once
pnpm turbo build --filter=@be-in-digital/mon-app
```

La nouvelle page apparaîtra automatiquement dans le dashboard admin, dans le groupe "Vitrine".

---

## 13. Erreurs fréquentes et solutions

### "CMS Registry is not initialized"

**Cause :** Vous appelez `getPageDefinition()` ou une autre fonction du registre avant `setCmsRegistry()`.

**Solution :** Vérifiez que :
- Le layout Next.js contient `import "@/lib/cms/init"` en première ligne
- Le fichier Convex contient `setCmsRegistry(appCmsConfig)` en haut du fichier

---

### "[CMS Registry] Invalid config: Duplicate group id"

**Cause :** Deux groupes dans `groups.ts` ont le même `id`.

**Solution :** Chaque groupe doit avoir un `id` unique.

```typescript
// ❌ Erreur
[
  { id: "main", label: "Principal", order: 1 },
  { id: "main", label: "Secondaire", order: 2 },   // doublon !
]

// ✅ Correct
[
  { id: "main", label: "Principal", order: 1 },
  { id: "secondary", label: "Secondaire", order: 2 },
]
```

---

### "[CMS Registry] Invalid config: Duplicate group order"

**Cause :** Deux groupes ont le même numéro d'`order`.

**Solution :** Chaque `order` doit être unique.

---

### "[CMS Registry] Invalid config: Page references unknown groupId"

**Cause :** Une page utilise un `groupId` qui n'existe dans aucun groupe.

**Solution :** Vérifiez que le `groupId` de la page correspond à un `id` dans `groups.ts`.

```typescript
// groups.ts
[{ id: "storefront", label: "Vitrine", order: 1 }]

// pages/faq.ts
{ slug: "faq", groupId: "store" }   // ❌ "store" n'existe pas
{ slug: "faq", groupId: "storefront" }  // ✅ Correct
```

---

### "[CMS Registry] Invalid config: Group has no pages assigned"

**Cause :** Un groupe existe dans `groups.ts` mais aucune page ne le référence.

**Solution :** Soit supprimer le groupe, soit ajouter au moins une page avec ce `groupId`.

---

### "La clé dans pages ne correspond pas au slug"

**Cause :** Dans `cms/index.ts`, la clé de l'objet ne correspond pas au `slug` de la PageDefinition.

```typescript
// ❌ Erreur
const pages = {
  "home": homepagePage,  // clé "home" mais slug "homepage"
}

// ✅ Correct
const pages = {
  "homepage": homepagePage,  // clé = slug
}
```

---

### "Cannot find module '../cms'"

**Cause :** Le fichier Convex ne trouve pas le dossier `cms/` avec un import relatif.

**Solution :** Vérifiez le chemin relatif. Depuis `convex/cms.ts`, le dossier `cms/` est un niveau au-dessus : `"../cms"`.

---

### Import `@/cms` ne fonctionne pas dans Convex

**Cause :** Le tsconfig Convex résout `@/` vers un dossier différent de Next.js.

**Solution :** Utilisez toujours un **import relatif** dans les fichiers Convex :

```typescript
// ❌ Dans un fichier Convex
import { appCmsConfig } from "@/cms"

// ✅ Dans un fichier Convex
import { appCmsConfig } from "../cms"
```

---

## 14. Diagrammes

### Flux de données CMS

```
┌──────────────────────────────────────────────────────────────────────┐
│                           INITIALISATION                             │
│                                                                      │
│  apps/mon-app/cms/           →   setCmsRegistry()   →   Registre    │
│  (groups.ts + pages/*.ts)         (validation)           (mémoire)   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                           ADMIN (ÉCRITURE)                           │
│                                                                      │
│  Dashboard    →  Formulaire  →  saveDraftBlock()  →  Convex DB      │
│  (listPages)     (auto-généré     (validation         (cmsBlocks)    │
│                   depuis le        validateBlockValues               │
│                   registre)        + registre)                       │
│                                                                      │
│                               →  publishPage()    →  cmsBlocks      │
│                                   (copie draft        (isDraft:false)│
│                                    vers published)                   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          STOREFRONT (LECTURE)                         │
│                                                                      │
│  Composant   →  getPageBlocks()  →  Valeurs publiées  →  Rendu     │
│  (page.tsx)      (Convex query)      + fallback code      (HTML)     │
│                                      si champ vide                   │
│                                      et hasCodeFallback              │
└──────────────────────────────────────────────────────────────────────┘
```

### Hiérarchie des types

```
CmsGroupDefinition
  └── id, label, order

PageDefinition
  ├── slug, label, description, groupId
  └── blocks: BlockDefinition[]
        ├── key, label, description
        └── fields: Record<string, FieldDefinition>
              ├── type, label, description
              ├── required, maxLength, placeholder
              ├── translatable, hasCodeFallback
              ├── options (select uniquement)
              └── group (groupement visuel)

CmsFieldValue (stocké en DB)
  ├── type
  ├── textValue (text, richtext, select)
  ├── mediaId (image, video, file)
  ├── altText, embedUrl, embedProvider
  └── isCleared (reset vers fallback)
```

---

## 15. Glossaire

| Terme            | Définition                                                                                         |
|------------------|----------------------------------------------------------------------------------------------------|
| **Registre**     | Singleton en mémoire contenant toutes les pages et groupes CMS, initialisé par `setCmsRegistry()` |
| **Page**         | Unité CMS identifiée par un slug (ex: `sign-in`, `homepage`). Le slug est un identifiant interne — il ne correspond pas toujours au chemin URL (ex: slug `homepage` → route `/`). |
| **Bloc**         | Section éditable d'une page (ex: "Hero", "Formulaire", "SEO"). Contient des champs.               |
| **Champ (Field)**| Unité atomique éditable (ex: titre, image, texte de bouton). A un type et des contraintes.         |
| **Groupe**       | Catégorie organisationnelle pour regrouper les pages dans le dashboard admin.                       |
| **Slug**         | Identifiant URL d'une page (ex: `"sign-in"`, `"homepage"`). Doit être unique.                     |
| **Draft**        | Brouillon — valeurs modifiées mais pas encore publiées.                                            |
| **Published**    | Valeurs publiées — visibles sur le storefront.                                                     |
| **Fallback**     | Valeur par défaut codée en dur dans le composant, utilisée si le CMS est vide.                     |
| **`hasCodeFallback`** | Indique si le composant affiche une valeur par défaut quand le CMS est vide.                  |
| **`isCleared`**  | Reset explicite d'un champ vers sa valeur fallback (supprime la valeur CMS).                       |
| **Side-effect import** | `import "@/lib/cms/init"` — exécute le fichier sans rien extraire, juste pour ses effets.    |
| **seoBlock**     | Bloc SEO réutilisable fourni par le package (metaTitle, metaDescription, ogImage, robots).         |
| **Barrel file**  | Fichier `index.ts` qui ré-exporte tous les éléments d'un dossier.                                 |

---

## Exports complets du package

```typescript
// Types
export type {
  FieldType,
  SelectOption,
  FieldDefinition,
  BlockDefinition,
  PageDefinition,
  CmsFieldValue,
  CmsBlockValues,
  CmsGroupDefinition,
} from "@be-in-digital/cms"

// Registry API
export {
  setCmsRegistry,
  getCmsRegistry,
  getCmsGroups,
  getPageDefinition,
  getBlockDefinition,
  getFieldDefinition,
  getAllPageSlugs,
} from "@be-in-digital/cms"

// Blocs réutilisables
export { seoBlock } from "@be-in-digital/cms"

// Validation des valeurs
export { validateBlockValues } from "@be-in-digital/cms"
export type { ValidationError, ValidationResult } from "@be-in-digital/cms"

// Sanitisation SVG
export { sanitizeSvg } from "@be-in-digital/cms"
export type { SanitizeResult } from "@be-in-digital/cms"

// Médias
export {
  CMS_MEDIA_LIMITS,
  MIME_TO_EXT,
  getMediaKind,
  getExtensionFromMimeType,
  validateMediaUpload,
} from "@be-in-digital/cms"
export type {
  MediaKind,
  MediaLimits,
  MediaValidationError,
  MediaValidationResult,
} from "@be-in-digital/cms"
```
