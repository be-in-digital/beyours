"use client"

import { useState, useEffect } from "react"
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@beindigital-engine/ui"

type ActionType = "google_review" | "instagram_follow" | "facebook_like" | "tiktok_follow" | "email_subscribe"

interface RequiredAction {
  _id: string
  type: ActionType
  name: string
  description?: string
  url?: string
  icon?: string
  isRequired: boolean
  sortOrder: number
  timerSeconds: number
  isActive: boolean
}

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  google_review: "Avis Google",
  instagram_follow: "Follow Instagram",
  facebook_like: "Like Facebook",
  tiktok_follow: "Follow TikTok",
  email_subscribe: "Inscription email",
}

interface ActionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action?: RequiredAction
  onSubmit: (data: {
    type: ActionType
    name: string
    description?: string
    url?: string
    isRequired: boolean
    sortOrder: number
    timerSeconds: number
    isActive: boolean
  }) => Promise<void>
  nextSortOrder: number
}

export function ActionFormDialog({ open, onOpenChange, action, onSubmit, nextSortOrder }: ActionFormDialogProps) {
  const isEditing = !!action

  const [type, setType] = useState<ActionType>("google_review")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("")
  const [isRequired, setIsRequired] = useState(true)
  const [timerSeconds, setTimerSeconds] = useState("10")
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (action && open) {
      setType(action.type)
      setName(action.name)
      setDescription(action.description ?? "")
      setUrl(action.url ?? "")
      setIsRequired(action.isRequired)
      setTimerSeconds(String(action.timerSeconds))
      setIsActive(action.isActive)
    } else if (!open) {
      setType("google_review")
      setName("")
      setDescription("")
      setUrl("")
      setIsRequired(true)
      setTimerSeconds("10")
      setIsActive(true)
    }
  }, [action, open])

  const handleSubmit = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmit({
        type,
        name: name.trim(),
        description: description || undefined,
        url: url || undefined,
        isRequired,
        sortOrder: action?.sortOrder ?? nextSortOrder,
        timerSeconds: parseInt(timerSeconds, 10) || 10,
        isActive,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifier l'action" : "Nouvelle action"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Modifiez les paramètres de cette action sociale" : "Configurez une action sociale requise avant de jouer"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ACTION_TYPE_LABELS) as [ActionType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input placeholder="Laissez un avis Google" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input placeholder="https://g.page/r/..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input placeholder="Description optionnelle" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Timer (secondes)</Label>
            <Input type="number" min={1} value={timerSeconds} onChange={(e) => setTimerSeconds(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              <Label className="text-sm">Obligatoire</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="text-sm">Actif</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <ButtonGroup>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "En cours..." : isEditing ? "Mettre à jour" : "Créer"}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
