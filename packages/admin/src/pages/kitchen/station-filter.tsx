"use client"

import { Button } from "@be-in-digital/ui"
import { ButtonGroup } from "@be-in-digital/ui"

/**
 * "Actif", inside the station button.
 *
 * A `<span>` and not a `<Badge>`: this package's `Badge` renders a `<div>`, and
 * a `<div>` inside a `<button>` is invalid — the button content model admits
 * phrasing content only. It looked like a badge before because the app copy of
 * this screen imported an older `Badge` that rendered a `<span>`.
 */
function ActiveMark() {
  return (
    <span className="ml-2 inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      Actif
    </span>
  )
}

interface StationFilterProps {
  stations: string[]
  selectedStation: string | null
  onStationChange: (station: string | null) => void
}

export function StationFilter({
  stations,
  selectedStation,
  onStationChange,
}: StationFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium">Station :</span>

      <ButtonGroup>
        <Button
          variant={selectedStation === null ? "default" : "outline"}
          size="sm"
          onClick={() => onStationChange(null)}
        >
          Toutes les stations
          {selectedStation === null && <ActiveMark />}
        </Button>

        {stations.map((station) => (
          <Button
            key={station}
            variant={selectedStation === station ? "default" : "outline"}
            size="sm"
            onClick={() => onStationChange(station)}
          >
            {station}
            {selectedStation === station && <ActiveMark />}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  )
}
