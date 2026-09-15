export { ProductsPage } from "./products-page"
export { NewProductPage } from "./new-product-page"
export { EditProductPage } from "./edit-product-page"
// Mounted, since #525. They were exported and rendered by nothing for as long
// as they had existed, while their back halves were live the whole time:
// `products.updateWithPropagation` and `products.duplicateCatalog` are
// registered as `storeMutation` in both apps, permission-guarded, and covered
// by `catalogue-scope.test.ts` and `authorization.test.ts`. So multi-store
// propagation — what "1 restaurant owner = 1-∞ locations" is made of — existed
// everywhere except on a screen, and the feature ledger counted it as shipping.
//
// This comment used to say the gap closed "by wiring them into the product
// screen, which is a change with its own review". It did, and the review was
// #525. `DuplicateCatalogModal` is a toolbar action on `ProductsPage`, offered
// only to an owner who has a second establishment; `PropagationModal` opens
// after a successful save on `EditProductPage`, for the same owner.
//
// `every-exported-screen-has-a-door.test.ts` is what keeps it true: a component
// exported from a barrel here and rendered nowhere in the monorepo now fails.
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
