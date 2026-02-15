# Exemples d'utilisation - @beindigital-engine/convex-schema

Ce document présente des exemples concrets d'utilisation du schéma et des validators.

## Installation dans un projet

```bash
pnpm add @beindigital-engine/convex-schema
```

## Utilisation du schéma Convex

### Dans convex/schema.ts

```typescript
import { schema } from '@beindigital-engine/convex-schema'

export default schema
```

## Utilisation des validators

### 1. Création d'un magasin

```typescript
import { mutation } from './_generated/server'
import { createStoreSchema } from '@beindigital-engine/convex-schema'

export const createStore = mutation({
  args: {},
  handler: async (ctx, rawArgs) => {
    // Validation avec Zod
    const validatedData = createStoreSchema.parse(rawArgs)

    // Insertion en base
    const storeId = await ctx.db.insert('stores', {
      ...validatedData,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    return storeId
  },
})
```

### 2. Création d'un produit avec options

```typescript
import { mutation } from './_generated/server'
import { createProductSchema } from '@beindigital-engine/convex-schema'

export const createProduct = mutation({
  handler: async (ctx, rawArgs) => {
    const product = createProductSchema.parse({
      storeId: rawArgs.storeId,
      categoryId: rawArgs.categoryId,
      name: 'Pizza Margherita',
      slug: 'pizza-margherita',
      description: 'Tomate, mozzarella, basilic',
      price: 1200, // 12.00 EUR en centimes
      compareAtPrice: 1500, // Prix barré
      images: [
        'https://mybucket.s3.eu-west-1.amazonaws.com/products/margherita.jpg'
      ],
      options: [
        {
          id: 'size',
          name: 'Taille',
          required: true,
          maxSelections: 1,
          choices: [
            {
              id: 'small',
              name: 'Petite (26cm)',
              priceModifier: 0,
            },
            {
              id: 'medium',
              name: 'Moyenne (30cm)',
              priceModifier: 200, // +2.00 EUR
            },
            {
              id: 'large',
              name: 'Grande (40cm)',
              priceModifier: 400, // +4.00 EUR
            },
          ],
        },
        {
          id: 'extras',
          name: 'Extras',
          required: false,
          maxSelections: 5,
          choices: [
            {
              id: 'extra-cheese',
              name: 'Supplément fromage',
              priceModifier: 150,
            },
            {
              id: 'olives',
              name: 'Olives',
              priceModifier: 100,
            },
          ],
        },
      ],
      allergens: ['gluten', 'lactose'],
      nutritionalInfo: {
        calories: 850,
        protein: 35,
        carbs: 90,
        fat: 30,
        fiber: 5,
      },
      tags: ['vegetarian', 'classic', 'popular'],
      spiceLevel: 0,
      scheduling: {
        availableFrom: '11:00',
        availableUntil: '23:00',
        availableDays: [0, 1, 2, 3, 4, 5, 6], // Tous les jours
      },
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
    })

    const productId = await ctx.db.insert('products', {
      ...product,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    return productId
  },
})
```

### 3. Création d'une commande

```typescript
import { mutation } from './_generated/server'
import { createOrderSchema } from '@beindigital-engine/convex-schema'

export const createOrder = mutation({
  handler: async (ctx, rawArgs) => {
    const order = createOrderSchema.parse({
      storeId: rawArgs.storeId,
      type: 'delivery',
      customerInfo: {
        name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
        phone: '+33612345678',
      },
      items: [
        {
          productId: 'prod_margherita',
          productName: 'Pizza Margherita',
          quantity: 2,
          unitPrice: 1200,
          selectedOptions: [
            {
              optionId: 'size',
              optionName: 'Taille',
              choiceId: 'large',
              choiceName: 'Grande (40cm)',
              priceModifier: 400,
            },
            {
              optionId: 'extras',
              optionName: 'Extras',
              choiceId: 'extra-cheese',
              choiceName: 'Supplément fromage',
              priceModifier: 150,
            },
          ],
          subtotal: 3500, // (1200 + 400 + 150) * 2
          notes: 'Bien cuite SVP',
        },
      ],
      deliveryAddress: {
        street: '45 Rue de Rivoli',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
        latitude: 48.8566,
        longitude: 2.3522,
        instructions: 'Code porte: 1234A',
      },
      notes: 'Livraison rapide si possible',
    })

    // Calculs automatiques
    const subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0)
    const taxRate = 0.10 // 10% TVA
    const taxAmount = Math.round(subtotal * taxRate)
    const deliveryFee = 300 // 3.00 EUR
    const total = subtotal + taxAmount + deliveryFee

    const orderNumber = await generateOrderNumber(ctx)

    const orderId = await ctx.db.insert('orders', {
      ...order,
      orderNumber,
      subtotal,
      taxAmount,
      deliveryFee,
      total,
      status: 'pending',
      paymentStatus: 'pending',
      source: 'website',
      estimatedPrepTime: 20,
      estimatedDeliveryTime: 45,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    return { orderId, orderNumber }
  },
})
```

