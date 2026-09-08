"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import {
  StarIcon,
  InstagramIcon,
  ThumbsUpIcon,
  MusicIcon,
  MailIcon,
  PlusIcon,
  TrashIcon,
  ListChecksIcon,
} from "lucide-react"
import {
  Badge,
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { convexErrorMessage } from "../../lib/convex-error"

/**
 * Required social actions CRUD — the quests players complete to unlock a play
 * (Google review, Instagram follow, …).
 */

type ActionType =
  | "google_review"
  | "instagram_follow"
  | "facebook_like"
  | "tiktok_follow"
  | "email_subscribe"

interface RequiredAction {
  _id: string
  type: ActionType
  name: string
  description?: string
  url?: string
  isRequired: boolean
  timerSeconds?: number
  isActive: boolean
  sortOrder: number
}

const TYPE_META: Record<ActionType, { label: string; icon: React.ReactNode; placeholder: string }> = {
  google_review: {
    label: "Avis Google",
    icon: <StarIcon className="h-4 w-4" />,
    placeholder: "https://g.page/r/...",
  },
  instagram_follow: {
    label: "Follow Instagram",
    icon: <InstagramIcon className="h-4 w-4" />,
    placeholder: "https://instagram.com/...",
  },
  facebook_like: {
    label: "Like Facebook",
    icon: <ThumbsUpIcon className="h-4 w-4" />,
    placeholder: "https://facebook.com/...",
  },
  tiktok_follow: {
    label: "Follow TikTok",
    icon: <MusicIcon className="h-4 w-4" />,
    placeholder: "https://tiktok.com/@...",
  },
  email_subscribe: {
    label: "Inscription newsletter",
    icon: <MailIcon className="h-4 w-4" />,
    placeholder: "URL du formulaire (optionnel)",
  },
}

export function GameActionsPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [type, setType] = useState<ActionType>("google_review")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("")
  const [timerSeconds, setTimerSeconds] = useState("8")
  const [isRequired, setIsRequired] = useState(true)

  const actions = useQuery(
    api.requiredActions.list,
    storeId ? { storeId } : "skip"
  ) as RequiredAction[] | undefined

  const createAction = useMutation(api.requiredActions.create)
  const updateAction = useMutation(api.requiredActions.update)
  const removeAction = useMutation(api.requiredActions.remove)

  const handleAdd = async () => {
    if (!storeId || !name.trim()) {
      toast.error("Donnez un nom à l'action")
      return
    }
    try {
      await createAction({
        storeId,
        type,
        name: name.trim(),
        description: description.trim() || undefined,
        url: url.trim() || undefined,
        isRequired,
        timerSeconds: timerSeconds ? Math.max(3, parseInt(timerSeconds, 10) || 8) : undefined,
        isActive: true,
      })
      toast.success("Action créée")
      setIsAddOpen(false)
      setName("")
      setDescription("")
      setUrl("")
      setTimerSeconds("8")
      setIsRequired(true)
    } catch (error) {
      toast.error("Échec de la création")
      console.error(error)
    }
  }

  const handleToggle = async (action: RequiredAction, field: "isActive" | "isRequired") => {
    try {
      await updateAction({ id: action._id, [field]: !action[field] })
    } catch (error) {
      toast.error("Échec de la mise à jour")
      console.error(error)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await removeAction({ id })
      toast.success("Action supprimée")
    } catch (error) {
      toast.error(convexErrorMessage(error, "Échec de la suppression"))
      console.error(error)
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  if (!storeId) {
    return (
      <Empty className="min-h-[400px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecksIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour gérer les actions</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (actions === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Actions requises</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Les étapes que vos clients accomplissent pour débloquer leur partie
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter une action
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle action</DialogTitle>
              <DialogDescription>
                Le client ouvre le lien, un compte à rebours valide l&apos;étape.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="actionType">Type *</Label>
                <Select value={type} onValueChange={(value) => setType(value as ActionType)}>
                  <SelectTrigger id="actionType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_META) as ActionType[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {TYPE_META[key].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="actionName">Nom affiché *</Label>
                <Input
                  id="actionName"
                  placeholder={`Ex : ${TYPE_META[type].label}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actionDescription">Description</Label>
                <Input
                  id="actionDescription"
                  placeholder="Ex : Laissez-nous un avis, ça aide énormément !"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actionUrl">Lien</Label>
                <Input
                  id="actionUrl"
                  placeholder={TYPE_META[type].placeholder}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="actionTimer">Durée de vérification (s)</Label>
                  <Input
                    id="actionTimer"
                    type="number"
                    min={3}
                    max={60}
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch id="actionRequired" checked={isRequired} onCheckedChange={setIsRequired} />
                  <Label htmlFor="actionRequired">Obligatoire</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <ButtonGroup>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={() => void handleAdd()}>Créer l&apos;action</Button>
              </ButtonGroup>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {actions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecksIcon />
            </EmptyMedia>
            <EmptyTitle>Aucune action configurée</EmptyTitle>
            <EmptyDescription>
              Sans action, vos clients jouent directement. Ajoutez un avis Google ou un follow pour
              transformer chaque partie en visibilité.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border border-border/50 rounded-lg divide-y divide-border/50">
          {actions.map((action) => (
            <div key={action._id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {TYPE_META[action.type].icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{action.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {TYPE_META[action.type].label}
                  {action.url ? ` · ${action.url}` : ""}
                  {action.timerSeconds ? ` · ${action.timerSeconds}s` : ""}
                </p>
              </div>
              {action.isRequired ? (
                <Badge variant="secondary">Obligatoire</Badge>
              ) : (
                <Badge variant="outline">Bonus</Badge>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={action.isActive}
                  onCheckedChange={() => void handleToggle(action, "isActive")}
                  aria-label={action.isActive ? "Désactiver l'action" : "Activer l'action"}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer l'action"
                  onClick={() => setDeletingId(action._id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={() => deletingId && void handleDelete(deletingId)}
        title="Supprimer cette action ?"
        description="Les clients n'auront plus à accomplir cette étape avant de jouer."
        isDeleting={isDeleting}
      />
    </div>
  )
}
