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

  it("accepts a valid campaign", () => {
    const result = validateCampaign(validCampaign())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  describe("name", () => {
    it("fails when name is empty", () => {
      const result = validateCampaign(validCampaign({ name: "" }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Le nom de la campagne est requis")
    })

    it("fails when name is only whitespace", () => {
      const result = validateCampaign(validCampaign({ name: "   " }))
      expect(result.valid).toBe(false)
    })
  })

  describe("subject", () => {
    it("fails when subject is empty", () => {
      const result = validateCampaign(validCampaign({ subject: "" }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("L'objet de l'email est requis")
    })
  })

  describe("templateId", () => {
    it("fails when templateId is missing", () => {
      const result = validateCampaign(validCampaign({ templateId: undefined }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Un modèle d'email est requis")
    })

    it("fails when the template has 0 blocks", () => {
      const result = validateCampaign(validCampaign({ templateBlockCount: 0 }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Le modèle sélectionné ne contient aucun bloc de contenu"
      )
    })

    it("passes when templateBlockCount is undefined", () => {
      const result = validateCampaign(
        validCampaign({ templateBlockCount: undefined })
      )
      expect(result.valid).toBe(true)
    })
  })

  describe("audienceCount", () => {
    it("fails when the audience is 0", () => {
      const result = validateCampaign(validCampaign({ audienceCount: 0 }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "L'audience ne contient aucun abonné actif"
      )
    })
  })

  describe("A/B test", () => {
    it("fails with fewer than 2 variants", () => {
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

    it("fails when the percentages do not add up to 100%", () => {
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

    it("passes when the percentages add up to 100%", () => {
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

    it("fails when a variant has no subject", () => {
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

    it("does not validate the variants when abTestEnabled is false", () => {
      const result = validateCampaign(
        validCampaign({ abTestEnabled: false, variants: [] })
      )
      expect(result.valid).toBe(true)
    })
  })

  describe("scheduledAt", () => {
    it("fails when the date is in the past", () => {
      const pastDate = Date.now() - 60_000
      const result = validateCampaign(
        validCampaign({ scheduledAt: pastDate })
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "La date de planification doit être dans le futur"
      )
    })

    it("passes when the date is in the future", () => {
      const futureDate = Date.now() + 3_600_000
      const result = validateCampaign(
        validCampaign({ scheduledAt: futureDate })
      )
      expect(result.valid).toBe(true)
    })

    it("passes when scheduledAt is null", () => {
      const result = validateCampaign(validCampaign({ scheduledAt: null }))
      expect(result.valid).toBe(true)
    })
  })

  it("returns every error at once", () => {
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
