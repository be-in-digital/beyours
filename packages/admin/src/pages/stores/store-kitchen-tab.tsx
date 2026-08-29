"use client"

import type { Dispatch, SetStateAction } from "react"
import { Volume2, VolumeX, Play } from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Slider,
  Switch,
} from "@be-in-digital/ui"
import {
  KITCHEN_ALERTS,
  playAlertBeep,
  type KitchenSoundConfig,
} from "../../lib/kitchen-alerts"

interface StoreKitchenTabProps {
  soundConfig: KitchenSoundConfig
  setSoundConfig: Dispatch<SetStateAction<KitchenSoundConfig>>
  handleUpdateSounds: () => Promise<void>
}

/**
 * The kitchen display's sound alerts, per establishment.
 *
 * `stores.soundConfig` had a mutation, a schema field and a reader — the
 * display — and no screen that wrote it, so every kitchen ran on the hardcoded
 * fallbacks (#243). This is that screen.
 *
 * Each alert carries a preview, because picking a volume for a screen in a
 * noisy kitchen without hearing it is guesswork.
 */
export function StoreKitchenTab({
  soundConfig,
  setSoundConfig,
  handleUpdateSounds,
}: StoreKitchenTabProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Alertes sonores</CardTitle>
          <CardDescription className="mt-1">
            Ce que l&apos;écran de cuisine fait entendre. Les réglages sont
            propres à cet établissement.
          </CardDescription>
        </CardHeader>

        <CardContent className="divide-y">
          {KITCHEN_ALERTS.map((alert) => {
            const setting = soundConfig[alert.key]

            return (
              <div key={alert.key} className="space-y-3 py-5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label
                      htmlFor={`sound-${alert.key}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {alert.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {alert.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs ${setting.enabled ? "text-green-600" : "text-muted-foreground"}`}
                    >
                      {setting.enabled ? "Activé" : "Coupé"}
                    </span>
                    <Switch
                      id={`sound-${alert.key}`}
                      aria-label={`Activer l'alerte « ${alert.label} »`}
                      checked={setting.enabled}
                      onCheckedChange={(enabled) =>
                        setSoundConfig((current) => ({
                          ...current,
                          [alert.key]: { ...current[alert.key], enabled },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {setting.enabled ? (
                    <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <Slider
                    data-testid={`sound-slider-${alert.key}`}
                    aria-label={`Volume de l'alerte « ${alert.label} »`}
                    value={[setting.volume]}
                    min={0}
                    max={100}
                    step={5}
                    disabled={!setting.enabled}
                    onValueChange={([volume]) =>
                      setSoundConfig((current) => ({
                        ...current,
                        [alert.key]: {
                          ...current[alert.key],
                          volume: volume ?? current[alert.key].volume,
                        },
                      }))
                    }
                    className="max-w-xs"
                  />
                  <span
                    data-testid={`sound-volume-${alert.key}`}
                    className="w-12 shrink-0 text-sm tabular-nums text-muted-foreground"
                  >
                    {setting.volume} %
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={!setting.enabled}
                    onClick={() => playAlertBeep(alert, setting.volume)}
                    aria-label={`Écouter l'alerte « ${alert.label} »`}
                  >
                    <Play className="mr-1.5 h-3 w-3" />
                    Écouter
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button onClick={handleUpdateSounds} size="sm">
        Enregistrer les alertes
      </Button>
    </>
  )
}
