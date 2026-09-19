/**
 * useTranslation — the storefront's `t()`.
 *
 * Everything needed to translate the UI was already in the language store:
 * the static JSON catalogues, the restaurateur's manual overrides, the current
 * locale and the default one. What was missing was a way to *read* them.
 * `setOverrides` and `setStaticStrings` had zero call sites and nothing ever
 * resolved a key, so switching language changed `<html lang>` and not one word
 * a customer could read.
 */

import { useMemo } from 'react'
import { localizeDocument, localizeDocuments } from '@be-yours/core'
import type { TranslatorFunction, TranslatableDocument } from '@be-yours/core'
import { useLanguageStore, buildTranslator } from '../stores/language'

export interface UseTranslationResult {
  /** Resolve a key: override → static JSON → default locale → the key itself. */
  t: TranslatorFunction
  /** The locale being rendered. */
  locale: string
  /** The store's source language, which every fallback lands on. */
  defaultLocale: string
  /**
   * False until the initialiser has read the store's languages.
   *
   * Text still resolves while false — it falls back to the default locale —
   * so a component may render immediately and does not have to gate on this.
   */
  isReady: boolean
}

/**
 * Subscribe to the language store and return a translator for the current
 * locale.
 *
 * The translator is rebuilt only when one of its four inputs changes; Zustand
 * hands back the same object identity otherwise, so a re-render caused by
 * anything else does not rebuild it.
 */
export function useTranslation(): UseTranslationResult {
  const locale = useLanguageStore((s) => s.locale)
  const defaultLocale = useLanguageStore((s) => s.defaultLocale)
  const overrides = useLanguageStore((s) => s.overrides)
  const staticStrings = useLanguageStore((s) => s.staticStrings)
  const isReady = useLanguageStore((s) => s.isReady)

  const t = useMemo(
    () => buildTranslator({ locale, defaultLocale, overrides, staticStrings }),
    [locale, defaultLocale, overrides, staticStrings]
  )

  return { t, locale, defaultLocale, isReady }
}

/**
 * The catalogue text to render for the current locale.
 *
 * Product, category and menu translations live on the document itself, in the
 * `translations` column the auto-translator writes — not in the `translations`
 * table, which holds CMS, blog and UI strings. So there is nothing to fetch:
 * the component already holds everything it needs, and this only picks the
 * right field off it, falling back to the source language field by field.
 */
export function useLocalizedDocument<T extends TranslatableDocument>(doc: T): T {
  const locale = useLanguageStore((s) => s.locale)

  return useMemo(() => {
    const { name, description } = localizeDocument(doc, locale)
    return {
      ...doc,
      name,
      ...(description === undefined ? {} : { description }),
    }
  }, [doc, locale])
}

/** `useLocalizedDocument` over a list, tolerating `undefined` while it loads. */
export function useLocalizedDocuments<T extends TranslatableDocument>(
  docs: readonly T[] | undefined | null
): T[] {
  const locale = useLanguageStore((s) => s.locale)

  return useMemo(() => localizeDocuments(docs ?? [], locale), [docs, locale])
}
