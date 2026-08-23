"use client"

import * as React from "react"
import { MapPin } from "lucide-react"
import { cn } from "../lib/utils"
import { useGooglePlacesAutocomplete } from "../hooks/useGooglePlacesAutocomplete"
import type { AddressValue } from "../types/address"

export type { AddressValue }

export interface AddressAutocompleteProps {
  value: AddressValue
  onChange: (value: AddressValue) => void
  apiKey: string
  countries?: string[]
  placeholder?: string
  disabled?: boolean
  error?: string
  label?: string
}

export function AddressAutocomplete({
  value,
  onChange,
  apiKey,
  countries = ["fr"],
  placeholder = "Rechercher une adresse...",
  disabled = false,
  error,
  label,
}: AddressAutocompleteProps) {
  const { inputRef } = useGooglePlacesAutocomplete({
    apiKey,
    countries,
    onSelect: (parsed) => {
      onChange({
        street: parsed.street ?? value.street,
        city: parsed.city ?? value.city,
        postalCode: parsed.postalCode ?? value.postalCode,
        country: parsed.country ?? value.country,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      })
    },
  })

  const inputClassName = cn(
    "flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    error && "border-destructive focus-visible:ring-destructive"
  )

  const fieldClassName =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

  // Labels have to point at their fields.
  //
  // Every label here was a bare <label> and every input had no id, so nothing
  // tied them together: a screen reader announced five anonymous text boxes,
  // clicking a label did not focus its field, and `getByLabel` could not find
  // them — which is how the e2e suite surfaced it.
  const fieldId = React.useId()

  return (
    <div className="w-full space-y-3">
      {label && (
        <label
          htmlFor={`${fieldId}-search`}
          className="text-sm font-medium leading-none"
        >
          {label}
        </label>
      )}

      {/* Search input with Google Places autocomplete */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          id={`${fieldId}-search`}
          ref={inputRef}
          type="text"
          className={inputClassName}
          placeholder={placeholder}
          disabled={disabled}
          defaultValue={value.street ? `${value.street}, ${value.city}` : ""}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Detail fields - pre-filled and editable */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label
            htmlFor={`${fieldId}-street`}
            className="text-xs font-medium text-muted-foreground"
          >
            Rue
          </label>
          <input
            id={`${fieldId}-street`}
            type="text"
            className={fieldClassName}
            value={value.street}
            onChange={(e) => onChange({ ...value, street: e.target.value })}
            placeholder="123 rue principale"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`${fieldId}-city`}
            className="text-xs font-medium text-muted-foreground"
          >
            Ville
          </label>
          <input
            id={`${fieldId}-city`}
            type="text"
            className={fieldClassName}
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="Paris"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`${fieldId}-postal`}
            className="text-xs font-medium text-muted-foreground"
          >
            Code postal
          </label>
          <input
            id={`${fieldId}-postal`}
            type="text"
            className={fieldClassName}
            value={value.postalCode}
            onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
            placeholder="75001"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label
            htmlFor={`${fieldId}-country`}
            className="text-xs font-medium text-muted-foreground"
          >
            Pays
          </label>
          <input
            id={`${fieldId}-country`}
            type="text"
            className={fieldClassName}
            value={value.country}
            onChange={(e) => onChange({ ...value, country: e.target.value })}
            placeholder="France"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
