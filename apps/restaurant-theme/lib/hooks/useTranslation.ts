"use client"

import { useMemo } from "react"
import { useLanguageStore } from "@beindigital-engine/restaurant"
import type { I18nKey } from "@/lib/i18n/index"

/**
 * Hook for translating static UI content.
 *
 * Merge order (first match wins):
 * 1. Convex override for current locale
 * 2. Static JSON for current locale
 * 3. Convex override for default locale
 * 4. Static JSON for default locale
 * 5. Static JSON for store default (ultimate fallback)
 * 6. Raw key (never empty)
 *
 * t() = O(1) lookup in a pre-merged object.
 */
export function useTranslation() {
  const locale = useLanguageStore((state) => state.locale)
  const defaultLocale = useLanguageStore((state) => state.defaultLocale)
  const isReady = useLanguageStore((state) => state.isReady)
  const overrides = useLanguageStore((state) => state.overrides)
  const staticStrings = useLanguageStore((state) => state.staticStrings)

  const merged = useMemo(() => {
    const result: Record<string, string> = {}

    // Build from lowest priority to highest (higher overwrites lower)
    // 5. Static JSON default locale (ultimate fallback)
    const defaultStatic = staticStrings.get(defaultLocale)
    if (defaultStatic) {
      Object.assign(result, defaultStatic)
    }

    // 4. Convex override default locale
    const defaultOverrides = overrides[defaultLocale]
    if (defaultOverrides) {
      Object.assign(result, defaultOverrides)
    }

    // 3. Static JSON current locale
    if (locale !== defaultLocale) {
      const localeStatic = staticStrings.get(locale)
      if (localeStatic) {
        Object.assign(result, localeStatic)
      }
    }

    // 2. Convex override current locale
    if (locale !== defaultLocale) {
      const localeOverrides = overrides[locale]
      if (localeOverrides) {
        Object.assign(result, localeOverrides)
      }
    }

    return result
  }, [locale, defaultLocale, overrides, staticStrings])

  const t = (key: I18nKey): string => {
    return merged[key] ?? key
  }

  return { t, locale, defaultLocale, isReady }
}
