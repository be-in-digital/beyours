# Usage examples - @be-in-digital/convex-schema

This document walks through concrete examples of using the schema and the validators.

## Installing in a project

```bash
pnpm add @be-in-digital/convex-schema
```

## Using the Convex schema

### In convex/schema.ts

```typescript
import { schema } from '@be-in-digital/convex-schema'

export default schema
```

## Using the validators

### 1. Creating a store

```typescript
import { mutation } from './_generated/server'
import { createStoreSchema } from '@be-in-digital/convex-schema'

export const createStore = mutation({
  args: {},
  handler: async (ctx, rawArgs) => {
    // Validate with Zod
    const validatedData = createStoreSchema.parse(rawArgs)

    // Insert into the database
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

### 2. Creating a product with options

```typescript
import { mutation } from './_generated/server'
import { createProductSchema } from '@be-in-digital/convex-schema'

export const createProduct = mutation({
  handler: async (ctx, rawArgs) => {
    const product = createProductSchema.parse({
      storeId: rawArgs.storeId,
      categoryId: rawArgs.categoryId,
      name: 'Pizza Margherita',
      slug: 'pizza-margherita',
      description: 'Tomate, mozzarella, basilic',
      price: 1200, // 12.00 EUR in cents
      compareAtPrice: 1500, // Strikethrough price
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
        availableDays: [0, 1, 2, 3, 4, 5, 6], // Every day
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

### 3. Creating an order

```typescript
import { mutation } from './_generated/server'
import { createOrderSchema } from '@be-in-digital/convex-schema'

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

    // Automatic calculations
    const subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0)
    const taxRate = 0.10 // 10% VAT
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

### 4. Gamification system

```typescript
import { mutation } from './_generated/server'
import {
  createGameSchema,
  createPrizeSchema,
  playGameSchema
} from '@be-in-digital/convex-schema'

// Create a game
export const createGame = mutation({
  handler: async (ctx, rawArgs) => {
    const game = createGameSchema.parse({
      storeId: rawArgs.storeId,
      type: 'wheel',
      name: 'Roue de la Fortune',
      description: 'Tentez votre chance et gagnez des réductions!',
      winRatio: 30, // 30% chance of winning
      isActive: true,
    })

    return await ctx.db.insert('games', {
      ...game,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Create a prize
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

// Play the game
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

    // Check the 24h cooldown
    const lastPlay = await ctx.db
      .query('gamePlays')
      .withIndex('by_playerEmail', (q) => q.eq('playerEmail', play.playerEmail))
      .order('desc')
      .first()

    if (lastPlay && Date.now() - lastPlay.playedAt < 24 * 60 * 60 * 1000) {
      throw new Error('Vous devez attendre 24h entre deux parties')
    }

    // Fetch the game and its win rate
    const game = await ctx.db.get(play.gameId)
    if (!game) throw new Error('Jeu introuvable')

    // Decide whether the player wins (based on winRatio)
    const didWin = Math.random() * 100 < game.winRatio

    let prizeId = undefined
    if (didWin) {
      // Pick a random available prize
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

    // On a win, create the redemption code
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
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // TODO: Send email with QR code
    }

    return { didWin, prizeId }
  },
})
```

### 5. Automatic translation with GPT-3.5

```typescript
import { mutation } from './_generated/server'
import {
  createLanguageSchema,
  batchTranslateSchema
} from '@be-in-digital/convex-schema'

// Add a language
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

// Batch translate with GPT-3.5
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

    // TODO: Process with GPT-3.5 in the background

    return jobId
  },
})
```

### 6. Kitchen Display System

```typescript
import { mutation } from './_generated/server'
import { createKitchenTicketSchema } from '@be-in-digital/convex-schema'

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

    // Auto-print if configured
    const printerSettings = await ctx.db
      .query('printerSettings')
      .withIndex('by_storeId', (q) => q.eq('storeId', ticket.storeId))
      .filter((q) => q.and(
        q.eq(q.field('autoPrint'), true),
        q.eq(q.field('station'), ticket.station)
      ))
      .first()

    if (printerSettings) {
      // TODO: Send to the printer
      await ctx.db.patch(ticketId, { printCount: 1 })
    }

    return ticketId
  },
})
```

### 7. Multi-provider payment

```typescript
import { mutation } from './_generated/server'
import { createPaymentSchema } from '@be-in-digital/convex-schema'

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

    // Update the order status
    await ctx.db.patch(payment.orderId, {
      paymentStatus: 'paid',
      updatedAt: Date.now(),
    })

    return paymentId
  },
})
```

## Error handling

```typescript
import { mutation } from './_generated/server'
import { createProductSchema } from '@be-in-digital/convex-schema'
import { ZodError } from 'zod'

export const createProduct = mutation({
  handler: async (ctx, rawArgs) => {
    try {
      const product = createProductSchema.parse(rawArgs)

      // Check that the slug is unique
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
        // Format the validation errors
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

## Optimized queries

```typescript
import { query } from './_generated/server'

// Active products by category
export const listProducts = query({
  args: { storeId: v.id('stores'), categoryId: v.id('categories') },
  handler: async (ctx, { storeId, categoryId }) => {
    return await ctx.db
      .query('products')
      .withIndex('by_storeId_categoryId', (q) =>
        q.eq('storeId', storeId).eq('categoryId', categoryId)
      )
      .filter((q) => q.eq(q.field('isActive'), true))
      .order('asc') // By sortOrder
      .collect()
  },
})

// In-flight orders for a store
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

// Kitchen tickets by station
export const kitchenTicketsByStation = query({
  args: { storeId: v.id('stores'), station: v.string() },
  handler: async (ctx, { storeId, station }) => {
    return await ctx.db
      .query('kitchenTickets')
      .withIndex('by_storeId_station', (q) =>
        q.eq('storeId', storeId).eq('station', station)
      )
      .filter((q) => q.neq(q.field('status'), 'completed'))
      .order('desc') // Most recent first
      .collect()
  },
})
```

## Performance tips

1. **Always filter by storeId first** in composite indexes
2. **Use the right index** for each query
3. **Store prices in cents** (integer) to avoid precision problems
4. **Limit results** with `.take(n)` for long lists
5. **Paginate results** for large collections
6. **Cache** rarely-changing data on the client

## Resources

- [Documentation Convex](https://docs.convex.dev)
- [Documentation Zod](https://zod.dev)
- [Documentation Better Auth](https://www.better-auth.com)
