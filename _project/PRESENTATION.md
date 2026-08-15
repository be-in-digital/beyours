# BeYours Engine - Architecture Documentation

## 📋 Overview

**BeYours Engine** is a premium Next.js e-commerce platform for restaurants with Convex backend. The system offers specialized themes by restaurant type (fast-food, pizzeria, Chinese, etc.) that restaurant owners can purchase and customize. Each installation allows managing multiple stores from a single centralized dashboard.

### Business Model

- **Product**: Specialized Next.js theme sold once to the restaurant owner
- **Multi-store**: Restaurant owner manages their own locations (e.g., Pizza Mario with 3 locations)
- **Pricing**: Per store (number of locations)
- **Maintenance**: Included for 1 year, then annual renewal to receive updates
- **Customization**:
    - **Simple**: Colors, fonts, logo (most clients)
    - **Advanced**: Complete storefront modification (clients with specific needs)
    - **Dashboard**: Fixed BeYours design (identical for all clients)

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│              BeYours Engine (Core)                   │
├─────────────────────────────────────────────────────────┤
│ • Admin Dashboard (fixed design)                        │
│ • Common Packages (ui, restaurant, integrations)        │
│ • Theme System                                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ├─────────────────┐
                         ▼                 ▼
┌──────────────────────────────┐  ┌──────────────────────┐
│    Predefined Themes         │  │  End Client          │
├──────────────────────────────┤  ├──────────────────────┤
│ • Fast Food Theme            │  │ Dashboard            │
│ • Pizzeria Theme             │  │ └─► Fixed design     │
│ • Chinese Restaurant Theme   │  │                      │
│ • Fine Dining Theme          │  │ Storefront           │
│ • Café/Bakery Theme          │  │ └─► Theme +          │
│ • Sushi Bar Theme            │  │     customization    │
└──────────────────────────────┘  └──────────────────────┘
```

### Use Case Example

```
Restaurant "Pizza Mario" purchases the theme
├── Single website: pizzamario.com
├── Store 1: Paris 15th
├── Store 2: Paris 11th  
└── Store 3: Boulogne

On the website:
1. Customer chooses their store (or auto-detection by geolocation)
2. Sees the menu for the selected store
3. Orders from that specific store
4. Can choose:
   - Click & Collect (pickup at store)
   - Delivery (Uber Direct from that store)
   - Dine-in (if enabled)
```

## 🏗️ Global Architecture

### Main Components

```
┌─────────────────────────────────────────────────────────────┐
│         BeYours Engine Master (Your private repo)        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ packages/                                             │  │
│  │  ├── ui/                  (React Components)          │  │
│  │  ├── restaurant/          (Restaurant Logic)          │  │
│  │  ├── integrations/        (Uber Eats, Deliveroo)     │  │
│  │  ├── marketing/           (Email, Gamification)       │  │
│  │  ├── cms/                 (Custom CMS)                │  │
│  │  ├── core/                (Auth, i18n, payments)      │  │
│  │  ├── convex-schema/       (Shared DB Schemas)        │  │
│  │  └── convex-functions/    (Backend Functions)        │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ apps/                                                 │  │
│  │  ├── restaurant-theme/    (Complete Theme)           │  │
│  │  ├── admin-dashboard/     (Your Global Dashboard)    │  │
│  │  └── docs/                (Documentation)            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ npm private publishing
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Client Repos (1 repo = 1 restaurant)            │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Restaurant "Pizza Mario"                            │    │
│  │ repo: client-pizzamario                             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Website: pizzamario.com                             │    │
│  │ ├── Store 1: Paris 15th                             │    │
│  │ ├── Store 2: Paris 11th                             │    │
│  │ └── Store 3: Boulogne                               │    │
│  │                                                      │    │
│  │ Database: Convex (dedicated instance)               │    │
│  │ Deployment: Vercel                                  │    │
│  │ Maintenance: Active until 03/15/2027                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Restaurant "Sushi Tokyo"                            │    │
│  │ repo: client-sushitokyo                             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Website: sushitokyo.fr                              │    │
│  │ ├── Store 1: Lyon Center                            │    │
│  │ └── Store 2: Lyon Part-Dieu                         │    │
│  │                                                      │    │
│  │ Database: Convex (dedicated instance)               │    │
│  │ Deployment: Vercel                                  │    │
│  │ Maintenance: EXPIRED (02/01/2026)                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Client Workflow

