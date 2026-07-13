"use client"

import type { Dispatch, SetStateAction } from "react"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@be-in-digital/ui"
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
        <div className="space-y-2">
          <Label htmlFor="currency">Devise</Label>
          <Select value={currency} onValueChange={setCurrency}>
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
          <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
            <Label htmlFor="clickAndCollect" className="cursor-pointer">Click & Collect</Label>
            <Switch
              id="clickAndCollect"
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
