# Image to Product — Design Specification

## Overview

"Image to Product" feature that lets the admin create products from an uploaded image. Two modes: photo of a dish (1 product) or photo of a paper menu (N products). The AI analyzes, extracts and generates the missing information. The admin reviews and confirms before creation.

## Understanding Summary

- **What**: Product creation from an image via AI (vision + generation)
- **Why**: Speed up the initial setup of a restaurant — avoid manual data entry
- **For whom**: Restaurant admins during initial configuration
- **Modes**: single dish (1 image → 1 product) / full menu (1 image → N products)
- **Workflow**: Upload → AI analysis → Pre-filled preview → Admin confirmation → Creation
- **Volume**: Low (initial setup, a few dozen per month per restaurant)
- **MVP**: French only, one image at a time

## Architecture

### Data flow

```
ADMIN UI
  1. Upload image (existing ImageUploader → S3)
  2. Mode choice: single dish vs menu
  3. Call Convex action: imageToProduct.analyze
     (S3 URL + mode + storeId)

CONVEX ACTION (Node.js runtime) — a single orchestrating action
  4. Check access to storeId
  5. processImage() helper
     - fetch image from S3
     - Sharp: resize (max 2048px), WebP, sharpening
     - If resolution < 800px: Replicate upscale (Real-ESRGAN)
     - Re-upload processed image → S3 products/{uuid}.webp
  6. analyzeWithVision() helper
     - OpenAI GPT-4o Structured Outputs (strict json_schema)
     - Single mode: extract name/description/ingredients/allergens/category
     - Menu mode: OCR + structured extraction of N products with prices
  7. enrichMissingSuggestions() helper (conditional)
     - GPT-4o ONLY if some fields are empty (description, ingredients)
     - Skipped if vision filled everything in
  8. mapCategories() helper
     - Query the store's existing categories via storeId
     - Fuzzy matching (lowercase, accent-insensitive)
     - Pre-maps matchedCategoryId if the match is > 80%
  9. Business post-processing
     - Force allergens.source = "inferred"
     - Normalize prices to non-negative integer cents
     - Enforce the empty-field conventions
  10. Returns AnalyzeImageResult (ephemeral, not stored in the DB)

ADMIN UI
  11. Preview: list of editable suggestion cards
      - Source badges (Detecte/Genere/Deduit) per field
      - Global warnings + per-card warnings
      - Discreet per-field confidence
      - Existing-category select pre-selected
      - Checkbox to include/exclude each product
  12. Minimum-field validation before batch creation
  13. Confirmation → products.create mutation (existing)
  14. Auto-translate triggers as usual
```

### AI provider

- **First provider**: OpenAI GPT-4o (consistent with the existing GPT-3.5-turbo)
- **Architecture**: provider-agnostic, migration to AI Gateway possible
- **Image upscale**: Replicate Real-ESRGAN (fallback if resolution < 800px)
- **Image processing**: Sharp (Node.js, inside the Convex runtime)

## Types

```typescript
type AiFieldSource = "detected" | "generated" | "inferred"

type AiField<T> = {
  value: T
  source: AiFieldSource
  confidence: number  // 0-1 per field
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
  price: AiField<number | null>         // cents, non-negative integer
  ingredients: AiField<string[]>
  allergens: AiField<string[]>          // ALWAYS source="inferred"
  detectedCategoryName: AiField<string | null>
  suggestedCategoryName: AiField<string>
  matchedCategoryId: string | null      // filled by mapCategories()
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

### Vision — single mode

```typescript
const singleProductVisionSchema = z.object({
  name: aiStringField,
  description: aiStringField,
  price: aiNumberField,               // cents, null if not visible
  ingredients: aiStringArrayField,
  allergens: aiStringArrayField,
  detectedCategoryName: aiNullableStringField,
  suggestedCategoryName: aiStringField,
  warnings: z.array(parsingWarningSchema),
})
```

### Vision — menu mode

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

### Enrichment

```typescript
const enrichmentResultSchema = z.object({
  products: z.array(z.object({
    tempId: z.string(),
    description: aiStringField,
    ingredients: aiStringArrayField,
  })),
})
```

## UI components

```
packages/admin/src/pages/products/
  products-page.tsx              # existing — add "Creer depuis image" button
  product-form.tsx               # existing — reused in pre-filled mode

  image-to-product/
    image-to-product-page.tsx    # Main page of the flow
    image-upload-step.tsx        # Upload + mode choice
    analysis-loading.tsx         # Skeleton + progress
    suggestions-review.tsx       # Suggestion list + batch actions
    suggestion-card.tsx          # Card per suggested product (editable)
    ai-field-badge.tsx           # "Detecte" / "Genere" / "Deduit" badge
    category-mapper.tsx          # Existing-category select
    warning-banner.tsx           # Global + per-card warnings
    confidence-indicator.tsx     # Discreet 0-100% visual indicator
```

## AI prompts

### Single mode (one dish)

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

### Menu mode (multi-product extraction)

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

### Enrichment (conditional)

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

## Cost estimate

| Step | Estimated cost |
|-------|-------------|
| GPT-4o vision (1 image) | ~$0.01-0.03 |
| GPT-4o enrichment (if needed) | ~$0.005-0.01 |
| Replicate upscale (if needed) | ~$0.02-0.05 |
| **Typical total** | **~$0.01-0.08** |

## Decision Log

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|--------|
| 1 | Sequential pipeline with preview | Modal wizard, dedicated page | Reuses ProductForm, no duplication |
| 2 | Everything through Convex actions | Next.js API Route | Consistent with the project architecture |
| 3 | A single orchestrating action | Chained actions | Avoids inter-action overhead |
| 4 | OpenAI GPT-4o as first provider | AI Gateway, Gemini | Consistent with the existing setup, provider-agnostic |
| 5 | Structured Outputs (strict json_schema) | json_object, manual parsing | Guaranteed schema conformance |
| 6 | AiField with a source enum | Boolean aiGenerated | More granular, better transparency |
| 7 | Confidence per field | Per product | Admin targets the fields worth checking |
| 8 | Allergens ALWAYS inferred | Allow detected | Legal liability |
| 9 | Sharp + AI upscale fallback (<800px) | AI every time | Good quality/cost ratio |
| 10 | Replicate Real-ESRGAN upscale | Multimodal model | Simple API, predictable cost |
| 11 | Conditional enrichment | Always/never enrich | Saves tokens |
| 12 | Fuzzy category matching in Convex | AI matching, exact match | Simple, good enough |
| 13 | Ephemeral client-side result | Temporary table | Low volume, no persistence |
| 14 | French-only MVP | Multi-language | The existing auto-translation takes over |
| 15 | Price as non-negative integer cents | Float euros | Consistent with the existing Convex schema |

## Assumptions

- Images of decent quality (smartphone photo)
- The store's categories already exist
- Auto-translation runs after creation (not during analysis)
- Acceptable AI cost (~$0.01-0.08/image)
- Prices in euros (store currency)
- MVP: French, one image at a time
- Sharp is compatible with Convex's Node.js runtime
- Replicate Real-ESRGAN is reachable over HTTP API from Convex

## Risks

- **Sharp inside Convex**: verify that Convex's Node.js runtime supports Sharp's native binaries. Fallback: client-side processing or a separate Lambda.
- **Convex action timeout**: the full pipeline (Sharp + Vision + Enrichment + Upscale) can take 15-30s. Check the execution limits of Convex actions.
- **Menu OCR quality**: paper menus photographed in real conditions (lighting, angle) can be hard to read. The warnings cover this risk.
- **Replicate cost**: monitor upscale usage to avoid billing surprises.
