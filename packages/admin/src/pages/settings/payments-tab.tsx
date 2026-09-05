"use client"

import type { Dispatch, SetStateAction } from "react"
import { Loader2 } from "lucide-react"
import { Button, Input, Label, Switch } from "@be-in-digital/ui"
import { FieldInfo } from "./field-info"
import { HELP } from "./help-content"
import type { PaymentConnection } from "./settings-types"
import { PAYMENT_CONNECTION_STATUS_CONFIG } from "../../lib/vocabulary"
import { canConnectProvider, canDisconnectProvider } from "../../lib/payment-connection"

/**
 * Connection state of one provider, as the owner reads it.
 *
 * Every state comes from `PAYMENT_CONNECTION_STATUS_CONFIG` — the two cards
 * used to test `status === "connected"` inline and fold everything else into
 * "Non connecté", which turned `onboarding_complete` (account live, takings
 * still landing on the platform) and `error` into the same grey nothing.
 */
function ConnectionStatus({ connection }: { connection: PaymentConnection | undefined }) {
  const badge = connection
    ? PAYMENT_CONNECTION_STATUS_CONFIG[connection.status]
    : PAYMENT_CONNECTION_STATUS_CONFIG.disconnected

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full shrink-0 ${badge.dotClassName}`} />
        <span className={`text-xs ${badge.textClassName}`}>{badge.label}</span>
      </div>

      {badge.detail && (
        <p className="text-xs text-muted-foreground leading-snug">{badge.detail}</p>
      )}

      {/* The account id is what the support team asks for, in every state that has one. */}
      {connection?.merchantId && (
        <p className="text-xs text-muted-foreground font-mono truncate">
          ID : {connection.merchantId}
        </p>
      )}
    </div>
  )
}

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
            <ConnectionStatus connection={stripeConnection} />

            {/* Connect / Disconnect buttons — only shown for selected provider */}
            {cardProvider === "stripe" && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {canConnectProvider(stripeConnection) && (
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
                {canDisconnectProvider(stripeConnection) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 h-7"
                    onClick={() => handleDisconnect("stripe")}
                  >
                    Déconnecter
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
            <ConnectionStatus connection={sumupConnection} />

            {/* Connect / Disconnect buttons — only shown for selected provider */}
            {cardProvider === "sumup" && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {canConnectProvider(sumupConnection) && (
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
                {canDisconnectProvider(sumupConnection) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 h-7"
                    onClick={() => handleDisconnect("sumup")}
                  >
                    Déconnecter
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Square is advertised in the guided tour and the docs and has no
            implementation at all — `refundPolicy` refuses it by name. Named
            here as forthcoming rather than offered as a third card: a radio
            option that cannot be selected is worse than a sentence that says
            when it will be. Same convention as the print providers, which
            carry `available: false` and a « Bientôt » badge. */}
        <p className="text-xs text-muted-foreground">
          Square arrive prochainement. En attendant, encaissez par Stripe ou
          SumUp — et par PayPal ou en espèces ci-dessous.
        </p>
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
