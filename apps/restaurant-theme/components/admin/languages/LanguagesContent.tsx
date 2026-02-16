"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { toast } from "sonner"
import { useState } from "react"
import { PlusIcon, LanguagesIcon, StarIcon, TrashIcon, EditIcon } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { LoadingState } from "@/components/admin/LoadingState"
import { EmptyState } from "@/components/admin/EmptyState"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Language {
  _id: Id<"languages">
  code: string
  name: string
  nativeName: string
  flagEmoji?: string
  isDefault: boolean
  isActive: boolean
  isRtl: boolean
}

export function LanguagesContent() {
  const storeId = useAdminStoreId()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [nativeName, setNativeName] = useState("")
  const [flagEmoji, setFlagEmoji] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [isRtl, setIsRtl] = useState(false)

  const languages = useQuery(
    api.languages.list,
    storeId ? { storeId } : "skip"
  ) as Language[] | undefined

  const createLanguage = useMutation(api.languages.create)
  const toggleActive = useMutation(api.languages.toggleActive)
  const setDefaultLanguage = useMutation(api.languages.setDefault)
  const removeLanguage = useMutation(api.languages.remove)

  const handleAddLanguage = async () => {
    if (!storeId || !code || !name || !nativeName) {
      toast.error("Please fill all required fields")
      return
    }

    try {
      await createLanguage({
        storeId,
        code,
        name,
        nativeName,
        flagEmoji: flagEmoji || undefined,
        isDefault,
        isActive: true,
        isRtl,
      })
      toast.success("Language added successfully")
      setIsAddDialogOpen(false)
      // Reset form
      setCode("")
      setName("")
      setNativeName("")
      setFlagEmoji("")
      setIsDefault(false)
      setIsRtl(false)
    } catch (error) {
      toast.error("Failed to add language")
      console.error(error)
    }
  }

  const handleToggleActive = async (id: Id<"languages">) => {
    try {
      await toggleActive({ id })
      toast.success("Language status updated")
    } catch (error) {
      toast.error("Failed to update status")
      console.error(error)
    }
  }

  const handleSetDefault = async (languageId: Id<"languages">) => {
    if (!storeId) return
    try {
      await setDefaultLanguage({ storeId, languageId })
      toast.success("Default language updated")
    } catch (error) {
      toast.error("Failed to update default language")
      console.error(error)
    }
  }

  const handleRemove = async (id: Id<"languages">, isDefaultLang: boolean) => {
    if (isDefaultLang) {
      toast.error("Cannot delete default language")
      return
    }
    try {
      await removeLanguage({ id })
      toast.success("Language removed successfully")
    } catch (error) {
      toast.error("Failed to remove language")
      console.error(error)
    }
  }

  if (!storeId) {
    return (
      <EmptyState
        icon={LanguagesIcon}
        title="No store selected"
        description="Please select a store to manage languages"
      />
    )
  }

  if (languages === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Languages</h1>
          <p className="text-muted-foreground mt-2">
            Manage available languages for your store
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Language
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Language</DialogTitle>
              <DialogDescription>
                Add a new language to your store
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Language Code *</Label>
                  <Input
                    id="code"
                    placeholder="en, fr, es..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flagEmoji">Flag Emoji</Label>
                  <Input
                    id="flagEmoji"
                    placeholder="🇬🇧"
                    value={flagEmoji}
                    onChange={(e) => setFlagEmoji(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="English"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nativeName">Native Name *</Label>
                <Input
                  id="nativeName"
                  placeholder="English"
                  value={nativeName}
                  onChange={(e) => setNativeName(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isDefault">Set as default</Label>
                <Switch
                  id="isDefault"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isRtl">Right-to-left (RTL)</Label>
                <Switch
                  id="isRtl"
                  checked={isRtl}
                  onCheckedChange={setIsRtl}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddLanguage}>Add Language</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {languages.length === 0 ? (
        <EmptyState
          icon={LanguagesIcon}
          title="No languages"
          description="Add your first language to get started"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Native Name</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>RTL</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.map((language) => (
                <TableRow key={language._id}>
                  <TableCell className="text-2xl">
                    {language.flagEmoji || "🏳️"}
                  </TableCell>
                  <TableCell className="font-mono">{language.code}</TableCell>
                  <TableCell>{language.name}</TableCell>
                  <TableCell>{language.nativeName}</TableCell>
                  <TableCell>
                    {language.isDefault ? (
                      <StarIcon className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(language._id)}
                      >
                        <StarIcon className="h-5 w-5" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={language.isActive}
                      onCheckedChange={() => handleToggleActive(language._id)}
                    />
                  </TableCell>
                  <TableCell>
                    {language.isRtl && <span className="text-xs">RTL</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(language._id, language.isDefault)}
                      disabled={language.isDefault}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
