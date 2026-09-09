"use client"

import type { Dispatch, SetStateAction } from "react"
import { RefreshCw, Loader2, HelpCircle, ExternalLink, Download, MoreHorizontal, Trash2 } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@be-in-digital/ui"
import type { StoreIntegration } from "./store-detail-types"

interface StoreUberEatsCardProps {
  storeIntegrations: StoreIntegration[] | undefined
  hasUberEatsGlobal: boolean | undefined
  uberEatsStoreId: string
  setUberEatsStoreId: Dispatch<SetStateAction<string>>
  uberEatsSyncMenu: boolean
  setUberEatsSyncMenu: Dispatch<SetStateAction<boolean>>
  uberEatsAutoAccept: boolean
  setUberEatsAutoAccept: Dispatch<SetStateAction<boolean>>
  uberEatsEnabled: boolean
  setUberEatsEnabled: Dispatch<SetStateAction<boolean>>
  uberEatsStoreStatus: "ONLINE" | "PAUSED" | "OFFLINE"
  setUberEatsStoreStatus: Dispatch<SetStateAction<"ONLINE" | "PAUSED" | "OFFLINE">>
  uberEatsPrepTime: string
  uberEatsPublicUrl: string
  setUberEatsPublicUrl: Dispatch<SetStateAction<string>>
  setUberEatsPrepTime: Dispatch<SetStateAction<string>>
  isSyncingUberEats: boolean
  isImportingUberEats: boolean
  isValidatingUberEats: boolean
  setRemovingPlatform: Dispatch<SetStateAction<"uberEats" | "deliveroo" | null>>
  handleSyncUberEatsMenu: () => Promise<void>
  handleImportUberEats: () => Promise<void>
  handleSaveUberEats: () => Promise<void>
}

