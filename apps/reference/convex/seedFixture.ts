import { internalMutation } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"

/**
 * The restaurant the e2e suite administers.
 *
 * `seed-users.mts` created six accounts and nothing else, so the `stores` table
 * stayed empty and every profile carried `storeIds: []`. Authentication then
 * succeeded and every admin screen still rendered nothing — the sidebar has no
 * restaurant to draw. Seventeen navigation tests failed on the same missing
 * locator, all of them describing this one absence.
 *
 * Internal on purpose: `internalMutation` is unreachable from a browser, so
 * this cannot be triggered on a deployment serving a real restaurant. It is
 * invoked by `scripts/seed-users.mts` through `npx convex run`, which
 * authenticates as the deployment itself.
 *
 * Idempotent throughout — seeding has to survive being run twice, which the
 * account step learned the hard way.
 */

const STORE_SLUG = "chez-luigi-test"

const HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  open: "09:00",
  close: "22:00",
  // Closed on Monday, so the "closed today" paths have something to show.
  isClosed: day === 1,
}))

const CATEGORIES = [
  { name: "Entrées", slug: "entrees", sortOrder: 0 },
  { name: "Plats", slug: "plats", sortOrder: 1 },
  { name: "Desserts", slug: "desserts", sortOrder: 2 },
]

/** Prices in cents, as everywhere else in this codebase. */
const PRODUCTS = [
  { category: "entrees", name: "Salade César", slug: "salade-cesar", price: 850 },
  { category: "entrees", name: "Soupe du jour", slug: "soupe-du-jour", price: 650 },
  { category: "plats", name: "Pizza Margherita", slug: "pizza-margherita", price: 1200 },
  { category: "plats", name: "Burger Classic", slug: "burger-classic", price: 1450 },
  { category: "desserts", name: "Tiramisu", slug: "tiramisu", price: 700 },
]

/** Roles that work in a restaurant, and therefore need it on their profile. */
const STAFF_ROLES = new Set(["client_admin", "manager", "kitchen", "waiter", "delivery"])

/**
 * A blog category, so the "Nouvel article" dialog has something to offer.
 *
 * Without one it replaces its form with "créez d'abord une catégorie", and four
 * tests about the form were really testing the absence of this row.
 */
const BLOG_CATEGORY = { name: "Actualités", slug: "actualites" }

/**
 * The sender address the email marketing needs before it will do anything.
 *
 * "Nouvelle campagne" stays disabled until `fromEmail` is set, which is correct
 * — and left eleven tests waiting on a button that is right to refuse. The
 * address is deliberately a `.test` domain: it is reserved by RFC 2606 and can
 * never be delivered to, so a run that unexpectedly sends mail fails loudly
 * rather than reaching a real inbox.
 */
const EMAIL_SENDER = {
  senderName: "Chez Luigi (test)",
  fromEmail: "no-reply@chez-luigi.test",
  replyToEmail: "contact@chez-luigi.test",
}

