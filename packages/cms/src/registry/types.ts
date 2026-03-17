/**
 * CMS Registry Types
 *
 * Defines the static structure of editable content zones.
 * Pure TypeScript — no Convex/React dependencies.
 */

/** Supported field types for CMS content */
export type FieldType = "text" | "richtext" | "image" | "video" | "file" | "select"

/** Option for select field type */
export interface SelectOption {
  value: string
  label: string
}

/** Definition of a single editable field within a block */
export interface FieldDefinition {
  type: FieldType
  /** Display label for admin UI (e.g. "Titre principal") */
  label: string
  /** Help text for admin UI */
  description?: string
  /** Whether this field must have a value to publish */
  required?: boolean
  /** Max character count for text/richtext fields */
  maxLength?: number
  /** Placeholder text for text inputs */
  placeholder?: string
  /** Whether this field can be translated (default: true for text/richtext, false for media) */
  translatable?: boolean
  /** Whether a code fallback exists — critical for reset/publish logic */
  hasCodeFallback: boolean
  /** Options for select field type */
  options?: SelectOption[]
}

/** Definition of a content block (section) within a page */
export interface BlockDefinition {
  /** Unique key within the page (e.g. "hero", "form") */
  key: string
  /** Display label for admin UI */
  label: string
  /** Help text for admin UI */
  description?: string
  /** Field definitions keyed by field name */
  fields: Record<string, FieldDefinition>
}

/** Definition of a CMS-editable page */
export interface PageDefinition {
  /** URL slug (e.g. "sign-in") — must match the route */
  slug: string
  /** Display label for admin UI */
  label: string
  /** Help text for admin UI */
  description?: string
  /** Content blocks for this page */
  blocks: BlockDefinition[]
}

/**
 * Value of a single CMS field as stored in cmsBlocks.values
 */
export interface CmsFieldValue {
  type: FieldType
  /** Text content (for text/richtext) */
  textValue?: string
  /** Reference to cmsMedia record (for image/video/file) */
  mediaId?: string
  /** Alt text contextual to this field usage */
  altText?: string
  /** Embed URL (for video embed) */
  embedUrl?: string
  /** Embed provider (for video embed) */
  embedProvider?: "youtube" | "vimeo"
  /** Explicit reset to code fallback */
  isCleared?: boolean
}

/** Map of field key -> field value, as stored in a cmsBlock record */
export type CmsBlockValues = Record<string, CmsFieldValue>
