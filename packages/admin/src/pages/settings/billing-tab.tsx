"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button, Input, Label, Textarea } from "@be-yours/ui"

/** The billing-identity block as the form edits it — strings only. */
export interface SellerFormState {
  legalName: string
  legalForm: string
  street: string
  city: string
  postalCode: string
  country: string
  siren: string
  siret: string
  vatNumber: string
  rcs: string
  shareCapital: string
  legalMentions: string
}

interface BillingTabProps {
  sellerForm: SellerFormState
  setSellerForm: Dispatch<SetStateAction<SellerFormState>>
  handleSaveBilling: () => Promise<void>
}

/**
 * Collects `globalSettings.seller` — the identity every invoice is issued
 * under. This screen did not exist before #375: `seller_incomplete` was
 * permanent on every deployment, so a restaurant took payments with no legal
 * invoice and nothing anywhere said so. Only the legal name gates issuance
 * (`invoices.sellerIsComplete`); the rest is required of most French
 * businesses but not all of them, so it stays optional and prints as given.
 */
export function BillingTab({
  sellerForm,
  setSellerForm,
  handleSaveBilling,
}: BillingTabProps) {
  const field =
    (key: keyof SellerFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setSellerForm((prev) => ({ ...prev, [key]: event.target.value }))

  return (
    <div className="border border-border/50 rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-sm font-medium">Identité de facturation</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ces informations figurent sur chaque facture émise. Sans raison
          sociale, aucune facture n&apos;est émise (art. 242 nonies A du CGI).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="seller-legal-name">Raison sociale *</Label>
          <Input
            id="seller-legal-name"
            value={sellerForm.legalName}
            onChange={field("legalName")}
            placeholder="SARL Chez Luigi"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seller-legal-form">Forme juridique</Label>
          <Input
            id="seller-legal-form"
            value={sellerForm.legalForm}
            onChange={field("legalForm")}
            placeholder="SARL, SAS, micro-entreprise…"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Label>Siège social</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="seller-street" className="text-xs text-muted-foreground">
              Rue
            </Label>
            <Input
              id="seller-street"
              value={sellerForm.street}
              onChange={field("street")}
              placeholder="1 rue de la Paix"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seller-postal-code" className="text-xs text-muted-foreground">
              Code postal
            </Label>
            <Input
              id="seller-postal-code"
              value={sellerForm.postalCode}
              onChange={field("postalCode")}
              placeholder="75002"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seller-city" className="text-xs text-muted-foreground">
              Ville
            </Label>
            <Input
              id="seller-city"
              value={sellerForm.city}
              onChange={field("city")}
              placeholder="Paris"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seller-country" className="text-xs text-muted-foreground">
              Pays
            </Label>
            <Input
              id="seller-country"
              value={sellerForm.country}
              onChange={field("country")}
              placeholder="France"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="seller-siren">SIREN</Label>
          <Input
            id="seller-siren"
            value={sellerForm.siren}
            onChange={field("siren")}
            placeholder="123 456 789"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seller-siret">SIRET</Label>
          <Input
            id="seller-siret"
            value={sellerForm.siret}
            onChange={field("siret")}
            placeholder="123 456 789 00012"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seller-vat">N° de TVA intracommunautaire</Label>
          <Input
            id="seller-vat"
            value={sellerForm.vatNumber}
            onChange={field("vatNumber")}
            placeholder="FR12345678901"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seller-rcs">RCS</Label>
          <Input
            id="seller-rcs"
            value={sellerForm.rcs}
            onChange={field("rcs")}
            placeholder="RCS Paris 123 456 789"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seller-share-capital">Capital social (€)</Label>
          <Input
            id="seller-share-capital"
            type="number"
            min="0"
            step="0.01"
            value={sellerForm.shareCapital}
            onChange={field("shareCapital")}
            placeholder="10000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seller-legal-mentions">Mentions légales</Label>
        <Textarea
          id="seller-legal-mentions"
          value={sellerForm.legalMentions}
          onChange={field("legalMentions")}
          placeholder="TVA non applicable, art. 293 B du CGI"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Imprimées telles quelles au pied de chaque facture.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveBilling}>Enregistrer</Button>
      </div>
    </div>
  )
}
