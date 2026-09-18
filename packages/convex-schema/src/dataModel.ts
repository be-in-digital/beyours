/**
 * Typed data model derived from the composed schema — type-only, zero runtime.
 *
 * This is the contract that lets @be-yours/convex-functions type its
 * handlers (`ctx: SchemaQueryCtx`) instead of `ctx: any`: schema drift then
 * surfaces at the package's own type-check, not at each consuming app's.
 * Structurally identical to every app's generated DataModel (apps compose
 * their schema from the same tables), so contexts flow through unchanged.
 */

import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  TableNamesInDataModel,
} from "convex/server"
import type { GenericId } from "convex/values"
import type schema from "./schema"

export type SchemaDataModel = DataModelFromSchemaDefinition<typeof schema>

export type TableName = TableNamesInDataModel<SchemaDataModel>

/** `Doc<"games">` — the stored document type of a table. */
export type Doc<T extends TableName> = DocumentByName<SchemaDataModel, T>

/** `DocId<"games">` — the id type of a table. */
export type DocId<T extends TableName> = GenericId<T>

export type SchemaQueryCtx = GenericQueryCtx<SchemaDataModel>
export type SchemaMutationCtx = GenericMutationCtx<SchemaDataModel>
export type SchemaActionCtx = GenericActionCtx<SchemaDataModel>
