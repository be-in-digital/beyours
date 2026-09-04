import { describe, it, expect } from "vitest"
import {
  CMS_MEDIA_LIMITS,
  CMS_MEDIA_SIZE_OVERRIDES,
  extensionFromFilename,
  getMediaKind,
  maxSizeForMimeType,
  validateMediaUpload,
} from "../media/types"

// ---------------------------------------------------------------------------
// Constants derived from the real limits so tests stay in sync with the source
// ---------------------------------------------------------------------------
const IMAGE_MAX = CMS_MEDIA_LIMITS.image.maxSize // 10 * 1024 * 1024
const VIDEO_MAX = CMS_MEDIA_LIMITS.video.maxSize // 100 * 1024 * 1024
const FILE_MAX = CMS_MEDIA_LIMITS.file.maxSize // 25 * 1024 * 1024

// All accepted MIME types, in the order the source builds them
const ALL_ACCEPTED_MIMES = Object.values(CMS_MEDIA_LIMITS).flatMap(
  (l) => l.mimeTypes,
)

// ---------------------------------------------------------------------------
// getMediaKind
// ---------------------------------------------------------------------------
describe("getMediaKind", () => {
  describe("image MIME types", () => {
    it('returns "image" for image/jpeg', () => {
      expect(getMediaKind("image/jpeg")).toBe("image")
    })

    it('returns "image" for image/jpg', () => {
      expect(getMediaKind("image/jpg")).toBe("image")
    })

    it('returns "image" for image/png', () => {
      expect(getMediaKind("image/png")).toBe("image")
    })

    it('returns "image" for image/webp', () => {
      expect(getMediaKind("image/webp")).toBe("image")
    })

    it('returns "image" for image/svg+xml', () => {
      expect(getMediaKind("image/svg+xml")).toBe("image")
    })
  })

  describe("video MIME types", () => {
    it('returns "video" for video/mp4', () => {
      expect(getMediaKind("video/mp4")).toBe("video")
    })

    it('returns "video" for video/webm', () => {
      expect(getMediaKind("video/webm")).toBe("video")
    })
  })

  describe("file MIME types", () => {
    it('returns "file" for application/pdf', () => {
      expect(getMediaKind("application/pdf")).toBe("file")
    })

    it('returns "file" for DOCX MIME type', () => {
      expect(
        getMediaKind(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ).toBe("file")
    })

    it('returns "file" for XLSX MIME type', () => {
      expect(
        getMediaKind(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      ).toBe("file")
    })

    it('returns "file" for PPTX MIME type', () => {
      expect(
        getMediaKind(
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ),
      ).toBe("file")
    })
  })

  describe("unknown / unsupported MIME types", () => {
    it("returns null for text/plain", () => {
      expect(getMediaKind("text/plain")).toBeNull()
    })

    it("returns null for an empty string", () => {
      expect(getMediaKind("")).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// validateMediaUpload
// ---------------------------------------------------------------------------
describe("validateMediaUpload", () => {
  // ---- filename validation -------------------------------------------------
  describe("filename validation", () => {
    it("returns invalid with code invalid_filename when filename is empty", () => {
      const result = validateMediaUpload("", "image/jpeg", 1024)
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe("invalid_filename")
    })

    it("returns invalid with code invalid_filename when filename is whitespace only", () => {
      const result = validateMediaUpload("   ", "image/jpeg", 1024)
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe("invalid_filename")
    })
  })

  // ---- MIME type validation ------------------------------------------------
  describe("MIME type validation", () => {
    it("returns invalid with code invalid_mime for an unknown MIME type", () => {
      const result = validateMediaUpload("document.txt", "text/plain", 1024)
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe("invalid_mime")
    })

    it("includes every accepted MIME type in the invalid_mime error message", () => {
      const result = validateMediaUpload("file.txt", "text/html", 1024)
      expect(result.valid).toBe(false)
      for (const mime of ALL_ACCEPTED_MIMES) {
        expect(result.error?.message).toContain(mime)
      }
    })
  })

  // ---- valid uploads -------------------------------------------------------
  describe("valid uploads", () => {
    it('accepts a valid jpeg image (1 MB) and returns kind "image"', () => {
      const result = validateMediaUpload(
        "photo.jpg",
        "image/jpeg",
        1 * 1024 * 1024,
      )
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("image")
      expect(result.error).toBeUndefined()
    })

    it('accepts a valid mp4 video (50 MB) and returns kind "video"', () => {
      const result = validateMediaUpload(
        "clip.mp4",
        "video/mp4",
        50 * 1024 * 1024,
      )
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("video")
      expect(result.error).toBeUndefined()
    })

    it('accepts a valid pdf file (5 MB) and returns kind "file"', () => {
      const result = validateMediaUpload(
        "report.pdf",
        "application/pdf",
        5 * 1024 * 1024,
      )
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("file")
      expect(result.error).toBeUndefined()
    })

    it("accepts an SVG image and returns kind \"image\"", () => {
      const result = validateMediaUpload(
        "icon.svg",
        "image/svg+xml",
        50 * 1024,
      )
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("image")
    })

    it("accepts a DOCX file and returns kind \"file\"", () => {
      const result = validateMediaUpload(
        "contract.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        200 * 1024,
      )
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("file")
    })

    it("accepts a zero-size file (size 0 is under every limit)", () => {
      const result = validateMediaUpload("empty.png", "image/png", 0)
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("image")
    })
  })

  // ---- image size boundary ------------------------------------------------
  describe("image size boundary (10 MB)", () => {
    it("accepts an image at exactly 10 MB", () => {
      const result = validateMediaUpload("photo.png", "image/png", IMAGE_MAX)
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("image")
    })

    it("rejects an image at 10 MB + 1 byte with code file_too_large", () => {
      const result = validateMediaUpload(
        "photo.png",
        "image/png",
        IMAGE_MAX + 1,
      )
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe("file_too_large")
    })
  })

  // ---- video size boundary ------------------------------------------------
  describe("video size boundary (100 MB)", () => {
    it("accepts a video at exactly 100 MB", () => {
      const result = validateMediaUpload("video.mp4", "video/mp4", VIDEO_MAX)
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("video")
    })

    it("rejects a video at 100 MB + 1 byte with code file_too_large", () => {
      const result = validateMediaUpload(
        "video.mp4",
        "video/mp4",
        VIDEO_MAX + 1,
      )
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe("file_too_large")
    })
  })

  // ---- file size boundary -------------------------------------------------
  describe("file size boundary (25 MB)", () => {
    it("accepts a file at exactly 25 MB", () => {
      const result = validateMediaUpload(
        "document.pdf",
        "application/pdf",
        FILE_MAX,
      )
      expect(result.valid).toBe(true)
      expect(result.kind).toBe("file")
    })

    it("rejects a file at 25 MB + 1 byte with code file_too_large", () => {
      const result = validateMediaUpload(
        "document.pdf",
        "application/pdf",
        FILE_MAX + 1,
      )
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe("file_too_large")
    })
  })
})

// ---------------------------------------------------------------------------
// extensionFromFilename
// ---------------------------------------------------------------------------
describe("extensionFromFilename", () => {
  it("returns the lowercased extension", () => {
    expect(extensionFromFilename("PHOTO.PNG")).toBe("png")
  })

  it("returns the last extension of a double-barrelled name", () => {
    expect(extensionFromFilename("archive.tar.gz")).toBe("gz")
  })

  it("returns null when there is no extension", () => {
    expect(extensionFromFilename("screenshot")).toBeNull()
  })

  it("returns null for a dotfile with no extension", () => {
    expect(extensionFromFilename(".env")).toBeNull()
  })

  it("returns null when the name ends in a dot", () => {
    expect(extensionFromFilename("photo.")).toBeNull()
  })

  it("ignores directory segments", () => {
    expect(extensionFromFilename("dossier.old/photo.png")).toBe("png")
  })
})

// ---------------------------------------------------------------------------
// maxSizeForMimeType
// ---------------------------------------------------------------------------
describe("maxSizeForMimeType", () => {
  it("caps SVG at 1 MB, below the 10 MB image limit", () => {
    expect(maxSizeForMimeType("image/svg+xml")).toBe(1 * 1024 * 1024)
    expect(CMS_MEDIA_SIZE_OVERRIDES["image/svg+xml"]).toBe(1 * 1024 * 1024)
  })

  it("uses the kind limit where there is no override", () => {
    expect(maxSizeForMimeType("image/png")).toBe(IMAGE_MAX)
    expect(maxSizeForMimeType("video/mp4")).toBe(VIDEO_MAX)
    expect(maxSizeForMimeType("application/pdf")).toBe(FILE_MAX)
  })

  it("returns null for a type the CMS does not accept", () => {
    expect(maxSizeForMimeType("text/html")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The hostile cases this allow-list exists for (#167)
//
// `validateMediaUpload` was called only by two browser components. It is now
// also the server-side check in `createMedia`, so every case below is a request
// the backend has to refuse on its own.
// ---------------------------------------------------------------------------
describe("validateMediaUpload — hostile uploads", () => {
  it("refuses text/html", () => {
    const result = validateMediaUpload("payload.html", "text/html", 512)
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe("invalid_mime")
  })

  it("refuses a 5 GB SVG", () => {
    const result = validateMediaUpload(
      "huge.svg",
      "image/svg+xml",
      5 * 1024 * 1024 * 1024,
    )
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe("file_too_large")
  })

  it("refuses an SVG over 1 MB, well under the image limit", () => {
    // Markup, not pixels: the same ceiling cmsSvgUpload enforces.
    const result = validateMediaUpload(
      "logo.svg",
      "image/svg+xml",
      1 * 1024 * 1024 + 1,
    )
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe("file_too_large")
  })

  it("accepts an SVG at exactly 1 MB", () => {
    const result = validateMediaUpload("logo.svg", "image/svg+xml", 1024 * 1024)
    expect(result.valid).toBe(true)
    expect(result.kind).toBe("image")
  })

  it("refuses a .html filename declared as image/png", () => {
    const result = validateMediaUpload("payload.html", "image/png", 1024)
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe("mime_extension_mismatch")
  })

  it("refuses a .svg filename declared as image/png", () => {
    const result = validateMediaUpload("logo.svg", "image/png", 1024)
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe("mime_extension_mismatch")
  })

  it("refuses a negative size, the one value under every cap", () => {
    const result = validateMediaUpload("photo.png", "image/png", -1)
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe("file_too_large")
  })
})

// ---------------------------------------------------------------------------
// …without refusing files editors legitimately upload
// ---------------------------------------------------------------------------
describe("validateMediaUpload — extension agreement", () => {
  it("accepts .jpeg for image/jpeg even though it is stored as .jpg", () => {
    const result = validateMediaUpload("photo.jpeg", "image/jpeg", 1024)
    expect(result.valid).toBe(true)
  })

  it("accepts an uppercase extension", () => {
    const result = validateMediaUpload("PHOTO.PNG", "image/png", 1024)
    expect(result.valid).toBe(true)
  })

  it("accepts a filename with no extension at all", () => {
    // The stored key is derived from the MIME type, so there is nothing to
    // disagree with — refusing this would refuse real uploads.
    const result = validateMediaUpload("capture-decran", "image/png", 1024)
    expect(result.valid).toBe(true)
  })

  it("accepts an accented French filename", () => {
    const result = validateMediaUpload("entrée-du-jour.jpg", "image/jpeg", 1024)
    expect(result.valid).toBe(true)
  })
})

describe("validateMediaUpload — JPEG extension aliases", () => {
  it.each(["photo.jpg", "photo.jpeg", "photo.jfif", "photo.jpe"])(
    "accepts %s as image/jpeg",
    (filename) => {
      expect(validateMediaUpload(filename, "image/jpeg", 1024).valid).toBe(true)
    },
  )
})
