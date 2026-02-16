"use client"

import { LanguagesPage } from "../languages/languages-page"

/**
 * Wrapper component that embeds LanguagesPage within Settings tabs
 * Renders language management interface without duplicate headers
 */
export function LanguagesTabContent() {
  return <LanguagesPage embedded />
}
