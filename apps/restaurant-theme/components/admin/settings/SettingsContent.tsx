"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { toast } from "sonner"
import { useState } from "react"
import { SettingsIcon, BellIcon, PlugIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { LoadingState } from "@/components/admin/LoadingState"
import { EmptyState } from "@/components/admin/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const integrations = [
  {
    id: "uber-eats",
    name: "Uber Eats",
    description: "Sync menu and receive orders from Uber Eats",
    icon: "🚗",
  },
  {
    id: "deliveroo",
    name: "Deliveroo",
    description: "Sync menu and receive orders from Deliveroo",
    icon: "🛵",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept card payments with Stripe",
    icon: "💳",
  },
  {
    id: "sumup",
    name: "SumUp",
    description: "Accept payments with SumUp",
    icon: "📱",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Accept PayPal payments",
    icon: "🅿️",
  },
  {
    id: "square",
    name: "Square",
    description: "Accept payments with Square",
    icon: "⬛",
  },
]

export function SettingsContent() {
  const storeId = useAdminStoreId()
  const store = useQuery(
    api.stores.getById,
    storeId ? { id: storeId } : "skip"
  )
  const updateStore = useMutation(api.stores.update)

  // General tab state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  // Notifications state
  const [orderReceivedNotif, setOrderReceivedNotif] = useState(true)
  const [orderCompletedNotif, setOrderCompletedNotif] = useState(true)
  const [lowStockNotif, setLowStockNotif] = useState(true)

  // Integrations state (placeholder)
  const [integrationsEnabled, setIntegrationsEnabled] = useState<Record<string, boolean>>({})
  const [integrationKeys, setIntegrationKeys] = useState<Record<string, string>>({})

  // Initialize state when store loads
  if (store && name === "") {
    setName(store.name)
    setPhone(store.phone || "")
    setEmail(store.email || "")
  }

  const handleUpdateGeneral = async () => {
    if (!storeId) return
    try {
      await updateStore({
        id: storeId,
        name,
        phone: phone || undefined,
        email: email || undefined,
      })
      toast.success("Settings updated successfully")
    } catch (error) {
      toast.error("Failed to update settings")
      console.error(error)
    }
  }

  const handleSaveNotifications = () => {
    // Placeholder - no backend connection yet
    toast.success("Notification preferences saved")
  }

  const handleToggleIntegration = (integrationId: string) => {
    setIntegrationsEnabled((prev) => ({
      ...prev,
      [integrationId]: !prev[integrationId],
    }))
    toast.success("Integration settings updated")
  }

  const handleUpdateIntegrationKey = (integrationId: string, key: string) => {
    setIntegrationKeys((prev) => ({
      ...prev,
      [integrationId]: key,
    }))
  }

  if (!storeId) {
    return (
      <EmptyState
        icon={SettingsIcon}
        title="No store selected"
        description="Please select a store to manage settings"
      />
    )
  }

  if (store === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage store settings and integrations
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name</Label>
              <Input
                id="storeName"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleUpdateGeneral}>Save Changes</Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="orderReceived">Order Received</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when a new order is received
                </p>
              </div>
              <Switch
                id="orderReceived"
                checked={orderReceivedNotif}
                onCheckedChange={setOrderReceivedNotif}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="orderCompleted">Order Completed</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when an order is completed
                </p>
              </div>
              <Switch
                id="orderCompleted"
                checked={orderCompletedNotif}
                onCheckedChange={setOrderCompletedNotif}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="lowStock">Low Stock Alert</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when products are running low
                </p>
              </div>
              <Switch
                id="lowStock"
                checked={lowStockNotif}
                onCheckedChange={setLowStockNotif}
              />
            </div>
            <Button onClick={handleSaveNotifications}>Save Preferences</Button>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {integrations.map((integration) => (
              <Card key={integration.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{integration.icon}</span>
                      <CardTitle>{integration.name}</CardTitle>
                    </div>
                    <Switch
                      checked={integrationsEnabled[integration.id] || false}
                      onCheckedChange={() => handleToggleIntegration(integration.id)}
                    />
                  </div>
                  <CardDescription>{integration.description}</CardDescription>
                </CardHeader>
                {integrationsEnabled[integration.id] && (
                  <CardContent className="space-y-2">
                    <Label htmlFor={`${integration.id}-key`}>API Key</Label>
                    <Input
                      id={`${integration.id}-key`}
                      type="password"
                      placeholder="Enter API key"
                      value={integrationKeys[integration.id] || ""}
                      onChange={(e) =>
                        handleUpdateIntegrationKey(integration.id, e.target.value)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Note: Integration backend not yet connected
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
