import { describe, it, expect, vi, afterEach } from "vitest"
import { validateCampaign, type CampaignToValidate } from "../campaign-validation"

function validCampaign(overrides: Partial<CampaignToValidate> = {}): CampaignToValidate {
  return {
    name: "Promo été",
    subject: "Offre spéciale -20%",
    templateId: "tpl_123",
    templateBlockCount: 3,
    audienceCount: 100,
    abTestEnabled: false,
    ...overrides,
  }
}

describe("validateCampaign", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("devrait valider une campagne correcte", () => {
    const result = validateCampaign(validCampaign())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  describe("name", () => {
    it("devrait échouer si name est vide", () => {
      const result = validateCampaign(validCampaign({ name: "" }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Le nom de la campagne est requis")
    })

    it("devrait échouer si name est juste des espaces", () => {
      const result = validateCampaign(validCampaign({ name: "   " }))
      expect(result.valid).toBe(false)
    })
  })

  describe("subject", () => {
    it("devrait échouer si subject est vide", () => {
      const result = validateCampaign(validCampaign({ subject: "" }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("L'objet de l'email est requis")
    })
  })

  describe("templateId", () => {
    it("devrait échouer si templateId est absent", () => {
      const result = validateCampaign(validCampaign({ templateId: undefined }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Un modèle d'email est requis")
    })

    it("devrait échouer si le template a 0 blocs", () => {
      const result = validateCampaign(validCampaign({ templateBlockCount: 0 }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Le modèle sélectionné ne contient aucun bloc de contenu"
      )
    })

    it("devrait passer si templateBlockCount est undefined", () => {
      const result = validateCampaign(
        validCampaign({ templateBlockCount: undefined })
      )
      expect(result.valid).toBe(true)
    })
  })

  describe("audienceCount", () => {
    it("devrait échouer si audience est 0", () => {
      const result = validateCampaign(validCampaign({ audienceCount: 0 }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "L'audience ne contient aucun abonné actif"
      )
    })
  })

  describe("A/B test", () => {
    it("devrait échouer avec moins de 2 variantes", () => {
      const result = validateCampaign(
        validCampaign({
          abTestEnabled: true,
          variants: [{ id: "a", subject: "Test A", percentage: 100 }],
        })
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Un test A/B nécessite au moins 2 variantes"
      )
    })

    it("devrait échouer si les pourcentages ne totalisent pas 100%", () => {
      const result = validateCampaign(
        validCampaign({
          abTestEnabled: true,
          variants: [
            { id: "a", subject: "Test A", percentage: 40 },
            { id: "b", subject: "Test B", percentage: 40 },
          ],
        })
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain("100%")
    })

    it("devrait passer si les pourcentages totalisent 100%", () => {
      const result = validateCampaign(
        validCampaign({
          abTestEnabled: true,
          variants: [
            { id: "a", subject: "Test A", percentage: 50 },
            { id: "b", subject: "Test B", percentage: 50 },
          ],
        })
      )
      expect(result.valid).toBe(true)
    })

    it("devrait échouer si une variante n'a pas de sujet", () => {
      const result = validateCampaign(
        validCampaign({
          abTestEnabled: true,
          variants: [
            { id: "a", subject: "", percentage: 50 },
            { id: "b", subject: "Test B", percentage: 50 },
          ],
        })
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("L'objet de la variante est requis")
    })

    it("ne devrait pas valider les variantes si abTestEnabled est false", () => {
      const result = validateCampaign(
        validCampaign({ abTestEnabled: false, variants: [] })
      )
      expect(result.valid).toBe(true)
    })
  })

  describe("scheduledAt", () => {
    it("devrait échouer si la date est dans le passé", () => {
      const pastDate = Date.now() - 60_000
      const result = validateCampaign(
        validCampaign({ scheduledAt: pastDate })
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "La date de planification doit être dans le futur"
      )
    })

    it("devrait passer si la date est dans le futur", () => {
      const futureDate = Date.now() + 3_600_000
      const result = validateCampaign(
        validCampaign({ scheduledAt: futureDate })
      )
      expect(result.valid).toBe(true)
    })

    it("devrait passer si scheduledAt est null", () => {
      const result = validateCampaign(validCampaign({ scheduledAt: null }))
      expect(result.valid).toBe(true)
    })
  })

  it("devrait retourner toutes les erreurs en une seule fois", () => {
    const result = validateCampaign({
      name: "",
      subject: "",
      templateId: undefined,
      audienceCount: 0,
      abTestEnabled: false,
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(4)
  })
})
