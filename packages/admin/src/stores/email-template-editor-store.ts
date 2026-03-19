/**
 * Email Template Editor Store (Zustand)
 *
 * Manages the state of the block-based email template editor.
 * No React Context — Zustand only, as per project conventions.
 */

import { create } from "zustand"

export type BlockAlignment = "left" | "center" | "right"

export interface TextBlock {
  type: "text"
  id: string
  content: string
  alignment?: BlockAlignment
}

export interface ImageBlock {
  type: "image"
  id: string
  url: string
  alt?: string
  linkUrl?: string
  alignment?: BlockAlignment
  width?: number
}

export interface ButtonBlock {
  type: "button"
  id: string
  text: string
  url: string
  backgroundColor?: string
  textColor?: string
  alignment?: BlockAlignment
}

export interface ProductBlock {
  type: "product"
  id: string
  productIds: string[]
  layout?: "list" | "grid"
}

export interface DividerBlock {
  type: "divider"
  id: string
  color?: string
  thickness?: number
}

export interface SpacerBlock {
  type: "spacer"
  id: string
  height?: number
}

export interface HeadingBlock {
  type: "heading"
  id: string
  content: string
  level: "h1" | "h2" | "h3"
  alignment?: BlockAlignment
  color?: string
}

export interface SocialBlock {
  type: "social"
  id: string
  alignment?: BlockAlignment
  links: { platform: string; url: string }[]
  style?: "icons" | "text"
}

export interface CouponBlock {
  type: "coupon"
  id: string
  code: string
  description?: string
  backgroundColor?: string
  textColor?: string
  borderColor?: string
}

/**
 * Blocks allowed inside columns (no nesting columns in columns).
 */
export type ColumnChildBlock =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | HeadingBlock
  | DividerBlock
  | SpacerBlock

export interface ColumnsBlock {
  type: "columns"
  id: string
  columns: { blocks: ColumnChildBlock[] }[]
  layout: "2" | "3"
}

export interface VideoBlock {
  type: "video"
  id: string
  thumbnailUrl: string
  videoUrl: string
  alt?: string
  alignment?: BlockAlignment
}

export interface HeroBlock {
  type: "hero"
  id: string
  imageUrl: string
  title: string
  subtitle?: string
  buttonText?: string
  buttonUrl?: string
  overlayColor?: string
  textColor?: string
  alignment?: BlockAlignment
}

export interface MenuHighlightBlock {
  type: "menu_highlight"
  id: string
  title?: string
  items: { name: string; description?: string; price: string; imageUrl?: string }[]
  layout?: "list" | "grid"
  accentColor?: string
}

export interface CountdownBlock {
  type: "countdown"
  id: string
  deadlineDate: string
  title?: string
  textColor?: string
  backgroundColor?: string
}

export interface GalleryBlock {
  type: "gallery"
  id: string
  images: { url: string; alt?: string; linkUrl?: string }[]
  columns?: 2 | 3 | 4
  gap?: number
}

export interface LocationBlock {
  type: "location"
  id: string
  address: string
  city?: string
  mapUrl?: string
  phone?: string
  email?: string
  alignment?: BlockAlignment
}

export interface HoursBlock {
  type: "hours"
  id: string
  title?: string
  rows: { day: string; hours: string }[]
  accentColor?: string
}

export interface TestimonialBlock {
  type: "testimonial"
  id: string
  quote: string
  author: string
  rating?: number
  avatarUrl?: string
  backgroundColor?: string
  textColor?: string
}

export interface DecorativeDividerBlock {
  type: "decorative_divider"
  id: string
  style: "dots" | "stars" | "wave" | "diamond"
  color?: string
  alignment?: BlockAlignment
}

export type EditorBlock =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | ProductBlock
  | DividerBlock
  | SpacerBlock
  | HeadingBlock
  | SocialBlock
  | CouponBlock
  | ColumnsBlock
  | VideoBlock
  | HeroBlock
  | MenuHighlightBlock
  | CountdownBlock
  | GalleryBlock
  | LocationBlock
  | HoursBlock
  | TestimonialBlock
  | DecorativeDividerBlock

const MAX_HISTORY = 20

export interface EmailTemplateEditorState {
  blocks: EditorBlock[]
  selectedBlockId: string | null
  subject: string
  previewText: string
  isDirty: boolean
  history: EditorBlock[][] // undo stack
}

export interface EmailTemplateEditorActions {
  /** Initialize or reset the editor with a template's existing data */
  load: (data: { blocks: EditorBlock[]; subject: string; previewText: string }) => void

  /** Add a block at the end or at a specific index */
  addBlock: (block: EditorBlock, index?: number) => void

  /** Update properties of a specific block by id */
  updateBlock: (id: string, partial: Partial<Omit<EditorBlock, "type" | "id">>) => void

