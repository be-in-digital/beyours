"use client"

import { Button, ButtonGroup, Badge } from "@be-in-digital/ui"

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
          {selectedStation === null && (
            <Badge variant="secondary" className="ml-2">
              Actif
            </Badge>
          )}
        </Button>

        {stations.map((station) => (
          <Button
            key={station}
            variant={selectedStation === station ? "default" : "outline"}
            size="sm"
            onClick={() => onStationChange(station)}
          >
            {station}
            {selectedStation === station && (
              <Badge variant="secondary" className="ml-2">
                Actif
              </Badge>
            )}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  )
}
