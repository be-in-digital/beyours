/**
 * @be-in-digital/cms
 *
 * CMS package for BeYours Engine.
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
  CmsGroupDefinition,
} from "./registry/types"

// ============================================================================
// Registry
// ============================================================================
export {
  setCmsRegistry,
  getCmsRegistry,
  getCmsGroups,
  getPageDefinition,
  getBlockDefinition,
  getFieldDefinition,
  getAllPageSlugs,
} from "./registry"

// ============================================================================
// Shared Blocks
// ============================================================================
export { seoBlock } from "./registry/blocks/seoBlock"

// ============================================================================
// Validation
// ============================================================================
export { validateBlockValues } from "./validation/validateBlockValues"
export type { ValidationError, ValidationResult } from "./validation/validateBlockValues"

// ============================================================================
// Sanitize
// ============================================================================
// `sanitizeSvg` is deliberately NOT re-exported here. It parses markup through
// DOMPurify, which needs a DOM, and this barrel is imported by Convex isolate
// modules (`convex/cms.ts`, `cmsAutoTranslate.ts`, `cmsSeedData.ts`,
// `cmsMediaConfirmUpload.ts`) that have none — a barrel re-export made the whole
// backend fail to push:
//
//   Failed to analyze cms.js: Cannot read properties of undefined (reading 'bind')
//
// It ships from `@be-in-digital/cms/sanitize` instead, so only the server-side
// callers that actually sanitize pull the parser in.
//
// The refusal check below is DOM-free and dependency-free, so it stays here for
// the Convex callers that cannot import the parser.
export {
  containsActiveContent,
  inspectSvgForActiveContent,
} from "./sanitize/svgActiveContent"
export type { ActiveContentReport } from "./sanitize/svgActiveContent"

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