  /** Remove a block by id. Clears selection if that block was selected */
  removeBlock: (id: string) => void

  /** Move a block from one index to another */
  moveBlock: (fromIndex: number, toIndex: number) => void

  /** Duplicate a block and insert the copy right after the original */
  duplicateBlock: (id: string) => void

  /** Insert a block right after the block with the given id */
  insertBlockAfter: (afterId: string, block: EditorBlock) => void

  /** Select a block for configuration */
  selectBlock: (id: string) => void

  /** Clear block selection */
  clearSelection: () => void

  /** Set the email subject line */
  setSubject: (subject: string) => void

  /** Set the preview text */
  setPreviewText: (text: string) => void

  /** Undo the last state-changing action */
  undo: () => void

  /** Reset the store to its initial empty state */
  reset: () => void
}

export type EmailTemplateEditorStore = EmailTemplateEditorState &
  EmailTemplateEditorActions

const initialState: EmailTemplateEditorState = {
  blocks: [],
  selectedBlockId: null,
  subject: "",
  previewText: "",
  isDirty: false,
  history: [],
}

function pushHistory(
  history: EditorBlock[][],
  blocks: EditorBlock[]
): EditorBlock[][] {
  const next = [blocks, ...history].slice(0, MAX_HISTORY)
  return next
}

export const useEmailTemplateEditorStore = create<EmailTemplateEditorStore>()(
  (set, get) => ({
    ...initialState,

    load: ({ blocks, subject, previewText }) => {
      set({
        blocks,
        subject,
        previewText,
        selectedBlockId: null,
        isDirty: false,
        history: [],
      })
    },

    addBlock: (block, index) => {
      const { blocks, history } = get()
      const newBlocks =
        index !== undefined
          ? [...blocks.slice(0, index), block, ...blocks.slice(index)]
          : [...blocks, block]
      set({
        blocks: newBlocks,
        history: pushHistory(history, blocks),
        isDirty: true,
      })
    },

    updateBlock: (id, partial) => {
      const { blocks, history } = get()
      const newBlocks = blocks.map((b) =>
        b.id === id ? ({ ...b, ...partial } as EditorBlock) : b
      )
      set({
        blocks: newBlocks,
        history: pushHistory(history, blocks),
        isDirty: true,
      })
    },

    removeBlock: (id) => {
      const { blocks, history, selectedBlockId } = get()
      const newBlocks = blocks.filter((b) => b.id !== id)
      set({
        blocks: newBlocks,
        selectedBlockId: selectedBlockId === id ? null : selectedBlockId,
        history: pushHistory(history, blocks),
        isDirty: true,
      })
    },

    moveBlock: (fromIndex, toIndex) => {
      const { blocks, history } = get()
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= blocks.length ||
        toIndex >= blocks.length
      ) {
        return
      }
      const newBlocks = [...blocks]
      const [removed] = newBlocks.splice(fromIndex, 1)
      if (removed) {
        newBlocks.splice(toIndex, 0, removed)
      }
      set({
        blocks: newBlocks,
        history: pushHistory(history, blocks),
        isDirty: true,
      })
    },

    duplicateBlock: (id) => {
      const { blocks, history } = get()
      const index = blocks.findIndex((b) => b.id === id)
      if (index === -1) return
      const original = blocks[index]
      if (!original) return
      const newId = crypto.randomUUID().slice(0, 7)
      const clone = JSON.parse(JSON.stringify(original)) as EditorBlock
      clone.id = newId
      const newBlocks = [
        ...blocks.slice(0, index + 1),
        clone,
        ...blocks.slice(index + 1),
      ]
      set({
        blocks: newBlocks,
        selectedBlockId: newId,
        history: pushHistory(history, blocks),
        isDirty: true,
      })
    },

    insertBlockAfter: (afterId, block) => {
      const { blocks, history } = get()
      const index = blocks.findIndex((b) => b.id === afterId)
      if (index === -1) return
      const newBlocks = [
        ...blocks.slice(0, index + 1),
        block,
        ...blocks.slice(index + 1),
      ]
      set({
        blocks: newBlocks,
        selectedBlockId: block.id,
        history: pushHistory(history, blocks),
        isDirty: true,
      })
    },

    selectBlock: (id) => {
      set({ selectedBlockId: id })
    },

    clearSelection: () => {
      set({ selectedBlockId: null })
    },

    setSubject: (subject) => {
      set({ subject, isDirty: true })
    },

    setPreviewText: (previewText) => {
      set({ previewText, isDirty: true })
    },

    undo: () => {
      const { history } = get()
      if (history.length === 0) return
      const [previous, ...rest] = history
      set({
        blocks: previous ?? [],
        history: rest,
        isDirty: rest.length > 0,
      })
    },

    reset: () => {
      set(initialState)
    },
  })
)
