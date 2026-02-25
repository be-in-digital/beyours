"use client"

import { useLanguageStore } from "@beindigital-engine/restaurant"

/**
 * Hook for reading translated dynamic content (products, categories, menus).
 *
 * Fallback chain:
 * 1. entity.translations[locale][field]
 * 2. entity.translations[defaultLocale][field]
 * 3. entity[field] (source language value)
 *
 * Never returns empty string — falls through to source value.
 */
export function useTranslatedField<
  T extends Record<string, any> & {
    translations?: Record<string, Record<string, string | undefined>>
  },
>(entity: T | null | undefined, field: string): string {
  const locale = useLanguageStore((state) => state.locale)
  const defaultLocale = useLanguageStore((state) => state.defaultLocale)

  if (!entity) return ""

  // 1. Current locale translation
  const localeValue = entity.translations?.[locale]?.[field]
  if (localeValue) return localeValue

  // 2. Default locale translation
  const defaultValue = entity.translations?.[defaultLocale]?.[field]
  if (defaultValue) return defaultValue

  // 3. Source field value
  const sourceValue = (entity as Record<string, any>)[field]
  return typeof sourceValue === "string" ? sourceValue : ""
}
