"use client"

import type { Dispatch, SetStateAction } from "react"
import {
  Button,
  Input,
  Label,
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@be-in-digital/ui"

interface GlobalServices {
  dineIn?: boolean
  takeaway?: boolean
  delivery?: boolean
  clickAndCollect?: boolean
}

interface StoreSettingsTabProps {
  customizeServices: boolean
  setCustomizeServices: Dispatch<SetStateAction<boolean>>
  dineIn: boolean
  setDineIn: Dispatch<SetStateAction<boolean>>
  takeaway: boolean
  setTakeaway: Dispatch<SetStateAction<boolean>>
  delivery: boolean
  setDelivery: Dispatch<SetStateAction<boolean>>
  clickAndCollect: boolean
  setClickAndCollect: Dispatch<SetStateAction<boolean>>
  customizeMinOrder: boolean
  setCustomizeMinOrder: Dispatch<SetStateAction<boolean>>
  minimumOrderAmount: string
  setMinimumOrderAmount: Dispatch<SetStateAction<string>>
  customizeDeliveryRadius: boolean
  setCustomizeDeliveryRadius: Dispatch<SetStateAction<boolean>>
  deliveryRadius: string
  setDeliveryRadius: Dispatch<SetStateAction<string>>
  customizeDeliveryFee: boolean
  setCustomizeDeliveryFee: Dispatch<SetStateAction<boolean>>
  deliveryFee: string
  setDeliveryFee: Dispatch<SetStateAction<string>>
  customizeDeliveryFree: boolean
  setCustomizeDeliveryFree: Dispatch<SetStateAction<boolean>>
  deliveryFreeAbove: string
  setDeliveryFreeAbove: Dispatch<SetStateAction<string>>
  globalServices: GlobalServices
  globalMinOrder: number
  globalDeliveryRadius: number
  globalDeliveryFee: number
  globalDeliveryFree: number
  handleUpdateSettings: () => Promise<void>
}

export function StoreSettingsTab({
  customizeServices,
  setCustomizeServices,
  dineIn,
  setDineIn,
  takeaway,
  setTakeaway,
  delivery,
  setDelivery,
  clickAndCollect,
  setClickAndCollect,
  customizeMinOrder,
  setCustomizeMinOrder,
  minimumOrderAmount,
  setMinimumOrderAmount,
  customizeDeliveryRadius,
  setCustomizeDeliveryRadius,
  deliveryRadius,
  setDeliveryRadius,
  customizeDeliveryFee,
  setCustomizeDeliveryFee,
  deliveryFee,
  setDeliveryFee,
  customizeDeliveryFree,
  setCustomizeDeliveryFree,
  deliveryFreeAbove,
  setDeliveryFreeAbove,
  globalServices,
  globalMinOrder,
  globalDeliveryRadius,
  globalDeliveryFee,
  globalDeliveryFree,
  handleUpdateSettings,
}: StoreSettingsTabProps) {
  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Paramètres de l'établissement</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Par défaut, les paramètres globaux s'appliquent. Activez un switch pour personnaliser.
        </p>
      </div>

      {/* Services */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <CardTitle className="text-base">Services disponibles</CardTitle>
              {customizeServices && (
                <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
                  Personnalisé
                </Badge>
              )}
            </div>
            <Switch
              checked={customizeServices}
              onCheckedChange={setCustomizeServices}
            />
          </div>
          {!customizeServices && (
            <CardDescription>
              Global : Sur place ({globalServices.dineIn ? "Oui" : "Non"}), À emporter ({globalServices.takeaway ? "Oui" : "Non"}), Livraison ({globalServices.delivery ? "Oui" : "Non"}), Click & Collect ({globalServices.clickAndCollect ? "Oui" : "Non"})
            </CardDescription>
          )}
        </CardHeader>
        {customizeServices && (
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <Label htmlFor="dineIn" className="text-sm cursor-pointer">Sur place</Label>
                <Switch id="dineIn" checked={dineIn} onCheckedChange={setDineIn} />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <Label htmlFor="takeaway" className="text-sm cursor-pointer">À emporter</Label>
                <Switch id="takeaway" checked={takeaway} onCheckedChange={setTakeaway} />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <Label htmlFor="delivery" className="text-sm cursor-pointer">Livraison</Label>
                <Switch id="delivery" checked={delivery} onCheckedChange={setDelivery} />
              </div>
              {/* Disabled for the same reason as on the global settings page:
                  `ORDER_TYPE_SERVICE` maps the three order types onto the other
                  three switches and never reads this one. Re-enable it, here and
                  there, once a fourth order type maps to it. */}
              <div className="flex items-start justify-between gap-3 rounded-lg border px-4 py-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="clickAndCollect" className="text-sm">Click & Collect</Label>
                    <Badge variant="outline" className="text-xs font-normal">Indisponible</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Vos trois types de commande couvrent déjà le retrait, via
                    «&nbsp;À emporter&nbsp;». Ce réglage agira le jour où un
                    quatrième type de commande existera.
                  </p>
                </div>
                <Switch id="clickAndCollect" disabled checked={clickAndCollect} onCheckedChange={setClickAndCollect} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Delivery Settings - grouped */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Paramètres de livraison</CardTitle>
          <CardDescription>
            Montant minimum, rayon, frais et seuil de gratuité
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {/* Minimum Order */}
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Commande minimum</p>
                {!customizeMinOrder && (
                  <p className="text-xs text-muted-foreground mt-0.5">Global : {globalMinOrder} €</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {customizeMinOrder && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Personnalisé</Badge>
                )}
                <Switch checked={customizeMinOrder} onCheckedChange={setCustomizeMinOrder} />
              </div>
            </div>
            {customizeMinOrder && (
              <div className="mt-3 max-w-xs">
                <Label htmlFor="minimumOrderAmount" className="text-xs text-muted-foreground">Montant minimum (€)</Label>
                <Input
                  id="minimumOrderAmount"
                  type="number"
                  step="0.01"
                  value={minimumOrderAmount}
                  onChange={(e) => setMinimumOrderAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Delivery Radius */}
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Rayon de livraison</p>
                {!customizeDeliveryRadius && (
                  <p className="text-xs text-muted-foreground mt-0.5">Global : {globalDeliveryRadius} km</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {customizeDeliveryRadius && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Personnalisé</Badge>
                )}
                <Switch checked={customizeDeliveryRadius} onCheckedChange={setCustomizeDeliveryRadius} />
              </div>
            </div>
            {customizeDeliveryRadius && (
              <div className="mt-3 max-w-xs">
                <Label htmlFor="deliveryRadius" className="text-xs text-muted-foreground">Rayon (km)</Label>
                <Input
                  id="deliveryRadius"
                  type="number"
                  step="0.1"
                  value={deliveryRadius}
                  onChange={(e) => setDeliveryRadius(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Delivery Fee */}
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Frais de livraison</p>
                {!customizeDeliveryFee && (
                  <p className="text-xs text-muted-foreground mt-0.5">Global : {globalDeliveryFee} €</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {customizeDeliveryFee && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Personnalisé</Badge>
                )}
                <Switch checked={customizeDeliveryFee} onCheckedChange={setCustomizeDeliveryFee} />
              </div>
            </div>
            {customizeDeliveryFee && (
              <div className="mt-3 max-w-xs">
                <Label htmlFor="deliveryFee" className="text-xs text-muted-foreground">Montant (€)</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Free Delivery Threshold */}
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Livraison gratuite à partir de</p>
                {!customizeDeliveryFree && (
                  <p className="text-xs text-muted-foreground mt-0.5">Global : {globalDeliveryFree} €</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {customizeDeliveryFree && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Personnalisé</Badge>
                )}
                <Switch checked={customizeDeliveryFree} onCheckedChange={setCustomizeDeliveryFree} />
              </div>
            </div>
            {customizeDeliveryFree && (
              <div className="mt-3 max-w-xs">
                <Label htmlFor="deliveryFreeAbove" className="text-xs text-muted-foreground">Montant (€)</Label>
                <Input
                  id="deliveryFreeAbove"
                  type="number"
                  step="0.01"
                  value={deliveryFreeAbove}
                  onChange={(e) => setDeliveryFreeAbove(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleUpdateSettings} size="sm">
        Enregistrer les paramètres
      </Button>
    </>
  )
}