export const internalSeedFixture = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // --- The restaurant -----------------------------------------------------
    const existing = await ctx.db
      .query("stores")
      .filter((q) => q.eq(q.field("slug"), STORE_SLUG))
      .first()

    const storeId: Id<"stores"> =
      existing?._id ??
      (await ctx.db.insert("stores", {
        name: "Chez Luigi (test)",
        slug: STORE_SLUG,
        address: {
          street: "12 rue de la Paix",
          city: "Paris",
          postalCode: "75002",
          country: "FR",
          latitude: 48.8698,
          longitude: 2.3312,
        },
        hours: HOURS,
        status: "open" as const,
        createdAt: now,
        updatedAt: now,
      }))

    // --- Its catalogue ------------------------------------------------------
    const categoryIds = new Map<string, Id<"categories">>()

    for (const category of CATEGORIES) {
      const found = await ctx.db
        .query("categories")
        .filter((q) =>
          q.and(
            q.eq(q.field("storeId"), storeId),
            q.eq(q.field("slug"), category.slug)
          )
        )
        .first()

      categoryIds.set(
        category.slug,
        found?._id ??
          (await ctx.db.insert("categories", {
            storeId,
            name: category.name,
            slug: category.slug,
            sortOrder: category.sortOrder,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          }))
      )
    }

    let productsCreated = 0

    for (const product of PRODUCTS) {
      const found = await ctx.db
        .query("products")
        .filter((q) =>
          q.and(
            q.eq(q.field("storeId"), storeId),
            q.eq(q.field("slug"), product.slug)
          )
        )
        .first()
      if (found) continue

      await ctx.db.insert("products", {
        storeId,
        categoryId: categoryIds.get(product.category)!,
        name: product.name,
        slug: product.slug,
        price: product.price,
        taxRate: 10,
        images: [],
        options: [],
        allergens: [],
        tags: [],
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
        source: "manual",
        createdAt: now,
        updatedAt: now,
      })
      productsCreated += 1
    }

    // --- Give the staff somewhere to work -----------------------------------
    //
    // A profile with `storeIds: []` passes every role check and then fails the
    // tenant check on the first screen it opens. Customers keep an empty list:
    // that is what a customer is.
    const profiles = await ctx.db.query("userProfiles").collect()
    let profilesAttached = 0

    for (const profile of profiles) {
      if (!STAFF_ROLES.has(profile.role)) continue
      if (profile.storeIds.includes(storeId)) continue

      await ctx.db.patch(profile._id, {
        storeIds: [...profile.storeIds, storeId],
        updatedAt: now,
      })
      profilesAttached += 1
    }

    // --- One product that tracks its stock ----------------------------------
    //
    // The inventory editor only exists for a tracked product; with none, the
    // quantity column is a row of dashes and the test for its +/- buttons had
    // nothing to look at.
    const firstProduct = await ctx.db
      .query("products")
      .filter((q) =>
        q.and(
          q.eq(q.field("storeId"), storeId),
          q.eq(q.field("slug"), PRODUCTS[0]!.slug)
        )
      )
      .first()

    let stockTracked = false
    if (firstProduct && !firstProduct.stock?.tracked) {
      await ctx.db.patch(firstProduct._id, {
        stock: {
          tracked: true,
          quantity: 12,
          lowStockThreshold: 3,
          autoDisableWhenEmpty: false,
        },
        updatedAt: now,
      })
      stockTracked = true
    }

    // --- A blog category ----------------------------------------------------
    const existingBlogCategory = await ctx.db
      .query("blogCategories")
      .filter((q) =>
        q.and(
          q.eq(q.field("storeId"), storeId),
          q.eq(q.field("slug"), BLOG_CATEGORY.slug)
        )
      )
      .first()

    if (!existingBlogCategory) {
      await ctx.db.insert("blogCategories", {
        storeId,
        name: BLOG_CATEGORY.name,
        slug: BLOG_CATEGORY.slug,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      })
    }

    // --- The sender address -------------------------------------------------
    const existingEmailConfig = await ctx.db
      .query("emailConfig")
      .withIndex("by_storeId", (q) => q.eq("storeId", storeId))
      .first()

    if (!existingEmailConfig) {
      await ctx.db.insert("emailConfig", {
        storeId,
        senderName: EMAIL_SENDER.senderName,
        fromEmail: EMAIL_SENDER.fromEmail,
        replyToEmail: EMAIL_SENDER.replyToEmail,
        branding: {
          primaryColor: "#0D5C3F",
          secondaryColor: "#F97316",
          footerText: "Chez Luigi — établissement de test",
        },
        unsubscribeText: "Se désinscrire",
        maxEmailsPerWeek: 3,
        automationSettings: {
          welcomeEnabled: false,
          postOrderEnabled: false,
          birthdayEnabled: false,
          inactiveEnabled: false,
          abandonedCartEnabled: false,
        },
        createdAt: now,
        updatedAt: now,
      })
    }

    // --- Auto Blog on the owner accounts ------------------------------------
    //
    // Entitlements hang off the Better Auth user id, which is what
    // `getAccessStatus` reads from the session. Owners only: this grants a paid
    // feature, and a test deployment is the only place that is acceptable.
    let ownersEntitled = 0

    for (const profile of profiles) {
      if (profile.role !== "client_admin") continue

      const existingEntitlement = await ctx.db
        .query("ownerEntitlements")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", profile.userId))
        .first()

      const autoBlog = {
        enabled: true,
        plan: "pro" as const,
        monthlyQuota: 30,
        allowMultiLanguage: true,
        allowAutoPublish: true,
        monthlyImageQuota: 100,
      }

      if (existingEntitlement) {
        if (existingEntitlement.autoBlog.enabled) continue
        await ctx.db.patch(existingEntitlement._id, { autoBlog, updatedAt: now })
      } else {
        await ctx.db.insert("ownerEntitlements", {
          ownerId: profile.userId,
          autoBlog,
          imageToProduct: { enabled: true, monthlyAnalysisQuota: 50 },
          createdAt: now,
          updatedAt: now,
        })
      }
      ownersEntitled += 1
    }

    return {
      storeId,
      storeCreated: !existing,
      categories: categoryIds.size,
      productsCreated,
      profilesAttached,
      stockTracked,
      blogCategoryCreated: !existingBlogCategory,
      emailConfigured: !existingEmailConfig,
      ownersEntitled,
    }
  },
})
