"use client"

import type { Dispatch, SetStateAction } from "react"
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@be-yours/ui"
import { CURRENCIES, TIMEZONES } from "./settings-constants"

interface GeneralTabProps {
  currency: string
  setCurrency: Dispatch<SetStateAction<string>>
  timezone: string
  setTimezone: Dispatch<SetStateAction<string>>
  taxRate: string
  setTaxRate: Dispatch<SetStateAction<string>>
  minimumOrder: string
  setMinimumOrder: Dispatch<SetStateAction<string>>
  dineIn: boolean
  setDineIn: Dispatch<SetStateAction<boolean>>
  takeaway: boolean
  setTakeaway: Dispatch<SetStateAction<boolean>>
  delivery: boolean
  setDelivery: Dispatch<SetStateAction<boolean>>
  clickAndCollect: boolean
  setClickAndCollect: Dispatch<SetStateAction<boolean>>
  handleSaveGeneral: () => Promise<void>
}

export function GeneralTab({
  currency,
  setCurrency,
  timezone,
  setTimezone,
  taxRate,
  setTaxRate,
  minimumOrder,
  setMinimumOrder,
  dineIn,
  setDineIn,
  takeaway,
  setTakeaway,
  delivery,
  setDelivery,
  clickAndCollect,
  setClickAndCollect,
  handleSaveGeneral,
}: GeneralTabProps) {
  return (
    <div className="border border-border/50 rounded-lg p-6 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {/* The currency picker is disabled on purpose, and only half of it is
            missing. The admin IS currency-aware: the payments and refund
            screens format with `formatPrice(amount, payment.currency)`, so a
            payment taken in another currency is displayed in it. The storefront
            is not: `formatPrice` in @be-yours/restaurant defaults to
            ('EUR', 'fr-FR') and all 27 storefront call sites per app pass the
            amount alone, so every public price renders in euros whatever is
            stored in `globalSettings.currency`. Re-enable this once those call
            sites read the setting — same convention as the email automations,
            which stay disabled with a stated reason rather than shipping a
            control that half works without saying so. */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="currency">Devise</Label>
            <Badge variant="outline" className="text-xs font-normal">
              Indisponible
            </Badge>
          </div>
          <Select disabled value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((curr) => (
                <SelectItem key={curr.value} value={curr.value}>
                  {curr.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            La devise sert à vos paiements et à vos remboursements, qui
            s'affichent dans la devise encaissée. Votre site public, lui,
            affiche encore tous les prix en euros.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Fuseau horaire</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="taxRate">TVA par défaut (%)</Label>
          <Input
            id="taxRate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minimumOrder">Commande minimum (€)</Label>
          <Input
            id="minimumOrder"
            type="number"
            min="0"
            step="0.01"
            value={minimumOrder}
            onChange={(e) => setMinimumOrder(e.target.value)}
            placeholder="Optionnel"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Services activés</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
            <Label htmlFor="dineIn" className="cursor-pointer">Sur place</Label>
            <Switch
              id="dineIn"
              checked={dineIn}
              onCheckedChange={setDineIn}
            />
          </div>
          <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
            <Label htmlFor="takeaway" className="cursor-pointer">À emporter</Label>
            <Switch
              id="takeaway"
              checked={takeaway}
              onCheckedChange={setTakeaway}
            />
          </div>
          <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
            <Label htmlFor="delivery" className="cursor-pointer">Livraison</Label>
            <Switch
              id="delivery"
              checked={delivery}
              onCheckedChange={setDelivery}
            />
          </div>
          {/* Click & Collect is disabled on purpose. `ORDER_TYPE_SERVICE`
              (@be-yours/convex-schema) maps the three order types onto the
              other three switches and never reads this one, so flipping it
              changes nothing an owner can observe. Same convention as the email
              automations, which stay disabled with a stated reason rather than
              shipping a switch that controls nothing. Delete the badge, the
              note and `disabled` once a fourth order type maps to it. */}
          <div className="flex items-start justify-between gap-3 border border-border/50 rounded-lg px-4 py-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="clickAndCollect">Click & Collect</Label>
                <Badge variant="outline" className="text-xs font-normal">
                  Indisponible
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Vos trois types de commande couvrent déjà le retrait, via
                «&nbsp;À emporter&nbsp;». Ce réglage agira le jour où un
                quatrième type de commande existera.
              </p>
            </div>
            <Switch
              id="clickAndCollect"
              disabled
              checked={clickAndCollect}
              onCheckedChange={setClickAndCollect}
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSaveGeneral} size="sm">
        Enregistrer les paramètres généraux
      </Button>
    </div>
  )
}
