import { describe, it, expect } from 'vitest'
import {
  createStoreSchema,
  updateStoreSchema,
  createProductSchema,
  updateProductSchema,
  productSourceEnum,
  createOrderSchema,
  updateOrderStatusSchema,
  createLanguageSchema,
  createGameSchema,
  playGameSchema,
  createPrizeSchema,
  createKitchenTicketSchema,
  createPaymentSchema,
} from '../validators'

describe('Store Validators', () => {
  it('should validate a valid store creation', () => {
    const validStore = {
      name: 'Pizza Palace',
      slug: 'pizza-palace',
      address: {
        street: '123 Main St',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
      settings: {
        currency: 'EUR',
        timezone: 'Europe/Paris',
        deliveryEnabled: true,
        pickupEnabled: true,
        dineInEnabled: true,
      },
    }

    const result = createStoreSchema.parse(validStore)
    expect(result).toBeDefined()
    expect(result.name).toBe('Pizza Palace')
  })

  it('should reject invalid slug', () => {
    const invalidStore = {
      name: 'Pizza Palace',
      slug: 'Pizza Palace!', // Invalid characters
      address: {
        street: '123 Main St',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
    }

    expect(() => createStoreSchema.parse(invalidStore)).toThrow()
  })

  it('should validate partial store update', () => {
    const update = {
      name: 'New Name',
      status: 'closed',
    }

    const result = updateStoreSchema.parse(update)
    expect(result.name).toBe('New Name')
  })
})

describe('Product Validators', () => {
  it('should validate a valid product with options', () => {
    const validProduct = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Margherita Pizza',
      slug: 'margherita-pizza',
      description: 'Classic tomato and mozzarella pizza',
      price: 1200, // 12.00 EUR in cents
      images: ['https://example.com/pizza.jpg'],
      options: [
        {
          id: 'size',
          name: 'Taille',
          required: true,
          choices: [
            { id: 'small', name: 'Petite', priceModifier: 0 },
            { id: 'large', name: 'Grande', priceModifier: 300 }, // +3.00 EUR
          ],
        },
      ],
      allergens: ['gluten', 'lactose'],
      tags: ['vegetarian', 'classic'],
      isActive: true,
      isFeatured: true,
    }

    const result = createProductSchema.parse(validProduct)
    expect(result.price).toBe(1200)
    expect(result.options).toHaveLength(1)
  })

  it('should reject negative price', () => {
    const invalidProduct = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Test Product',
      slug: 'test-product',
      price: -100, // Invalid negative price
    }

    expect(() => createProductSchema.parse(invalidProduct)).toThrow()
  })

  it('should validate product with scheduling', () => {
    const productWithSchedule = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Breakfast Menu',
      slug: 'breakfast-menu',
      price: 800,
      scheduling: {
        availableFrom: '07:00',
        availableUntil: '11:00',
        availableDays: [1, 2, 3, 4, 5], // Mon-Fri
      },
    }

    const result = createProductSchema.parse(productWithSchedule)
    expect(result.scheduling?.availableFrom).toBe('07:00')
  })

  it('should default source to manual and taxRate to 0', () => {
    const product = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Test',
      slug: 'test',
      price: 1000,
    }

    const result = createProductSchema.parse(product)
    expect(result.source).toBe('manual')
    expect(result.taxRate).toBe(0)
  })

  it('should validate product imported from Uber Eats with platform overrides', () => {
    const uberProduct = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Burger Classique',
      slug: 'burger-classique',
      price: 1200,
      taxRate: 10,
      preparationTime: 15,
      sku: 'BRG-001',
      source: 'uber_eats',
      externalIds: { uberEatsId: 'ue-item-456' },
      platformOverrides: {
        uberEats: {
          price: 1400, // prix plus eleve sur Uber Eats
          isActive: true,
          lastSyncedAt: Date.now(),
        },
      },
      options: [
        {
          id: 'sauce',
          name: 'Sauce',
          required: false,
          externalIds: { uberEatsId: 'ue-mod-group-1' },
          choices: [
            {
              id: 'ketchup',
              name: 'Ketchup',
              priceModifier: 0,
              externalIds: { uberEatsId: 'ue-mod-1' },
            },
            {
              id: 'mayo',
              name: 'Mayonnaise',
              priceModifier: 50,
              externalIds: { uberEatsId: 'ue-mod-2' },
            },
          ],
        },
      ],
    }

    const result = createProductSchema.parse(uberProduct)
    expect(result.source).toBe('uber_eats')
    expect(result.taxRate).toBe(10)
    expect(result.preparationTime).toBe(15)
    expect(result.sku).toBe('BRG-001')
    expect(result.platformOverrides?.uberEats?.price).toBe(1400)
    expect(result.options[0].externalIds?.uberEatsId).toBe('ue-mod-group-1')
    expect(result.options[0].choices[0].externalIds?.uberEatsId).toBe('ue-mod-1')
  })

  it('should validate product with Deliveroo sync error', () => {
    const product = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Salade Cesar',
      slug: 'salade-cesar',
      price: 950,
      source: 'deliveroo',
      externalIds: { deliverooId: 'dlv-789' },
      platformOverrides: {
        deliveroo: {
          isActive: false,
          syncError: 'Image non conforme aux specifications Deliveroo',
        },
      },
    }

    const result = createProductSchema.parse(product)
    expect(result.source).toBe('deliveroo')
    expect(result.platformOverrides?.deliveroo?.isActive).toBe(false)
    expect(result.platformOverrides?.deliveroo?.syncError).toBeDefined()
  })

  it('should reject invalid source', () => {
    expect(() => productSourceEnum.parse('amazon')).toThrow()
  })

  it('should reject preparation time > 240 minutes', () => {
    const product = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Test',
      slug: 'test',
      price: 1000,
      preparationTime: 300, // 5 heures, trop long
    }

    expect(() => createProductSchema.parse(product)).toThrow()
  })

  it('should reject taxRate > 100', () => {
    const product = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Test',
      slug: 'test',
      price: 1000,
      taxRate: 150,
    }

    expect(() => createProductSchema.parse(product)).toThrow()
  })
})

