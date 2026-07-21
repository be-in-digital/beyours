"use client"

import { Button, Input, Label, Switch } from "@be-in-digital/ui"
import { DAY_NAMES, DISPLAY_ORDER } from "./settings-constants"
import type { StoreHours } from "./settings-types"

interface HoursTabProps {
  hours: StoreHours
  updateHour: (day: number, field: "open" | "close" | "isClosed", value: string | boolean) => void
  applyWeekdayHours: () => void
  applyAllDaysHours: () => void
  handleSaveHours: () => Promise<void>
}

export function HoursTab({
  hours,
  updateHour,
  applyWeekdayHours,
  applyAllDaysHours,
  handleSaveHours,
}: HoursTabProps) {
  return (
    <div className="border border-border/50 rounded-lg p-6 space-y-4">
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={applyWeekdayHours}>
          Lun-Ven même horaire
        </Button>
        <Button variant="outline" size="sm" onClick={applyAllDaysHours}>
          Tous les jours
        </Button>
      </div>

      <div className="space-y-3">
        {DISPLAY_ORDER.map((dayNum) => {
          const dayHours = hours.find((h) => h.day === dayNum)
          if (!dayHours) return null

          return (
            <div key={dayNum} className="flex items-center gap-4 border border-border/50 rounded-lg p-4">
              <div className="w-24 font-medium text-sm">
                {DAY_NAMES[dayNum]}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`open-${dayNum}`} className="text-xs text-muted-foreground">
                    Ouverture
                  </Label>
                  <Input
                    id={`open-${dayNum}`}
                    type="time"
                    value={dayHours.open}
                    onChange={(e) => updateHour(dayNum, "open", e.target.value)}
                    disabled={dayHours.isClosed}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`close-${dayNum}`} className="text-xs text-muted-foreground">
                    Fermeture
                  </Label>
                  <Input
                    id={`close-${dayNum}`}
                    type="time"
                    value={dayHours.close}
                    onChange={(e) => updateHour(dayNum, "close", e.target.value)}
                    disabled={dayHours.isClosed}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id={`closed-${dayNum}`}
                  checked={!dayHours.isClosed}
                  onCheckedChange={(checked) => updateHour(dayNum, "isClosed", !checked)}
                />
                <Label htmlFor={`closed-${dayNum}`} className="text-sm cursor-pointer">
                  {dayHours.isClosed ? "Fermé" : "Ouvert"}
                </Label>
              </div>
            </div>
          )
        })}
      </div>

      <Button onClick={handleSaveHours} size="sm">
        Enregistrer les horaires
      </Button>
    </div>
  )
}
