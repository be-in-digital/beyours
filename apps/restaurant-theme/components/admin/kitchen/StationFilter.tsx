"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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
      <span className="text-sm font-medium">Station:</span>

      <Button
        variant={selectedStation === null ? "default" : "outline"}
        size="sm"
        onClick={() => onStationChange(null)}
      >
        All Stations
        {selectedStation === null && (
          <Badge variant="secondary" className="ml-2">
            Active
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
              Active
            </Badge>
          )}
        </Button>
      ))}
    </div>
  )
}
