/**
 * Admin Auth Store - Zustand
 *
 * Client-side state management for admin authentication.
 * Synced from Better Auth session + Convex userProfile by AdminAuthSync.
 * Not persisted to localStorage (auth data should not be cached).
 */

import { create } from "zustand"
import type { Role } from "@be-in-digital/core"

interface AdminUser {
  id: string
  email: string
  name?: string
  image?: string
}

interface AdminAuthState {
  user: AdminUser | null
  role: Role
  isLoading: boolean
  isAuthenticated: boolean
  signOut: (() => Promise<void>) | null
}

interface AdminAuthActions {
  setAuth: (
    user: AdminUser,
    role: Role,
    signOut: () => Promise<void>
  ) => void
  setLoading: (loading: boolean) => void
  clearAuth: () => void
}

export type AdminAuthStore = AdminAuthState & AdminAuthActions

export const useAdminAuthStore = create<AdminAuthStore>()((set) => ({
  // Initial state
  user: null,
  role: "customer" as Role,
  isLoading: true,
  isAuthenticated: false,
  signOut: null,

  // Actions
  setAuth: (user, role, signOut) => {
    set({
      user,
      role,
      isLoading: false,
      isAuthenticated: true,
      signOut,
    })
  },

  setLoading: (loading) => {
    set({ isLoading: loading })
  },

  clearAuth: () => {
    set({
      user: null,
      role: "customer" as Role,
      isLoading: false,
      isAuthenticated: false,
      signOut: null,
    })
  },
}))
