"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { useState } from "react"
import { PlusIcon, StoreIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/admin/LoadingState"
import { EmptyState } from "@/components/admin/EmptyState"
import { slugify } from "@/lib/admin/formatters"
import Link from "next/link"
import { cn } from "@/lib/utils"

const statusConfig = {
  open: { label: "Open", color: "bg-green-500 text-white" },
  closed: { label: "Closed", color: "bg-red-500 text-white" },
  temporarily_unavailable: { label: "Unavailable", color: "bg-orange-500 text-white" },
}

export function StoresContent() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [street, setStreet] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("France")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  const stores = useQuery(api.stores.list, {})
  const createStore = useMutation(api.stores.create)

  const handleCreateStore = async () => {
    if (!name || !street || !city || !postalCode) {
      toast.error("Please fill all required fields")
      return
    }

    try {
      const slug = slugify(name)
      await createStore({
        name,
        slug,
        description: description || undefined,
        address: {
          street,
          city,
          postalCode,
          country,
        },
        phone: phone || undefined,
        email: email || undefined,
        settings: {
          currency: "EUR",
          timezone: "Europe/Paris",
          deliveryEnabled: true,
          pickupEnabled: true,
          dineInEnabled: true,
          minimumOrderAmount: 1000, // €10.00
          deliveryFee: 300, // €3.00
          deliveryRadius: 5000, // 5km
          taxRate: 10, // 10%
        },
      })
      toast.success("Store created successfully")
      setIsCreateDialogOpen(false)
      // Reset form
      setName("")
      setDescription("")
      setStreet("")
      setCity("")
      setPostalCode("")
      setCountry("France")
      setPhone("")
      setEmail("")
    } catch (error) {
      toast.error("Failed to create store")
      console.error(error)
    }
  }

  if (stores === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stores</h1>
          <p className="text-muted-foreground mt-2">
            Manage your restaurant locations
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Store
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Store</DialogTitle>
              <DialogDescription>
                Add a new restaurant location to your business
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Store Name *</Label>
                  <Input
                    id="name"
                    placeholder="Main Restaurant"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (auto-generated)</Label>
                  <Input
                    id="slug"
                    value={slugify(name)}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Street Address *</Label>
                <Input
                  id="street"
                  placeholder="123 Main Street"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="Paris"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code *</Label>
                  <Input
                    id="postalCode"
                    placeholder="75001"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+33 1 23 45 67 89"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="store@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateStore}>Create Store</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {stores.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title="No stores"
          description="Create your first store to get started"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stores.map((store: any) => (
            <Link
              key={store._id}
              href={`/stores/${store._id}`}
              className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{store.name}</h3>
                  <Badge
                    className={cn(
                      "mt-2",
                      statusConfig[store.status as keyof typeof statusConfig]?.color || "bg-gray-500 text-white"
                    )}
                  >
                    {statusConfig[store.status as keyof typeof statusConfig]?.label || store.status}
                  </Badge>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{store.address.street}</p>
                <p>{store.address.city}, {store.address.postalCode}</p>
                {store.phone && <p>{store.phone}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
