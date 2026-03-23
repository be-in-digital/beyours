# Image to Product — Design Specification

## Overview

Fonctionnalite "Image to Product" permettant a l'admin de creer des produits depuis une image uploadee. Deux modes : photo de plat (1 produit) ou photo de menu papier (N produits). L'IA analyse, extrait et genere les informations manquantes. L'admin revoit et valide avant creation.

## Understanding Summary

- **Quoi** : Creation de produits depuis une image via IA (vision + generation)
- **Pourquoi** : Accelerer le setup initial d'un restaurant — eviter la saisie manuelle
- **Pour qui** : Admins restaurant lors de la configuration initiale
- **Modes** : plat unique (1 image → 1 produit) / menu complet (1 image → N produits)
- **Workflow** : Upload → Analyse IA → Preview pre-rempli → Validation admin → Creation
- **Volume** : Faible (setup initial, quelques dizaines/mois/restaurant)
- **MVP** : Francais uniquement, une image a la fois

## Architecture

### Flux de donnees

```
ADMIN UI
  1. Upload image (ImageUploader existant → S3)
  2. Choix mode : plat unique vs menu
  3. Appel Convex action: imageToProduct.analyze
     (URL S3 + mode + storeId)

CONVEX ACTION (Node.js runtime) — une seule action orchestratrice
  4. Verification acces storeId
  5. processImage() helper
     - fetch image depuis S3
     - Sharp : resize (max 2048px), WebP, nettete
     - Si resolution < 800px : upscale Replicate (Real-ESRGAN)
     - Re-upload image traitee → S3 products/{uuid}.webp
  6. analyzeWithVision() helper
     - OpenAI GPT-4o Structured Outputs (json_schema strict)
     - Mode single : extraction nom/description/ingredients/allergenes/categorie
     - Mode menu : OCR + extraction structuree de N produits avec prix
  7. enrichMissingSuggestions() helper (conditionnel)
     - GPT-4o SEULEMENT si des champs sont vides (description, ingredients)
     - Skip si la vision a tout rempli
  8. mapCategories() helper
     - Query categories existantes du store via storeId
     - Matching fuzzy (lowercase, sans accents)
     - Pre-mappe matchedCategoryId si correspondance > 80%
  9. Post-traitement metier
     - Force allergens.source = "inferred"
     - Normalise prix en centimes entier non-negatif
     - Garantit conventions champs vides
  10. Retourne AnalyzeImageResult (ephemere, pas stocke en DB)

ADMIN UI
  11. Preview : liste de suggestion-cards editables
      - Badges source (Detecte/Genere/Deduit) par champ
      - Warnings globaux + par card
      - Confidence discrete par champ
      - Select categorie existante pre-selectionne
      - Checkbox inclure/exclure chaque produit
  12. Validation champs minimums avant creation en lot
  13. Confirmation → mutation products.create (existante)
  14. Auto-translate se declenche normalement
```

### Provider IA

