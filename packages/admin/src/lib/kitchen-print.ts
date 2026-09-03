/**
 * How an establishment's kitchen receives an order, prints it and routes it.
 *
 * WHY THIS EXISTS: `stores.printConfig` decides whether a paid order produces a
 * slip at the pass. `kitchenTickets.create` reads it and writes
 * `printStatus: "pending"` only when it is enabled and lists the trigger — and
 * no screen anywhere in the engine wrote it. Every establishment therefore ran
 * with `printConfig === undefined`, every ticket was stamped `"not_required"`,
 * `getPrintQueue` was permanently empty and automatic printing was dead
 * product-wide (#164). The editor that once existed lived in
 * `apps/themes/components/admin/settings/`, a folder no route rendered, and was
 * deleted along with it.
 *
 * `stationMapping` has the same shape of hole one layer down:
 * `orders.resolveStations` reads it on every paid order and nothing wrote it.
 * `orderConfirmation` has it one layer up: `orders.releaseToKitchen` reads it
 * on every paid order, and the mutation that wrote it was deleted in 74de4e9
 * along with that same unrouted folder.
 *
 * The catalogues live here rather than inline in the tab for the reason
 * `kitchen-alerts` does — they carry facts the UI must state and a future caller
 * must not contradict, the sharpest being that only `browser` prints anything.
 */

/* ------------------------------------------------------------------ */
/* Order confirmation                                                  */
/* ------------------------------------------------------------------ */

export type OrderConfirmationMode = "auto" | "manual"

export interface OrderConfirmationOption {
  key: OrderConfirmationMode
  label: string
  /** What the establishment lives with, not what the code does. */
  description: string
}

/**
 * When a paid order reaches the pass.
 *
 * `releaseToKitchen` reads this on every paid order. Under "manual" it returns
 * without creating a ticket and the order waits for `orders.updateStatus` to
 * move it to `confirmed` — which is a person pressing a button. Nothing prints
 * either, because there is no ticket to print.
 *
 * That is a workflow an establishment can want, and a trap for one that does
 * not know it chose it: from the kitchen the two modes are indistinguishable
 * until an order fails to appear. The descriptions carry that consequence, and
 * the editor repeats it when "manual" is selected.
 */
export const ORDER_CONFIRMATION_MODES: readonly OrderConfirmationOption[] = [
  {
    key: "auto",
    label: "Automatique",
    description:
      "La commande payée part directement en cuisine. C'est le comportement de tous les établissements aujourd'hui.",
  },
  {
    key: "manual",
    label: "Manuelle",
    description:
      "La commande payée attend qu'un membre du personnel l'accepte avant de partir en cuisine.",
  },
]

/** What the backend does with an establishment that has never chosen. */
export const DEFAULT_ORDER_CONFIRMATION: OrderConfirmationMode = "auto"

/** Read the stored mode, falling back the way `releaseToKitchen` does. */
export function resolveOrderConfirmation(
  stored: string | null | undefined
): OrderConfirmationMode {
  return stored === "manual" ? "manual" : DEFAULT_ORDER_CONFIRMATION
}

/* ------------------------------------------------------------------ */
/* Printing                                                            */
/* ------------------------------------------------------------------ */

export type PrintProvider =
  | "browser"
  | "star_cloud"
  | "epson_cloud"
  | "sunmi_cloud"

export type PrintTriggerKey = "confirmed" | "ready" | "reprint"

export type PaperSize = "80mm" | "58mm"

/**
 * The shape the editor owns.
 *
 * `apiKey` is deliberately absent. It is a printer credential, `storeAudit`
 * redacts it and `stores.getById` strips it before the admin ever sees it — so
 * an editor could not round-trip it honestly even if a credential belonged in a
 * form, which it does not.
 *
 * Consequence, stated because it is not obvious: `updatePrintConfig` replaces
 * the whole object, so saving from this screen clears any stored key. The
 * screen does NOT warn about it and cannot — the value is stripped before it
 * arrives, so the form has no way to know one exists. Only a hand-written row
 * on a cloud provider, which this editor refuses to select, can be in that
 * state; when those providers ship, the key needs its own write path rather
 * than a warning here.
 *
 * `printerId` is not a secret and does survive the read, so it is carried
 * through untouched rather than dropped.
 */
export interface KitchenPrintConfig {
  provider: PrintProvider
  printerId?: string | undefined
  triggers: PrintTriggerKey[]
  paperSize: PaperSize
  enabled: boolean
}

export interface PrintProviderOption {
  key: PrintProvider
  label: string
  /** What the establishment has to have in the room for this to work. */
  description: string
  /** Whether `KitchenPrintTrigger` can actually drive it today. */
  available: boolean
}

/**
 * The four providers the schema accepts, and the one that prints.
 *
 * `KitchenPrintTrigger` returns immediately for any provider other than
 * `browser`. Choosing a cloud printer therefore leaves tickets queued as
 * `pending` forever, and the display's `printerOffline` alarm — which repeats
 * every thirty seconds — sounds with nothing on screen to explain it (#164).
 *
 * They stay listed rather than removed: they are stored values, the schema
 * still accepts them, and an establishment that already holds one deserves to
 * see which one. They are offered `disabled`, with the reason in view, so the
 * choice is legible instead of merely impossible.
 */
export const PRINT_PROVIDERS: readonly PrintProviderOption[] = [
  {
    key: "browser",
    label: "Navigateur",
    description:
      "L'écran de cuisine imprime lui-même, sur l'imprimante du poste. C'est le seul mode disponible aujourd'hui.",
    available: true,
  },
  {
    key: "star_cloud",
    label: "Star Cloud",
    description: "Imprimante Star connectée au cloud du fabricant.",
    available: false,
  },
  {
    key: "epson_cloud",
    label: "Epson Cloud",
    description: "Imprimante Epson connectée au cloud du fabricant.",
    available: false,
  },
  {
    key: "sunmi_cloud",
    label: "Sunmi Cloud",
    description: "Imprimante Sunmi connectée au cloud du fabricant.",
    available: false,
  },
]

