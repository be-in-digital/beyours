// @be-in-digital/convex-schema
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

// Typed data model (type-only): SchemaDataModel, Doc<>, SchemaQueryCtx…
export * from "./dataModel"
