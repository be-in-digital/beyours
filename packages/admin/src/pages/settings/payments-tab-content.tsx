"use client"

import { PaymentsPage } from "../payments/payments-page"

/**
 * Wrapper component that embeds PaymentsPage within Settings tabs
 * Renders payment management interface without duplicate headers
 */
export function PaymentsTabContent() {
  return <PaymentsPage embedded />
}
