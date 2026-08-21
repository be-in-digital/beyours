import { query } from "./_generated/server";
import * as defs from "@be-in-digital/convex-functions/translations";
import { storeMutation, storeIdFromDocument } from "./lib/storeFunctions";

// PUBLIC BY DESIGN — these read translations of already-public content (product
// names, category labels, storefront UI strings). The storefront renders them
// for anonymous visitors, so requiring auth here would break the language
// switcher. Nothing store-confidential passes through them.
export const getForEntity = query(defs.getForEntity);
export const getByLanguage = query(defs.getByLanguage);
export const getUIOverrides = query(defs.getUIOverrides);

// Writes are a different matter: these used to check only that the caller was
// logged in, so any account could rewrite another restaurant's translations.
export const upsert = storeMutation({
  args: defs.upsert.args,
  handler: (ctx, args) => defs.upsert.handler(ctx, args),
});

export const bulkUpsert = storeMutation({
  args: defs.bulkUpsert.args,
  handler: (ctx, args) => defs.bulkUpsert.handler(ctx, args),
});

export const remove = storeMutation({
  args: defs.remove.args,
  storeIdFrom: storeIdFromDocument("Translation not found"),
  handler: (ctx, args) => defs.remove.handler(ctx, args),
});
