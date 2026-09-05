export { ProductsPage } from "./products-page"
export { NewProductPage } from "./new-product-page"
export { EditProductPage } from "./edit-product-page"
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
