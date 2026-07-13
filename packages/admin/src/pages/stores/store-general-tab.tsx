"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@be-in-digital/ui"
import { Input } from "@be-in-digital/ui"
import { Label } from "@be-in-digital/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@be-in-digital/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@be-in-digital/ui"
import { AddressAutocomplete, type AddressValue } from "@be-in-digital/ui"

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

type StoreStatus = "draft" | "open" | "closed" | "temporarily_unavailable"

interface StoreGeneralTabProps {
  name: string
  setName: Dispatch<SetStateAction<string>>
  slug: string
  setSlug: Dispatch<SetStateAction<string>>
  description: string
  setDescription: Dispatch<SetStateAction<string>>
  phone: string
  setPhone: Dispatch<SetStateAction<string>>
  email: string
  setEmail: Dispatch<SetStateAction<string>>
  status: StoreStatus
  setStatus: Dispatch<SetStateAction<StoreStatus>>
  address: AddressValue
  setAddress: Dispatch<SetStateAction<AddressValue>>
  handleUpdateGeneral: () => Promise<void>
}

export function StoreGeneralTab({
  name,
  setName,
  slug,
  setSlug,
  description,
  setDescription,
  phone,
  setPhone,
  email,
  setEmail,
  status,
  setStatus,
  address,
  setAddress,
  handleUpdateGeneral,
}: StoreGeneralTabProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'établissement</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="open">Ouvert</SelectItem>
                  <SelectItem value="closed">Fermé</SelectItem>
                  <SelectItem value="temporarily_unavailable">Temporairement indisponible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Adresse</CardTitle>
        </CardHeader>
        <CardContent>
          <AddressAutocomplete
            label="Adresse de l'établissement"
            value={address}
            onChange={setAddress}
            apiKey={GOOGLE_MAPS_API_KEY}
          />
        </CardContent>
      </Card>

      <Button onClick={handleUpdateGeneral} size="sm">
        Enregistrer
      </Button>
    </>
  )
}
