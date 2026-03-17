/**
 * CMS Media Types & Validation
 *
 * Defines limits per media kind and provides upload validation.
 */

export type MediaKind = "image" | "video" | "file"

export interface MediaLimits {
  mimeTypes: string[]
  maxSize: number // bytes
}

export const CMS_MEDIA_LIMITS: Record<MediaKind, MediaLimits> = {
  image: {
    mimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ],
    maxSize: 10 * 1024 * 1024, // 10MB (SVG: 1MB enforced separately by sanitizer)
  },
  video: {
    mimeTypes: ["video/mp4", "video/webm"],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  file: {
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
    ],
    maxSize: 25 * 1024 * 1024, // 25MB
  },
}

/**
 * Canonical MIME type to file extension mapping.
 * Single source of truth — imported by Convex actions and storageUpload.
 */
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
}

/**
 * Returns the file extension for a given MIME type.
 * Falls back to "bin" for unknown types.
 */
export function getExtensionFromMimeType(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? "bin"
}

export interface MediaValidationError {
  code: "invalid_mime" | "file_too_large" | "invalid_filename"
  message: string
}

export interface MediaValidationResult {
  valid: boolean
  kind?: MediaKind
  error?: MediaValidationError
}

/**
 * Derives the media kind from MIME type
 */
export function getMediaKind(mimeType: string): MediaKind | null {
  for (const [kind, limits] of Object.entries(CMS_MEDIA_LIMITS)) {
    if (limits.mimeTypes.includes(mimeType)) {
      return kind as MediaKind
    }
  }
  return null
}

/**
 * Validates a media upload against CMS limits
 */
export function validateMediaUpload(
  filename: string,
  mimeType: string,
  size: number,
): MediaValidationResult {
  if (!filename || filename.trim().length === 0) {
    return {
      valid: false,
      error: {
        code: "invalid_filename",
        message: "Le nom de fichier est requis",
      },
    }
  }

  const kind = getMediaKind(mimeType)
  if (!kind) {
    const allMimes = Object.values(CMS_MEDIA_LIMITS).flatMap((l) => l.mimeTypes)
    return {
      valid: false,
      error: {
        code: "invalid_mime",
        message: `Type MIME "${mimeType}" non autorisé. Types acceptés : ${allMimes.join(", ")}`,
      },
    }
  }

  const limits = CMS_MEDIA_LIMITS[kind]
  if (size > limits.maxSize) {
    const limitMB = (limits.maxSize / (1024 * 1024)).toFixed(0)
    const sizeMB = (size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: {
        code: "file_too_large",
        message: `Fichier trop volumineux (${sizeMB}MB). Taille maximale pour ${kind} : ${limitMB}MB`,
      },
    }
  }

  return { valid: true, kind }
}