export interface PrintTriggerOption {
  key: PrintTriggerKey
  label: string
  /** What makes it fire, in the kitchen's terms rather than the code's. */
  description: string
}

/**
 * When a slip comes out, in the order an order goes through them.
 *
 * `reprint` is not automatic: it is the staff's own button on the kitchen
 * screen. It is listed here because `kitchenTickets.requestReprint` writes the
 * queue whatever this says, so leaving it out of the editor would let an
 * establishment believe it had switched printing off entirely.
 */
export const PRINT_TRIGGERS: readonly PrintTriggerOption[] = [
  {
    key: "confirmed",
    label: "À la confirmation",
    description:
      "Le paiement est encaissé et la commande part en cuisine. C'est le déclencheur qui fait tourner un service.",
  },
  {
    key: "ready",
    label: "Quand la commande est prête",
    description:
      "Un second ticket quand le plat est prêt à partir — pour le passe ou pour le livreur.",
  },
  {
    key: "reprint",
    label: "Réimpression manuelle",
    description:
      "Le bouton du personnel sur l'écran de cuisine, quand un ticket est perdu ou illisible.",
  },
]

export interface PaperSizeOption {
  key: PaperSize
  label: string
  description: string
}

export const PAPER_SIZES: readonly PaperSizeOption[] = [
  {
    key: "80mm",
    label: "80 mm",
    description: "Le rouleau standard des imprimantes de comptoir.",
  },
  {
    key: "58mm",
    label: "58 mm",
    description: "Le rouleau étroit des terminaux de paiement et des Sunmi.",
  },
]

/**
 * What an establishment that has never been configured starts from.
 *
 * Off, and on the only provider that works. Printing costs paper and needs an
 * imprimante branchée: turning it on for everyone at once would greet a
 * restaurant with an alarm it did not ask for. `confirmed` and `reprint` are
 * pre-selected because they are the pair a kitchen actually uses — the choice
 * that matters is the switch above them.
 */
export const DEFAULT_PRINT_CONFIG: KitchenPrintConfig = {
  provider: "browser",
  triggers: ["confirmed", "reprint"],
  paperSize: "80mm",
  enabled: false,
}

const PROVIDER_KEYS = new Set<string>(PRINT_PROVIDERS.map((p) => p.key))
const TRIGGER_KEYS = new Set<string>(PRINT_TRIGGERS.map((t) => t.key))
const PAPER_KEYS = new Set<string>(PAPER_SIZES.map((p) => p.key))

/** The providers a save is allowed to select. */
export function isProviderAvailable(provider: PrintProvider): boolean {
  return PRINT_PROVIDERS.some((p) => p.key === provider && p.available)
}

/**
 * Fill in what a stored config does not carry.
 *
 * A row written before a trigger existed, or hand-edited, must not leave the
 * form reading `undefined.includes`. Unknown values fall back rather than
 * throwing: the schema is the authority on what may be stored, and a form that
 * refuses to open is worse than one that opens on the default.
 */
export function resolvePrintConfig(
  stored:
    | {
        provider?: string
        printerId?: string
        triggers?: readonly string[]
        paperSize?: string
        enabled?: boolean
      }
    | null
    | undefined
): KitchenPrintConfig {
  const provider =
    stored?.provider && PROVIDER_KEYS.has(stored.provider)
      ? (stored.provider as PrintProvider)
      : DEFAULT_PRINT_CONFIG.provider

  const paperSize =
    stored?.paperSize && PAPER_KEYS.has(stored.paperSize)
      ? (stored.paperSize as PaperSize)
      : DEFAULT_PRINT_CONFIG.paperSize

  const triggers = stored?.triggers
    ? PRINT_TRIGGERS.filter((t) => stored.triggers?.includes(t.key)).map(
        (t) => t.key
      )
    : [...DEFAULT_PRINT_CONFIG.triggers]

  return {
    provider,
    printerId: stored?.printerId,
    paperSize,
    triggers,
    enabled: stored?.enabled ?? DEFAULT_PRINT_CONFIG.enabled,
  }
}

/** Order the triggers the way the catalogue does, whatever order they arrived in. */
export function orderTriggers(
  triggers: readonly string[]
): PrintTriggerKey[] {
  return PRINT_TRIGGERS.filter((t) => triggers.includes(t.key)).map((t) => t.key)
}

/* ------------------------------------------------------------------ */
/* Stations                                                            */
/* ------------------------------------------------------------------ */

/** One category, sent to one station. `station` is a name the owner chose. */
export interface StationAssignment {
  categoryId: string
  station: string
}

/** The longest a station name may be, so a ticket header stays readable. */
export const MAX_STATION_NAME_LENGTH = 24

/**
 * Trim a station name to something a ticket can print and a mapping can match.
 *
 * Names are compared by their exact stored value — `stationMapping.station` is
 * a string, not a reference — so " Chaud " and "Chaud" would be two stations
 * that look like one. Normalising on the way in is what keeps that from
 * happening; comparison is case-insensitive for the same reason.
 */
export function normaliseStationName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, MAX_STATION_NAME_LENGTH)
}

/** Whether `name` already names a station, ignoring case and padding. */
export function hasStation(
  stations: readonly string[],
  name: string
): boolean {
  const target = normaliseStationName(name).toLocaleLowerCase("fr")
  return stations.some((s) => s.toLocaleLowerCase("fr") === target)
}
