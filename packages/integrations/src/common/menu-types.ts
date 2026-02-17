/**
 * Shared menu types used by platform integrations (Uber Eats, Deliveroo).
 * pullMenu() functions return PulledCategory[] for a unified import format.
 */

export interface PulledCategory {
  externalId: string
  name: string
  items: PulledItem[]
}

export interface PulledItem {
  externalId: string
  name: string
  description?: string
  imageUrl?: string
  /** Price in cents (minor units) */
  price: number
  modifierGroups: PulledModifierGroup[]
}

export interface PulledModifierGroup {
  externalId: string
  name: string
  modifiers: PulledModifier[]
}

export interface PulledModifier {
  externalId: string
  name: string
  /** Price in cents (minor units) */
  price: number
}