export function StoreUberEatsCard({
  storeIntegrations,
  hasUberEatsGlobal,
  uberEatsStoreId,
  setUberEatsStoreId,
  uberEatsSyncMenu,
  setUberEatsSyncMenu,
  uberEatsAutoAccept,
  setUberEatsAutoAccept,
  uberEatsEnabled,
  setUberEatsEnabled,
  uberEatsStoreStatus,
  setUberEatsStoreStatus,
  uberEatsPrepTime,
  uberEatsPublicUrl,
  setUberEatsPublicUrl,
  setUberEatsPrepTime,
  isSyncingUberEats,
  isImportingUberEats,
  isValidatingUberEats,
  setRemovingPlatform,
  handleSyncUberEatsMenu,
  handleImportUberEats,
  handleSaveUberEats,
}: StoreUberEatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Uber Eats</CardTitle>
            <CardDescription>Configuration de l&apos;intégration Uber Eats pour cet établissement</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const ueIntegration = storeIntegrations?.find((i: StoreIntegration) => i.platform === "uberEats")
              if (!ueIntegration?.menuSyncStatus || ueIntegration.menuSyncStatus === "idle") return null
              const statusColors: Record<string, string> = {
                syncing: "bg-blue-100 text-blue-700",
                success: "bg-green-100 text-green-700",
                error: "bg-red-100 text-red-700",
              }
              const statusLabels: Record<string, string> = {
                syncing: "Synchronisation...",
                success: "Synchronisé",
                error: "Erreur de sync",
              }
              return (
                <Badge className={statusColors[ueIntegration.menuSyncStatus] ?? ""}>
                  {statusLabels[ueIntegration.menuSyncStatus] ?? ueIntegration.menuSyncStatus}
                </Badge>
              )
            })()}
            {storeIntegrations?.some((i: StoreIntegration) => i.platform === "uberEats") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {(isSyncingUberEats || isImportingUberEats) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {uberEatsEnabled && uberEatsSyncMenu && (
                    <DropdownMenuItem
                      onClick={handleSyncUberEatsMenu}
                      disabled={isSyncingUberEats}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Synchroniser le menu
                    </DropdownMenuItem>
                  )}
                  {uberEatsEnabled && (
                    <DropdownMenuItem
                      onClick={handleImportUberEats}
                      disabled={isImportingUberEats}
                    >
                      <Download className="h-4 w-4" />
                      Importer les produits
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setRemovingPlatform("uberEats")}
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer l&apos;intégration
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasUberEatsGlobal ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Activez d'abord Uber Eats dans les Paramètres Globaux &gt; Intégrations
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="uberEatsStoreId">ID du restaurant Uber Eats</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Comment trouver votre Store ID Uber Eats"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 text-sm" side="right" align="start">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-base">Comment trouver votre Store ID ?</h4>

                      <div className="space-y-2">
                        <p className="font-medium">Méthode 1 : Via Uber Eats Manager</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>
                            Connectez-vous à{" "}
                            <a
                              href="https://merchants.ubereats.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline font-medium text-foreground inline-flex items-center gap-0.5"
                            >
                              Uber Eats Manager
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>Sélectionnez votre restaurant</li>
                          <li>Regardez l&apos;URL dans la barre d&apos;adresse de votre navigateur</li>
                          <li>Copiez l&apos;identifiant UUID qui apparaît après <code className="bg-muted px-1 py-0.5 rounded text-xs">/home/</code></li>
                        </ol>
                        <div className="bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                          merchants.ubereats.com/manager/home/<span className="text-primary-ink font-bold">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="font-medium">Méthode 2 : Via le support Uber Eats</p>
                        <p className="text-muted-foreground">
                          Contactez le support Uber Eats et demandez le <strong>Store ID (UUID)</strong> associé à votre restaurant.
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                        <p className="text-blue-800 text-xs">
                          <strong>Format attendu :</strong> un identifiant de type UUID, par exemple{" "}
                          <code className="bg-blue-100 px-1 rounded">a1b2c3d4-e5f6-7890-abcd-ef1234567890</code>
                        </p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Input
                id="uberEatsStoreId"
                value={uberEatsStoreId}
                onChange={(e) => setUberEatsStoreId(e.target.value)}
                placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="uberEatsStoreStatus">Statut sur la plateforme</Label>
                <Select value={uberEatsStoreStatus} onValueChange={(v) => setUberEatsStoreStatus(v as "ONLINE" | "PAUSED" | "OFFLINE")}>
                  <SelectTrigger id="uberEatsStoreStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONLINE">En ligne</SelectItem>
                    <SelectItem value="PAUSED">En pause</SelectItem>
                    <SelectItem value="OFFLINE">Hors ligne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="uberEatsPrepTime">Temps de préparation (min)</Label>
                <Input
                  id="uberEatsPrepTime"
                  type="number"
                  min="1"
                  max="120"
                  value={uberEatsPrepTime}
                  onChange={(e) => setUberEatsPrepTime(e.target.value)}
                  placeholder="15"
                />
              </div>
            </div>

            {/* The link the storefront's « Commandez aussi sur vos apps »
                tile points at. It has to be typed because there is nothing to
                derive it from — `platformStoreId` is an API identifier, not a
                public URL — and the tile was hard-coded to Uber Eats's HOME
                page in its absence, on every menu page, listed or not. No
                URL, no tile. */}
            <div className="space-y-2">
              <Label htmlFor="uberEatsPublicUrl">Lien public Uber Eats</Label>
              <Input
                id="uberEatsPublicUrl"
                type="url"
                value={uberEatsPublicUrl}
                onChange={(e) => setUberEatsPublicUrl(e.target.value)}
                placeholder="https://www.ubereats.com/fr/store/mon-restaurant/abc123"
              />
              <p className="text-muted-foreground text-xs">
                L&apos;adresse de VOTRE page sur Uber Eats. Elle s&apos;affiche
                sur votre site ; sans elle, aucun bouton Uber Eats n&apos;est
                montré à vos clients.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="uberEatsSyncMenu">Synchroniser le menu</Label>
              <Switch
                id="uberEatsSyncMenu"
                checked={uberEatsSyncMenu}
                onCheckedChange={setUberEatsSyncMenu}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="uberEatsAutoAccept">Acceptation automatique des commandes</Label>
              <Switch
                id="uberEatsAutoAccept"
                checked={uberEatsAutoAccept}
                onCheckedChange={setUberEatsAutoAccept}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="uberEatsEnabled">Intégration activée</Label>
              <Switch
                id="uberEatsEnabled"
                checked={uberEatsEnabled}
                onCheckedChange={setUberEatsEnabled}
              />
            </div>

            <Button onClick={handleSaveUberEats} size="sm" disabled={isValidatingUberEats}>
              {isValidatingUberEats ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verification...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
