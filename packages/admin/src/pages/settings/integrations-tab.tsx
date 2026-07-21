"use client"

import type { Dispatch, SetStateAction } from "react"
import { Loader2 } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@be-in-digital/ui"
import { FieldInfo } from "./field-info"
import { HELP } from "./help-content"

interface IntegrationsTabProps {
  uberDirectEnabled: boolean
  setUberDirectEnabled: Dispatch<SetStateAction<boolean>>
  uberDirectCustomerId: string
  setUberDirectCustomerId: Dispatch<SetStateAction<string>>
  uberDirectClientId: string
  setUberDirectClientId: Dispatch<SetStateAction<string>>
  uberDirectClientSecret: string
  setUberDirectClientSecret: Dispatch<SetStateAction<string>>
  uberEatsEnabled: boolean
  setUberEatsEnabled: Dispatch<SetStateAction<boolean>>
  uberEatsPriceMarkup: string
  setUberEatsPriceMarkup: Dispatch<SetStateAction<string>>
  deliverooEnabled: boolean
  setDeliverooEnabled: Dispatch<SetStateAction<boolean>>
  deliverooPriceMarkup: string
  setDeliverooPriceMarkup: Dispatch<SetStateAction<string>>
  handleSaveIntegrations: () => Promise<void>
  isValidatingIntegrations: boolean
}

export function IntegrationsTab({
  uberDirectEnabled,
  setUberDirectEnabled,
  uberDirectCustomerId,
  setUberDirectCustomerId,
  uberDirectClientId,
  setUberDirectClientId,
  uberDirectClientSecret,
  setUberDirectClientSecret,
  uberEatsEnabled,
  setUberEatsEnabled,
  uberEatsPriceMarkup,
  setUberEatsPriceMarkup,
  deliverooEnabled,
  setDeliverooEnabled,
  deliverooPriceMarkup,
  setDeliverooPriceMarkup,
  handleSaveIntegrations,
  isValidatingIntegrations,
}: IntegrationsTabProps) {
  return (
    <div className="grid gap-4">
      {/* Uber Direct */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Uber Direct</CardTitle>
              <FieldInfo
                title="Uber Direct"
                description="Service de livraison on-demand qui utilise le réseau de coursiers Uber pour livrer vos commandes."
                steps={[
                  { text: "Créez un compte Uber Direct sur le dashboard Uber." },
                  { text: "Obtenez votre Customer ID, Client ID et Client Secret (voir l'aide de chaque champ)." },
                  { text: "Entrez ces identifiants dans les champs ci-dessous." },
                  { text: "Activez l'intégration pour commencer à utiliser Uber Direct." },
                ]}
                links={[
                  { label: "Uber Direct Dashboard", url: "https://dashboard.uber.com/" },
                  { label: "Guide de démarrage Uber Direct", url: "https://developer.uber.com/docs/deliveries/overview" },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${uberDirectEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                {uberDirectEnabled ? "Activé" : "Désactivé"}
              </span>
              <Switch
                checked={uberDirectEnabled}
                onCheckedChange={setUberDirectEnabled}
              />
            </div>
          </div>
          <CardDescription className="text-xs">
            Service de livraison on-demand d'Uber
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="uberDirectCustomerId" className="text-xs">
                Customer ID (Uber Store ID)
              </Label>
              <FieldInfo {...HELP.uberDirect.customerId} />
            </div>
            <Input
              id="uberDirectCustomerId"
              type="text"
              value={uberDirectCustomerId}
              onChange={(e) => setUberDirectCustomerId(e.target.value)}
              placeholder="Entrez votre Customer ID"
              disabled={!uberDirectEnabled}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="uberDirectClientId" className="text-xs">
                Client ID (OAuth)
              </Label>
              <FieldInfo {...HELP.uberDirect.clientId} />
            </div>
            <Input
              id="uberDirectClientId"
              type="text"
              value={uberDirectClientId}
              onChange={(e) => setUberDirectClientId(e.target.value)}
              placeholder="Entrez votre Client ID"
              disabled={!uberDirectEnabled}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="uberDirectClientSecret" className="text-xs">
                Client Secret (OAuth)
              </Label>
              <FieldInfo {...HELP.uberDirect.clientSecret} />
            </div>
            <Input
              id="uberDirectClientSecret"
              type="password"
              value={uberDirectClientSecret}
              onChange={(e) => setUberDirectClientSecret(e.target.value)}
              placeholder="Entrez votre Client Secret"
              disabled={!uberDirectEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Uber Eats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Uber Eats</CardTitle>
              <FieldInfo {...HELP.uberEats.general} />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${uberEatsEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                {uberEatsEnabled ? "Activé" : "Désactivé"}
              </span>
              <Switch
                checked={uberEatsEnabled}
                onCheckedChange={setUberEatsEnabled}
              />
            </div>
          </div>
          <CardDescription className="text-xs">
            Synchronisez votre menu et recevez des commandes depuis Uber Eats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="uberEatsPriceMarkup" className="text-xs">
              Majoration prix (%)
            </Label>
            <Input
              id="uberEatsPriceMarkup"
              type="number"
              min="0"
              max="100"
              step="1"
              value={uberEatsPriceMarkup}
              onChange={(e) => setUberEatsPriceMarkup(e.target.value)}
              placeholder="0"
              disabled={!uberEatsEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Les prix envoyés à Uber Eats seront majorés de ce pourcentage (ex: 30 = +30%)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Deliveroo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Deliveroo</CardTitle>
              <FieldInfo {...HELP.deliveroo.general} />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${deliverooEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                {deliverooEnabled ? "Activé" : "Désactivé"}
              </span>
              <Switch
                checked={deliverooEnabled}
                onCheckedChange={setDeliverooEnabled}
              />
            </div>
          </div>
          <CardDescription className="text-xs">
            Synchronisez votre menu et recevez des commandes depuis Deliveroo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="deliverooPriceMarkup" className="text-xs">
              Majoration prix (%)
            </Label>
            <Input
              id="deliverooPriceMarkup"
              type="number"
              min="0"
              max="100"
              step="1"
              value={deliverooPriceMarkup}
              onChange={(e) => setDeliverooPriceMarkup(e.target.value)}
              placeholder="0"
              disabled={!deliverooEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Les prix envoyés à Deliveroo seront majorés de ce pourcentage (ex: 30 = +30%)
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSaveIntegrations} size="sm" disabled={isValidatingIntegrations}>
        {isValidatingIntegrations ? (
          <>
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            Vérification Uber Direct...
          </>
        ) : (
          "Enregistrer les intégrations"
        )}
      </Button>
    </div>
  )
}
