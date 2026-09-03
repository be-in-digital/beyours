"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { Volume2, VolumeX, Play, Printer, Plus, X, Check } from "lucide-react"
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Slider,
  Switch,
} from "@be-in-digital/ui"
import {
  KITCHEN_ALERTS,
  playAlertBeep,
  type KitchenSoundConfig,
} from "../../lib/kitchen-alerts"
import {
  MAX_STATION_NAME_LENGTH,
  ORDER_CONFIRMATION_MODES,
  PAPER_SIZES,
  PRINT_PROVIDERS,
  PRINT_TRIGGERS,
  hasStation,
  isProviderAvailable,
  normaliseStationName,
  type KitchenPrintConfig,
  type OrderConfirmationMode,
  type PaperSize,
  type PrintProvider,
  type PrintTriggerKey,
} from "../../lib/kitchen-print"

/** Only the two fields the mapping needs; the query returns the whole row. */
interface StoreCategory {
  _id: string
  name: string
}

interface StoreKitchenTabProps {
  soundConfig: KitchenSoundConfig
  setSoundConfig: Dispatch<SetStateAction<KitchenSoundConfig>>
  handleUpdateSounds: () => Promise<void>
  orderConfirmation: OrderConfirmationMode
  setOrderConfirmation: Dispatch<SetStateAction<OrderConfirmationMode>>
  handleUpdateOrderConfirmation: () => Promise<void>
  printConfig: KitchenPrintConfig
  setPrintConfig: Dispatch<SetStateAction<KitchenPrintConfig>>
  handleUpdatePrintConfig: () => Promise<void>
  categories: StoreCategory[] | undefined
  kitchenStations: string[]
  setKitchenStations: Dispatch<SetStateAction<string[]>>
  stationMapping: Record<string, string>
  setStationMapping: Dispatch<SetStateAction<Record<string, string>>>
  handleUpdateStations: () => Promise<void>
}

/** The value a category select carries when nothing is assigned. */
const UNASSIGNED = "__unassigned__"

/**
 * Everything the kitchen does with an order: print it, route it, announce it.
 *
 * Four settings, one tab, in the order a service runs through them.
 *
 * CONFIRMATION (#164) decides whether a paid order reaches the pass without a
 * human at all. `releaseToKitchen` reads it; the mutation that wrote it was
 * deleted in 74de4e9 with the unrouted screen that called it, so the setting
 * was readable, meaningful and unreachable.
 *
 * PRINTING (#164) was the hole. `stores.printConfig` decides whether a paid
 * order produces a slip; `kitchenTickets.create` reads it and no screen in the
 * engine wrote it, so every establishment ran with `printConfig === undefined`,
 * every ticket was stamped `printStatus: "not_required"`, `getPrintQueue` was
 * permanently empty and automatic printing was dead product-wide. The editor
 * that once existed lived in a folder no route rendered and went out with it.
 *
 * STATIONS closes the same shape of hole one layer down: `resolveStations`
 * reads `stationMapping` on every paid order and nothing wrote it, so the
 * routing the schema describes could not be switched on.
 *
 * SOUND was the first of the three to be given a screen (#243) and is
 * unchanged; it sits last because it is what an owner tunes once the tickets
 * are actually coming out.
 */
