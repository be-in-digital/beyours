// @be-yours/convex-schema
// Package exports

// Table definitions (for composing app schemas)
export * from "./tables"

// Full composed schema (for reference)
export { default as schema } from "./schema"

// Zod validators
export * from "./validators"

// TypeScript types
export * from "./types"

// Order status machine — shared by the services, the admin UI and updateStatus
export * from "./orderStatus"

// Store publication rule — shared by stores.list, orders.create and the storefront
export * from "./storeStatus"

// Recurring time windows — shared by product scheduling, happy-hour promotions
// and the storefront menu, which used to answer the question differently
export * from "./timeWindow"

// The weekly opening schedule — shared by orders.create and the storefront
export * from "./openingHours"

// Which services an establishment offers — shared by orders.create and the
// storefront's order-type selector
export * from "./storeServices"

// Where « Réserver une table » points — shared by the admin form, the mutation
// that writes it and the storefront that renders it into an href
export * from "./reservationUrl"

// Typed data model (type-only): SchemaDataModel, Doc<>, SchemaQueryCtx…
export * from "./dataModel"