describe('Order Validators', () => {
  it('should validate a delivery order', () => {
    const validOrder = {
      storeId: 'store123',
      type: 'delivery' as const,
      customerInfo: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+33612345678',
      },
      items: [
        {
          productId: 'prod123',
          productName: 'Margherita Pizza',
          quantity: 2,
          unitPrice: 1200,
          selectedOptions: [],
          subtotal: 2400,
        },
      ],
      deliveryAddress: {
        street: '45 Rue de Rivoli',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
    }

    const result = createOrderSchema.parse(validOrder)
    expect(result.type).toBe('delivery')
    expect(result.items).toHaveLength(1)
  })

  it('should reject order with no items', () => {
    const invalidOrder = {
      storeId: 'store123',
      type: 'pickup',
      customerInfo: {
        name: 'John Doe',
      },
      items: [], // Invalid: no items
    }

    expect(() => createOrderSchema.parse(invalidOrder)).toThrow()
  })

  it('should validate order status update', () => {
    const statusUpdate = {
      orderId: 'order123',
      status: 'preparing' as const,
    }

    const result = updateOrderStatusSchema.parse(statusUpdate)
    expect(result.status).toBe('preparing')
  })
})

describe('Language Validators', () => {
  it('should validate language creation', () => {
    const validLanguage = {
      storeId: 'store123',
      code: 'es',
      name: 'Espagnol',
      nativeName: 'Español',
      flagEmoji: '🇪🇸',
      isDefault: false,
      isRtl: false,
    }

    const result = createLanguageSchema.parse(validLanguage)
    expect(result.code).toBe('es')
  })

  it('should normalize language code to lowercase', () => {
    const language = {
      storeId: 'store123',
      code: 'FR',
      name: 'Francais',
      nativeName: 'Francais',
    }

    const result = createLanguageSchema.parse(language)
    expect(result.code).toBe('fr')
  })
})

