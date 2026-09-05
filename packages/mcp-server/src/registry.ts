import {
  PACKAGE_VERSIONS,
  type RegisteredPackage,
} from "./package-versions.js";

export interface PackageExport {
  name: string;
  type:
    | "component"
    | "hook"
    | "store"
    | "service"
    | "type"
    | "function"
    | "utility"
    | "constant"
    | "validator"
    | "enum"
    | "class"
    | "provider"
    | "hoc";
  description: string;
  importPath: string;
  props?: Record<
    string,
    { type: string; required: boolean; description: string }
  >;
  params?: Record<string, { type: string; description: string }>;
  returnType?: string;
  example?: string;
  tags?: string[];
}

export interface PackageInfo {
  /** Directory name under `packages/`, which is also the key into PACKAGE_VERSIONS. */
  name: RegisteredPackage;
  scope: string;
  description: string;
  /**
   * Always `PACKAGE_VERSIONS[name]`. Never a literal: the nine hand-typed
   * versions here all said 2.0.1 while admin had reached 8.0.0.
   */
  version: string;
  category: "frontend" | "backend" | "shared" | "tooling";
  dependencies: string[];
  peerDependencies?: string[];
  exports: PackageExport[];
  installCommand: string;
  setupSteps?: string[];
}

export const packages: PackageInfo[] = [
  {
    name: "ui",
    scope: "@be-in-digital/ui",
    description:
      "React UI component library built on Radix UI and Tailwind CSS v4. The engine's one design system: 59 accessible, themeable components for storefront and admin interfaces, published as TypeScript source and imported from the root specifier.",
    version: PACKAGE_VERSIONS["ui"],
    category: "frontend",
    dependencies: [
      "lucide-react",
      "radix-ui",
      "clsx",
      "class-variance-authority",
      "tailwind-merge",
      "recharts",
      "embla-carousel-react",
    ],
    peerDependencies: [
      "react@^19",
      "react-dom@^19",
      "react-hook-form@^7",
      "@hookform/resolvers@^3",
    ],
    installCommand: "pnpm add @be-in-digital/ui",
    setupSteps: [
      "Add the package: pnpm add @be-in-digital/ui",
      "Configure Tailwind to scan: content: ['./node_modules/@be-in-digital/ui/**/*.{js,ts,jsx,tsx}']",
      "Import components: import { Button, Card } from '@be-in-digital/ui'",
    ],
    exports: [
      {
        name: "Container",
        type: "component",
        description: "Responsive container with max-width constraint",
        importPath: "@be-in-digital/ui",
        tags: ["layout"],
      },
      {
        name: "Section",
        type: "component",
        description: "Semantic section wrapper with consistent spacing",
        importPath: "@be-in-digital/ui",
        tags: ["layout"],
      },
      {
        name: "PageHeader",
        type: "component",
        description: "Page title with optional breadcrumb and actions",
        importPath: "@be-in-digital/ui",
        tags: ["layout"],
        props: {
          title: {
            type: "string",
            required: true,
            description: "Page title",
          },
          description: {
            type: "string",
            required: false,
            description: "Page description",
          },
          actions: {
            type: "ReactNode",
            required: false,
            description: "Action buttons",
          },
        },
      },
      {
        name: "Button",
        type: "component",
        description:
          "Primary action button with variants and sizes",
        importPath: "@be-in-digital/ui",
        tags: ["form", "action"],
        props: {
          variant: {
            type: "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'",
            required: false,
            description: "Visual style variant",
          },
          size: {
            type: "'default' | 'sm' | 'lg' | 'icon'",
            required: false,
            description: "Button size",
          },
          disabled: {
            type: "boolean",
            required: false,
            description: "Disable button",
          },
        },
        example: '<Button variant="destructive" size="sm">Delete</Button>',
      },
      {
        name: "Input",
        type: "component",
        description: "Text input field",
        importPath: "@be-in-digital/ui",
        tags: ["form"],
        example: '<Input placeholder="Email" type="email" />',
      },
      {
        name: "SearchInput",
        type: "component",
        description: "Search input with icon and clear button",
        importPath: "@be-in-digital/ui",
        tags: ["form", "search"],
      },
      {
        name: "Textarea",
        type: "component",
        description: "Multi-line text input",
        importPath: "@be-in-digital/ui",
        tags: ["form"],
      },
      {
        name: "Select",
        type: "component",
        description: "Dropdown select with Radix UI",
        importPath: "@be-in-digital/ui",
        tags: ["form"],
      },
      {
        name: "Checkbox",
        type: "component",
        description: "Checkbox input with label",
        importPath: "@be-in-digital/ui",
        tags: ["form"],
      },
      {
        name: "Switch",
        type: "component",
        description: "Toggle switch",
        importPath: "@be-in-digital/ui",
        tags: ["form"],
      },
      {
        name: "Slider",
        type: "component",
        description: "Range slider input",
        importPath: "@be-in-digital/ui",
        tags: ["form"],
      },
      {
        name: "FormField",
        type: "component",
        description: "Form field with label, input, error and description",
        importPath: "@be-in-digital/ui",
        tags: ["form"],
      },
      {
        name: "Badge",
        type: "component",
        description:
          "Status badge. Variants: default, secondary, destructive, outline, ghost, link.",
        importPath: "@be-in-digital/ui",
        tags: ["display"],
        example: '<Badge variant="secondary">Active</Badge>',
      },
      {
        name: "Card",
        type: "component",
        description: "Content card with header, body, footer",
        importPath: "@be-in-digital/ui",
        tags: ["display", "layout"],
      },
      {
        name: "Avatar",
        type: "component",
        description: "User avatar with fallback initials",
        importPath: "@be-in-digital/ui",
        tags: ["display"],
      },
      {
        name: "Table",
        type: "component",
        description: "Data table with header, body, footer",
        importPath: "@be-in-digital/ui",
        tags: ["display", "data"],
      },
      {
        name: "DataTable",
        type: "component",
        description:
          "Advanced data table with sorting, filtering, pagination",
        importPath: "@be-in-digital/ui",
        tags: ["display", "data"],
      },
      {
        name: "Dialog",
        type: "component",
        description: "Modal dialog with Radix UI",
        importPath: "@be-in-digital/ui",
        tags: ["overlay"],
      },
      {
        name: "AlertDialog",
        type: "component",
        description: "Confirmation dialog for destructive actions",
        importPath: "@be-in-digital/ui",
        tags: ["overlay"],
      },
      {
        name: "Toast",
        type: "component",
        description: "Toast notification system",
        importPath: "@be-in-digital/ui",
        tags: ["feedback"],
      },
      {
        name: "Skeleton",
        type: "component",
        description: "Loading skeleton placeholder",
        importPath: "@be-in-digital/ui",
        tags: ["feedback", "loading"],
      },
      {
        name: "Spinner",
        type: "component",
        description: "Loading spinner animation",
        importPath: "@be-in-digital/ui",
        tags: ["feedback", "loading"],
      },
      {
        name: "EmptyState",
        type: "component",
        description: "Empty state with icon, title and action",
        importPath: "@be-in-digital/ui",
        tags: ["feedback"],
      },
      {
        name: "Tooltip",
        type: "component",
        description: "Hover tooltip",
        importPath: "@be-in-digital/ui",
        tags: ["overlay"],
      },
      {
        name: "Popover",
        type: "component",
        description: "Floating content popover",
        importPath: "@be-in-digital/ui",
        tags: ["overlay"],
      },
      {
        name: "DropdownMenu",
        type: "component",
        description: "Context menu dropdown",
        importPath: "@be-in-digital/ui",
        tags: ["navigation", "overlay"],
      },
      {
        name: "Pagination",
        type: "component",
        description: "Page navigation controls",
        importPath: "@be-in-digital/ui",
        tags: ["navigation"],
      },
      {
        name: "AddressAutocomplete",
        type: "component",
        description: "Google Maps address autocomplete input",
        importPath: "@be-in-digital/ui",
        tags: ["form", "maps"],
      },
      {
        name: "ProductCard",
        type: "component",
        description:
          "Product display card with image, name, price and add-to-cart",
        importPath: "@be-in-digital/ui",
        tags: ["restaurant", "product"],
      },
      {
        name: "CartItem",
        type: "component",
        description: "Cart line item with quantity controls",
        importPath: "@be-in-digital/ui",
        tags: ["restaurant", "cart"],
      },
      {
        name: "OrderStatusBadge",
        type: "component",
        description: "Order status badge with color coding",
        importPath: "@be-in-digital/ui",
        tags: ["restaurant", "order"],
      },
      {
        name: "QuantitySelector",
        type: "component",
        description: "Increment/decrement quantity control",
        importPath: "@be-in-digital/ui",
        tags: ["restaurant", "form"],
      },
      {
        name: "PriceDisplay",
        type: "component",
        description: "Formatted price display with currency",
        importPath: "@be-in-digital/ui",
        tags: ["restaurant", "display"],
      },
      {
        name: "AllergenBadge",
        type: "component",
        description:
          "Food allergen badge. Takes any string from products.allergens — never cast it to Allergen. Recognised names (French or English) render with an icon and their canonical label; an unrecognised one renders as the owner typed it and is announced as the restaurant's own wording, not as an allergen. Vocabulary and matching live in @be-in-digital/core/allergens.",
        importPath: "@be-in-digital/ui",
        tags: ["restaurant", "product", "allergens"],
      },
      {
        name: "SpiceLevelIndicator",
        type: "component",
        description: "Spice level visual indicator (1-5)",
        importPath: "@be-in-digital/ui",
        tags: ["restaurant", "product"],
      },
      {
        name: "StoreStatusBadge",
        type: "component",
        description: "Store open/closed status badge",
        importPath: "@be-in-digital/ui",
        tags: ["restaurant", "store"],
      },
      {
        name: "AdminLayout",
        type: "component",
        description: "Admin dashboard layout with sidebar navigation",
        importPath: "@be-in-digital/ui",
        tags: ["admin", "layout"],
      },
      {
        name: "StatCard",
        type: "component",
        description: "KPI statistic card with trend indicator",
        importPath: "@be-in-digital/ui",
        tags: ["admin", "display"],
      },
      {
        name: "ActionBar",
        type: "component",
        description: "Action toolbar for page-level actions",
        importPath: "@be-in-digital/ui",
        tags: ["admin", "layout"],
      },
      {
        name: "FilterBar",
        type: "component",
        description: "Filter controls bar for lists",
        importPath: "@be-in-digital/ui",
        tags: ["admin", "filter"],
      },
      {
        name: "StatusTimeline",
        type: "component",
        description: "Timeline of status changes",
        importPath: "@be-in-digital/ui",
        tags: ["admin", "display"],
      },
      {
        name: "cn",
        type: "utility",
        description: "Merge class names with clsx + tailwind-merge",
        importPath: "@be-in-digital/ui",
        tags: ["utility"],
        example: "cn('px-4 py-2', isActive && 'bg-primary text-white')",
        returnType: "string",
      },
    ],
  },
  {
    name: "core",
    scope: "@be-in-digital/core",
    description:
      "Core services: authentication with RBAC (7 roles, 15 resources, 10 actions), i18n with GPT auto-translation, AWS (S3 + SES), and Sentry.",
    version: PACKAGE_VERSIONS["core"],
    category: "shared",
    dependencies: ["zod"],
    peerDependencies: ["react@^19", "react-dom@^19"],
    installCommand: "pnpm add @be-in-digital/core",
    setupSteps: [
      "Install: pnpm add @be-in-digital/core",
      "Set env vars: OPENAI_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, AWS_SES_FROM_EMAIL",
      "Wrap app with AuthProvider: <AuthProvider>{children}</AuthProvider>",
      "Use auth hooks: const { user, isAuthenticated } = useAuth()",
    ],
    exports: [
      {
        name: "Role",
        type: "enum",
        description:
          "User roles: SUPER_ADMIN, OWNER, MANAGER, CHEF, CASHIER, WAITER, VIEWER",
        importPath: "@be-in-digital/core",
        tags: ["auth", "rbac"],
      },
      {
        name: "Resource",
        type: "enum",
        description:
          "15 protected resources: STORE, PRODUCT, ORDER, KITCHEN, PAYMENT, LANGUAGE, GAME, TEAM, SETTINGS, DESIGN, INTEGRATION, EMAIL, CMS, BLOG, SYSTEM",
        importPath: "@be-in-digital/core",
        tags: ["auth", "rbac"],
      },
      {
        name: "Action",
        type: "enum",
        description:
          "10 actions: CREATE, READ, UPDATE, DELETE, MANAGE, EXPORT, IMPORT, APPROVE, REJECT, PUBLISH",
        importPath: "@be-in-digital/core",
        tags: ["auth", "rbac"],
      },
      {
        name: "hasPermission",
        type: "function",
        description: "Check if a role has a specific permission",
        importPath: "@be-in-digital/core",
        tags: ["auth", "rbac"],
        params: {
          role: { type: "Role", description: "User's role" },
          permission: {
            type: "Permission",
            description: "Permission to check (resource:action)",
          },
        },
        returnType: "boolean",
        example: "hasPermission(Role.MANAGER, 'product:create') // true",
      },
      {
        name: "requirePermission",
        type: "function",
        description:
          "Throw PermissionDeniedError if role lacks permission",
        importPath: "@be-in-digital/core",
        tags: ["auth", "rbac"],
      },
      {
        name: "PermissionDeniedError",
        type: "class",
        description: "Error thrown when permission check fails",
        importPath: "@be-in-digital/core",
        tags: ["auth", "rbac", "error"],
      },
      {
        name: "AuthProvider",
        type: "provider",
        description: "React context provider for authentication state",
        importPath: "@be-in-digital/core",
        tags: ["auth", "react"],
        example: "<AuthProvider><App /></AuthProvider>",
      },
      {
        name: "useAuth",
        type: "hook",
        description:
          "Access auth state: user, session, isAuthenticated, signIn, signOut",
        importPath: "@be-in-digital/core",
        tags: ["auth", "react"],
        returnType:
          "{ user, session, isAuthenticated, signIn, signOut, signUp }",
      },
      {
        name: "useUser",
        type: "hook",
        description: "Get current user data",
        importPath: "@be-in-digital/core",
        tags: ["auth", "react"],
        returnType: "User | null",
      },
      {
        name: "usePermission",
        type: "hook",
        description: "Check if current user has a specific permission",
        importPath: "@be-in-digital/core",
        tags: ["auth", "react", "rbac"],
        example: "const canCreate = usePermission('product:create')",
      },
      {
        name: "CanAccessProps",
        type: "type",
        description:
          "Props of the permission gate. The component itself is NOT shipped — it needs JSX, so each app implements it over usePermission and types it with CanAccessComponent.",
        importPath: "@be-in-digital/core",
        tags: ["auth", "react", "rbac"],
        example:
          "export function CanAccess({ permission, children, fallback }: CanAccessProps) {\n  const { allowed, loading } = usePermission(permission)\n  if (loading) return null\n  return allowed ? <>{children}</> : fallback ? <>{fallback}</> : null\n}",
      },
      {
        name: "CanAccessComponent",
        type: "type",
        description:
          "Signature the app's CanAccess implementation must satisfy: (props: CanAccessProps) => ReactNode",
        importPath: "@be-in-digital/core",
        tags: ["auth", "react", "rbac"],
      },
      {
        name: "RoleGateProps",
        type: "type",
        description:
          "Props of the role gate. As with CanAccess, the component is implemented in the app — the package ships the contract, not the JSX.",
        importPath: "@be-in-digital/core",
        tags: ["auth", "react", "rbac"],
      },
      {
        name: "RoleGateComponent",
        type: "type",
        description:
          "Signature the app's RoleGate implementation must satisfy: (props: RoleGateProps) => ReactNode",
        importPath: "@be-in-digital/core",
        tags: ["auth", "react", "rbac"],
      },
      {
        name: "getServerSession",
        type: "function",
        description: "Get session on server-side (RSC/API)",
        importPath: "@be-in-digital/core",
        tags: ["auth", "server"],
      },
      {
        name: "requireAuth",
        type: "function",
        description: "Middleware: require authentication",
        importPath: "@be-in-digital/core",
        tags: ["auth", "server", "middleware"],
      },
      {
        name: "withAuthRoute",
        type: "function",
        description: "Wrap API route with auth check",
        importPath: "@be-in-digital/core",
        tags: ["auth", "server", "api"],
      },
      {
        name: "detectLocale",
        type: "function",
        description:
          "Detect user locale from cookie > localStorage > browser > header",
        importPath: "@be-in-digital/core",
        tags: ["i18n", "detection"],
        returnType: "string",
      },
      {
        name: "createTranslator",
        type: "function",
        description: "Create a translation function for a locale",
        importPath: "@be-in-digital/core",
        tags: ["i18n", "translation"],
        example:
          "const t = createTranslator(translations, 'fr')\nt('product.name')",
      },
      {
        name: "translateText",
        type: "function",
        description:
          "Translate text using GPT-3.5-turbo (~$0.001/product)",
        importPath: "@be-in-digital/core",
        tags: ["i18n", "gpt", "translation"],
      },
      {
        name: "batchTranslate",
        type: "function",
        description: "Translate multiple texts in batch",
        importPath: "@be-in-digital/core",
        tags: ["i18n", "gpt", "translation"],
      },
      {
        name: "estimateTranslationCost",
        type: "function",
        description: "Estimate GPT translation cost before running",
        importPath: "@be-in-digital/core",
        tags: ["i18n", "gpt", "cost"],
      },
      {
        name: "RTL_LANGUAGES",
        type: "constant",
        description: "List of right-to-left language codes",
        importPath: "@be-in-digital/core",
        tags: ["i18n"],
      },
      {
        name: "COMMON_LANGUAGES",
        type: "constant",
        description:
          "Pre-configured language definitions with names and flags",
        importPath: "@be-in-digital/core",
        tags: ["i18n"],
      },
      {
        name: "createS3Service",
        type: "function",
        description:
          "Builds the S3 service. The AWS SDK is injected, not imported: pass an S3Operations client so the package stays runtime-agnostic. The returned S3Service carries upload, getPresignedUploadUrl, getPresignedDownloadUrl, delete, getPublicUrl, exists and getMetadata.",
        importPath: "@be-in-digital/core",
        params: {
          config: {
            type: "S3Config",
            description: "Bucket, region and public base URL",
          },
          client: {
            type: "S3Operations",
            description:
              "Injected AWS SDK adapter (putObject, deleteObject, headObject, getSignedUrl)",
          },
        },
        returnType: "S3Service",
        tags: ["aws", "s3", "storage"],
        example:
          "const s3 = createS3Service(config, client)\nconst { key, url } = await s3.upload(buffer, { folder: 'products', contentType: 'image/webp' })",
      },
      {
        name: "S3Service",
        type: "type",
        description:
          "The S3 surface returned by createS3Service. There is no free-standing uploadToS3 function — uploading goes through an instance.",
        importPath: "@be-in-digital/core",
        tags: ["aws", "s3", "storage"],
      },
      {
        name: "createSESService",
        type: "function",
        description:
          "Builds the SES service over an injected SESOperations client. The returned SESService carries sendEmail, sendTemplatedEmail and sendBulkEmail (rate-limited to the SES sandbox ceiling).",
        importPath: "@be-in-digital/core",
        params: {
          config: {
            type: "SESConfig",
            description: "fromEmail, optional fromName and replyToEmail",
          },
          client: {
            type: "SESOperations",
            description:
              "Injected SES adapter — createSESv2Operations(config) builds one over @aws-sdk/client-sesv2",
          },
        },
        returnType: "SESService",
        tags: ["aws", "ses", "email"],
        example:
          "const ses = createSESService(config, createSESv2Operations(awsConfig))\nawait ses.sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' })",
      },
      {
        name: "getSESService",
        type: "function",
        description:
          "Server-side shortcut: reads the SES configuration from the environment and returns a ready SESService. Use it instead of wiring createSESService by hand in a route handler.",
        importPath: "@be-in-digital/core",
        returnType: "SESService",
        tags: ["aws", "ses", "email"],
      },
      {
        name: "SESService",
        type: "type",
        description:
          "The SES surface returned by createSESService. sendEmail and sendTemplatedEmail are methods on it, not module-level functions.",
        importPath: "@be-in-digital/core",
        tags: ["aws", "ses", "email"],
      },
      {
        name: "resolveSentryOptions",
        type: "function",
        description: "Builds the Sentry.init options for one runtime ('browser' | 'server' | 'edge') from the environment, or returns null when NEXT_PUBLIC_SENTRY_DSN is unset or is not a DSN — in which case the app must skip Sentry.init entirely. One Sentry project per client: the DSN is the isolation. Import-free, so the browser bundle, the edge runtime and Convex can all read it. See apps/docs/deployment/sentry.md.",
        importPath: "@be-in-digital/core/sentry",
        tags: ["monitoring", "sentry", "env"],
      },
      {
        name: "isSentryDsn",
        type: "function",
        description: "True when a string is a Sentry DSN (https://<key>@<host>/<projectId>). The env schema only checks that the DSN is a URL, so a project-page URL pasted by mistake is caught here instead of silently disabling reporting.",
        importPath: "@be-in-digital/core/sentry",
        tags: ["monitoring", "sentry", "validation"],
      },
      {
        name: "packageEnvSchema",
        type: "validator",
        description: "Zod schema for the 11 BeYours platform-level env vars (AWS, OpenAI, Uber Eats, Uber Direct, Deliveroo). Strict: parsing throws when a required one is missing.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation", "zod"],
      },
      {
        name: "siteEnvRequiredSchema",
        type: "validator",
        description: "Strict Zod schema for the 7 site vars a restaurant deployment cannot boot without (NEXT_PUBLIC_CONVEX_URL, CONVEX_SITE_URL, SITE_URL, BETTER_AUTH_SECRET min 32 chars, ENCRYPTION_KEY, AWS_S3_BUCKET_NAME, AWS_SES_FROM_EMAIL). Declared without the optional-empty helper, so an empty value fails like a missing one. Used by validateAllEnv() at startup, never by the runtime getters.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation", "zod", "startup"],
      },
      {
        name: "siteEnvOptionalSchema",
        type: "validator",
        description: "Zod schema for the 34 optional site vars, refined with the SITE_FEATURE_GROUPS all-or-nothing rules. Used by validateAllEnv() at startup, never by the runtime getters.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation", "zod", "startup"],
      },
      {
        name: "SITE_FEATURE_GROUPS",
        type: "constant",
        description: "Features that are all-or-nothing: setting any variable of a group makes the whole group required (Stripe, PayPal, SumUp, BeYours billing). Half a payment provider fails at the till, not at boot.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation"],
        returnType: "{ feature: string; vars: readonly string[] }[]",
      },
      {
        name: "siteEnvSchema",
        type: "validator",
        description: "LENIENT Zod reader over both site tiers - every field optional. What getSiteEnv() parses, kept permissive because it runs inside Convex actions where the deployment holds only a subset of the vars. Boot-time enforcement belongs to siteEnvRequiredSchema / siteEnvOptionalSchema.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation", "zod"],
      },
      {
        name: "getPackageEnv",
        type: "function",
        description: "Get validated platform env vars (lazy-loaded, memoized). Throws ZodError if required vars are missing.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation"],
        returnType: "PackageEnv",
        example: "const { OPENAI_API_KEY } = getPackageEnv()",
      },
      {
        name: "getSiteEnv",
        type: "function",
        description: "Get per-restaurant site env vars (lazy-loaded, memoized) through the lenient reader: every field is possibly undefined and a missing var does NOT throw. Whether the deployment may boot is decided once by validateAllEnv().",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation"],
        returnType: "SiteEnv",
        example: "const { NEXT_PUBLIC_CONVEX_URL, STRIPE_SECRET_KEY } = getSiteEnv() // both string | undefined",
      },
      {
        name: "isSandbox",
        type: "function",
        description: "Resolve whether an integration talks to its sandbox: isSandbox('uberEats' | 'deliveroo' | 'paypal'). Reads UBER_EATS_SANDBOX_MODE / DELIVEROO_IS_SANDBOX / PAYPAL_SANDBOX_MODE. Only the exact string 'false' selects production; unset, empty or malformed resolves to SANDBOX and warns once per flag. Replaces the inline `site.X === \"true\"` read, which made an unset variable mean PRODUCTION at 43 call sites. Being explicit is still required — validateAllEnv() refuses to boot an integration configured without a declared mode.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "integrations", "uber-eats", "deliveroo", "paypal"],
        params: {
          platform: { type: "'uberEats' | 'deliveroo' | 'paypal'", description: "Which integration to resolve" },
        },
        returnType: "boolean",
        example: "const credentials = { clientId, clientSecret, sandboxMode: isSandbox(\"uberEats\") }",
      },
      {
        name: "checkSandboxFlags",
        type: "function",
        description: "Which sandbox flags a deployment still owes an answer on, given a raw env object. Silent while an integration is switched off entirely; the moment any of its credentials is set, its mode becomes required. The Deliveroo brand/site ids are deliberately excluded — they are e2e fixtures. Called by validateAllEnv().",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation", "startup"],
        params: {
          source: { type: "Record<string, unknown>", description: "Usually process.env" },
        },
        returnType: "{ name: string; message: string }[]",
      },
      {
        name: "SANDBOX_FLAG_RULES",
        type: "constant",
        description: "The three integrations whose sandbox mode must be declared once configured, each with the credentials that switch it on: Uber Eats, Deliveroo, PayPal. The rule spans two tiers (credentials are package-level, flags site-level), which is why it is not a Zod refinement.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation"],
        returnType: "readonly { feature: string; flag: string; enabledBy: readonly string[] }[]",
      },
      {
        name: "validateAllEnv",
        type: "function",
        description: "Validate every tier without throwing: the 8 package vars, the 10 required site vars (AWS credentials among them since 2026-08-28 — one AWS account per client), the optional site vars including the SITE_FEATURE_GROUPS all-or-nothing rules, and the sandbox declarations from checkSandboxFlags(). Returns { ok, missing } with each problem tagged by EnvTier.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation", "startup"],
        returnType: "{ ok: boolean; missing: EnvProblem[] } where EnvProblem = { name: string; message: string; tier: 'package' | 'site' | 'feature' }",
        example: "const { ok, missing } = validateAllEnv()\nif (!ok) console.error(formatEnvReport(missing))",
      },
      {
        name: "formatEnvReport",
        type: "function",
        description: "Format the problems from validateAllEnv() into a human-readable console report, grouped under the three EnvTier headings (package-level, site-level, half-configured feature). Report strings are in French.",
        importPath: "@be-in-digital/core/env",
        tags: ["env", "validation", "startup"],
        params: {
          missing: { type: "EnvProblem[] = { name: string; message: string; tier: 'package' | 'site' | 'feature' }[]", description: "Problems from validateAllEnv()" },
        },
        returnType: "string",
      },
    ],
  },
  {
    name: "restaurant",
    scope: "@be-in-digital/restaurant",
    description:
      "Restaurant business logic: Zustand stores (cart, store, UI, language), services, and React hooks.",
    version: PACKAGE_VERSIONS["restaurant"],
    category: "frontend",
    dependencies: ["zustand"],
    peerDependencies: ["react@^19"],
    installCommand: "pnpm add @be-in-digital/restaurant",
    setupSteps: [
      "Install: pnpm add @be-in-digital/restaurant",
      "Import stores: import { useCartStore } from '@be-in-digital/restaurant/stores'",
      "Import hooks: import { useCart } from '@be-in-digital/restaurant/hooks'",
    ],
    exports: [
      {
        name: "useCartStore",
        type: "store",
        description:
          "Shopping cart Zustand store: items, addItem, removeItem, updateQuantity, clear, total",
        importPath: "@be-in-digital/restaurant/stores",
        tags: ["store", "cart", "zustand"],
        example: "const { items, addItem, total } = useCartStore()",
      },
      {
        name: "useAdminStoreSelection",
        type: "store",
        description:
          "Id of the establishment being administered. Persisted; the document itself comes from Convex",
        importPath: "@be-in-digital/restaurant/stores",
        tags: ["store", "zustand", "admin"],
        example: "const storeId = useAdminStoreSelection((s) => s.storeId)",
      },
      {
        name: "useStorefrontStoreSelection",
        type: "store",
        description:
          "Id of the establishment the visitor is browsing. Kept apart from the admin selection",
        importPath: "@be-in-digital/restaurant/stores",
        tags: ["store", "zustand", "storefront"],
        example: "const storeId = useStorefrontStoreSelection((s) => s.storeId)",
      },
      {
        name: "useUIStore",
        type: "store",
        description: "UI state Zustand store: modals, filters, sidebar",
        importPath: "@be-in-digital/restaurant/stores",
        tags: ["store", "ui", "zustand"],
      },
      {
        name: "useLanguageStore",
        type: "store",
        description:
          "Language/locale Zustand store: current language, setLanguage",
        importPath: "@be-in-digital/restaurant/stores",
        tags: ["store", "i18n", "zustand"],
      },
      {
        name: "useCart",
        type: "hook",
        description: "Cart operations: add, remove, update, summary, checkout",
        importPath: "@be-in-digital/restaurant/hooks",
        tags: ["hook", "cart"],
      },
      {
        name: "useNearestStore",
        type: "hook",
        description:
          "Find nearest store by geolocation. Pass { autoLocate: true } to prompt on mount; off by default",
        importPath: "@be-in-digital/restaurant/hooks",
        tags: ["hook", "store", "geo"],
      },
      {
        name: "useOrderStatus",
        type: "hook",
        description: "Track order status in real-time",
        importPath: "@be-in-digital/restaurant/hooks",
        tags: ["hook", "order"],
      },
      {
        name: "useProductFilters",
        type: "hook",
        description:
          "Filter and sort products by category, price, allergens",
        importPath: "@be-in-digital/restaurant/hooks",
        tags: ["hook", "product", "filter"],
      },
      {
        name: "CartItem",
        type: "type",
        description:
          "Cart item with product, quantity and selected options",
        importPath: "@be-in-digital/restaurant",
        tags: ["type", "cart"],
      },
      {
        name: "CartSummary",
        type: "type",
        description:
          "Cart summary with subtotal, tax, delivery fee, total",
        importPath: "@be-in-digital/restaurant",
        tags: ["type", "cart"],
      },
    ],
  },
  {
    name: "admin",
    scope: "@be-in-digital/admin",
    description:
      "Complete admin dashboard: 20+ page components, layout, stores, hooks, and formatters for restaurant management.",
    version: PACKAGE_VERSIONS["admin"],
    category: "frontend",
    dependencies: [],
    installCommand: "pnpm add @be-in-digital/admin",
    exports: [
      {
        name: "DashboardPage",
        type: "component",
        description: "Main dashboard with KPIs, charts, recent orders",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "dashboard"],
      },
      {
        name: "OrdersPage",
        type: "component",
        description: "Order list with filtering and status management",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "orders"],
      },
      {
        name: "ProductsPage",
        type: "component",
        description: "Product catalog management",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "products"],
      },
      {
        name: "KitchenPage",
        type: "component",
        description: "Kitchen Display System with real-time tickets",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "kitchen"],
      },
      {
        name: "GamesPage",
        type: "component",
        description: "Gamification management (QR codes, prizes, games)",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "gamification"],
      },
      {
        name: "LanguagesPage",
        type: "component",
        description: "Language management with GPT auto-translation",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "i18n"],
      },
      {
        name: "PaymentsPage",
        type: "component",
        description:
          "Payment integrations (Stripe, SumUp, PayPal, cash; Square is announced but unimplemented)",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "payments"],
      },
      {
        name: "EmailDashboardPage",
        type: "component",
        description: "Email marketing dashboard with KPIs",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "email"],
      },
      {
        name: "useAdminAuthStore",
        type: "store",
        description: "Admin authentication Zustand store",
        importPath: "@be-in-digital/admin/stores",
        tags: ["admin", "store", "auth", "zustand"],
      },
      {
        name: "useAdminStoreId",
        type: "hook",
        description: "Get current admin store ID",
        importPath: "@be-in-digital/admin/hooks",
        tags: ["admin", "hook"],
      },
      {
        name: "useDebounce",
        type: "hook",
        description: "Debounce a value with configurable delay",
        importPath: "@be-in-digital/admin/hooks",
        tags: ["admin", "hook", "utility"],
      },
      {
        name: "formatPrice",
        type: "utility",
        description:
          "Format price in cents to display (e.g., 1299 -> '12,99 EUR')",
        importPath: "@be-in-digital/admin/lib",
        tags: ["admin", "utility", "format"],
        example: "formatPrice(1299) // '12,99 EUR'",
      },
      {
        name: "formatDate",
        type: "utility",
        description: "Format date with locale",
        importPath: "@be-in-digital/admin/lib",
        tags: ["admin", "utility", "format"],
      },
      {
        name: "slugify",
        type: "utility",
        description: "Convert string to URL-safe slug",
        importPath: "@be-in-digital/admin/lib",
        tags: ["admin", "utility"],
      },
      {
        name: "eurosToCents",
        type: "utility",
        description: "Convert euros to cents (12.99 -> 1299)",
        importPath: "@be-in-digital/admin/lib",
        tags: ["admin", "utility", "format"],
      },
      {
        name: "AppSidebar",
        type: "component",
        description: "Admin sidebar with nav, logo (supports dynamic logoUrl/brandName from CMS), and user footer.",
        importPath: "@be-in-digital/admin",
        tags: ["admin", "layout", "sidebar"],
        props: {
          footer: { type: "React.ReactNode", required: false, description: "Footer content (e.g. StoreSelector)" },
          userFooter: { type: "React.ReactNode", required: false, description: "User section (e.g. SidebarUserMenu)" },
          logoUrl: { type: "string | null", required: false, description: "Dynamic logo URL from CMS branding" },
          brandName: { type: "string", required: false, description: "Brand name, defaults to 'BeYours'" },
        },
      },
      {
        name: "StoreSelector",
        type: "component",
        description: "Store dropdown selector. Auto-selects when only one store exists. Hides dropdown for single store.",
        importPath: "@be-in-digital/admin",
        tags: ["admin", "component", "store"],
      },
      {
        name: "StoreGuard",
        type: "component",
        description: "Guard that ensures a store is selected. Auto-selects single store. Shows create prompt when no stores exist.",
        importPath: "@be-in-digital/admin",
        tags: ["admin", "component", "store", "guard"],
      },
      {
        name: "StoresPage",
        type: "component",
        description: "Store management page with CRUD, bulk actions, and draft-to-open guidance on creation.",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "stores"],
      },
      {
        name: "StoreDetailPage",
        type: "component",
        description: "Store detail/config page with back button, draft banner, tabs (General, Hours, Settings, Integrations).",
        importPath: "@be-in-digital/admin/pages",
        tags: ["admin", "page", "stores", "detail"],
      },
    ],
  },
  {
    name: "convex-schema",
    scope: "@be-in-digital/convex-schema",
    description:
      "Convex database schema: 50+ table definitions, 40+ Zod validators, 100+ TypeScript types.",
    version: PACKAGE_VERSIONS["convex-schema"],
    category: "shared",
    dependencies: ["convex", "zod"],
    installCommand: "pnpm add @be-in-digital/convex-schema",
    exports: [
      {
        name: "storesTable",
        type: "validator",
        description: "Store table with hours, location, config",
        importPath: "@be-in-digital/convex-schema/tables",
        tags: ["schema", "store"],
      },
      {
        name: "productsTable",
        type: "validator",
        description: "Product table with options, pricing, stock",
        importPath: "@be-in-digital/convex-schema/tables",
        tags: ["schema", "product"],
      },
      {
        name: "ordersTable",
        type: "validator",
        description: "Order table with items, status, payment",
        importPath: "@be-in-digital/convex-schema/tables",
        tags: ["schema", "order"],
      },
      {
        name: "kitchenTicketsTable",
        type: "validator",
        description: "Kitchen display tickets",
        importPath: "@be-in-digital/convex-schema/tables",
        tags: ["schema", "kitchen"],
      },
      {
        name: "gamesTable",
        type: "validator",
        description: "Game definitions (Wheel, Scratch) with win ratio",
        importPath: "@be-in-digital/convex-schema/tables",
        tags: ["schema", "gamification"],
      },
      {
        name: "StoreDoc",
        type: "type",
        description: "Store document type with all fields",
        importPath: "@be-in-digital/convex-schema",
        tags: ["type", "store"],
      },
      {
        name: "ProductDoc",
        type: "type",
        description: "Product document type",
        importPath: "@be-in-digital/convex-schema",
        tags: ["type", "product"],
      },
      {
        name: "OrderDoc",
        type: "type",
        description: "Order document type",
        importPath: "@be-in-digital/convex-schema",
        tags: ["type", "order"],
      },
      {
        name: "OrderStatus",
        type: "enum",
        description:
          "Order lifecycle: pending -> confirmed -> preparing -> ready -> delivered -> completed",
        importPath: "@be-in-digital/convex-schema",
        tags: ["type", "order", "enum"],
      },
      {
        name: "GameType",
        type: "enum",
        description: "Game types: WHEEL_OF_FORTUNE, SCRATCH_CARD",
        importPath: "@be-in-digital/convex-schema",
        tags: ["type", "gamification", "enum"],
      },
      {
        name: "menuVisionResultSchema",
        type: "validator",
        description:
          "Convex validator for what the vision model returns for a whole menu photo; singleProductVisionSchema covers the one-product case. These are the engine's half of image-to-product — the analysis action itself is app-level Node code.",
        importPath: "@be-in-digital/convex-schema/validators",
        tags: ["validation", "ai", "product"],
      },
    ],
  },
  {
    name: "convex-functions",
    scope: "@be-in-digital/convex-functions",
    description:
      "Convex backend functions: 48 modules covering auth, CRUD, kitchen, payments, gamification, i18n, email, CMS, integrations, and AI.",
    version: PACKAGE_VERSIONS["convex-functions"],
    category: "backend",
    dependencies: ["convex"],
    installCommand: "pnpm add @be-in-digital/convex-functions",
    exports: [
      {
        name: "stores",
        type: "function",
        description: "Store CRUD operations",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "store"],
      },
      {
        name: "products",
        type: "function",
        description: "Product catalog management",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "product"],
      },
      {
        name: "orders",
        type: "function",
        description: "Order creation, tracking, status updates",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "order"],
      },
      {
        name: "kitchenTickets",
        type: "function",
        description: "Kitchen ticket creation, browser printing, status",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "kitchen"],
      },
      {
        name: "runTranslationPlan",
        type: "function",
        description:
          "GPT-powered auto-translation. Deliberately NOT on the package barrel: the module must not pull @be-in-digital/core into the Convex default runtime, so it ships from its own subpath. Pair it with getTranslationPlan and saveDocumentTranslations, and gate writes with touchesTranslatableText.",
        importPath: "@be-in-digital/convex-functions/autoTranslate",
        tags: ["backend", "i18n", "gpt"],
        example:
          'import * as autoTranslate from "@be-in-digital/convex-functions/autoTranslate"',
      },
      {
        name: "touchesTranslatableText",
        type: "function",
        description:
          "True when a patch changes a field that has translations, so the caller knows whether to schedule a re-translation.",
        importPath: "@be-in-digital/convex-functions/autoTranslate",
        tags: ["backend", "i18n"],
      },
      {
        name: "getTranslationPlan",
        type: "function",
        description:
          "Convex query definition ({ args, handler }) returning the documents and target languages a translation run has to cover.",
        importPath: "@be-in-digital/convex-functions/autoTranslate",
        tags: ["backend", "i18n"],
      },
      {
        name: "games",
        type: "function",
        description: "Game management (create, update win ratio)",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "gamification"],
      },
      {
        name: "emailCampaigns",
        type: "function",
        description: "Email campaign CRUD and sending",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "email"],
      },
      {
        name: "cms",
        type: "function",
        description: "CMS content management functions",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "cms"],
      },
      {
        name: "checkImageToProductAccess",
        type: "function",
        description:
          "Entitlement guard for image-to-product: says whether the owner's plan still has analysis quota. The analysis action itself is NOT in this package — it is app-level Convex code (`convex/imageToProduct.ts`) because it needs the Node runtime for sharp and the OpenAI vision call. The engine ships the guard, the quota accounting and the result validators.",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "ai", "product", "entitlements"],
      },
      {
        name: "reserveImageToProductQuota",
        type: "function",
        description:
          "Takes one image-to-product analysis off the owner's monthly quota before the app-level action runs; releaseImageToProductQuota gives it back when the analysis fails.",
        importPath: "@be-in-digital/convex-functions",
        tags: ["backend", "ai", "product", "entitlements"],
      },
    ],
  },
  {
    name: "cms",
    scope: "@be-in-digital/cms",
    description:
      "Custom CMS: page/block registry, field definitions, media management, SVG sanitization, and content validation.",
    version: PACKAGE_VERSIONS["cms"],
    category: "shared",
    dependencies: [],
    installCommand: "pnpm add @be-in-digital/cms",
    exports: [
      {
        name: "setCmsRegistry",
        type: "function",
        description: "Register CMS page and block definitions",
        importPath: "@be-in-digital/cms",
        tags: ["cms", "registry"],
      },
      {
        name: "getCmsRegistry",
        type: "function",
        description: "Get all registered CMS definitions",
        importPath: "@be-in-digital/cms",
        tags: ["cms", "registry"],
      },
      {
        name: "getPageDefinition",
        type: "function",
        description: "Get a specific page definition by slug",
        importPath: "@be-in-digital/cms",
        tags: ["cms", "page"],
      },
      {
        name: "validateBlockValues",
        type: "function",
        description: "Validate CMS block content against schema",
        importPath: "@be-in-digital/cms",
        tags: ["cms", "validation"],
      },
      {
        name: "sanitizeSvg",
        type: "function",
        description:
          "Full SVG sanitization through DOMPurify. It is deliberately kept OFF the package barrel and ships from its own subpath: DOMPurify needs a DOM, and the barrel is imported by Convex isolate modules that have none — re-exporting it once made the whole backend fail to push. Convex-side callers use containsActiveContent from the barrel instead.",
        importPath: "@be-in-digital/cms/sanitize",
        tags: ["cms", "security"],
      },
      {
        name: "containsActiveContent",
        type: "function",
        description:
          "DOM-free, dependency-free refusal check for SVG markup carrying script or event handlers. Safe to call from a Convex isolate, unlike sanitizeSvg.",
        importPath: "@be-in-digital/cms",
        tags: ["cms", "security"],
      },
      {
        name: "validateMediaUpload",
        type: "function",
        description: "Validate media file upload (size, type)",
        importPath: "@be-in-digital/cms",
        tags: ["cms", "media"],
      },
    ],
  },
  {
    name: "integrations",
    scope: "@be-in-digital/integrations",
    description:
      "Third-party integrations: Uber Eats and Deliveroo API clients, menu sync, order handling, webhook security.",
    version: PACKAGE_VERSIONS["integrations"],
    category: "backend",
    dependencies: [],
    installCommand: "pnpm add @be-in-digital/integrations",
    exports: [
      {
        name: "uberEats.fetchUberEats",
        type: "service",
        description:
          "Authenticated fetch against the Uber Eats API — handles the OAuth token cache and the retry policy. The namespace is flat: uberEats re-exports client, oauth, mappers, security and menu-sync members side by side, so there is no uberEats.client sub-object.",
        importPath: "@be-in-digital/integrations",
        tags: ["integration", "uber-eats"],
        example:
          'import { uberEats } from "@be-in-digital/integrations"\nawait uberEats.fetchUberEats(credentials, "/v1/eats/stores")',
      },
      {
        name: "uberEats.pushMenu",
        type: "service",
        description:
          "Push the local menu to Uber Eats; uberEats.pullMenu reads theirs back for reconciliation.",
        importPath: "@be-in-digital/integrations",
        tags: ["integration", "uber-eats", "menu"],
      },
      {
        name: "uberEats.acceptOrder",
        type: "service",
        description:
          "Accept an incoming Uber Eats order. denyOrder, cancelOrder and markOrderAsReady sit beside it in the same namespace.",
        importPath: "@be-in-digital/integrations",
        tags: ["integration", "uber-eats", "order"],
      },
      {
        name: "deliveroo.fetchDeliveroo",
        type: "service",
        description:
          "Authenticated fetch against the Deliveroo API, with the same token cache as the Uber Eats client. Flat namespace — there is no deliveroo.client sub-object.",
        importPath: "@be-in-digital/integrations",
        tags: ["integration", "deliveroo"],
      },
      {
        name: "deliveroo.pullMenu",
        type: "service",
        description:
          "Read the Deliveroo menu back for reconciliation. Deliveroo menu *pushes* go through the separate menu-push path.",
        importPath: "@be-in-digital/integrations",
        tags: ["integration", "deliveroo", "menu"],
      },
      {
        name: "deliveroo.acceptOrder",
        type: "service",
        description:
          "Accept an incoming Deliveroo order. confirmOrder, rejectOrder, updatePrepStage, getOrder and sendSyncStatus are the rest of the order surface.",
        importPath: "@be-in-digital/integrations",
        tags: ["integration", "deliveroo", "order"],
      },
    ],
  },
  {
    name: "marketing",
    scope: "@be-in-digital/marketing",
    description:
      "Email marketing: HTML rendering (28 block types), campaign validation, segmentation, double opt-in, statistics, CSV import.",
    version: PACKAGE_VERSIONS["marketing"],
    category: "shared",
    dependencies: [],
    installCommand: "pnpm add @be-in-digital/marketing",
    exports: [
      {
        name: "renderTemplateToEmailHtml",
        type: "function",
        description: "Render full email template to HTML string",
        importPath: "@be-in-digital/marketing",
        tags: ["email", "render"],
      },
      {
        name: "validateCampaign",
        type: "function",
        description: "Validate campaign before sending",
        importPath: "@be-in-digital/marketing",
        tags: ["email", "validation"],
      },
      {
        name: "buildSegmentFilter",
        type: "function",
        description: "Build subscriber filter from segment rules",
        importPath: "@be-in-digital/marketing",
        tags: ["email", "segment"],
      },
      {
        name: "generateDoubleOptInToken",
        type: "function",
        description: "Generate email verification token",
        importPath: "@be-in-digital/marketing",
        tags: ["email", "opt-in"],
      },
      {
        name: "computeStatRates",
        type: "function",
        description: "Calculate open rate, click rate, etc.",
        importPath: "@be-in-digital/marketing",
        tags: ["email", "stats"],
      },
      {
        name: "parseSubscriberCsv",
        type: "function",
        description: "Parse CSV file to subscriber list",
        importPath: "@be-in-digital/marketing",
        tags: ["email", "import"],
      },
    ],
  },
];

