"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@be-in-digital/ui"
import { Input } from "@be-in-digital/ui"
import { Label } from "@be-in-digital/ui"
import { Switch } from "@be-in-digital/ui"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@be-in-digital/ui"
import { DAY_NAMES, DISPLAY_ORDER } from "./store-detail-constants"
import type { DayHours } from "./store-detail-types"

interface StoreHoursTabProps {
  useGlobalHours: boolean
  setUseGlobalHours: Dispatch<SetStateAction<boolean>>
  globalHours: DayHours[]
  hours: DayHours[]
  setHours: Dispatch<SetStateAction<DayHours[]>>
  handleSetAllWeekdays: () => void
  handleSetAllDays: () => void
  handleUpdateHours: () => Promise<void>
}

export function StoreHoursTab({
  useGlobalHours,
  setUseGlobalHours,
  globalHours,
  hours,
  setHours,
  handleSetAllWeekdays,
  handleSetAllDays,
  handleUpdateHours,
}: StoreHoursTabProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Horaires d'ouverture</CardTitle>
              <CardDescription className="mt-1">
                {useGlobalHours
                  ? "Cet établissement utilise les horaires globaux"
                  : "Horaires personnalisés pour cet établissement"
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Label
                htmlFor="useGlobalHours"
                className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap"
              >
                Horaires globaux
              </Label>
              <Switch
                id="useGlobalHours"
                checked={useGlobalHours}
                onCheckedChange={setUseGlobalHours}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Global hours (read-only) */}
          {useGlobalHours && globalHours.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="space-y-2">
                {DISPLAY_ORDER.map((dayNum) => {
                  const dayH = globalHours.find((h: DayHours) => h.day === dayNum)
                  if (!dayH) return null
                  return (
                    <div key={dayNum} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="font-medium w-24">{DAY_NAMES[dayNum]}</span>
                      <span className="text-muted-foreground">
                        {dayH.isClosed ? "Fermé" : `${dayH.open} – ${dayH.close}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Custom hours editor */}
          {!useGlobalHours && (
            <>
              <div className="flex flex-wrap gap-2 pb-2">
                <Button variant="outline" size="sm" onClick={handleSetAllWeekdays}>
                  Appliquer Lundi à Vendredi
                </Button>
                <Button variant="outline" size="sm" onClick={handleSetAllDays}>
                  Appliquer à tous les jours
                </Button>
              </div>

              <div className="divide-y">
                {DISPLAY_ORDER.map((dayNum) => {
                  const dayHours = hours.find((h) => h.day === dayNum)
                  if (!dayHours) return null
                  const index = hours.indexOf(dayHours)

                  return (
                    <div
                      key={dayNum}
                      className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${dayHours.isClosed ? "opacity-50" : ""}`}
                    >
                      <span className="w-24 text-sm font-medium shrink-0">
                        {DAY_NAMES[dayNum]}
                      </span>

                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <Input
                          id={`open-${dayNum}`}
                          type="time"
                          value={dayHours.open}
                          onChange={(e) => {
                            const newHours = [...hours]
                            newHours[index] = { ...dayHours, open: e.target.value }
                            setHours(newHours)
                          }}
                          disabled={dayHours.isClosed}
                          className="w-[120px]"
                        />
                        <span className="text-muted-foreground text-sm">–</span>
                        <Input
                          id={`close-${dayNum}`}
                          type="time"
                          value={dayHours.close}
                          onChange={(e) => {
                            const newHours = [...hours]
                            newHours[index] = { ...dayHours, close: e.target.value }
                            setHours(newHours)
                          }}
                          disabled={dayHours.isClosed}
                          className="w-[120px]"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        <Switch
                          id={`closed-${dayNum}`}
                          checked={dayHours.isClosed}
                          onCheckedChange={(checked) => {
                            const newHours = [...hours]
                            newHours[index] = { ...dayHours, isClosed: checked }
                            setHours(newHours)
                          }}
                        />
                        <Label htmlFor={`closed-${dayNum}`} className="text-sm text-muted-foreground cursor-pointer">
                          Fermé
                        </Label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleUpdateHours} size="sm">
        Enregistrer les horaires
      </Button>
    </>
  )
}
