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

  describe("état initial", () => {
    it("devrait avoir un état vide par défaut", () => {
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
    it("devrait charger les données du template", () => {
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

    it("devrait réinitialiser la sélection", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.load({ blocks: [textBlock("t1")], subject: "", previewText: "" })
      store.selectBlock("t1")
      store.load({ blocks: [], subject: "", previewText: "" })

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBeNull()
    })
  })

  describe("addBlock", () => {
    it("devrait ajouter un bloc à la fin", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(spacerBlock("s1"))

      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(2)
      expect(state.blocks[1]?.id).toBe("s1")
      expect(state.isDirty).toBe(true)
    })

    it("devrait ajouter un bloc à un index spécifique", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t3"))
      store.addBlock(textBlock("t2"), 1) // insérer au milieu

      const ids = useEmailTemplateEditorStore
        .getState()
        .blocks.map((b) => b.id)
      expect(ids).toEqual(["t1", "t2", "t3"])
    })

    it("devrait empiler l'historique", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))

      expect(useEmailTemplateEditorStore.getState().history).toHaveLength(1)
    })
  })

  describe("updateBlock", () => {
    it("devrait mettre à jour les propriétés d'un bloc", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1", "Ancien"))
      store.updateBlock("t1", { content: "Nouveau" })

      const block = useEmailTemplateEditorStore.getState().blocks[0]
      expect(block?.type === "text" && block.content).toBe("Nouveau")
    })

    it("ne devrait pas affecter les autres blocs", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1", "A"))
      store.addBlock(textBlock("t2", "B"))
      store.updateBlock("t1", { content: "C" })

      const blocks = useEmailTemplateEditorStore.getState().blocks
      expect(blocks[1]?.type === "text" && blocks[1].content).toBe("B")
    })
  })

  describe("removeBlock", () => {
    it("devrait supprimer un bloc par id", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t2"))
      store.removeBlock("t1")

      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(1)
      expect(state.blocks[0]?.id).toBe("t2")
    })

    it("devrait désélectionner si le bloc supprimé était sélectionné", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.selectBlock("t1")
      store.removeBlock("t1")

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBeNull()
    })

    it("ne devrait pas changer la sélection si un autre bloc est supprimé", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t2"))
      store.selectBlock("t1")
      store.removeBlock("t2")

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBe("t1")
    })
  })

  describe("moveBlock", () => {
    it("devrait déplacer un bloc d'un index à un autre", () => {
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

    it("ne devrait rien faire si fromIndex === toIndex", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("a"))
      const historyBefore = useEmailTemplateEditorStore.getState().history.length
      store.moveBlock(0, 0)
      expect(useEmailTemplateEditorStore.getState().history.length).toBe(
        historyBefore
      )
    })

    it("ne devrait rien faire si les index sont hors limites", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("a"))
      store.moveBlock(-1, 0)
      store.moveBlock(0, 5)

      expect(useEmailTemplateEditorStore.getState().blocks).toHaveLength(1)
    })
  })

  describe("selectBlock / clearSelection", () => {
    it("devrait sélectionner un bloc", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.selectBlock("t1")

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBe("t1")
    })

    it("devrait effacer la sélection", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.selectBlock("t1")
      store.clearSelection()

      expect(useEmailTemplateEditorStore.getState().selectedBlockId).toBeNull()
    })
  })

  describe("setSubject / setPreviewText", () => {
    it("devrait mettre à jour le subject et marquer isDirty", () => {
      useEmailTemplateEditorStore.getState().setSubject("Nouveau sujet")
      const state = useEmailTemplateEditorStore.getState()
      expect(state.subject).toBe("Nouveau sujet")
      expect(state.isDirty).toBe(true)
    })

    it("devrait mettre à jour le previewText", () => {
      useEmailTemplateEditorStore.getState().setPreviewText("Aperçu")
      expect(useEmailTemplateEditorStore.getState().previewText).toBe("Aperçu")
    })
  })

  describe("undo", () => {
    it("devrait restaurer l'état précédent des blocs", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t2"))
      store.undo()

      const state = useEmailTemplateEditorStore.getState()
      expect(state.blocks).toHaveLength(1)
      expect(state.blocks[0]?.id).toBe("t1")
    })

    it("devrait supporter plusieurs undo", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.addBlock(textBlock("t2"))
      store.addBlock(textBlock("t3"))
      store.undo()
      store.undo()

      expect(useEmailTemplateEditorStore.getState().blocks).toHaveLength(1)
    })

    it("ne devrait rien faire si l'historique est vide", () => {
      useEmailTemplateEditorStore.getState().undo()
      expect(useEmailTemplateEditorStore.getState().blocks).toHaveLength(0)
    })

    it("devrait mettre isDirty à false quand l'historique est épuisé", () => {
      const store = useEmailTemplateEditorStore.getState()
      store.addBlock(textBlock("t1"))
      store.undo()

      expect(useEmailTemplateEditorStore.getState().isDirty).toBe(false)
    })
  })

  describe("reset", () => {
    it("devrait remettre l'état initial complet", () => {
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
