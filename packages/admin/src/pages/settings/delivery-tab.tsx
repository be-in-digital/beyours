"use client"

import type { Dispatch, SetStateAction } from "react"
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  AddressAutocomplete,
  type AddressValue,
} from "@be-in-digital/ui"
import { centsToEuros } from "../../lib/formatters"
import { GOOGLE_MAPS_API_KEY } from "./settings-constants"
import type { SimulationResult } from "./settings-types"

interface DeliveryTabProps {
  feeMode: "fixed" | "percentage"
  setFeeMode: Dispatch<SetStateAction<"fixed" | "percentage">>
  deliveryRadius: string
  setDeliveryRadius: Dispatch<SetStateAction<string>>
  freeAbove: string
  setFreeAbove: Dispatch<SetStateAction<string>>
  deliveryFee: string
  setDeliveryFee: Dispatch<SetStateAction<string>>
  deliveryPercentage: string
  setDeliveryPercentage: Dispatch<SetStateAction<string>>
  deliveryMaxFee: string
  setDeliveryMaxFee: Dispatch<SetStateAction<string>>
  handleSaveDelivery: () => Promise<void>
  uberDirectEnabled: boolean
  simulatorAddress: AddressValue
  setSimulatorAddress: Dispatch<SetStateAction<AddressValue>>
  handleSimulate: () => Promise<void>
  isSimulating: boolean
  simulationResult: SimulationResult | null
  setSimulationResult: Dispatch<SetStateAction<SimulationResult | null>>
}

