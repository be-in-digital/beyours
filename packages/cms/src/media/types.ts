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
    maxSize: 10 * 1024 * 1024, // 10MB (SVG is capped lower, see CMS_MEDIA_SIZE_OVERRIDES)
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

/**
 * Filename extensions a given MIME type is allowed to arrive under.
 *
 * `MIME_TO_EXT` answers "what do we store it as"; this answers "what may the
 * uploader have called it". They differ where a type has more than one common
 * spelling — `image/jpeg` is stored as `.jpg` and legitimately arrives as
 * `.jpeg` too — and conflating the two would refuse real photographs.
 */
export const MIME_ALLOWED_EXTENSIONS: Record<string, string[]> = {
  // `jfif` and `jpe` are what Windows and some scanners hand a browser for a
  // plain JPEG. Refusing them would refuse real photographs.
  "image/jpeg": ["jpg", "jpeg", "jfif", "jpe"],
  "image/jpg": ["jpg", "jpeg", "jfif", "jpe"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/svg+xml": ["svg"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "pptx",
  ],
}

/**
 * Size caps that are tighter than the cap for the kind as a whole.
 *
 * An SVG is markup, not pixels: it is the one accepted image type a browser can
 * be talked into treating as a document, and megabytes of it buy an uploader
 * nothing but parser surface. 1MB here is the same ceiling `cmsSvgUpload`
 * enforces on the other upload path, so both refuse the same file.
 */
export const CMS_MEDIA_SIZE_OVERRIDES: Record<string, number> = {
  "image/svg+xml": 1 * 1024 * 1024, // 1MB
}

/**
 * The largest upload accepted for a MIME type, in bytes.
 * Returns null for a type the CMS does not accept at all.
 */
export function maxSizeForMimeType(mimeType: string): number | null {
  const kind = getMediaKind(mimeType)
  if (!kind) return null

  const override = CMS_MEDIA_SIZE_OVERRIDES[mimeType]
  const kindLimit = CMS_MEDIA_LIMITS[kind].maxSize

  return override !== undefined ? Math.min(override, kindLimit) : kindLimit
}

/**
 * The extension a filename ends in, lowercased, or null when it has none.
 * Trailing dots and a leading-dot-only name ("`.env`") count as no extension.
 */
export function extensionFromFilename(filename: string): string | null {
  const base = filename.trim().split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  if (dot <= 0 || dot === base.length - 1) return null
  return base.slice(dot + 1).toLowerCase()
}

export interface MediaValidationError {
  code:
    | "invalid_mime"
    | "file_too_large"
    | "invalid_filename"
    | "mime_extension_mismatch"
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
 * Validates a media upload against CMS limits.
 *
 * This is the whole allow-list for the media library — MIME type, declared
 * extension and size — and it is called on both sides of the wire. The browser
 * calls it to tell an editor why their file was refused; `createMedia` calls it
 * because the browser is not the security boundary and an upload path that
 * accepts `text/html` is a stored-XSS vector.
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

  // A name ending `.html` handed over as `image/png` is not a mistyped upload,
  // it is an attempt to have the object served back as a document. A file with
  // no extension at all is accepted: the stored key is derived from the MIME
  // type, so there is nothing to disagree with.
  const extension = extensionFromFilename(filename)
  const allowedExtensions = MIME_ALLOWED_EXTENSIONS[mimeType] ?? []
  if (extension !== null && !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: {
        code: "mime_extension_mismatch",
        message: `L'extension ".${extension}" ne correspond pas au type "${mimeType}". Extensions acceptées : ${allowedExtensions.map((e) => `.${e}`).join(", ")}`,
      },
    }
  }

  const maxSize = maxSizeForMimeType(mimeType) ?? CMS_MEDIA_LIMITS[kind].maxSize
  if (size > maxSize) {
    const limitMB = (maxSize / (1024 * 1024)).toFixed(0)
    const sizeMB = (size / (1024 * 1024)).toFixed(1)
    const scope =
      CMS_MEDIA_SIZE_OVERRIDES[mimeType] !== undefined ? mimeType : kind
    return {
      valid: false,
      error: {
        code: "file_too_large",
        message: `Fichier trop volumineux (${sizeMB}MB). Taille maximale pour ${scope} : ${limitMB}MB`,
      },
    }
  }

  // A negative size is not a real file: it is the only value that slips under
  // every cap above.
  if (!Number.isFinite(size) || size < 0) {
    return {
      valid: false,
      error: {
        code: "file_too_large",
        message: `Taille de fichier invalide : ${size}`,
      },
    }
  }

  return { valid: true, kind }
}