describe('Gamification Validators', () => {
  it('should validate game creation with win ratio', () => {
    const validGame = {
      storeId: 'store123',
      type: 'wheel' as const,
      name: 'Roue de la Fortune',
      description: 'Tentez votre chance!',
      winRatio: 30, // 30% chance to win
      isActive: true,
    }

    const result = createGameSchema.parse(validGame)
    expect(result.winRatio).toBe(30)
  })

  it('should reject win ratio > 100', () => {
    const invalidGame = {
      storeId: 'store123',
      type: 'wheel',
      name: 'Test Game',
      winRatio: 150, // Invalid: > 100
    }

    expect(() => createGameSchema.parse(invalidGame)).toThrow()
  })

  it('should validate prize creation', () => {
    const validPrize = {
      storeId: 'store123',
      name: 'Dessert gratuit',
      type: 'free_product' as const,
      productId: 'prod123',
      validityDays: 7,
      isActive: true,
    }

    const result = createPrizeSchema.parse(validPrize)
    expect(result.validityDays).toBe(7)
  })

  it('should validate game play', () => {
    const validPlay = {
      storeId: 'store123',
      gameId: 'game123',
      qrCodeId: 'qr123',
      playerEmail: 'player@example.com',
      playerName: 'Jean Dupont',
      completedActions: ['action1', 'action2'],
    }

    const result = playGameSchema.parse(validPlay)
    expect(result.completedActions).toHaveLength(2)
  })

  it('should reject game play without completed actions', () => {
    const invalidPlay = {
      storeId: 'store123',
      gameId: 'game123',
      qrCodeId: 'qr123',
      playerEmail: 'player@example.com',
      playerName: 'Jean Dupont',
      completedActions: [], // Invalid: no actions
    }

    expect(() => playGameSchema.parse(invalidPlay)).toThrow()
  })
})

describe('Kitchen Validators', () => {
  it('should validate kitchen ticket creation', () => {
    const validTicket = {
      storeId: 'store123',
      orderId: 'order123',
      station: 'plats',
      priority: 'normal' as const,
      items: [
        {
          productName: 'Pizza Margherita',
          quantity: 2,
          options: ['Grande', 'Extra fromage'],
        },
      ],
      orderNumber: 'ORD-2026-0001',
      orderType: 'dine_in' as const,
      source: 'website' as const,
    }

    const result = createKitchenTicketSchema.parse(validTicket)
    expect(result.station).toBe('plats')
    expect(result.items).toHaveLength(1)
  })
})

describe('Payment Validators', () => {
  it('should validate payment creation', () => {
    const validPayment = {
      orderId: 'order123',
      storeId: 'store123',
      amount: 2400, // 24.00 EUR in cents
      currency: 'EUR',
      provider: 'stripe' as const,
      externalId: 'pi_123456789',
    }

    const result = createPaymentSchema.parse(validPayment)
    expect(result.provider).toBe('stripe')
    expect(result.amount).toBe(2400)
  })

  it('should reject payment with amount <= 0', () => {
    const invalidPayment = {
      orderId: 'order123',
      storeId: 'store123',
      amount: 0, // Invalid: must be > 0
      currency: 'EUR',
      provider: 'stripe',
    }

    expect(() => createPaymentSchema.parse(invalidPayment)).toThrow()
  })

  it('should normalize currency to uppercase', () => {
    const payment = {
      orderId: 'order123',
      storeId: 'store123',
      amount: 1000,
      currency: 'eur', // Lowercase
      provider: 'cash' as const,
    }

    const result = createPaymentSchema.parse(payment)
    expect(result.currency).toBe('EUR')
  })
})

describe('Edge Cases', () => {
  it('should handle optional fields correctly', () => {
    const minimalProduct = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Simple Product',
      slug: 'simple-product',
      price: 1000,
    }

    const result = createProductSchema.parse(minimalProduct)
    expect(result.images).toEqual([])
    expect(result.options).toEqual([])
    expect(result.isActive).toBe(true)
    expect(result.isFeatured).toBe(false)
    expect(result.source).toBe('manual')
    expect(result.taxRate).toBe(0)
  })

  it('should validate URL fields', () => {
    const productWithInvalidUrl = {
      storeId: 'store123',
      categoryId: 'cat123',
      name: 'Test',
      slug: 'test',
      price: 1000,
      images: ['not-a-url'], // Invalid URL
    }

    expect(() => createProductSchema.parse(productWithInvalidUrl)).toThrow()
  })

  it('should validate email fields', () => {
    const invalidEmail = {
      storeId: 'store123',
      type: 'pickup',
      customerInfo: {
        name: 'Test',
        email: 'invalid-email', // Invalid email
      },
      items: [
        {
          productId: 'p1',
          productName: 'Test',
          quantity: 1,
          unitPrice: 1000,
          selectedOptions: [],
          subtotal: 1000,
        },
      ],
    }

    expect(() => createOrderSchema.parse(invalidEmail)).toThrow()
  })
})