export function DeliveryTab({
  feeMode,
  setFeeMode,
  deliveryRadius,
  setDeliveryRadius,
  freeAbove,
  setFreeAbove,
  deliveryFee,
  setDeliveryFee,
  deliveryPercentage,
  setDeliveryPercentage,
  deliveryMaxFee,
  setDeliveryMaxFee,
  handleSaveDelivery,
  uberDirectEnabled,
  simulatorAddress,
  setSimulatorAddress,
  handleSimulate,
  isSimulating,
  simulationResult,
  setSimulationResult,
}: DeliveryTabProps) {
  return (
    <>
      {/* Pricing mode section */}
      <div className="border border-border/50 rounded-lg p-6 space-y-6">
        {/* Fee mode selector - same card pattern as payment provider */}
        <div className="space-y-3">
          <Label>Mode de tarification</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setFeeMode("fixed")
                setSimulationResult(null)
              }}
              className={`flex items-center gap-3 border rounded-lg px-4 py-3 text-left transition-colors ${
                feeMode === "fixed"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <div className={`h-3 w-3 rounded-full border-2 ${
                feeMode === "fixed"
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40"
              }`} />
              <div>
                <div className="text-sm font-medium">Prix fixe</div>
                <div className="text-xs text-muted-foreground">Montant constant par commande</div>
              </div>
            </button>

            {/* Percentage mode bills a share of an Uber Direct quote. Without
                the integration there is no quote to bill a share of, and the
                checkout refuses every delivery order with "un devis de
                livraison est requis" — which the customer cannot satisfy. The
                option is offered only when it can work. */}
            <button
              type="button"
              disabled={!uberDirectEnabled}
              title={
                uberDirectEnabled
                  ? undefined
                  : "Activez Uber Direct pour facturer un pourcentage du coût réel"
              }
              onClick={() => {
                setFeeMode("percentage")
                setSimulationResult(null)
              }}
              className={`flex items-center gap-3 border rounded-lg px-4 py-3 text-left transition-colors ${
                !uberDirectEnabled
                  ? "cursor-not-allowed border-border/50 opacity-50"
                  : feeMode === "percentage"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border/50 hover:border-border"
              }`}
            >
              <div className={`h-3 w-3 rounded-full border-2 ${
                feeMode === "percentage"
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40"
              }`} />
              <div>
                <div className="text-sm font-medium">Pourcentage Uber Direct</div>
                <div className="text-xs text-muted-foreground">
                  {uberDirectEnabled
                    ? "Calculé sur le coût réel de la livraison"
                    : "Nécessite l'intégration Uber Direct"}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Common fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="deliveryRadius">Rayon de livraison (km)</Label>
            <Input
              id="deliveryRadius"
              type="number"
              min="0"
              step="0.1"
              value={deliveryRadius}
              onChange={(e) => setDeliveryRadius(e.target.value)}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="freeAbove">Livraison gratuite à partir de (€)</Label>
            <Input
              id="freeAbove"
              type="number"
              min="0"
              step="0.01"
              value={freeAbove}
              onChange={(e) => setFreeAbove(e.target.value)}
              placeholder="30.00"
            />
          </div>
        </div>

        {/* Fixed mode fields */}
        {feeMode === "fixed" && (
          <div className="space-y-2">
            <Label htmlFor="deliveryFee">Frais de livraison (€)</Label>
            <Input
              id="deliveryFee"
              type="number"
              min="0"
              step="0.01"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              placeholder="3.50"
            />
          </div>
        )}

        {/* Percentage mode fields */}
        {feeMode === "percentage" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryPercentage">Pourcentage du coût Uber Direct (%)</Label>
              <Input
                id="deliveryPercentage"
                type="number"
                min="1"
                max="100"
                step="1"
                value={deliveryPercentage}
                onChange={(e) => setDeliveryPercentage(e.target.value)}
                placeholder="70"
              />
              <p className="text-xs text-muted-foreground">Entre 1 et 100</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryMaxFee">Plafond maximum (€)</Label>
              <Input
                id="deliveryMaxFee"
                type="number"
                min="0"
                step="0.01"
                value={deliveryMaxFee}
                onChange={(e) => setDeliveryMaxFee(e.target.value)}
                placeholder="Optionnel"
                disabled={!deliveryPercentage}
              />
              <p className="text-xs text-muted-foreground">Optionnel — sans plafond si vide</p>
            </div>
          </div>
        )}

        <Button onClick={handleSaveDelivery} size="sm">
          Enregistrer les paramètres de livraison
        </Button>
      </div>

      {/* Simulator section - only visible in percentage mode with Uber Direct enabled */}
      {feeMode === "percentage" && uberDirectEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulateur de coût</CardTitle>
            <CardDescription className="text-xs">
              Estimez ce que paiera le client et votre perte sur une livraison
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressAutocomplete
              value={simulatorAddress}
              onChange={(addr) => {
                setSimulatorAddress(addr)
                setSimulationResult(null)
              }}
              apiKey={GOOGLE_MAPS_API_KEY}
              label="Adresse de livraison (test)"
            />

            <Button
              onClick={handleSimulate}
              size="sm"
              variant="outline"
              disabled={!simulatorAddress.latitude || isSimulating || !deliveryPercentage}
            >
              {isSimulating ? "Estimation en cours..." : "Estimer le coût"}
            </Button>

            {simulationResult && (
              <>
                <div className="border border-border/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coût Uber Direct</span>
                    <span>{centsToEuros(simulationResult.uberDirectCost).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frais client ({deliveryPercentage}%)</span>
                    <span className="font-medium text-primary-ink">{centsToEuros(simulationResult.clientFee).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {simulationResult.restaurantLoss > 0 ? "Perte restaurant" : "Marge restaurant"}
                    </span>
                    <span className={simulationResult.restaurantLoss > 0 ? "text-destructive" : "text-green-600"}>
                      {centsToEuros(simulationResult.restaurantLoss).toFixed(2)} €
                    </span>
                  </div>
                  <div className="border-t border-border/50 pt-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">Temps estimé</span>
                    <span>~{simulationResult.estimatedMinutes} min</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                  <span className="text-amber-700 dark:text-amber-400 text-sm mt-0.5">⚠</span>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Estimation indicative. Le prix réel peut varier selon la demande et la disponibilité des coursiers.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
