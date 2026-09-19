/**
 * Admin Auth Store - Zustand
 *
 * Client-side state management for admin authentication.
 * Synced from Better Auth session + Convex userProfile by AdminAuthSync.
 * Not persisted to localStorage (auth data should not be cached).
 */

import { create } from "zustand"
import type { Role } from "@be-yours/core"

interface AdminUser {
  id: string
  email: string
  name?: string
  image?: string
}

interface AdminAuthState {
  user: AdminUser | null
  role: Role
  /**
   * The module checkboxes the owner ticked for this member, from
   * `userProfiles.permissions`.
   *
   * The server runs TWO gates on every store query: the RBAC role check, and
   * then `profileAllowsPermission`, which narrows the role to the modules the
   * member was actually granted. The sidebar knew only about the first, so a
   * manager invited with `["orders"]` alone was shown every entry their role
   * permits and refused by `module_denied` on all of them.
   *
   * An EMPTY list means unrestricted, exactly as the server reads it — every
   * profile in every existing deployment has `permissions: []`, and reading
   * that as "nothing allowed" would empty the sidebar for everyone.
   */
  permissions: string[]
  isLoading: boolean
  isAuthenticated: boolean
  signOut: (() => Promise<void>) | null
}

interface AdminAuthActions {
  setAuth: (
    user: AdminUser,
    role: Role,
    signOut: () => Promise<void>,
    /** Omitted means unrestricted — see `permissions` above. */
    permissions?: string[]
  ) => void
  setLoading: (loading: boolean) => void
  clearAuth: () => void
}

export type AdminAuthStore = AdminAuthState & AdminAuthActions

export const useAdminAuthStore = create<AdminAuthStore>()((set) => ({
  // Initial state
  user: null,
  role: "customer" as Role,
  permissions: [],
  isLoading: true,
  isAuthenticated: false,
  signOut: null,

  // Actions
  setAuth: (user, role, signOut, permissions = []) => {
    set({
      user,
      role,
      permissions,
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
      permissions: [],
      isLoading: false,
      isAuthenticated: false,
      signOut: null,
    })
  },
}))
