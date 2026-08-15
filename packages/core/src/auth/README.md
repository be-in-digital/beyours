# Module Auth - @be-in-digital/core

Ce module fournit une solution complète d'authentification avec **Better Auth** et un système **RBAC (Role-Based Access Control)** pour BeYours Engine.

## 📦 Installation des dépendances

Le module auth est conçu pour fonctionner avec Better Auth. Installez les dépendances nécessaires :

```bash
pnpm add better-auth @better-auth/convex @better-auth/two-factor
```

## 🏗️ Architecture

Le module est composé de 4 fichiers principaux :

### 1. `rbac.ts` - Système de permissions (100% fonctionnel)
Gère les 7 rôles et leurs permissions granulaires.

**Rôles disponibles :**
- `super_admin` - Accès total
- `client_admin` - Tout sur son restaurant
- `manager` - Gestion opérationnelle
- `kitchen` - KDS uniquement
- `waiter` - Commandes + tables
- `delivery` - Livraisons uniquement
- `customer` - Ses propres commandes

**Exemple d'utilisation :**
```ts
import { Role, hasPermission } from '@be-in-digital/core/auth'

// Vérifier une permission
hasPermission(Role.MANAGER, 'products:write') // true
hasPermission(Role.CUSTOMER, 'products:delete') // false

// Middleware de vérification
const checkDelete = requirePermission('products:delete')
checkDelete(userRole) // throw si pas la permission
```

### 2. `config.ts` - Configuration Better Auth
Configuration de base pour Better Auth avec Convex.

**Après installation de better-auth :**
```ts
import { betterAuth } from 'better-auth'
import { convexAdapter } from '@better-auth/convex'
import { twoFactorPlugin } from '@better-auth/two-factor'

export const auth = betterAuth({
  baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
  secret: process.env.AUTH_SECRET!,
  database: convexAdapter({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    // ... autres providers
  },
  plugins: [
    twoFactorPlugin({
      methods: ['totp', 'email'],
      totpIssuer: 'BeYours',
    }),
  ],
})
```

### 3. `client.ts` - Hooks React
Hooks et utilitaires pour le frontend React.

**Après installation de better-auth/react :**
```tsx
import { createAuthClient } from 'better-auth/react'
import { usePermission, Role } from '@be-in-digital/core/auth'

// Créer le client
const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
})

// Utiliser dans un composant
function ProductManager() {
  const { allowed, loading } = usePermission('products:write')

  if (!allowed) return <AccessDenied />

  return <ProductForm />
}

// Composant conditionnel (à implémenter dans votre app)
function CanAccess({ permission, children }: CanAccessProps) {
  const { allowed, loading } = usePermission(permission)
  if (loading) return null
  return allowed ? <>{children}</> : null
}
```

### 4. `server.ts` - Utilitaires serveur
Middlewares pour Server Components et API Routes.

**Exemple dans un Server Component :**
```ts
import { requireAuth, requirePermission } from '@be-in-digital/core/auth'

export default async function DashboardPage() {
  const session = await requireAuth()
  return <div>Bonjour {session.user.name}</div>
}
```

**Exemple dans une API Route :**
```ts
import { withAuthRoute } from '@be-in-digital/core/auth'

export const DELETE = withAuthRoute(
  async (req, session) => {
    // session est garanti non-null avec la bonne permission
    return Response.json({ success: true })
  },
  { requirePermission: 'products:delete' }
)
```

## 🧪 Tests

Le module RBAC est 100% testé avec 47 tests couvrant tous les scénarios.

```bash
# Lancer les tests
pnpm --filter @be-in-digital/core test

# Tests en watch mode
pnpm --filter @be-in-digital/core test:watch
```

## 📝 Variables d'environnement

```bash
# Better Auth
AUTH_SECRET=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# OAuth Providers (optionnel)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

## 🚀 Étapes d'intégration

### 1. Installer Better Auth
```bash
pnpm add better-auth @better-auth/convex @better-auth/two-factor
```

### 2. Configurer Better Auth
Créer `apps/restaurant-theme/lib/auth.ts` :
```ts
import { betterAuth } from 'better-auth'
import { convexAdapter } from '@better-auth/convex'
import { createAuthConfig } from '@be-in-digital/core/auth'

export const auth = betterAuth(
  createAuthConfig({
    baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
    secret: process.env.AUTH_SECRET!,
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  })
)
```

### 3. Créer le client React
Créer `apps/restaurant-theme/lib/auth-client.ts` :
```ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
})

// Exporter les hooks
export { useAuth, usePermission, useRole } from '@be-in-digital/core/auth'
```

### 4. Ajouter le provider
Dans `apps/restaurant-theme/app/layout.tsx` :
```tsx
import { SessionProvider } from 'better-auth/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

### 5. Protéger les pages
```tsx
import { requireAuth, requirePermission } from '@be-in-digital/core/auth'

export default async function ProductsPage() {
  await requirePermission('products:read')
  // Page protégée
}
```

## 📊 Matrice des permissions

| Rôle | Products | Orders | Kitchen | Team | Settings | Payments |
|------|----------|--------|---------|------|----------|----------|
| super_admin | ✅ Tout | ✅ Tout | ✅ Tout | ✅ Tout | ✅ Tout | ✅ Tout |
| client_admin | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ Read + Refund |
| manager | ✅ Read + Write | ✅ CRUD | ✅ Read + Write | ✅ Read | ✅ Read | ✅ Read |
| kitchen | ❌ | ✅ Read + Update Status | ✅ CRUD | ❌ | ❌ | ❌ |
| waiter | ✅ Read | ✅ CRUD | ❌ | ❌ | ❌ | ✅ Read |
| delivery | ❌ | ✅ Read + Update Status | ❌ | ❌ | ❌ | ❌ |
| customer | ✅ Read | ✅ View Own | ❌ | ❌ | ❌ | ❌ |

## 🔒 Sécurité

- **TypeScript strict mode** : Aucun `any` type
- **Zod validation** : Tous les inputs validés
- **Permission checks** : Toujours vérifier côté serveur ET client
- **Session management** : 7 jours d'expiration, refresh après 1 jour
- **2FA support** : TOTP et email
- **Rate limiting** : À implémenter dans les hooks

## 📚 Documentation complète

Voir `CLAUDE.md` à la racine du projet pour l'architecture complète.

---

**Note importante** : Le RBAC est 100% fonctionnel et testé SANS Better Auth. Les fonctions client.ts et server.ts sont des wrappers qui seront fonctionnels une fois Better Auth installé.
