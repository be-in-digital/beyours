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
} from "@be-yours/ui"
import type { StoreIntegration } from "./store-detail-types"

interface StoreDeliverooCardProps {
  storeIntegrations: StoreIntegration[] | undefined
  hasDeliverooGlobal: boolean | undefined
  deliverooStoreId: string
  setDeliverooStoreId: Dispatch<SetStateAction<string>>
  deliverooBrandId: string
  setDeliverooBrandId: Dispatch<SetStateAction<string>>
  deliverooSyncMenu: boolean
  setDeliverooSyncMenu: Dispatch<SetStateAction<boolean>>
  deliverooAutoAccept: boolean
  setDeliverooAutoAccept: Dispatch<SetStateAction<boolean>>
  deliverooEnabled: boolean
  setDeliverooEnabled: Dispatch<SetStateAction<boolean>>
  deliverooStoreStatus: "ONLINE" | "PAUSED" | "OFFLINE"
  setDeliverooStoreStatus: Dispatch<SetStateAction<"ONLINE" | "PAUSED" | "OFFLINE">>
  deliverooPrepTime: string
  deliverooPublicUrl: string
  setDeliverooPublicUrl: Dispatch<SetStateAction<string>>
  setDeliverooPrepTime: Dispatch<SetStateAction<string>>
  isSyncingDeliveroo: boolean
  isImportingDeliveroo: boolean
  isValidatingDeliveroo: boolean
  setRemovingPlatform: Dispatch<SetStateAction<"uberEats" | "deliveroo" | null>>
  handleSyncDeliverooMenu: () => Promise<void>
  handleImportDeliveroo: () => Promise<void>
  handleSaveDeliveroo: () => Promise<void>
}

