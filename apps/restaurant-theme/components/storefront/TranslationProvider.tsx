"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useStoreStore } from "@beindigital-engine/restaurant"
import { useLanguageStore } from "@beindigital-engine/restaurant"
import { loadAllStaticStrings } from "@/lib/i18n/index"

interface TranslationProviderProps {
  children: ReactNode
}

/**
 * TranslationProvider — data-fetching component in the storefront layout
 * that boots the entire i18n system and writes to the Zustand store:
 *
 * 1. Fetches active languages from Convex → initializes useLanguageStore
 * 2. Fetches UI overrides from Convex → writes to useLanguageStore.overrides
 * 3. Prefetches all static JSON locale files → writes to useLanguageStore.staticStrings
 */
export function TranslationProvider({ children }: TranslationProviderProps) {
  const currentStore = useStoreStore((state) => state.currentStore)
  const storeId = currentStore?._id

  // 1. Fetch active languages
  const languages = useQuery(
    api.languages.listActive,
    storeId ? { storeId: storeId as any } : "skip"
  )

  // 2. Fetch UI overrides
  const rawOverrides = useQuery(
    api.translations.getUIOverrides,
    storeId ? { storeId: storeId as any } : "skip"
  )

  const initialize = useLanguageStore((state) => state.initialize)
  const setOverrides = useLanguageStore((state) => state.setOverrides)
  const setStaticStrings = useLanguageStore((state) => state.setStaticStrings)
  const initializedRef = useRef(false)

  // Initialize language store when languages arrive
  useEffect(() => {
    if (!languages || languages.length === 0) return

    const defaultLang = languages.find((l: any) => l.isDefault)
    const defaultCode = defaultLang?.code ?? "fr"

    const storeLanguages = languages.map((l: any) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      flagEmoji: l.flagEmoji,
      isDefault: l.isDefault,
      isActive: l.isActive,
    }))

    // Handle case: current locale became inactive → re-initialize
    if (initializedRef.current) {
      const langStore = useLanguageStore.getState()
      const activeCodes = languages
        .filter((l: any) => l.isActive)
        .map((l: any) => l.code)

      if (!activeCodes.includes(langStore.locale)) {
        initialize(storeLanguages, defaultCode)
      }
      return
    }

    initialize(storeLanguages, defaultCode)
    initializedRef.current = true

    // Prefetch all active locale files
    const codes = languages.map((l: any) => l.code)
    loadAllStaticStrings(codes).then(setStaticStrings).catch((err) => {
      console.error("[TranslationProvider] Failed to load static strings:", err)
    })
  }, [languages, initialize, setStaticStrings])

  // Write overrides to Zustand when they arrive or change
  useEffect(() => {
    setOverrides(rawOverrides ?? {})
  }, [rawOverrides, setOverrides])

  return <>{children}</>
}
