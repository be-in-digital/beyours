/**
 * UI Store - Zustand
 *
 * Client-side state management for UI interactions
 * No persistence needed for UI state
 */

import { create } from 'zustand'

/**
 * UI state
 */
export interface UIState {
  isMobileMenuOpen: boolean
  isCartOpen: boolean
  isSidebarOpen: boolean
  activeModal: string | null
}

/**
 * UI actions
 */
export interface UIActions {
  toggleMobileMenu: () => void
  toggleCart: () => void
  toggleSidebar: () => void
  openModal: (modalId: string) => void
  closeModal: () => void
}

/**
 * UI store type
 */
export type UIStore = UIState & UIActions

/**
 * UI store (no persistence)
 */
export const useUIStore = create<UIStore>()((set) => ({
  // Initial state
  isMobileMenuOpen: false,
  isCartOpen: false,
  isSidebarOpen: true,
  activeModal: null,

  // Actions
  toggleMobileMenu: () => {
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen }))
  },

  toggleCart: () => {
    set((state) => ({ isCartOpen: !state.isCartOpen }))
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }))
  },

  openModal: (modalId) => {
    set({ activeModal: modalId })
  },

  closeModal: () => {
    set({ activeModal: null })
  },
}))
