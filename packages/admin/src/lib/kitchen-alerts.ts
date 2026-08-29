/**
 * The kitchen display's three sound alerts.
 *
 * WHY THIS EXISTS: `stores.soundConfig` decides which alerts sound and how
 * loudly, and until now nothing wrote it. The mutation, the schema field and
 * the reader were all in place; the settings screen never was, so every
 * deployment ran on a literal hardcoded inside `KitchenContent` (#243).
 *
 * The catalogue lives here, in the shared admin package, because two screens
 * need to agree on it: the editor an owner sets the volumes in, and the display
 * that plays them. It was written out twice — the defaults in `KitchenContent`,
 * the frequencies in `KitchenSoundManager` — and a third copy in the editor
 * would have been the one that drifted.
 *
 * Volume is a percentage. `playAlertBeep` divides by 100 and clamps, the same
 * way the display does.
 */

export type KitchenAlertKey = "newTicket" | "overdue" | "printerOffline"

export interface KitchenAlertSetting {
  enabled: boolean
  volume: number
}

export type KitchenSoundConfig = Record<KitchenAlertKey, KitchenAlertSetting>

export interface KitchenAlert {
  key: KitchenAlertKey
  label: string
  /** What makes it fire, in the kitchen's terms rather than the code's. */
  description: string
  /** Tone, in hertz, and length, in milliseconds — what the display plays. */
  frequency: number
  duration: number
  /** Whether it repeats for as long as the condition holds. */
  repeats: boolean
}

/**
 * The three alerts, in the order the display raises them.
 *
 * `overdue` and `printerOffline` repeat every 30 seconds for as long as their
 * condition holds. That is why being able to mute them matters more than the
 * arrival chime: a stuck printer nobody can silence turns into a kitchen that
 * unplugs the screen.
 */
export const KITCHEN_ALERTS: readonly KitchenAlert[] = [
  {
    key: "newTicket",
    label: "Nouveau ticket",
    description: "Une commande arrive en cuisine. Un bip, une fois.",
    frequency: 800,
    duration: 200,
    repeats: false,
  },
  {
    key: "overdue",
    label: "Ticket en retard",
    description:
      "Au moins un ticket a dépassé son temps de préparation. Répété toutes les 30 secondes tant que c'est le cas.",
    frequency: 400,
    duration: 300,
    repeats: true,
  },
  {
    key: "printerOffline",
    label: "Impression bloquée",
    description:
      "Au moins un ticket n'a pas pu être imprimé. Répété toutes les 30 secondes tant que c'est le cas.",
    frequency: 600,
    duration: 500,
    repeats: true,
  },
]

/**
 * What the display plays for an establishment that has never been configured.
 *
 * Everything on, because a kitchen that hears nothing misses orders — the
 * failure of a silent default is worse than the failure of a loud one.
 */
export const DEFAULT_SOUND_CONFIG: KitchenSoundConfig = {
  newTicket: { enabled: true, volume: 80 },
  overdue: { enabled: true, volume: 100 },
  printerOffline: { enabled: true, volume: 100 },
}

/**
 * Fill in what a stored config does not carry.
 *
 * A row written before an alert existed, or a hand-edited one, must not leave
 * the display reading `undefined.enabled`.
 */
export function resolveSoundConfig(
  stored: Partial<Record<KitchenAlertKey, Partial<KitchenAlertSetting>>> | null | undefined
): KitchenSoundConfig {
  const resolved = {} as KitchenSoundConfig
  for (const { key } of KITCHEN_ALERTS) {
    const fallback = DEFAULT_SOUND_CONFIG[key]
    resolved[key] = {
      enabled: stored?.[key]?.enabled ?? fallback.enabled,
      volume: stored?.[key]?.volume ?? fallback.volume,
    }
  }
  return resolved
}

/** A percentage, clamped and rounded to something the schema will accept. */
export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0
  return Math.round(Math.max(0, Math.min(100, volume)))
}

/**
 * Play one alert, at one volume.
 *
 * The editor's preview. Choosing a volume for a screen in a noisy kitchen
 * without hearing it is guesswork, and the display already knows how to make
 * the sound — this is the same beep, from the same numbers.
 *
 * Browsers refuse to start an `AudioContext` outside a user gesture, so this is
 * only ever called from a click. It returns quietly rather than throwing when
 * audio is unavailable: a preview that cannot play is not a reason to fail a
 * settings page.
 */
export function playAlertBeep(alert: KitchenAlert, volume: number): void {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioCtor) return

    const ctx = new AudioCtor()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(alert.frequency, ctx.currentTime)
    gain.gain.setValueAtTime(clampVolume(volume) / 100, ctx.currentTime)

    oscillator.start()
    oscillator.stop(ctx.currentTime + alert.duration / 1000)
    oscillator.onended = () => void ctx.close()
  } catch {
    // No audio on this device, or the gesture was not recognised.
  }
}