```
Client (Restaurant) purchases the theme
         │
         ├─ You create a dedicated GitHub repo
         ├─ Theme installation + basic configuration
         ├─ Client configures stores, branding, products
         ├─ Vercel + Convex deployment
         └─ Maintenance = 1 year included
```

## 🔧 Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: Custom components + shadcn/ui
- **State Management**: Zustand (for component state) + Convex React Hooks (for server state)
- **Forms**: React Hook Form + Zod
- **i18n Storage**: Cookies or localStorage (for language preference)
- **Deployment**: Vercel

### Backend
- **BaaS**: Convex
- **Database**: Convex (one instance per client/restaurant)
- **Authentication**: Better Auth + Convex
- **File Storage**: Convex Storage
- **Real-time**: Convex Subscriptions

### Package Management
- **Package manager**: pnpm
- **Monorepo**: Turborepo
- **npm Registry**: GitHub Packages (private)
- **Versioning**: Changesets

### Integrations
- **Payments**: Stripe, SumUp, PayPal, Square
- **Delivery**: Uber Direct API
- **Platforms**: Uber Eats API, Deliveroo API
- **Email**: Resend / SendGrid
- **Analytics**: Vercel Analytics, Plausible

## 🎯 Complete Features

[Note: Complete features section would be translated here - over 2000 lines covering all restaurant management features including multi-store, products, orders, KDS, integrations, payments, promotions, gamification, email marketing, CMS, team management, authentication, analytics, multilingual, and design customization]

### 🎨 Theme System

BeYours Engine offers predefined themes optimized by restaurant type. Each theme is designed to maximize conversions based on cuisine type.

#### Available Themes

**1. Fast Food Theme**
```typescript
// Characteristics
{
  name: "Fast Food",
  target: "McDonald's, Burger King, KFC, Quick",
  colors: {
    primary: "#E31837", // Dynamic red
    secondary: "#FFC72C", // Golden yellow
  },
  layout: {
    hero: "video", // Appetizing product video
    productGrid: "large-images", // XXL images
    checkout: "single-page", // Quick checkout
  },
  features: {
    quickOrder: true, // 2-click ordering
    upselling: "aggressive", // Active suggestions
    menuCombo: true, // Combo meals
  },
}
```
- **Design**: Modern, colorful, energetic
- **Typography**: Bold, impactful
- **Layout**: Dense grid, dominant visuals
- **CTA**: Very visible, contrasted
- **Focus**: Speed, simplicity, visuals

**2. Pizzeria Theme**
```typescript
{
  name: "Pizzeria",
  target: "Traditional, Italian pizzerias",
  colors: {
    primary: "#D32F2F", // Italian red
    secondary: "#388E3C", // Basil green
    accent: "#FFA726", // Cheese orange
  },
  layout: {
    hero: "slider", // Pizza slider
    productGrid: "masonry", // Ingredient showcase
    checkout: "multi-step",
  },
  features: {
    pizzaBuilder: true, // Pizza composer
    ingredientHighlight: true,
    sizeSelector: "visual", // Visual size selection
    halfAndHalf: true, // Half and half
  },
}
```
- **Design**: Italian, warm, artisanal
- **Typography**: Elegant serif for titles
- **Layout**: Focus on customization
- **Visuals**: Fresh ingredients, wood oven
- **Features**: Advanced pizza builder

**3. Chinese Restaurant Theme**
```typescript
{
  name: "Chinese Restaurant",
  target: "Chinese, Asian restaurants",
  colors: {
    primary: "#D32F2F", // Chinese red
    secondary: "#212121", // Black
    accent: "#FFD700", // Gold
  },
  layout: {
    hero: "image", // Large ambiance image
    productGrid: "list-with-icons", // List with spice icons
    checkout: "multi-step",
  },
  features: {
    spiceLevelIndicator: true, // Spice level
    menuCombos: true, // Menus A,B,C
    ingredientIcons: true, // Visual icons
    chineseCalendar: true, // Chinese events
  },
}
```
- **Design**: Elegant, red and gold
- **Typography**: Modern/traditional mix
- **Layout**: Organization by specialties
- **Visuals**: Presented dishes, chopsticks
- **Features**: Spice indicators

