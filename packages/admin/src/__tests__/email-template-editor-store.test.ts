import { describe, it, expect, beforeEach } from "vitest"
import {
  useEmailTemplateEditorStore,
  type EditorBlock,
} from "../stores/email-template-editor-store"

function textBlock(id: string, content = "Hello"): EditorBlock {
  return { type: "text", id, content }
}

function spacerBlock(id: string, height = 24): EditorBlock {
  return { type: "spacer", id, height }
}

describe("useEmailTemplateEditorStore", () => {
  beforeEach(() => {
    useEmailTemplateEditorStore.getState().reset()
  })

  describe("initial state", () => {
    it("starts with an empty state", () => {
      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(0)
      expect(state.selectedBlockId).toBeNull()
      expect(state.subject).toBe("")
      expect(state.previewText).toBe("")
      expect(state.isDirty).toBe(false)
      expect(state.history).toHaveLength(0)
    })
  })

  describe("load", () => {
    it("loads the template data", () => {
      const blocks = [textBlock("t1"), spacerBlock("s1")]
      useEmailTemplateEditorStore.getState().load({
        blocks,
        subject: "Promo",
        previewText: "Aperçu",
      })

      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(2)
      expect(state.subject).toBe("Promo")
      expect(state.previewText).toBe("Aperçu")
      expect(state.isDirty).toBe(false)
      expect(state.history).toHaveLength(0)
    })

    it("resets the selection", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.load({ blocks: [textBlock("t1")], subject: "", previewText: "" })
      store.selectBlock("t1")
      store.load({ blocks: [], subject: "", previewText: "" })

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBeNull()
    })
  })

  describe("addBlock", () => {
    it("appends a block at the end", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(spacerBlock("s1"))

      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(2)
      expect(state.blocks[1]?.id).toBe("s1")
      expect(state.isDirty).toBe(true)
    })

    it("inserts a block at a specific index", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t3"))
      store.addBlock(textBlock("t2"), 1) // insert in the middle

      const ids = useEmailTemplateEditorStore
        .getState()
        .blocks.map((b) => b.id)
      expect(ids).toEqual(["t1", "t2", "t3"])
    })

    it("pushes onto the history", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))

      expect(useEmailTemplateEditorStore.getState().history).toHaveLength(1)
    })
  })

  describe("updateBlock", () => {
    it("updates the properties of a block", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1", "Ancien"))
      store.updateBlock("t1", { content: "Nouveau" })

      const block = useEmailTemplateEditorStore.getState().blocks[0]
      expect(block?.type === "text" && block.content).toBe("Nouveau")
    })

    it("leaves the other blocks untouched", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1", "A"))
      store.addBlock(textBlock("t2", "B"))
      store.updateBlock("t1", { content: "C" })

      const blocks = useEmailTemplateEditorStore.getState().blocks
      expect(blocks[1]?.type === "text" && blocks[1].content).toBe("B")
    })
  })

  describe("removeBlock", () => {
    it("removes a block by id", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t2"))
      store.removeBlock("t1")

      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(1)
      expect(state.blocks[0]?.id).toBe("t2")
    })

    it("clears the selection when the removed block was selected", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.selectBlock("t1")
      store.removeBlock("t1")

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBeNull()
    })

    it("keeps the selection when another block is removed", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t2"))
      store.selectBlock("t1")
      store.removeBlock("t2")

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBe("t1")
    })
  })

  describe("moveBlock", () => {
    it("moves a block from one index to another", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("a"))
      store.addBlock(textBlock("b"))
      store.addBlock(textBlock("c"))
      store.moveBlock(0, 2)

      const ids = useEmailTemplateEditorStore
        .getState()
        .blocks.map((b) => b.id)
      expect(ids).toEqual(["b", "c", "a"])
    })

    it("does nothing when fromIndex === toIndex", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("a"))
      const historyBefore = useEmailTemplateEditorStore.getState().history.length
      store.moveBlock(0, 0)
      expect(useEmailTemplateEditorStore.getState().history.length).toBe(
        historyBefore
      )
    })

    it("does nothing when the indexes are out of bounds", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("a"))
      store.moveBlock(-1, 0)
      store.moveBlock(0, 5)

      expect(useEmailTemplateEditorStore.getState().blocks).toHaveLength(1)
    })
  })

  describe("selectBlock / clearSelection", () => {
    it("selects a block", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.selectBlock("t1")

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBe("t1")
    })

    it("clears the selection", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.selectBlock("t1")
      store.clearSelection()

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBeNull()
    })
  })

  describe("setSubject / setPreviewText", () => {
    it("updates the subject and marks isDirty", () => {
      useEmailTemplateEditorStore.getState().setSubject("Nouveau sujet")
      const state = useEmailTemplateEditorStore.getState()
      expect(state.subject).toBe("Nouveau sujet")
      expect(state.isDirty).toBe(true)
    })

    it("updates the previewText", () => {
      useEmailTemplateEditorStore.getState().setPreviewText("Aperçu")
      expect(useEmailTemplateEditorStore.getState().previewText).toBe("Aperçu")
    })
  })

  describe("undo", () => {
    it("restores the previous block state", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t2"))
      store.undo()

      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(1)
      expect(state.blocks[0]?.id).toBe("t1")
    })

    it("supports several undos", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t2"))
      store.addBlock(textBlock("t3"))
      store.undo()
      store.undo()

      expect(useEmailTemplateEditorStore.getState().blocks).toHaveLength(1)
    })

    it("does nothing when the history is empty", () => {
      useEmailTemplateEditorStore.getState().undo()
      expect(useEmailTemplateEditorStore.getState().blocks).toHaveLength(0)
    })

    it("sets isDirty to false once the history is exhausted", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.undo()

      expect(useEmailTemplateEditorStore.getState().isDirty).toBe(false)
    })
  })

  describe("reset", () => {
    it("restores the full initial state", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.setSubject("Test")
      store.selectBlock("t1")
      store.reset()

      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(0)
      expect(state.subject).toBe("")
      expect(state.selectedBlockId).toBeNull()
      expect(state.isDirty).toBe(false)
      expect(state.history).toHaveLength(0)
    })
  })
})
