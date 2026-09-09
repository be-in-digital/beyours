export { ProductsPage } from "./products-page"
export { NewProductPage } from "./new-product-page"
export { EditProductPage } from "./edit-product-page"
// Mounted by no screen — and deliberately kept (#413).
//
// Their back halves are live: `products.updateWithPropagation` and
// `products.duplicateCatalog` are registered as `storeMutation` in both apps,
// permission-guarded, and covered by `catalogue-scope.test.ts` and
// `authorization.test.ts`. `PropagationModal`'s `onConfirm(scope,
// targetStoreIds)` is an exact match for `updateWithPropagation`'s validator.
//
// So these are not the front half of an unbuilt feature, they are the unmounted
// UI of a built one — multi-store propagation, which is what "1 restaurant
// owner = 1-∞ locations" is made of. That closes by wiring them into the
// product screen, which is a change with its own review, not by deleting them:
// the same reasoning `tasks/reference-themes-divergence.md` gives for keeping
// `ProductCard` and `QuantitySelector`.
export { PropagationModal } from "./propagation-modal"
export { DuplicateCatalogModal } from "./duplicate-catalog-modal"
export { MenusTab } from "./menus-tab"
export { MenuFormDialog } from "./menu-form-dialog"
export { ImageToProductPage } from "./image-to-product"
// The one allergen control, shared by the product form and the AI review card.
// Exported so a third writer of `products.allergens` reuses it rather than
// growing a second vocabulary, which is how the four allergen surfaces diverged.
export { AllergenField } from "./allergen-field"
export type { AllergenFieldProps } from "./allergen-field"
export {
  readAllergenSelection,
  isAllergenSelected,
  toggleAllergenValue,
  addAllergenValue,
  removeAllergenValue,
  isDeclarableAllergenValue,
} from "./allergen-selection"
export type {
  AllergenOption,
  AllergenSelection,
  UnverifiedAllergen,
} from "./allergen-selection"