- **Premier provider** : OpenAI GPT-4o (coherent avec l'existant GPT-3.5-turbo)
- **Architecture** : provider-agnostic, migration possible vers AI Gateway
- **Image upscale** : Replicate Real-ESRGAN (fallback si resolution < 800px)
- **Image processing** : Sharp (Node.js, dans le runtime Convex)

## Types

```typescript
type AiFieldSource = "detected" | "generated" | "inferred"

type AiField<T> = {
  value: T
  source: AiFieldSource
  confidence: number  // 0-1 par champ
}

type ParsingWarning = {
  field: string
  message: string
  severity: "info" | "warning"
}

type ProductSuggestion = {
  tempId: string
  name: AiField<string>
  description: AiField<string>
  price: AiField<number | null>         // centimes, entier non-negatif
  ingredients: AiField<string[]>
  allergens: AiField<string[]>          // TOUJOURS source="inferred"
  detectedCategoryName: AiField<string | null>
  suggestedCategoryName: AiField<string>
  matchedCategoryId: string | null      // rempli par mapCategories()
  imageUrl: string
  originalImageUrl: string
  imageEnhanced: boolean
  warnings: ParsingWarning[]
}

type AnalyzeImageResult = {
  mode: "single" | "menu"
  suggestions: ProductSuggestion[]
  processingCost: {
    visionTokens: number
    completionTokens: number
    estimatedCostUsd: number
    imageUpscaled: boolean
  }
}
```

## Zod Schemas (Structured Outputs)

### Vision mode single

```typescript
const singleProductVisionSchema = z.object({
  name: aiStringField,
  description: aiStringField,
  price: aiNumberField,               // centimes, null si non visible
  ingredients: aiStringArrayField,
  allergens: aiStringArrayField,
  detectedCategoryName: aiNullableStringField,
  suggestedCategoryName: aiStringField,
  warnings: z.array(parsingWarningSchema),
})
```

### Vision mode menu

```typescript
const menuVisionResultSchema = z.object({
  products: z.array(z.object({
    name: aiStringField,
    description: aiStringField,
    price: aiNumberField,
    ingredients: aiStringArrayField,
    allergens: aiStringArrayField,
    detectedCategoryName: aiNullableStringField,
    suggestedCategoryName: aiStringField,
    warnings: z.array(parsingWarningSchema),
  })),
})
```

### Enrichissement

```typescript
const enrichmentResultSchema = z.object({
  products: z.array(z.object({
    tempId: z.string(),
    description: aiStringField,
    ingredients: aiStringArrayField,
  })),
})
```

## Composants UI

```
packages/admin/src/pages/products/
  products-page.tsx              # existant — ajout bouton "Creer depuis image"
  product-form.tsx               # existant — reutilise en mode pre-rempli

  image-to-product/
    image-to-product-page.tsx    # Page principale du flow
    image-upload-step.tsx        # Upload + choix mode
    analysis-loading.tsx         # Skeleton + progression
    suggestions-review.tsx       # Liste des suggestions + actions lot
    suggestion-card.tsx          # Card par produit suggere (editable)
    ai-field-badge.tsx           # Badge "Detecte" / "Genere" / "Deduit"
    category-mapper.tsx          # Select categorie existante
    warning-banner.tsx           # Warnings globaux + par card
    confidence-indicator.tsx     # Indicateur visuel discret 0-100%
```

## Prompts IA

### Mode single (plat unique)

```
Tu es un expert en restauration et gastronomie.
Analyse cette photo d'un plat de restaurant.
Retourne un JSON strictement conforme au schema fourni.

Regles :
- "name" : identifie le plat. source="detected" si texte visible,
  sinon source="inferred".
- "description" : 1-2 phrases, appetissante, professionnelle.
  source="detected" si visible, sinon source="generated".
- "price" : en centimes d'euros (entier). source="detected" si visible,
  sinon value=null.
- "ingredients" : liste les ingredients visibles ou hautement probables.
  source="detected" si visibles, source="inferred" si deduits.
- "allergens" : TOUJOURS source="inferred". Uniquement les tres probables.
- "detectedCategoryName" : source="detected" si section visible, sinon null.
- "suggestedCategoryName" : toujours rempli, source="inferred".
- "confidence" : 0.0-1.0 par champ.
- "warnings" : si ambigu/flou. severity="warning" si impactant, "info" si mineur.

Langue : francais.
```

### Mode menu (extraction multi-produits)

```
Tu es un expert en restauration et OCR de menus.
Analyse cette photo de menu/carte de restaurant.
Extrais TOUS les plats, boissons et items visibles.
Retourne un JSON conforme au schema fourni.

Regles par champ :
- "name" : texte exact lu. source="detected".
- "price" : centimes euros entier. source="detected".
  Si illisible → value=null + warning.
- "detectedCategoryName" : source="detected" si section visible, sinon null.
- "suggestedCategoryName" : toujours rempli, source="inferred".
- "description" : source="detected" si presente. Sinon value="", source="generated", confidence=0.
- "ingredients" : source="detected" si listes. Sinon value=[], confidence=0.
- "allergens" : TOUJOURS source="inferred".
- "warnings" : un par ambiguite.

Langue : francais.
```

### Enrichissement (conditionnel)

```
Tu es un expert en gastronomie et redaction de fiches produits.
Complete les champs vides de ces produits.

Regles :
- "description" : 1-2 phrases, professionnelle. source="generated".
- "ingredients" : ingredients typiques. source="generated".
- NE MODIFIE PAS les champs deja remplis (confidence > 0).
- confidence entre 0.5 et 0.8 (jamais 1.0).

Produits : {productsJson}
```

## Estimation couts

| Etape | Cout estime |
|-------|-------------|
| Vision GPT-4o (1 image) | ~$0.01-0.03 |
| Enrichissement GPT-4o (si necessaire) | ~$0.005-0.01 |
| Upscale Replicate (si necessaire) | ~$0.02-0.05 |
| **Total typique** | **~$0.01-0.08** |

## Decision Log

| # | Decision | Alternatives | Raison |
|---|----------|-------------|--------|
| 1 | Pipeline sequentiel avec preview | Modal wizard, page dediee | Reutilise ProductForm, pas de duplication |
| 2 | Tout via Convex actions | API Route Next.js | Coherence architecture projet |
| 3 | Une seule action orchestratrice | Actions chainees | Evite surcout inter-actions |
| 4 | OpenAI GPT-4o premier provider | AI Gateway, Gemini | Coherent avec existant, provider-agnostic |
| 5 | Structured Outputs (json_schema strict) | json_object, parsing manuel | Garantie conformite schema |
| 6 | AiField avec source enum | Boolean aiGenerated | Plus granulaire, meilleure transparence |
| 7 | Confidence par champ | Par produit | Admin cible les champs a verifier |
| 8 | Allergenes TOUJOURS inferred | Permettre detected | Responsabilite legale |
| 9 | Sharp + upscale IA fallback (<800px) | IA systematique | Bon ratio qualite/cout |
| 10 | Replicate Real-ESRGAN upscale | Modele multimodal | API simple, cout previsible |
| 11 | Enrichissement conditionnel | Toujours/jamais enrichir | Economie tokens |
| 12 | Matching categories fuzzy Convex | Matching IA, exact | Simple, suffisant |
| 13 | Resultat ephemere client | Table temporaire | Faible volume, pas de persistance |
| 14 | MVP francais uniquement | Multi-langue | Traduction auto existante prend le relais |
| 15 | Prix centimes entier non-negatif | Float euros | Coherent schema Convex existant |

## Assumptions

- Images de qualite correcte (photo smartphone)
- Categories du store existent deja
- Traduction auto se declenche apres creation (pas pendant analyse)
- Cout IA acceptable (~$0.01-0.08/image)
- Prix en euros (devise du store)
- MVP : francais, une image a la fois
- Sharp est compatible avec le runtime Node.js de Convex
- Replicate Real-ESRGAN est accessible via API HTTP depuis Convex

## Risques

- **Sharp dans Convex** : verifier que le runtime Node.js de Convex supporte les binaires natifs de Sharp. Fallback : processing cote client ou Lambda separee.
- **Timeout Convex action** : le pipeline complet (Sharp + Vision + Enrichissement + Upscale) peut prendre 15-30s. Verifier les limites d'execution des actions Convex.
- **Qualite OCR menus** : les menus papier photographies en conditions reelles (eclairage, angle) peuvent etre difficiles a lire. Les warnings couvrent ce risque.
- **Cout Replicate** : surveiller l'usage upscale pour eviter les surprises de facturation.