### 4. Système de gamification

```typescript
import { mutation } from './_generated/server'
import {
  createGameSchema,
  createPrizeSchema,
  playGameSchema
} from '@beindigital-engine/convex-schema'

// Créer un jeu
export const createGame = mutation({
  handler: async (ctx, rawArgs) => {
    const game = createGameSchema.parse({
      storeId: rawArgs.storeId,
      type: 'wheel',
      name: 'Roue de la Fortune',
      description: 'Tentez votre chance et gagnez des réductions!',
      winRatio: 30, // 30% de chance de gagner
      isActive: true,
    })

    return await ctx.db.insert('games', {
      ...game,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Créer un lot
export const createPrize = mutation({
  handler: async (ctx, rawArgs) => {
    const prize = createPrizeSchema.parse({
      storeId: rawArgs.storeId,
      name: 'Dessert gratuit',
      description: 'Un dessert au choix offert',
      imageUrl: 'https://example.com/dessert.jpg',
      type: 'free_product',
      productId: 'prod_tiramisu',
      validityDays: 7,
      totalAvailable: 100,
      isActive: true,
    })

    return await ctx.db.insert('prizes', {
      ...prize,
      remainingCount: prize.totalAvailable,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Jouer au jeu
export const playGame = mutation({
  handler: async (ctx, rawArgs) => {
    const play = playGameSchema.parse({
      storeId: rawArgs.storeId,
      gameId: rawArgs.gameId,
      qrCodeId: rawArgs.qrCodeId,
      playerEmail: 'player@example.com',
      playerName: 'Marie Martin',
      completedActions: ['google_review', 'instagram_follow'],
    })

    // Vérifier cooldown 24h
    const lastPlay = await ctx.db
      .query('gamePlays')
      .withIndex('by_playerEmail', (q) => q.eq('playerEmail', play.playerEmail))
      .order('desc')
      .first()

    if (lastPlay && Date.now() - lastPlay.playedAt < 24 * 60 * 60 * 1000) {
      throw new Error('Vous devez attendre 24h entre deux parties')
    }

    // Récupérer le jeu et son taux de gain
    const game = await ctx.db.get(play.gameId)
    if (!game) throw new Error('Jeu introuvable')

    // Déterminer si le joueur gagne (basé sur winRatio)
    const didWin = Math.random() * 100 < game.winRatio

    let prizeId = undefined
    if (didWin) {
      // Sélectionner un lot aléatoire disponible
      const availablePrizes = await ctx.db
        .query('prizes')
        .withIndex('by_storeId_isActive', (q) =>
          q.eq('storeId', play.storeId).eq('isActive', true)
        )
        .collect()

      if (availablePrizes.length > 0) {
        prizeId = availablePrizes[0]._id
      }
    }

    const gamePlayId = await ctx.db.insert('gamePlays', {
      ...play,
      didWin,
      prizeId,
      playedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Si gagné, créer le code de rédemption
    if (didWin && prizeId) {
      const redemptionCode = generateRedemptionCode()

      await ctx.db.insert('prizeRedemptions', {
        storeId: play.storeId,
        gamePlayId,
        prizeId,
        playerEmail: play.playerEmail,
        playerName: play.playerName,
        redemptionCode,
        status: 'pending',
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 jours
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // TODO: Envoyer email avec QR code
    }

    return { didWin, prizeId }
  },
})
```

### 5. Traduction automatique avec GPT-3.5

```typescript
import { mutation } from './_generated/server'
import {
  createLanguageSchema,
  batchTranslateSchema
} from '@beindigital-engine/convex-schema'

// Ajouter une langue
export const addLanguage = mutation({
  handler: async (ctx, rawArgs) => {
    const language = createLanguageSchema.parse({
      storeId: rawArgs.storeId,
      code: 'es',
      name: 'Espagnol',
      nativeName: 'Español',
      flagEmoji: '🇪🇸',
      isDefault: false,
      isRtl: false,
    })

    return await ctx.db.insert('languages', {
      ...language,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Traduire en lot avec GPT-3.5
export const translateProducts = mutation({
  handler: async (ctx, rawArgs) => {
    const job = batchTranslateSchema.parse({
      storeId: rawArgs.storeId,
      sourceLanguage: 'fr',
      targetLanguage: 'es',
      entityType: 'product',
      entityIds: ['prod1', 'prod2', 'prod3'],
    })

    const jobId = await ctx.db.insert('translationJobs', {
      ...job,
      totalItems: job.entityIds.length,
      completedItems: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // TODO: Traiter avec GPT-3.5 en arrière-plan

    return jobId
  },
})
```

### 6. Kitchen Display System

