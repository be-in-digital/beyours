/**
 * @beindigital-engine/cms
 *
 * CMS package for BeInDigital Engine.
 * Provides registry definitions, types, and validation for the CMS system.
 */

// ============================================================================
// Types
// ============================================================================
export type {
  FieldType,
  SelectOption,
  FieldDefinition,
  BlockDefinition,
  PageDefinition,
  CmsFieldValue,
  CmsBlockValues,
} from "./registry/types"

// ============================================================================
// Registry
// ============================================================================
export {
  cmsRegistry,
  getPageDefinition,
  getBlockDefinition,
  getFieldDefinition,
  getAllPageSlugs,
} from "./registry"

// ============================================================================
// Validation
// ============================================================================
export { validateBlockValues } from "./validation/validateBlockValues"
export type { ValidationError, ValidationResult } from "./validation/validateBlockValues"

// ============================================================================
// Sanitize
// ============================================================================
export { sanitizeSvg } from "./sanitize/svgSanitizer"
export type { SanitizeResult } from "./sanitize/svgSanitizer"

// ============================================================================
// Media
// ============================================================================
export {
  CMS_MEDIA_LIMITS,
  MIME_TO_EXT,
  getMediaKind,
  getExtensionFromMimeType,
  validateMediaUpload,
} from "./media/types"
export type {
  MediaKind,
  MediaLimits,
  MediaValidationError,
  MediaValidationResult,
} from "./media/types"