export function StoreKitchenTab({
  soundConfig,
  setSoundConfig,
  handleUpdateSounds,
  orderConfirmation,
  setOrderConfirmation,
  handleUpdateOrderConfirmation,
  printConfig,
  setPrintConfig,
  handleUpdatePrintConfig,
  categories,
  kitchenStations,
  setKitchenStations,
  stationMapping,
  setStationMapping,
  handleUpdateStations,
}: StoreKitchenTabProps) {
  const [stationDraft, setStationDraft] = useState("")

  const draftName = normaliseStationName(stationDraft)
  const isDuplicateStation = draftName.length > 0 && hasStation(kitchenStations, draftName)
  const canAddStation = draftName.length > 0 && !isDuplicateStation

  const selectedProvider = PRINT_PROVIDERS.find((p) => p.key === printConfig.provider)
  const providerUnavailable = !isProviderAvailable(printConfig.provider)

  const addStation = () => {
    if (!canAddStation) return
    setKitchenStations((current) => [...current, draftName])
    setStationDraft("")
  }

  /**
   * Drop a station, and every assignment that pointed at it.
   *
   * `resolveStations` matches on the station string, so an assignment left
   * behind would keep routing tickets to a pass that no longer exists. The save
   * handler filters the same pairs out as a backstop; doing it here means the
   * screen never shows a category assigned to nothing.
   */
  const removeStation = (station: string) => {
    setKitchenStations((current) => current.filter((s) => s !== station))
    setStationMapping((current) =>
      Object.fromEntries(Object.entries(current).filter(([, s]) => s !== station))
    )
  }

  const assignCategory = (categoryId: string, station: string) => {
    setStationMapping((current) => {
      const next = { ...current }
      if (station === UNASSIGNED) delete next[categoryId]
      else next[categoryId] = station
      return next
    })
  }

  const toggleTrigger = (key: PrintTriggerKey, checked: boolean) => {
    setPrintConfig((current) => ({
      ...current,
      triggers: checked
        ? [...current.triggers.filter((t) => t !== key), key]
        : current.triggers.filter((t) => t !== key),
    }))
  }

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Order confirmation                                               */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Confirmation des commandes</CardTitle>
          <CardDescription className="mt-1">
            Ce qui arrive à une commande une fois qu&apos;elle est payée.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            role="radiogroup"
            aria-label="Confirmation des commandes"
            className="grid gap-3 sm:grid-cols-2"
          >
            {ORDER_CONFIRMATION_MODES.map((mode) => {
              const selected = orderConfirmation === mode.key

              return (
                <button
                  key={mode.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`order-confirmation-${mode.key}`}
                  onClick={() => setOrderConfirmation(mode.key)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{mode.label}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {mode.description}
                  </span>
                </button>
              )
            })}
          </div>

          {/*
            The trap this setting is. `releaseToKitchen` returns without
            creating a ticket under "manual", so the kitchen display stays
            empty and nothing prints — the two modes are indistinguishable from
            the pass until an order fails to appear. Naming the button that has
            to be pressed is what turns "held" into something an owner can act
            on.
          */}
          {orderConfirmation === "manual" && (
            <Alert
              variant="warning"
              title="Rien ne part en cuisine tant que personne n'a accepté"
              data-testid="order-confirmation-warning"
            >
              <p>
                La commande payée reste en attente : aucun ticket n&apos;est
                imprimé et l&apos;écran de cuisine ne l&apos;affiche pas.
                Quelqu&apos;un doit cliquer «&nbsp;Accepter la commande&nbsp;»
                dans la liste des commandes, à chaque service. Sans cela, le
                client attend un plat que la cuisine n&apos;a jamais vu.
              </p>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleUpdateOrderConfirmation}
        size="sm"
        data-testid="order-confirmation-save"
      >
        Enregistrer la confirmation
      </Button>

      {/* ---------------------------------------------------------------- */}
      {/* Printing                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Impression des tickets</CardTitle>
              <CardDescription className="mt-1">
                {printConfig.enabled
                  ? "Les commandes payées sortent en cuisine sur papier."
                  : "Aucun ticket n'est imprimé. Les commandes s'affichent uniquement à l'écran de cuisine."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-xs ${printConfig.enabled ? "text-green-600" : "text-muted-foreground"}`}
              >
                {printConfig.enabled ? "Activée" : "Coupée"}
              </span>
              <Switch
                id="print-enabled"
                data-testid="print-enabled"
                aria-label="Activer l'impression des tickets"
                checked={printConfig.enabled}
                onCheckedChange={(enabled) =>
                  setPrintConfig((current) => ({ ...current, enabled }))
                }
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {printConfig.enabled ? (
            <>
              {/*
                The warning issue #164 asks for. `KitchenPrintTrigger` returns
                immediately for any provider but `browser`, so a cloud printer
                leaves tickets queued forever while the display's "Impression
                bloquée" alarm repeats every thirty seconds with nothing on
                screen to explain it.
              */}
              {providerUnavailable && (
                <Alert
                  variant="destructive"
                  title="Ce mode d'impression ne fonctionne pas encore"
                  data-testid="print-provider-warning"
                >
                  <p>
                    Aucun ticket ne sortira, et l&apos;alarme «&nbsp;Impression
                    bloquée&nbsp;» sonnera toutes les 30&nbsp;secondes en cuisine.
                    Repassez sur «&nbsp;Navigateur&nbsp;» ou coupez
                    l&apos;impression.
                  </p>
                </Alert>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="print-provider" className="text-sm font-medium">
                    Mode d&apos;impression
                  </Label>
                  <Select
                    value={printConfig.provider}
                    onValueChange={(provider) =>
                      setPrintConfig((current) => ({
                        ...current,
                        provider: provider as PrintProvider,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="print-provider"
                      data-testid="print-provider"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRINT_PROVIDERS.map((provider) => (
                        <SelectItem
                          key={provider.key}
                          value={provider.key}
                          disabled={!provider.available}
                          data-testid={`print-provider-${provider.key}`}
                        >
                          {/*
                            Radix renders these children in the closed trigger
                            too, so an establishment already stored on a cloud
                            provider reads "Bientôt" without opening the list.
                            A span rather than `Badge`, which is a div: this is
                            phrasing content inside a span.
                          */}
                          <span className="flex items-center gap-2">
                            {provider.label}
                            {!provider.available && (
                              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                                Bientôt
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {selectedProvider?.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="print-paper-size" className="text-sm font-medium">
                    Largeur du papier
                  </Label>
                  <Select
                    value={printConfig.paperSize}
                    onValueChange={(paperSize) =>
                      setPrintConfig((current) => ({
                        ...current,
                        paperSize: paperSize as PaperSize,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="print-paper-size"
                      data-testid="print-paper-size"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAPER_SIZES.map((size) => (
                        <SelectItem key={size.key} value={size.key}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {PAPER_SIZES.find((s) => s.key === printConfig.paperSize)?.description}
                  </p>
                </div>
              </div>

              <div className="space-y-1 border-t pt-5">
                <Label className="text-sm font-medium">Quand imprimer</Label>
                <div className="divide-y">
                  {PRINT_TRIGGERS.map((trigger) => (
                    <div
                      key={trigger.key}
                      className="flex items-start justify-between gap-4 py-4 last:pb-0"
                    >
                      <div className="space-y-1">
                        <Label
                          htmlFor={`print-trigger-${trigger.key}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {trigger.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {trigger.description}
                        </p>
                      </div>
                      <Switch
                        id={`print-trigger-${trigger.key}`}
                        data-testid={`print-trigger-${trigger.key}`}
                        aria-label={`Imprimer « ${trigger.label} »`}
                        checked={printConfig.triggers.includes(trigger.key)}
                        onCheckedChange={(checked) => toggleTrigger(trigger.key, checked)}
                        className="shrink-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
              <Printer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Activez l&apos;impression pour choisir le mode, la largeur du
                papier et le moment où le ticket sort. Le personnel peut toujours
                réimprimer un ticket depuis l&apos;écran de cuisine.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleUpdatePrintConfig} size="sm" data-testid="print-save">
        Enregistrer l&apos;impression
      </Button>

      {/* ---------------------------------------------------------------- */}
      {/* Stations                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Postes de cuisine</CardTitle>
          <CardDescription className="mt-1">
            Nommez vos postes, puis dites lequel prépare chaque catégorie. Une
            commande est alors coupée en un ticket par poste concerné. Sans
            poste, elle reste sur un seul ticket.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="station-name" className="text-sm font-medium">
              Vos postes
            </Label>

            {kitchenStations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {kitchenStations.map((station) => (
                  <Badge
                    key={station}
                    variant="secondary"
                    className="gap-1.5 py-1 pr-1 pl-3 text-sm font-normal"
                  >
                    {station}
                    <button
                      type="button"
                      data-testid={`station-remove-${station}`}
                      aria-label={`Supprimer le poste « ${station} »`}
                      onClick={() => removeStation(station)}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun poste. Toute la commande part sur un seul ticket — ce qui
                convient à une cuisine tenue par une seule brigade.
              </p>
            )}

            <div className="flex items-start gap-2">
              <div className="w-full max-w-xs space-y-1.5">
                <Input
                  id="station-name"
                  data-testid="station-name-input"
                  value={stationDraft}
                  maxLength={MAX_STATION_NAME_LENGTH}
                  placeholder="chaud, froid, pizza…"
                  aria-label="Nom du poste à ajouter"
                  onChange={(event) => setStationDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return
                    event.preventDefault()
                    addStation()
                  }}
                />
                {isDuplicateStation && (
                  <p className="text-sm text-destructive" data-testid="station-duplicate">
                    Ce poste existe déjà.
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                data-testid="station-add"
                disabled={!canAddStation}
                onClick={addStation}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>

          {kitchenStations.length > 0 && (
            <div className="space-y-1 border-t pt-5">
              <Label className="text-sm font-medium">Qui prépare quoi</Label>

              {categories === undefined ? (
                <div className="space-y-3 pt-3">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="flex items-center justify-between gap-4">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-9 w-[180px]" />
                    </div>
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <p className="pt-2 text-sm text-muted-foreground">
                  Cet établissement n&apos;a pas encore de catégorie. Créez-en
                  dans le menu pour pouvoir les répartir entre les postes.
                </p>
              ) : (
                <div className="divide-y">
                  {categories.map((category) => (
                    <div
                      key={category._id}
                      className="flex items-center justify-between gap-4 py-3 last:pb-0"
                    >
                      <span className="text-sm">{category.name}</span>
                      <Select
                        value={stationMapping[category._id] ?? UNASSIGNED}
                        onValueChange={(station) => assignCategory(category._id, station)}
                      >
                        <SelectTrigger
                          data-testid={`station-select-${category._id}`}
                          aria-label={`Poste pour « ${category.name} »`}
                          className="w-[180px] shrink-0"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Non assignée</SelectItem>
                          {kitchenStations.map((station) => (
                            <SelectItem key={station} value={station}>
                              {station}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleUpdateStations} size="sm" data-testid="stations-save">
        Enregistrer les postes
      </Button>

      {/* ---------------------------------------------------------------- */}
      {/* Sound alerts                                                     */}
      {/* ---------------------------------------------------------------- */}
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
