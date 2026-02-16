"use client"

import { DesignPage } from "../design/design-page"

/**
 * Wrapper component that embeds DesignPage within Settings tabs
 * Renders design customization interface without duplicate headers
 */
export function DesignTabContent() {
  return <DesignPage embedded />
}
