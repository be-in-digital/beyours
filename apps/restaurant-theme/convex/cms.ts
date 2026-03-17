import { query, mutation, internalMutation } from "./_generated/server"
import * as defs from "@beindigital-engine/convex-functions/cms"

// ─── Global Config ───────────────────────────────────────────────────────────

export const getGlobalConfig = query(defs.getGlobalConfig)
export const updateGlobalConfig = mutation(defs.updateGlobalConfig)

// ─── Page Queries ────────────────────────────────────────────────────────────

export const getHomePage = query(defs.getHomePage)
export const getMenuPage = query(defs.getMenuPage)
export const getAboutPage = query(defs.getAboutPage)
export const getContactPage = query(defs.getContactPage)
export const getCartConfig = query(defs.getCartConfig)
export const getCheckoutPage = query(defs.getCheckoutPage)
export const getTrackingPage = query(defs.getTrackingPage)
export const getSigninPage = query(defs.getSigninPage)
export const getSignupPage = query(defs.getSignupPage)
export const getPrivacyPage = query(defs.getPrivacyPage)
export const getTermsPage = query(defs.getTermsPage)
export const get404Page = query(defs.get404Page)
export const getMaintenancePage = query(defs.getMaintenancePage)
export const getAccountPage = query(defs.getAccountPage)

// ─── Page Mutations ──────────────────────────────────────────────────────────

export const updateHomePage = mutation(defs.updateHomePage)
export const updateMenuPage = mutation(defs.updateMenuPage)
export const updateAboutPage = mutation(defs.updateAboutPage)
export const updateContactPage = mutation(defs.updateContactPage)
export const updateCartConfig = mutation(defs.updateCartConfig)
export const updateCheckoutPage = mutation(defs.updateCheckoutPage)
export const updateTrackingPage = mutation(defs.updateTrackingPage)
export const updateSigninPage = mutation(defs.updateSigninPage)
export const updateSignupPage = mutation(defs.updateSignupPage)
export const updatePrivacyPage = mutation(defs.updatePrivacyPage)
export const updateTermsPage = mutation(defs.updateTermsPage)
export const update404Page = mutation(defs.update404Page)
export const updateMaintenancePage = mutation(defs.updateMaintenancePage)
export const updateAccountPage = mutation(defs.updateAccountPage)

// ─── Blog Posts ──────────────────────────────────────────────────────────────

export const listBlogPosts = query(defs.listBlogPosts)
export const getBlogPost = query(defs.getBlogPost)
export const createBlogPost = mutation(defs.createBlogPost)
export const updateBlogPost = mutation(defs.updateBlogPost)
export const deleteBlogPost = mutation(defs.deleteBlogPost)

// ─── Seed ────────────────────────────────────────────────────────────────────

export const seedInitialCMS = internalMutation(defs.seedInitialCMS)
