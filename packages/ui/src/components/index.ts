/**
 * The design system's public surface.
 *
 * One implementation per component, living here. Until this convergence the
 * apps carried their own `components/ui/` — 37 files, byte-identical between
 * the two apps and divergent from this package — and `packages/admin` carried
 * a third copy of nine of them. A default Button was `h-10` here and `h-9`
 * there, so the same storefront rendered two button heights depending on which
 * page you were on, and twelve files imported from both systems at once.
 *
 * The newer generation won: `data-slot` attributes the e2e suite and
 * `globals.css` already select on, `size-*` utilities, Tailwind v4 focus rings,
 * `aria-invalid` states. What the package copies had and the app copies had
 * lost — the dialog's `max-h`/`overflow-y-auto` fix, the Alert's `warning` and
 * `success` variants — was merged back in rather than dropped.
 */

// Layout
export * from "./Container"
export * from "./Section"
export * from "./PageHeader"
export * from "./ScrollArea"

// Navigation
export * from "./Navbar"
export * from "./Breadcrumb"
export * from "./Tabs"
export * from "./Sidebar"
export * from "./Sheet"

// Form
export * from "./Button"
export * from "./ButtonGroup"
export * from "./Label"
export * from "./Input"
export * from "./InputGroup"
export * from "./SearchInput"
export * from "./Textarea"
export * from "./Select"
export * from "./Checkbox"
export * from "./RadioGroup"
export * from "./Switch"
export * from "./Slider"
export * from "./FormField"

// Display
export * from "./Badge"
export * from "./Card"
export * from "./Avatar"
export * from "./Table"
export * from "./Dialog"
export * from "./AlertDialog"
export * from "./Popover"
export * from "./Tooltip"
export * from "./Toast"
export * from "./Skeleton"
export * from "./Spinner"
export * from "./EmptyState"
export * from "./Empty"
export * from "./Alert"
export * from "./Separator"
export * from "./DropdownMenu"
export * from "./Pagination"
export * from "./DataTable"
export * from "./AddressAutocomplete"
export * from "./Accordion"
export * from "./Collapsible"
export * from "./Carousel"
export * from "./Chart"
export * from "./Progress"
