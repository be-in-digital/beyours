/**
 * CMS Block Validation
 *
 * Validates CmsBlockValues against the registry definition.
 * Used by Convex mutations before persisting drafts.
 */

import type { CmsBlockValues, CmsFieldValue, BlockDefinition, FieldType } from "../registry/types"

export interface ValidationError {
  fieldKey: string
  code: "unknown_field" | "type_mismatch" | "required" | "max_length" | "invalid_option"
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/** Field types that support textValue */
const TEXT_TYPES: FieldType[] = ["text", "richtext"]

/** Field types that support mediaId */
const MEDIA_TYPES: FieldType[] = ["image", "video", "file"]

/**
 * Validate block values against a block definition from the registry.
 *
 * Checks:
 * - No unknown fields (fields not in the registry)
 * - Type matches (textValue for text/richtext, mediaId for media types)
 * - Required fields have a value (unless hasCodeFallback or isCleared)
 * - maxLength not exceeded for text/richtext
 */
export function validateBlockValues(
  values: CmsBlockValues,
  blockDef: BlockDefinition,
): ValidationResult {
  const errors: ValidationError[] = []

  for (const [fieldKey, fieldValue] of Object.entries(values)) {
    const fieldDef = blockDef.fields[fieldKey]

    // Unknown field
    if (!fieldDef) {
      errors.push({
        fieldKey,
        code: "unknown_field",
        message: `Field "${fieldKey}" is not defined in block "${blockDef.key}"`,
      })
      continue
    }

    // isCleared fields skip other validations
    if (fieldValue.isCleared) {
      continue
    }

    // Type mismatch
    if (fieldValue.type !== fieldDef.type) {
      errors.push({
        fieldKey,
        code: "type_mismatch",
        message: `Field "${fieldKey}" expects type "${fieldDef.type}" but got "${fieldValue.type}"`,
      })
      continue
    }

    // Type-specific validation
    validateFieldValue(fieldKey, fieldValue, fieldDef.type, fieldDef.maxLength, fieldDef.options, errors)
  }

  // Required field check — only if field has no code fallback
  for (const [fieldKey, fieldDef] of Object.entries(blockDef.fields)) {
    if (!fieldDef.required || fieldDef.hasCodeFallback) continue

    const value = values[fieldKey]
    if (!value || value.isCleared || !hasContent(value, fieldDef.type)) {
      errors.push({
        fieldKey,
        code: "required",
        message: `Field "${fieldKey}" is required and has no code fallback`,
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

function validateFieldValue(
  fieldKey: string,
  value: CmsFieldValue,
  type: FieldType,
  maxLength: number | undefined,
  options: import("../registry/types").SelectOption[] | undefined,
  errors: ValidationError[],
): void {
  // maxLength check for text types
  if (TEXT_TYPES.includes(type) && maxLength !== undefined && value.textValue) {
    // For richtext, strip HTML tags before measuring length
    const plainText = type === "richtext"
      ? stripHtml(value.textValue)
      : value.textValue

    if (plainText.length > maxLength) {
      errors.push({
        fieldKey,
        code: "max_length",
        message: `Field "${fieldKey}" exceeds max length of ${maxLength} (got ${plainText.length})`,
      })
    }
  }

  // Select: validate textValue is in allowed options
  if (type === "select" && value.textValue && options) {
    const validValues = options.map((o) => o.value)
    if (!validValues.includes(value.textValue)) {
      errors.push({
        fieldKey,
        code: "invalid_option",
        message: `Field "${fieldKey}" has invalid option "${value.textValue}". Allowed: ${validValues.join(", ")}`,
      })
    }
  }
}

function hasContent(value: CmsFieldValue, type: FieldType): boolean {
  if (TEXT_TYPES.includes(type) || type === "select") {
    return !!value.textValue && value.textValue.trim().length > 0
  }
  // Video has dual content sources: mediaId OR embedUrl
  if (type === "video") {
    return !!value.mediaId || !!value.embedUrl
  }
  if (MEDIA_TYPES.includes(type)) {
    return !!value.mediaId
  }
  return false
}

/** Strip HTML tags for character counting (simple approach) */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}
