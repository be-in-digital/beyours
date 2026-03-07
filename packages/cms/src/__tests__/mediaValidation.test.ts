import { describe, it, expect } from "vitest"
import {
  CMS_MEDIA_LIMITS,
  getMediaKind,
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