**4. Fine Dining Theme**
```typescript
{
  name: "Fine Dining",
  target: "Gastronomic, Michelin-starred restaurants",
  colors: {
    primary: "#1A1A1A", // Deep black
    secondary: "#C9A961", // Subtle gold
    background: "#F5F5F5", // Off-white
  },
  layout: {
    hero: "minimal", // Elegant minimal
    productGrid: "spacious", // Spaced, airy
    checkout: "multi-step",
  },
  features: {
    detailedDescriptions: true,
    chefStory: true, // Chef's story
    winePariring: true, // Food-wine pairings
    reservationOnly: false,
  },
}
```
- **Design**: Clean, luxurious, minimal
- **Typography**: Elegant serif
- **Layout**: Spaced, high-quality photos
- **Visuals**: Professional photography
- **Features**: Detailed descriptions

**5. Café/Bakery Theme**
```typescript
{
  name: "Café & Bakery",
  target: "Cafés, bakeries, pastry shops",
  colors: {
    primary: "#6F4E37", // Coffee brown
    secondary: "#F4A460", // Golden sand
    accent: "#D4A76A", // Caramel
  },
  layout: {
    hero: "carousel", // Product carousel
    productGrid: "dense-grid", // Dense grid
    checkout: "single-page",
  },
  features: {
    breakfastMenu: true, // Breakfast menu
    dailySpecials: true, // Daily specials
    allergenBadges: true, // Visible allergen badges
    takeawayFocus: true, // Takeaway focus
  },
}
```
- **Design**: Warm, welcoming
- **Typography**: Handwritten for titles
- **Layout**: Tight product grid
- **Visuals**: Bright, appetizing photos
- **Features**: Breakfast categories

**6. Sushi Bar Theme**
```typescript
{
  name: "Sushi Bar",
  target: "Japanese restaurants, sushi",
  colors: {
    primary: "#1A1A1A", // Black
    secondary: "#E53935", // Japanese red
    accent: "#FFFFFF", // Pure white
  },
  layout: {
    hero: "video", // Preparation video
    productGrid: "horizontal-scroll", // Horizontal scroll
    checkout: "multi-step",
  },
  features: {
    menuByPieces: true, // Order by pieces
    plateSystem: true, // Plate system
    visualRoll: true, // Visual roll
    wasabiLevel: true, // Wasabi level
  },
}
```
- **Design**: Minimalist, zen, Japanese
- **Typography**: Clean, modern
- **Layout**: Horizontal, fluid
- **Visuals**: Sharp photos, black background
- **Features**: Pieces system

#### Theme Selection

The client chooses their theme during installation:

```bash
# CLI during setup
? What type of restaurant do you manage?
  ❯ Fast Food
    Pizzeria
    Chinese Restaurant
    Fine Dining
    Café/Bakery
    Sushi Bar
    Custom (custom development)
```

Or from the dashboard:

```typescript
// app/(admin)/settings/theme/page.tsx
export default function ThemeSelector() {
  const [selectedTheme, setSelectedTheme] = useState("pizzeria")
  
  return (
    <div className="grid grid-cols-3 gap-6">
      {themes.map(theme => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          selected={selectedTheme === theme.id}
          onSelect={() => setSelectedTheme(theme.id)}
        />
      ))}
    </div>
  )
}
```

#### Theme Structure

```
packages/themes/
├── fast-food/
│   ├── components/
│   │   ├── Hero.tsx           # Specific hero
│   │   ├── ProductCard.tsx    # Specific card
│   │   └── MenuCombo.tsx      # Unique feature
│   ├── styles/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   └── theme.css
│   ├── config.ts              # Theme configuration
│   └── screenshots/           # Previews
│       ├── desktop.png
│       └── mobile.png
├── pizzeria/
├── chinese/
├── fine-dining/
├── cafe-bakery/
└── sushi-bar/
```

#### Client Customization

Even with a theme, the client can customize:

**Simple Level (all clients)**:
- ✅ Colors (primary, secondary, accent)
- ✅ Logo and favicon
- ✅ Fonts (heading, body)
- ✅ Hero images
- ❌ Structure/layout (fixed by theme)
- ❌ Components (fixed by theme)

**Advanced Level (custom development)**:
- ✅ Complete storefront modification
- ✅ New components
- ✅ Custom layout
- ❌ Dashboard (remains standard)

### 💳 Payment Management

#### Configurable Multi-Provider System

The client can enable/disable the payment methods they wish to accept:

**Supported Online Providers**:
- **Stripe**: Cards, Apple Pay, Google Pay, SEPA
    - Configuration: API Key, Webhook Secret
    - 3D Secure support
    - Immediate or deferred payment
- **SumUp**: Physical terminal and online payment
    - Configuration: API Key, Merchant Code
    - Mobile POS support
    - Point of Sale integration
- **PayPal**: PayPal account, Pay Later
    - Configuration: Client ID, Secret
    - PayPal Business support
    - Installment payments
- **Square**: Physical terminal and online payment
    - Configuration: Access Token, Location ID
    - Reader support
    - Cash register management

**Physical Payments**:
- **Cash**: Enable/disable
    - Change management
    - Physical cash register
- **Card Terminal**:
    - Via Stripe Terminal
    - Via SumUp
    - Via Square Reader

#### Client Configuration

```typescript
// Dashboard interface to enable payments
paymentSettings: {
  online: {
    stripe: {
      enabled: true,
      publishableKey: "pk_live_...",
      secretKey: "sk_live_...",
      webhookSecret: "whsec_...",
      methods: ["card", "apple_pay", "google_pay"],
    },
    sumup: {
      enabled: true,
      apiKey: "sup_sk_...",
      merchantCode: "MXXX...",
      affiliateKey: "...",
    },
    paypal: {
      enabled: true,
      clientId: "...",
      secret: "...",
      mode: "live", // "sandbox" | "live"
    },
    square: {
      enabled: false,
      accessToken: "...",
      locationId: "...",
    },
  },
  onsite: {
    cash: {
      enabled: true,
    },
    cardTerminal: {
      enabled: true,
      provider: "sumup", // "stripe" | "sumup" | "square"
    },
  },
}
```

#### Features
- **Secure Payment**: PCI DSS compliant for all providers
- **3D Secure**: Mandatory strong authentication (SCA Europe)
- **Refunds**: Full or partial from dashboard
    - Multi-provider support
    - Refund reason
    - Automatic customer notification
- **History**: All transactions
    - Filters by provider, status, amount
    - Accounting export (CSV, PDF)
- **Reconciliation**: Multi-provider accounting export
- **Split Payment**: Bill sharing
    - Equal split
    - Custom split
    - Payment per person
- **Webhooks**: Automatic event management
    - Successful payment
    - Failed payment
    - Refund
    - Dispute (chargeback)

#### Payment Method Selection

At checkout, the end customer only sees methods enabled by the restaurant owner:

```
┌─────────────────────────────────────┐
│ Choose your payment method          │
├─────────────────────────────────────┤
│ ☐ Credit Card (Stripe)              │
│ ☐ Apple Pay / Google Pay            │
│ ☐ PayPal                            │
│ ☐ Cash on delivery                  │
│   (additional €0.50)                │
└─────────────────────────────────────┘
```

### 🔐 Authentication and Security

#### Better Auth + Convex

