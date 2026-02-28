/**
 * CMS Registry
 *
 * Central registry of all CMS-editable pages and their content zones.
 * Used by admin UI (form generation), validation (mutations), and storefront (fallback logic).
 */

import type { PageDefinition, BlockDefinition, FieldDefinition } from "./types"
import { signInPage } from "./pages/sign-in"
import { signUpPage } from "./pages/sign-up"
import { forgotPasswordPage } from "./pages/forgot-password"
import { homepagePage } from "./pages/homepage"
import { menuPage } from "./pages/menu"
import { cartPage } from "./pages/cart"
import { checkoutPage } from "./pages/checkout"
import { storeSelectorPage } from "./pages/store-selector"
import { accountPage } from "./pages/account"
import { accountOrdersPage } from "./pages/account-orders"
import { accountAddressesPage } from "./pages/account-addresses"
import { accountFavoritesPage } from "./pages/account-favorites"
import { orderTrackingPage } from "./pages/order-tracking"
import { productDetailPage } from "./pages/product-detail"
import { categoryMenuPage } from "./pages/category-menu"
import { gamePage } from "./pages/game"
import { storefrontLayoutPage } from "./pages/storefront-layout"

/** Central registry mapping page slugs to their definitions */
export const cmsRegistry: Record<string, PageDefinition> = {
  "sign-in": signInPage,
  "sign-up": signUpPage,
  "forgot-password": forgotPasswordPage,
  homepage: homepagePage,
  menu: menuPage,
  cart: cartPage,
  checkout: checkoutPage,
  "store-selector": storeSelectorPage,
  account: accountPage,
  "account-orders": accountOrdersPage,
  "account-addresses": accountAddressesPage,
  "account-favorites": accountFavoritesPage,
  "order-tracking": orderTrackingPage,
  "product-detail": productDetailPage,
  "category-menu": categoryMenuPage,
  game: gamePage,
  "storefront-layout": storefrontLayoutPage,
}

/** Get the definition for a page by its slug */
export function getPageDefinition(slug: string): PageDefinition | undefined {
  return cmsRegistry[slug]
}

/** Get all registered page slugs */
export function getAllPageSlugs(): string[] {
  return Object.keys(cmsRegistry)
}

/** Get a block definition within a page */
export function getBlockDefinition(
  pageSlug: string,
  blockKey: string,
): BlockDefinition | undefined {
  const page = cmsRegistry[pageSlug]
  if (!page) return undefined
  return page.blocks.find((b) => b.key === blockKey)
}

/** Get a field definition within a block */
export function getFieldDefinition(
  pageSlug: string,
  blockKey: string,
  fieldKey: string,
): FieldDefinition | undefined {
  const block = getBlockDefinition(pageSlug, blockKey)
  if (!block) return undefined
  return block.fields[fieldKey]
}