export function StoreDeliverooCard({
  storeIntegrations,
  hasDeliverooGlobal,
  deliverooStoreId,
  setDeliverooStoreId,
  deliverooBrandId,
  setDeliverooBrandId,
  deliverooSyncMenu,
  setDeliverooSyncMenu,
  deliverooAutoAccept,
  setDeliverooAutoAccept,
  deliverooEnabled,
  setDeliverooEnabled,
  deliverooStoreStatus,
  setDeliverooStoreStatus,
  deliverooPrepTime,
  deliverooPublicUrl,
  setDeliverooPublicUrl,
  setDeliverooPrepTime,
  isSyncingDeliveroo,
  isImportingDeliveroo,
  isValidatingDeliveroo,
  setRemovingPlatform,
  handleSyncDeliverooMenu,
  handleImportDeliveroo,
  handleSaveDeliveroo,
}: StoreDeliverooCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Deliveroo</CardTitle>
            <CardDescription>Configuration de l&apos;intégration Deliveroo pour cet établissement</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const dlIntegration = storeIntegrations?.find((i: StoreIntegration) => i.platform === "deliveroo")
              if (!dlIntegration?.menuSyncStatus || dlIntegration.menuSyncStatus === "idle") return null
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
                <Badge className={statusColors[dlIntegration.menuSyncStatus] ?? ""}>
                  {statusLabels[dlIntegration.menuSyncStatus] ?? dlIntegration.menuSyncStatus}
                </Badge>
              )
            })()}
            {storeIntegrations?.some((i: StoreIntegration) => i.platform === "deliveroo") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {(isSyncingDeliveroo || isImportingDeliveroo) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {deliverooEnabled && deliverooSyncMenu && (
                    <DropdownMenuItem
                      onClick={handleSyncDeliverooMenu}
                      disabled={isSyncingDeliveroo}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Synchroniser le menu
                    </DropdownMenuItem>
                  )}
                  {deliverooEnabled && (
                    <DropdownMenuItem
                      onClick={handleImportDeliveroo}
                      disabled={isImportingDeliveroo}
                    >
                      <Download className="h-4 w-4" />
                      Importer les produits
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setRemovingPlatform("deliveroo")}
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
        {!hasDeliverooGlobal ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Activez d'abord Deliveroo dans les Paramètres Globaux &gt; Intégrations
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deliverooStoreId">ID du restaurant Deliveroo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Comment trouver votre Store ID Deliveroo"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 text-sm" side="right" align="start">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-base">Comment trouver votre Store ID ?</h4>

                      <div className="space-y-2">
                        <p className="font-medium">Méthode 1 : Via le Restaurant Hub</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>
                            Connectez-vous à{" "}
                            <a
                              href="https://restaurant-hub.deliveroo.net"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline font-medium text-foreground inline-flex items-center gap-0.5"
                            >
                              Deliveroo Restaurant Hub
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>Accédez à <strong>Paramètres</strong> &gt; <strong>Informations du restaurant</strong></li>
                          <li>L&apos;identifiant est affiché dans la section informations ou visible dans l&apos;URL</li>
                        </ol>
                        <div className="bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                          restaurant-hub.deliveroo.net/restaurants/<span className="text-primary-ink font-bold">123456</span>/...
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="font-medium">Méthode 2 : Via votre tablette Deliveroo</p>
                        <p className="text-muted-foreground">
                          Sur la tablette fournie par Deliveroo, accédez aux <strong>Paramètres</strong>. L&apos;identifiant du restaurant est affiché dans les informations du compte.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="font-medium">Méthode 3 : Via le support Deliveroo</p>
                        <p className="text-muted-foreground">
                          Contactez le support Deliveroo et demandez le <strong>Restaurant ID</strong> associé à votre établissement.
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                        <p className="text-blue-800 text-xs">
                          <strong>Format attendu :</strong> un identifiant numérique, par exemple{" "}
                          <code className="bg-blue-100 px-1 rounded">123456</code>
                        </p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Input
                id="deliverooStoreId"
                value={deliverooStoreId}
                onChange={(e) => setDeliverooStoreId(e.target.value)}
                placeholder="123456"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliverooBrandId">Brand ID Deliveroo</Label>
              <Input
                id="deliverooBrandId"
                value={deliverooBrandId}
                onChange={(e) => setDeliverooBrandId(e.target.value)}
                placeholder="brand-uuid-xxxx"
              />
              <p className="text-xs text-muted-foreground">
                Identifiant de marque fourni par Deliveroo, requis pour l'import des produits
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliverooStoreStatus">Statut sur la plateforme</Label>
                <Select value={deliverooStoreStatus} onValueChange={(v) => setDeliverooStoreStatus(v as "ONLINE" | "PAUSED" | "OFFLINE")}>
                  <SelectTrigger id="deliverooStoreStatus">
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
                <Label htmlFor="deliverooPrepTime">Temps de préparation (min)</Label>
                <Input
                  id="deliverooPrepTime"
                  type="number"
                  min="1"
                  max="120"
                  value={deliverooPrepTime}
                  onChange={(e) => setDeliverooPrepTime(e.target.value)}
                  placeholder="15"
                />
              </div>
            </div>

            {/* The link the storefront's « Commandez aussi sur vos apps »
                tile points at. It has to be typed because there is nothing to
                derive it from — `platformStoreId` is an API identifier, not a
                public URL — and the tile was hard-coded to Deliveroo's HOME
                page in its absence, on every menu page, listed or not. No
                URL, no tile. */}
            <div className="space-y-2">
              <Label htmlFor="deliverooPublicUrl">Lien public Deliveroo</Label>
              <Input
                id="deliverooPublicUrl"
                type="url"
                value={deliverooPublicUrl}
                onChange={(e) => setDeliverooPublicUrl(e.target.value)}
                placeholder="https://deliveroo.fr/fr/menu/paris/quartier/mon-restaurant"
              />
              <p className="text-muted-foreground text-xs">
                L&apos;adresse de VOTRE page sur Deliveroo. Elle s&apos;affiche
                sur votre site ; sans elle, aucun bouton Deliveroo n&apos;est
                montré à vos clients.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="deliverooSyncMenu">Synchroniser le menu</Label>
              <Switch
                id="deliverooSyncMenu"
                checked={deliverooSyncMenu}
                onCheckedChange={setDeliverooSyncMenu}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="deliverooAutoAccept">Acceptation automatique des commandes</Label>
              <Switch
                id="deliverooAutoAccept"
                checked={deliverooAutoAccept}
                onCheckedChange={setDeliverooAutoAccept}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="deliverooEnabled">Intégration activée</Label>
              <Switch
                id="deliverooEnabled"
                checked={deliverooEnabled}
                onCheckedChange={setDeliverooEnabled}
              />
            </div>

            <Button onClick={handleSaveDeliveroo} size="sm" disabled={isValidatingDeliveroo}>
              {isValidatingDeliveroo ? (
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