```typescript
import { mutation } from './_generated/server'
import { createKitchenTicketSchema } from '@beindigital-engine/convex-schema'

export const createKitchenTicket = mutation({
  handler: async (ctx, rawArgs) => {
    const ticket = createKitchenTicketSchema.parse({
      storeId: rawArgs.storeId,
      orderId: rawArgs.orderId,
      station: 'plats',
      priority: 'normal',
      items: [
        {
          productName: 'Pizza Margherita',
          quantity: 2,
          options: ['Grande', 'Supplément fromage'],
          notes: 'Bien cuite',
        },
        {
          productName: 'Salade César',
          quantity: 1,
          options: ['Sans oignons'],
        },
      ],
      orderNumber: 'ORD-2026-0001',
      orderType: 'dine_in',
      source: 'website',
      estimatedPrepTime: 15,
    })

    const ticketId = await ctx.db.insert('kitchenTickets', {
      ...ticket,
      status: 'pending',
      printCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Auto-print si configuré
    const printerSettings = await ctx.db
      .query('printerSettings')
      .withIndex('by_storeId', (q) => q.eq('storeId', ticket.storeId))
      .filter((q) => q.and(
        q.eq(q.field('autoPrint'), true),
        q.eq(q.field('station'), ticket.station)
      ))
      .first()

    if (printerSettings) {
      // TODO: Envoyer à l'imprimante
      await ctx.db.patch(ticketId, { printCount: 1 })
    }

    return ticketId
  },
})
```

### 7. Paiement multi-provider

```typescript
import { mutation } from './_generated/server'
import { createPaymentSchema } from '@beindigital-engine/convex-schema'

export const createPayment = mutation({
  handler: async (ctx, rawArgs) => {
    const payment = createPaymentSchema.parse({
      orderId: rawArgs.orderId,
      storeId: rawArgs.storeId,
      amount: 2400, // 24.00 EUR
      currency: 'EUR',
      provider: 'stripe',
      externalId: 'pi_123456789', // Stripe Payment Intent ID
      metadata: {
        last4: '4242',
        brand: 'visa',
        receiptUrl: 'https://stripe.com/receipt/...',
      },
    })

    const paymentId = await ctx.db.insert('payments', {
      ...payment,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Mettre à jour le statut de la commande
    await ctx.db.patch(payment.orderId, {
      paymentStatus: 'paid',
      updatedAt: Date.now(),
    })

    return paymentId
  },
})
```

## Gestion des erreurs

```typescript
import { mutation } from './_generated/server'
import { createProductSchema } from '@beindigital-engine/convex-schema'
import { ZodError } from 'zod'

export const createProduct = mutation({
  handler: async (ctx, rawArgs) => {
    try {
      const product = createProductSchema.parse(rawArgs)

      // Vérifier que le slug est unique
      const existing = await ctx.db
        .query('products')
        .withIndex('by_storeId_slug', (q) =>
          q.eq('storeId', product.storeId).eq('slug', product.slug)
        )
        .first()

      if (existing) {
        throw new Error('Un produit avec ce slug existe déjà')
      }

      return await ctx.db.insert('products', {
        ...product,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    } catch (error) {
      if (error instanceof ZodError) {
        // Formater les erreurs de validation
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }))
        throw new Error(JSON.stringify(formattedErrors))
      }
      throw error
    }
  },
})
```

## Queries optimisées

```typescript
import { query } from './_generated/server'

// Liste des produits actifs par catégorie
export const listProducts = query({
  args: { storeId: v.id('stores'), categoryId: v.id('categories') },
  handler: async (ctx, { storeId, categoryId }) => {
    return await ctx.db
      .query('products')
      .withIndex('by_storeId_categoryId', (q) =>
        q.eq('storeId', storeId).eq('categoryId', categoryId)
      )
      .filter((q) => q.eq(q.field('isActive'), true))
      .order('asc') // Par sortOrder
      .collect()
  },
})

// Commandes en cours pour un magasin
export const activeOrders = query({
  args: { storeId: v.id('stores') },
  handler: async (ctx, { storeId }) => {
    return await ctx.db
      .query('orders')
      .withIndex('by_storeId_status', (q) =>
        q.eq('storeId', storeId).eq('status', 'preparing')
      )
      .collect()
  },
})

// Tickets cuisine par station
export const kitchenTicketsByStation = query({
  args: { storeId: v.id('stores'), station: v.string() },
  handler: async (ctx, { storeId, station }) => {
    return await ctx.db
      .query('kitchenTickets')
      .withIndex('by_storeId_station', (q) =>
        q.eq('storeId', storeId).eq('station', station)
      )
      .filter((q) => q.neq(q.field('status'), 'completed'))
      .order('desc') // Plus récents en premier
      .collect()
  },
})
```

## Conseils de performance

1. **Toujours filtrer par storeId en premier** dans les index composés
2. **Utiliser les index appropriés** pour chaque requête
3. **Stocker les prix en centimes** (integer) pour éviter les problèmes de précision
4. **Limiter les résultats** avec `.take(n)` pour les listes longues
5. **Paginer les résultats** pour les collections volumineuses
6. **Mettre en cache** les données rarement modifiées côté client

## Ressources

- [Documentation Convex](https://docs.convex.dev)
- [Documentation Zod](https://zod.dev)
- [Documentation Better Auth](https://www.better-auth.com)
