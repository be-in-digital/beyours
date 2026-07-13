"use client"

import type { Dispatch, SetStateAction } from "react"
import { Loader2 } from "lucide-react"
import { Button, Input, Label, Switch } from "@be-in-digital/ui"
import { FieldInfo } from "./field-info"
import { HELP } from "./help-content"
import type { PaymentConnection } from "./settings-types"

interface PaymentsTabProps {
  cardProvider: "stripe" | "sumup"
  setCardProvider: Dispatch<SetStateAction<"stripe" | "sumup">>
  stripeConnection: PaymentConnection | undefined
  sumupConnection: PaymentConnection | undefined
  connectingProvider: string | null
  handleConnect: (provider: "stripe" | "sumup") => Promise<void>
  handleDisconnect: (provider: "stripe" | "sumup") => Promise<void>
  paypalEnabled: boolean
  setPaypalEnabled: Dispatch<SetStateAction<boolean>>
  paypalEmail: string
  setPaypalEmail: Dispatch<SetStateAction<string>>
  cashEnabled: boolean
  setCashEnabled: Dispatch<SetStateAction<boolean>>
  handleSavePayments: () => Promise<void>
}

export function PaymentsTab({
  cardProvider,
  setCardProvider,
  stripeConnection,
  sumupConnection,
  connectingProvider,
  handleConnect,
  handleDisconnect,
  paypalEnabled,
  setPaypalEnabled,
  paypalEmail,
  setPaypalEmail,
  cashEnabled,
  setCashEnabled,
  handleSavePayments,
}: PaymentsTabProps) {
  return (
    <div className="border border-border/50 rounded-lg p-6 space-y-6">

      {/* Card provider section: Stripe and SumUp with OAuth connect/disconnect */}
      <div className="space-y-3">
        <Label>Paiement par carte bancaire</Label>
        <p className="text-xs text-muted-foreground">
          Choisissez votre prestataire de paiement par carte. Un seul peut être actif à la fois.
        </p>
        <div className="grid grid-cols-2 gap-4">

          {/* Stripe card */}
          <div
            className={`border rounded-lg p-4 space-y-3 transition-colors cursor-pointer ${
              cardProvider === "stripe"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border/50 opacity-60 hover:opacity-80 hover:border-border"
            }`}
            onClick={() => setCardProvider("stripe")}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                  cardProvider === "stripe"
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">Stripe</span>
                  <FieldInfo {...HELP.payments.stripe} />
                </div>
                <div className="text-xs text-muted-foreground">Paiement en ligne et TPE</div>
              </div>
            </div>

            {/* Connection status badge */}
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  stripeConnection?.status === "connected" ? "bg-green-500" : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {stripeConnection?.status === "connected" ? "Connecté" : "Non connecté"}
              </span>
            </div>

            {/* Merchant ID when connected */}
            {stripeConnection?.status === "connected" && stripeConnection.merchantId && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                ID : {stripeConnection.merchantId}
              </p>
            )}

            {/* Connect / Disconnect button — only shown for selected provider */}
            {cardProvider === "stripe" && (
              <div onClick={(e) => e.stopPropagation()}>
                {stripeConnection?.status === "connected" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 h-7"
                    onClick={() => handleDisconnect("stripe")}
                  >
                    Déconnecter
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={connectingProvider === "stripe"}
                    onClick={() => handleConnect("stripe")}
                  >
                    {connectingProvider === "stripe" ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      "Connecter"
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* SumUp card */}
          <div
            className={`border rounded-lg p-4 space-y-3 transition-colors cursor-pointer ${
              cardProvider === "sumup"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border/50 opacity-60 hover:opacity-80 hover:border-border"
            }`}
            onClick={() => setCardProvider("sumup")}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                  cardProvider === "sumup"
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">SumUp</span>
                  <FieldInfo {...HELP.payments.sumup} />
                </div>
                <div className="text-xs text-muted-foreground">Terminal de paiement mobile</div>
              </div>
            </div>

            {/* Connection status badge */}
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  sumupConnection?.status === "connected" ? "bg-green-500" : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {sumupConnection?.status === "connected" ? "Connecté" : "Non connecté"}
              </span>
            </div>

            {/* Merchant ID when connected */}
            {sumupConnection?.status === "connected" && sumupConnection.merchantId && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                ID : {sumupConnection.merchantId}
              </p>
            )}

            {/* Connect / Disconnect button — only shown for selected provider */}
            {cardProvider === "sumup" && (
              <div onClick={(e) => e.stopPropagation()}>
                {sumupConnection?.status === "connected" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 h-7"
                    onClick={() => handleDisconnect("sumup")}
                  >
                    Déconnecter
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={connectingProvider === "sumup"}
                    onClick={() => handleConnect("sumup")}
                  >
                    {connectingProvider === "sumup" ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      "Connecter"
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Other payment methods */}
      <div className="space-y-3">
        <Label>Autres moyens de paiement</Label>
        <div className="space-y-3">

          {/* PayPal — email-based connection */}
          <div className="border border-border/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">PayPal</p>
                  <FieldInfo {...HELP.payments.paypal} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Accepter les paiements via PayPal
                </p>
              </div>
              <Switch
                checked={paypalEnabled}
                onCheckedChange={setPaypalEnabled}
              />
            </div>

            {paypalEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="paypalEmail" className="text-xs">
                  Email PayPal Business
                </Label>
                <Input
                  id="paypalEmail"
                  type="email"
                  placeholder="votre-email@business.paypal.com"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  L'adresse email associée à votre compte PayPal Business.
                  Les paiements seront envoyés directement sur ce compte.
                </p>
              </div>
            )}
          </div>

          {/* Cash — simple toggle, no OAuth */}
          <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
            <div>
              <Label htmlFor="cashEnabled" className="cursor-pointer">Espèces</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Disponible uniquement pour les commandes sur place et Click &amp; Collect
              </p>
            </div>
            <Switch
              id="cashEnabled"
              checked={cashEnabled}
              onCheckedChange={setCashEnabled}
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSavePayments} size="sm">
        Enregistrer les paramètres de paiement
      </Button>
    </div>
  )
}
