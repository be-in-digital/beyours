"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { toast } from "sonner"
import { useState } from "react"
import { GamepadIcon, PlusIcon, QrCodeIcon, GiftIcon, TrashIcon } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { LoadingState } from "@/components/admin/LoadingState"
import { EmptyState } from "@/components/admin/EmptyState"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Game {
  _id: Id<"games">
  name: string
  type: "wheel" | "scratch_card"
  description?: string
  winRatio: number
  isActive: boolean
}

interface QRCode {
  _id: Id<"gameQRCodes">
  code: string
  tableNumber?: string
  location?: string
  isActive: boolean
}

interface Prize {
  _id: Id<"prizes">
  name: string
  description?: string
  type: string
  value?: number
  validityDays: number
  totalAvailable?: number
  isActive: boolean
}

export function GamesContent() {
  const storeId = useAdminStoreId()
  const [isAddGameOpen, setIsAddGameOpen] = useState(false)
  const [isAddQROpen, setIsAddQROpen] = useState(false)
  const [isAddPrizeOpen, setIsAddPrizeOpen] = useState(false)

  // Game form state
  const [gameName, setGameName] = useState("")
  const [gameType, setGameType] = useState<"wheel" | "scratch_card">("wheel")
  const [gameDescription, setGameDescription] = useState("")
  const [winRatio, setWinRatio] = useState(30)

  // QR Code form state
  const [qrCode, setQrCode] = useState("")
  const [tableNumber, setTableNumber] = useState("")
  const [location, setLocation] = useState("")

  // Prize form state
  const [prizeName, setPrizeName] = useState("")
  const [prizeDescription, setPrizeDescription] = useState("")
  const [prizeType, setPrizeType] = useState<"discount_percentage" | "discount_fixed" | "free_product" | "free_menu" | "custom">("discount_percentage")
  const [prizeValue, setPrizeValue] = useState("")
  const [validityDays, setValidityDays] = useState("7")
  const [totalAvailable, setTotalAvailable] = useState("")

  const games = useQuery(api.games.list, storeId ? { storeId } : "skip") as Game[] | undefined
  const qrCodes = useQuery(api.gameQRCodes.list, storeId ? { storeId } : "skip") as QRCode[] | undefined
  const prizes = useQuery(api.prizes.list, storeId ? { storeId } : "skip") as Prize[] | undefined

  const createGame = useMutation(api.games.create)
  const updateWinRatio = useMutation(api.games.updateWinRatio)
  const removeGame = useMutation(api.games.remove)

  const createQRCode = useMutation(api.gameQRCodes.create)
  const removeQRCode = useMutation(api.gameQRCodes.remove)

  const createPrize = useMutation(api.prizes.create)
  const removePrize = useMutation(api.prizes.remove)

  const generateQRCode = () => {
    // Generate random code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    setQrCode(code)
  }

  const handleAddGame = async () => {
    if (!storeId || !gameName) {
      toast.error("Please fill all required fields")
      return
    }

    try {
      await createGame({
        storeId,
        type: gameType,
        name: gameName,
        description: gameDescription || undefined,
        winRatio,
        isActive: true,
      })
      toast.success("Game created successfully")
      setIsAddGameOpen(false)
      setGameName("")
      setGameDescription("")
      setWinRatio(30)
    } catch (error) {
      toast.error("Failed to create game")
      console.error(error)
    }
  }

  const handleUpdateWinRatio = async (gameId: Id<"games">, newRatio: number) => {
    try {
      await updateWinRatio({ id: gameId, winRatio: newRatio })
      toast.success("Win ratio updated")
    } catch (error) {
      toast.error("Failed to update win ratio")
      console.error(error)
    }
  }

  const handleAddQRCode = async () => {
    if (!storeId || !qrCode) {
      toast.error("Please generate a QR code")
      return
    }

    try {
      await createQRCode({
        storeId,
        code: qrCode,
        tableNumber: tableNumber || undefined,
        location: location || undefined,
        isActive: true,
      })
      toast.success("QR Code created successfully")
      setIsAddQROpen(false)
      setQrCode("")
      setTableNumber("")
      setLocation("")
    } catch (error) {
      toast.error("Failed to create QR code")
      console.error(error)
    }
  }

  const handleAddPrize = async () => {
    if (!storeId || !prizeName) {
      toast.error("Please fill all required fields")
      return
    }

    try {
      await createPrize({
        storeId,
        name: prizeName,
        description: prizeDescription || undefined,
        type: prizeType,
        value: prizeValue ? parseInt(prizeValue) : undefined,
        validityDays: parseInt(validityDays),
        totalAvailable: totalAvailable ? parseInt(totalAvailable) : undefined,
        isActive: true,
      })
      toast.success("Prize created successfully")
      setIsAddPrizeOpen(false)
      setPrizeName("")
      setPrizeDescription("")
      setPrizeValue("")
      setValidityDays("7")
      setTotalAvailable("")
    } catch (error) {
      toast.error("Failed to create prize")
      console.error(error)
    }
  }

  if (!storeId) {
    return (
      <EmptyState
        icon={GamepadIcon}
        title="No store selected"
        description="Please select a store to manage games"
      />
    )
  }

  if (games === undefined || qrCodes === undefined || prizes === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Games & Gamification</h1>
        <p className="text-muted-foreground mt-2">
          Engage customers with interactive games
        </p>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Games Config</TabsTrigger>
          <TabsTrigger value="qrcodes">QR Codes</TabsTrigger>
          <TabsTrigger value="prizes">Prizes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isAddGameOpen} onOpenChange={setIsAddGameOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Create Game
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Game</DialogTitle>
                  <DialogDescription>
                    Set up a new game for your customers
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gameName">Game Name *</Label>
                    <Input
                      id="gameName"
                      placeholder="Spin & Win"
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gameType">Game Type *</Label>
                    <Select value={gameType} onValueChange={(v) => setGameType(v as "wheel" | "scratch_card")}>
                      <SelectTrigger id="gameType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wheel">Wheel of Fortune</SelectItem>
                        <SelectItem value="scratch_card">Scratch Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gameDescription">Description</Label>
                    <Input
                      id="gameDescription"
                      placeholder="Optional description"
                      value={gameDescription}
                      onChange={(e) => setGameDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="winRatio">Win Ratio: {winRatio}%</Label>
                    <Slider
                      id="winRatio"
                      min={0}
                      max={100}
                      step={5}
                      value={[winRatio]}
                      onValueChange={(v) => setWinRatio(v[0] ?? 30)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage of plays that result in a win
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddGameOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddGame}>Create Game</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {games.length === 0 ? (
            <EmptyState
              icon={GamepadIcon}
              title="No games"
              description="Create your first game to get started"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {games.map((game) => (
                <div key={game._id} className="border rounded-lg p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{game.name}</h3>
                      <Badge className="mt-2">
                        {game.type === "wheel" ? "Wheel of Fortune" : "Scratch Card"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGame({ id: game._id })}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  {game.description && (
                    <p className="text-sm text-muted-foreground">{game.description}</p>
                  )}
                  <div className="space-y-2">
                    <Label>Win Ratio: {game.winRatio}%</Label>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[game.winRatio]}
                      onValueChange={(v) => handleUpdateWinRatio(game._id, v[0] ?? 0)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="qrcodes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isAddQROpen} onOpenChange={setIsAddQROpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Create QR Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create QR Code</DialogTitle>
                  <DialogDescription>
                    Generate a QR code for table or location
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="qrCode">QR Code *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="qrCode"
                        value={qrCode}
                        onChange={(e) => setQrCode(e.target.value)}
                        placeholder="Auto-generated"
                      />
                      <Button type="button" onClick={generateQRCode}>
                        Generate
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tableNumber">Table Number</Label>
                    <Input
                      id="tableNumber"
                      placeholder="12"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="Main dining area"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddQROpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddQRCode}>Create QR Code</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {qrCodes.length === 0 ? (
            <EmptyState
              icon={QrCodeIcon}
              title="No QR codes"
              description="Create QR codes for your tables"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {qrCodes.map((qr) => (
                <div key={qr._id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <QrCodeIcon className="h-8 w-8" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQRCode({ id: qr._id })}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="font-mono text-sm font-semibold">{qr.code}</p>
                  {qr.tableNumber && (
                    <p className="text-sm text-muted-foreground">
                      Table {qr.tableNumber}
                    </p>
                  )}
                  {qr.location && (
                    <p className="text-xs text-muted-foreground">{qr.location}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prizes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isAddPrizeOpen} onOpenChange={setIsAddPrizeOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Create Prize
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Prize</DialogTitle>
                  <DialogDescription>
                    Add a new prize that customers can win
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prizeName">Prize Name *</Label>
                    <Input
                      id="prizeName"
                      placeholder="10% off"
                      value={prizeName}
                      onChange={(e) => setPrizeName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizeType">Type *</Label>
                    <Select value={prizeType} onValueChange={(v: any) => setPrizeType(v)}>
                      <SelectTrigger id="prizeType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discount_percentage">% Discount</SelectItem>
                        <SelectItem value="discount_fixed">Fixed Discount</SelectItem>
                        <SelectItem value="free_product">Free Product</SelectItem>
                        <SelectItem value="free_menu">Free Menu</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizeValue">Value (optional)</Label>
                    <Input
                      id="prizeValue"
                      type="number"
                      placeholder="10"
                      value={prizeValue}
                      onChange={(e) => setPrizeValue(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="validityDays">Validity (days) *</Label>
                      <Input
                        id="validityDays"
                        type="number"
                        value={validityDays}
                        onChange={(e) => setValidityDays(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalAvailable">Available (optional)</Label>
                      <Input
                        id="totalAvailable"
                        type="number"
                        placeholder="Unlimited"
                        value={totalAvailable}
                        onChange={(e) => setTotalAvailable(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizeDescription">Description</Label>
                    <Input
                      id="prizeDescription"
                      placeholder="Optional description"
                      value={prizeDescription}
                      onChange={(e) => setPrizeDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddPrizeOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddPrize}>Create Prize</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {prizes.length === 0 ? (
            <EmptyState
              icon={GiftIcon}
              title="No prizes"
              description="Create prizes that customers can win"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {prizes.map((prize) => (
                <div key={prize._id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <GiftIcon className="h-6 w-6" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePrize({ id: prize._id })}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-semibold">{prize.name}</h3>
                  <Badge>{prize.type.replace("_", " ")}</Badge>
                  {prize.description && (
                    <p className="text-sm text-muted-foreground">{prize.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Valid for {prize.validityDays} days
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <EmptyState
            icon={GamepadIcon}
            title="No game history"
            description="Game play history will appear here"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