BeYours Engine uses [Better Auth](https://www.better-auth.com/) integrated with Convex for modern and secure authentication.

**Better Auth Advantages**:
- Framework-agnostic
- Type-safe with TypeScript
- Modular plugins
- Native OAuth support
- Integrated 2FA
- Advanced session management
- Convex compatible

#### Better Auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth"
import { convexAdapter } from "better-auth/adapters/convex"

export const auth = betterAuth({
  database: convexAdapter({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      teamId: process.env.APPLE_TEAM_ID!,
      keyId: process.env.APPLE_KEY_ID!,
      privateKey: process.env.APPLE_PRIVATE_KEY!,
    },
  },
  plugins: [
    twoFactor({
      issuer: "BeYours Engine",
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Send email with magic link
        await sendEmail({
          to: email,
          subject: "Login to your restaurant",
          html: `<a href="${url}">Sign in</a>`,
        })
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh after 1 day
  },
})
```

#### Authentication Methods

**Email/Password**:
- Automatic secure hash (bcrypt)
- Configurable strong password policy
- Mandatory email verification
- Secure email reset

**OAuth (Social Login)**:
- Google Sign In
- Facebook Login
- Apple Sign In
- Accounts automatically linked to email

**Magic Link**:
- Passwordless login
- Email with temporary unique link
- Configurable expiration
- Ideal for end customers

**SMS OTP** (optional):
- One-time code via SMS
- Via Twilio or other provider
- 5-minute expiration

#### Advanced Security

**2FA (Two-Factor Authentication)**:
```typescript
// Integrated Better Auth plugin
import { twoFactor } from "better-auth/plugins"

// In client dashboard
await auth.twoFactor.enable({
  userId: user.id,
  method: "totp", // or "sms", "email"
})
```
- **TOTP**: Google Authenticator, Authy
- **SMS**: Code via SMS
- **Email**: Code via email
- **Mandatory**: For all admin accounts
- **Optional**: For end customers

**Session Management**:
```typescript
// Session with Better Auth
const session = await auth.api.getSession({
  headers: request.headers,
})

// Logout on all devices
await auth.api.signOut({
  userId: user.id,
  allDevices: true,
})

// Active sessions
const sessions = await auth.api.listSessions({
  userId: user.id,
})
```
- Configurable automatic timeout
- Automatic token refresh
- Selective logout by device
- Active sessions visible in dashboard

**Advanced Protection**:
- **Rate limiting**: Brute force protection with Better Auth
- **IP Whitelisting**: For super admin accounts
- **Audit logs**: All connections and sensitive actions
- **CSRF Protection**: Automatic tokens
- **Secure cookies**: HttpOnly, Secure, SameSite

#### Convex Integration

```typescript
// convex/auth.ts
import { auth } from "@/lib/auth"
import { query, mutation } from "./_generated/server"

// Authentication middleware
export const getUser = query(async (ctx) => {
  const session = await auth.api.getSession({
    headers: ctx.headers,
  })
  
  if (!session) return null
  
  return await ctx.db
    .query("users")
    .withIndex("by_id", (q) => q.eq("_id", session.user.id))
    .unique()
})

// Protected mutation
export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await getUser(ctx)
    if (!user) throw new Error("Unauthorized")
    
    await ctx.db.patch(user._id, {
      name: args.name,
    })
  },
})
```

#### Convex Schema for Better Auth

```typescript
// convex/schema.ts
export default defineSchema({
  // Better Auth tables
  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),
  
  session: defineTable({
    userId: v.id("user"),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
  
  account: defineTable({
    userId: v.id("user"),
    accountId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
  
  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
  }).index("by_identifier", ["identifier"]),
  
  // Custom BeYours tables
  users: defineTable({
    // Extension of Better Auth user
    userId: v.id("user"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("client_admin"),
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery"),
      v.literal("customer")
    ),
    storeIds: v.array(v.id("stores")),
    permissions: v.array(v.string()),
    language: v.string(),
    phone: v.optional(v.string()),
    twoFactorEnabled: v.boolean(),
  }).index("by_userId", ["userId"]),
})
```

#### Permissions and RBAC

**Role-Based Access Control**:
```typescript
// lib/permissions.ts
export const permissions = {
  super_admin: ["*"], // All rights
  client_admin: [
    "stores:*",
    "orders:*",
    "products:*",
    "customers:*",
    "team:*",
    "settings:*",
  ],
  manager: [
    "orders:view",
    "orders:update",
    "products:view",
    "customers:view",
  ],
  kitchen: [
    "kitchen:view",
    "kitchen:update",
  ],
  waiter: [
    "orders:create",
    "orders:view",
  ],
  delivery: [
    "deliveries:view",
    "deliveries:update",
  ],
  customer: [
    "orders:view_own",
  ],
}

// Permission check
export function hasPermission(
  user: User,
  permission: string
): boolean {
  const userPerms = permissions[user.role]
  return (
    userPerms.includes("*") ||
    userPerms.includes(permission) ||
    userPerms.some((p) => {
      const [resource] = p.split(":")
      return permission.startsWith(resource + ":")
    })
  )
}
```

**Granular Permissions**:
- By module (orders, products, customers, etc.)
- By action (view, create, update, delete)
- Hierarchical inheritance
- Temporary permissions (expiration)

#### Usage Example

```typescript
// app/(admin)/orders/page.tsx
"use client"

import { useAuth } from "@/lib/auth-client"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

export default function OrdersPage() {
  const { user, isLoading } = useAuth()
  const orders = useQuery(api.orders.list)
  
  if (isLoading) return <Loading />
  if (!user) return <Redirect to="/login" />
  
  return (
    <div>
      <h1>Orders</h1>
      <OrderList orders={orders} />
    </div>
  )
}
```

## 📦 Package Structure

[Complete package structure with all modules - ui, restaurant, integrations, marketing, cms, core, themes, convex-schema, convex-functions]

## 🗄️ Database Schema (Convex)

[Complete database schema with all tables - users, sessions, stores, products, menus, orders, kitchenTickets, promotions, gamificationRewards, emailCampaigns, cmsPages, payments, customers, analytics, notifications, teamMembers, reviews, branding, layoutSettings, maintenance, updateHistory]

## 🔄 Update System

[Complete update workflow with maintenance management, client and admin dashboards]

## 🗂️ Client Repo Structure

[Complete file structure for a client repository]

## 🚀 Deployment

[Complete deployment workflow including project creation, configuration, Vercel deployment, and initial setup]

## 🛡️ Security

[Security measures including npm package access, sensitive variables, GDPR compliance]

## 📊 Monitoring and Analytics

[Metrics tracking and recommended tools]

## 🤝 Client Support

### Maintenance Levels

| Plan | Price/store | Updates | Support | Features | SLA |
|------|-------------|---------|---------|----------|-----|
| **Basic** | €29/month | Security only | Email | Standard | 48h |
| **Premium** | €59/month | All features | Email + Chat | Standard + Advanced Marketing | 24h |
| **Enterprise** | Custom | All + custom | Priority + Phone | All + Custom dev | 4h |

### Maintenance Expiration Procedure

**D-30 days**:
- Automatic reminder email
- Dashboard notification

**D-7 days**:
- Urgent reminder email
- Badge in admin dashboard

**D-0 (expiration)**:
- Update button disabled
- "Maintenance expired" badge visible
- Email with renewal link

**D+7 (grace period)**:
- Final reminder
- Site continues to work

**D+14**:
- npm package access revoked (optional)
- Site continues to work but frozen

### Technical Support
- **Email**: support@beindigital.com
- **Chat**: Integrated in admin dashboard (Premium+ clients)
- **Documentation**: docs.beindigital-engine.com
- **Changelog**: Visible in dashboard

## 📚 Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Convex Docs](https://docs.convex.dev)
- [Better Auth Docs](https://www.better-auth.com/)
- [Vercel Docs](https://vercel.com/docs)
- [Turborepo Docs](https://turbo.build/repo/docs)
- [Stripe Docs](https://stripe.com/docs)
- [SumUp API](https://developer.sumup.com/)
- [Uber Eats API](https://developer.uber.com/docs/eats)
- [Deliveroo API](https://deliveroo.engineering/)

### Internal Links
- **GitHub Organization**: `https://github.com/beindigital`
- **npm Registry**: `https://github.com/beindigital?tab=packages`
- **Admin Dashboard**: `https://admin.beindigital-engine.com`
- **Documentation**: `https://docs.beindigital-engine.com`
- **Website**: `https://beindigital-engine.com`

## 🔮 Roadmap

### Phase 1 - MVP (3 months)
- [x] Base architecture
- [ ] @be-in-digital/ui packages
- [ ] @be-in-digital/restaurant packages
- [ ] @be-in-digital/themes (6 themes)
- [ ] @be-in-digital/convex-schema packages
- [ ] @be-in-digital/convex-functions packages
- [ ] Better Auth integration
- [ ] Complete admin dashboard
- [ ] Kitchen Display System
- [ ] Order system
- [ ] Multi-provider payments (Stripe, SumUp, PayPal, Square)

### Phase 2 - Integrations (2 months)
- [ ] Uber Eats integration
- [ ] Deliveroo integration
- [ ] Uber Direct integration
- [ ] Click & Collect
- [ ] Basic email marketing
- [ ] Static CMS pages

### Phase 3 - Marketing & Gamification (2 months)
- [ ] Points system
- [ ] Achievements
- [ ] Leaderboard
- [ ] Advanced email campaigns
- [ ] Customer segmentation
- [ ] A/B testing

### Phase 4 - Analytics & Optimization (1 month)
- [ ] Advanced analytics dashboard
- [ ] Automatic reports
- [ ] AI predictions
- [ ] Product recommendations
- [ ] SEO optimization

### Phase 5 - Advanced Features
- [ ] Mobile app (React Native)
- [ ] Advanced loyalty program
- [ ] Table reservations
- [ ] Advanced inventory management
- [ ] Multi-currency
- [ ] Multi-country
- [ ] Public API for third-party integrations
- [ ] Full white-label (client subdomains)

---

**Version**: 1.1.0  
**Last Updated**: February 2026  
**Maintained by**: BeYours Team