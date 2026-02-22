/**
 * Campaign validation
 *
 * Validates a campaign before sending or scheduling.
 * Returns a structured { valid, errors } result.
 */

export interface CampaignToValidate {
  name: string
  subject: string
  templateId?: string
  templateBlockCount?: number
  segmentId?: string | null
  audienceCount: number // number of subscribers who will receive it
  abTestEnabled: boolean
  variants?: Array<{ id: string; subject: string; percentage: number }>
  scheduledAt?: number | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a campaign before sending or scheduling.
 */
export function validateCampaign(campaign: CampaignToValidate): ValidationResult {
  const errors: string[] = []

  // Required: name
  if (!campaign.name || campaign.name.trim().length === 0) {
    errors.push("Le nom de la campagne est requis")
  }

  // Required: subject
  if (!campaign.subject || campaign.subject.trim().length === 0) {
    errors.push("L'objet de l'email est requis")
  }

  // Required: template with at least one block
  if (!campaign.templateId) {
    errors.push("Un modèle d'email est requis")
  } else if (
    campaign.templateBlockCount !== undefined &&
    campaign.templateBlockCount === 0
  ) {
    errors.push("Le modèle sélectionné ne contient aucun bloc de contenu")
  }

  // Required: non-empty audience
  if (campaign.audienceCount === 0) {
    errors.push("L'audience ne contient aucun abonné actif")
  }

  // A/B test: variants must sum to 100%
  if (campaign.abTestEnabled) {
    const variants = campaign.variants ?? []
    if (variants.length < 2) {
      errors.push("Un test A/B nécessite au moins 2 variantes")
    } else {
      const total = variants.reduce((sum, v) => sum + v.percentage, 0)
      if (Math.round(total) !== 100) {
        errors.push(
          `Les pourcentages des variantes A/B doivent totaliser 100% (actuellement ${total}%)`
        )
      }
      for (const variant of variants) {
        if (!variant.subject || variant.subject.trim().length === 0) {
          errors.push(`L'objet de la variante est requis`)
          break
        }
      }
    }
  }

  // Scheduled date must be in the future
  if (campaign.scheduledAt !== undefined && campaign.scheduledAt !== null) {
    if (campaign.scheduledAt <= Date.now()) {
      errors.push("La date de planification doit être dans le futur")
    }
  }

  return { valid: errors.length === 0, errors }
}