export function searchPackages(query: string): PackageExport[] {
  const q = query.toLowerCase();
  const results: (PackageExport & { packageName: string; score: number })[] =
    [];

  for (const pkg of packages) {
    for (const exp of pkg.exports) {
      let score = 0;
      if (exp.name.toLowerCase().includes(q)) score += 10;
      if (exp.description.toLowerCase().includes(q)) score += 5;
      if (exp.tags?.some((t) => t.includes(q))) score += 3;

      if (score > 0) {
        results.push({ ...exp, packageName: pkg.scope, score });
      }
    }
  }

  // `exp.importPath` is kept as declared. It used to be overwritten with the
  // package scope here, which silently downgraded every subpath-only export —
  // `sanitizeSvg` came back as `@be-in-digital/cms` instead of
  // `@be-in-digital/cms/sanitize`, an import that does not resolve.
  return results
    .sort((a, b) => b.score - a.score)
    .map(({ score, packageName, ...exp }) => {
      void score;
      void packageName;
      return exp;
    });
}

/**
 * The import statement a consumer should write for one export claim.
 *
 * A dotted `name` is a member of a namespace re-export (`export * as uberEats`
 * in `@be-in-digital/integrations`), so the statement imports the namespace and
 * the member is reached through it — `import { uberEats.pullMenu }` is not
 * syntax.
 *
 * `apps/reference/__tests__/mcp-registry-imports.test.ts` compiles the output of
 * this function for every claim in the registry, so what the server prints is
 * what a consumer can paste.
 */
export function importStatement(exp: PackageExport): string {
  return `import { ${importBinding(exp)} } from '${exp.importPath}'`;
}

/** The identifier an import brings into scope for this claim. */
export function importBinding(exp: PackageExport): string {
  const binding = exp.name.split(".")[0];
  /* c8 ignore next -- name is never empty; split always yields a first element */
  return binding ?? exp.name;
}

export function getPackageByName(name: string): PackageInfo | undefined {
  return packages.find((p) => p.name === name || p.scope === name);
}
