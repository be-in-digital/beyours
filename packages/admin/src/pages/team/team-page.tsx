"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { cn } from "../../lib/utils"
import { useState, useMemo } from "react"
import {
  PlusIcon,
  UserIcon,
  MoreVerticalIcon,
  TrashIcon,
  SendIcon,
  PencilIcon,
  MailIcon,
  ShieldIcon,
  BuildingIcon,
} from "lucide-react"
import {
  Button,
  ButtonGroup,
  Badge,
  Avatar,
  AvatarFallback,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  Switch,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { resolveStoreSelection } from "../../components/store-selection"

// === TYPES & CONSTANTS ===

type Role = "manager" | "kitchen" | "waiter" | "delivery"
type InvitationStatus = "pending" | "accepted" | "expired"
type StatusFilter = "all" | "active" | "inactive" | "pending"

const ROLES: { value: Role; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "kitchen", label: "Cuisine" },
  { value: "waiter", label: "Serveur" },
  { value: "delivery", label: "Livreur" },
]

const ROLE_CONFIG: Record<Role, { label: string; color: string }> = {
  manager: { label: "Manager", color: "bg-primary text-primary-foreground" },
  kitchen: { label: "Cuisine", color: "bg-orange-500 text-white" },
  waiter: { label: "Serveur", color: "bg-blue-500 text-white" },
  delivery: { label: "Livreur", color: "bg-green-500 text-white" },
}

const PERMISSION_MODULES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "orders", label: "Commandes" },
  { id: "products", label: "Produits / Menu" },
  { id: "kitchen", label: "Cuisine (KDS)" },
  { id: "team", label: "Équipe" },
  { id: "settings", label: "Paramètres" },
  { id: "integrations", label: "Intégrations" },
  { id: "marketing", label: "Jeux / Marketing" },
] as const

const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  manager: PERMISSION_MODULES.map((m) => m.id),
  kitchen: ["orders", "kitchen"],
  waiter: ["dashboard", "orders"],
  delivery: ["orders"],
}

// === MAIN COMPONENT ===

export function TeamPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  // Dialogs
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [editMember, setEditMember] = useState<any | null>(null)
  const [deleteMember, setDeleteMember] = useState<any | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  // Data
  const stores = useQuery(api?.stores?.listAll ?? ("skip" as any))

  /**
   * The persisted selection, but only once this deployment has confirmed it
   * exists.
   *
   * The id lives in localStorage, and localStorage outlives the deployment that
   * issued it. `teamMembers.list` declares `storeId: v.id("stores")`, which
   * refuses an id belonging to another deployment — and Convex raises that out
   * of `useQuery` during render, taking the page down rather than degrading it.
   *
   * This is the same shape as #119, and `/dashboard/team` is one of
   * `StoreGuard`'s `BYPASS_ROUTES`, so the guard renders this page before it has
   * settled the selection. It still repairs it — its effect runs on bypassed
   * routes too — but a render happens first, and one render is all it took.
   */
  const selection = resolveStoreSelection({ storeId, stores: stores as any[] })
  const verifiedStoreId = selection.status === "selected" ? storeId : null

  const teamMembers = useQuery(
    api?.teamMembers?.list,
    verifiedStoreId ? { storeId: verifiedStoreId } : "skip"
  )

  // Actions & Mutations
  const sendInvitation = useAction(api?.teamMembersEmail?.sendInvitationEmail)
  const resendInvitation = useAction(api?.teamMembersEmail?.resendInvitationEmail)
  const updateMember = useMutation(api?.teamMembers?.update)
  const toggleActive = useMutation(api?.teamMembers?.toggleActive)
  const removeMember = useMutation(api?.teamMembers?.remove)

  // Get current store name
  const currentStore = useMemo(
    () => (stores as any[])?.find((s: any) => s._id === verifiedStoreId),
    [stores, verifiedStoreId]
  )

  // Filtered members
  const filteredMembers = useMemo(() => {
    if (!teamMembers) return []
    return (teamMembers as any[]).filter((member: any) => {
      // Status filter
      if (statusFilter === "active" && (!member.isActive || member.invitationStatus === "pending")) return false
      if (statusFilter === "inactive" && member.isActive) return false
      if (statusFilter === "pending" && member.invitationStatus !== "pending") return false

      // Role filter
      if (roleFilter !== "all" && member.role !== roleFilter) return false

      // Search
      if (search) {
        const q = search.toLowerCase()
        return (
          member.name?.toLowerCase().includes(q) ||
          member.email?.toLowerCase().includes(q)
        )
      }

      return true
    })
  }, [teamMembers, statusFilter, roleFilter, search])

  // Handlers
  const handleToggleActive = async (id: string) => {
    try {
      await toggleActive({ id })
      toast.success("Statut mis a jour")
    } catch {
      toast.error("Échec de la mise a jour")
    }
  }

  const handleRemove = async () => {
    if (!deleteMember) return
    try {
      await removeMember({ id: deleteMember._id })
      toast.success("Membre supprimé")
      setDeleteMember(null)
    } catch {
      toast.error("Échec de la suppression")
    }
  }

  const handleResendInvitation = async (member: any) => {
    try {
      await resendInvitation({
        memberId: member._id,
        storeName: currentStore?.name ?? "Restaurant",
      })
      toast.success(`Invitation renvoyée à ${member.email}`)
    } catch {
      toast.error("Échec du renvoi de l'invitation")
    }
  }

  // The list has not arrived, or `StoreGuard` is about to replace a selection
  // this deployment does not have. Either way there is nothing to ask for yet,
  // and saying "no establishment selected" here would be wrong on the next
  // render.
  if (selection.status === "pending" || selection.status === "replace") {
    return <LoadingState />
  }

  // No store selected
  if (!verifiedStoreId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Veuillez sélectionner un établissement pour gérer l'équipe</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (teamMembers === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gestion de l'équipe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les membres de votre équipe, leurs rôles et permissions
          </p>
        </div>
        <Button size="sm" onClick={() => setIsInviteOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Inviter un membre
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Rechercher par nom ou email..."
          value={search}
          onValueChange={setSearch}
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table or Empty State */}
      {filteredMembers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserIcon />
            </EmptyMedia>
            <EmptyTitle>{teamMembers.length === 0 ? "Aucun membre" : "Aucun résultat"}</EmptyTitle>
            <EmptyDescription>
              {teamMembers.length === 0
                ? "Invitez votre premier membre pour commencer"
                : "Essayez de modifier vos filtres"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Périmètre</TableHead>
                <TableHead className="hidden md:table-cell">Date d'ajout</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member: any) => (
                <TableRow key={member._id}>
                  {/* Member info */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.name || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.email || "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-xs font-medium",
                        ROLE_CONFIG[member.role as Role]?.color
                      )}
                    >
                      {ROLE_CONFIG[member.role as Role]?.label || member.role}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <MemberStatus member={member} />
                  </TableCell>

                  {/* Store scope */}
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {member.allStores
                        ? "Tous"
                        : currentStore?.name ?? "—"}
                    </span>
                  </TableCell>

                  {/* Date */}
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditMember(member)}>
                          <PencilIcon className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        {member.invitationStatus === "pending" && (
                          <DropdownMenuItem onClick={() => handleResendInvitation(member)}>
                            <MailIcon className="mr-2 h-4 w-4" />
                            Renvoyer l'invitation
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleToggleActive(member._id)}>
                          <ShieldIcon className="mr-2 h-4 w-4" />
                          {member.isActive ? "Desactiver" : "Activer"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteMember(member)}
                        >
                          <TrashIcon className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invite Dialog */}
      <InviteDialog
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        storeId={verifiedStoreId}
        storeName={currentStore?.name ?? "Restaurant"}
        stores={stores as any[] | undefined}
        sendInvitation={sendInvitation}
      />

      {/* Edit Dialog */}
      {editMember && (
        <EditDialog
          open={!!editMember}
          onOpenChange={(open) => !open && setEditMember(null)}
          member={editMember}
          updateMember={updateMember}
          stores={stores as any[] | undefined}
        />
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteMember}
        onOpenChange={(open) => !open && setDeleteMember(null)}
        onConfirm={handleRemove}
        title="Supprimer le membre"
        description={`Êtes-vous sûr de vouloir supprimer ${deleteMember?.name ?? "ce membre"} de l'équipe ? Cette action est irréversible.`}
      />
    </div>
  )
}

// === MEMBER STATUS BADGE ===

function MemberStatus({ member }: { member: any }) {
  if (member.invitationStatus === "pending") {
    return (
      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
        <SendIcon className="mr-1 h-3 w-3" />
        En attente
      </Badge>
    )
  }

  if (member.invitationStatus === "expired") {
    return (
      <Badge variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50">
        Expire
      </Badge>
    )
  }

  if (!member.isActive) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Inactif
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
      Actif
    </Badge>
  )
}

// === INVITE DIALOG ===

function InviteDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  stores,
  sendInvitation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
  storeName: string
  stores: any[] | undefined
  sendInvitation: any
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("waiter")
  const [allStores, setAllStores] = useState(false)
  const [selectedStoreId, setSelectedStoreId] = useState(storeId)
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_ROLE_PERMISSIONS.waiter)
  const [isSending, setIsSending] = useState(false)

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole)
    setPermissions([...DEFAULT_ROLE_PERMISSIONS[newRole]])
  }

  const togglePermission = (moduleId: string) => {
    setPermissions((prev) =>
      prev.includes(moduleId)
        ? prev.filter((p) => p !== moduleId)
        : [...prev, moduleId]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Veuillez remplir le nom et l'email")
      return
    }

    setIsSending(true)
    try {
      const result = await sendInvitation({
        storeId: allStores ? undefined : selectedStoreId,
        allStores,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        permissions,
        storeName,
      })
      if (result?.emailSent === false) {
        toast.warning(`Membre ajouté mais l'email n'a pas pu être envoyé à ${email}`)
      } else {
        toast.success(`Invitation envoyée à ${email}`)
      }
      resetForm()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error?.message ?? "Échec de l'envoi de l'invitation")
    } finally {
      setIsSending(false)
    }
  }

  const resetForm = () => {
    setName("")
    setEmail("")
    setRole("waiter")
    setAllStores(false)
    setSelectedStoreId(storeId)
    setPermissions([...DEFAULT_ROLE_PERMISSIONS.waiter])
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inviter un membre</DialogTitle>
          <DialogDescription>
            Un email d'invitation sera envoyé au nouveau membre
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nom complet</Label>
            <Input
              id="invite-name"
              placeholder="Jean Dupont"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="jean@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="invite-role">Rôle</Label>
            <Select value={role} onValueChange={(v) => handleRoleChange(v as Role)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* All Stores toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Tous les établissements</Label>
              <p className="text-xs text-muted-foreground">
                Acces a l'ensemble de la chaine
              </p>
            </div>
            <Switch
              checked={allStores}
              onCheckedChange={setAllStores}
            />
          </div>

          {/* Store selector (hidden when allStores) */}
          {!allStores && stores && stores.length > 1 && (
            <div className="space-y-2">
              <Label>Établissement</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store: any) => (
                    <SelectItem key={store._id} value={store._id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              {PERMISSION_MODULES.map((mod) => (
                <Checkbox
                  key={mod.id}
                  label={mod.label}
                  checked={permissions.includes(mod.id)}
                  onCheckedChange={() => togglePermission(mod.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <ButtonGroup>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSending}>
              {isSending ? "Envoi..." : "Envoyer l'invitation"}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// === EDIT DIALOG ===

function EditDialog({
  open,
  onOpenChange,
  member,
  updateMember,
  stores,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: any
  updateMember: any
  stores: any[] | undefined
}) {
  const [role, setRole] = useState<Role>(member.role)
  const [permissions, setPermissions] = useState<string[]>(member.permissions ?? [])
  const [allStores, setAllStores] = useState(member.allStores ?? false)
  const [selectedStoreId, setSelectedStoreId] = useState(member.storeId)
  const [isSaving, setIsSaving] = useState(false)

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole)
    setPermissions([...DEFAULT_ROLE_PERMISSIONS[newRole]])
  }

  const togglePermission = (moduleId: string) => {
    setPermissions((prev) =>
      prev.includes(moduleId)
        ? prev.filter((p) => p !== moduleId)
        : [...prev, moduleId]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateMember({
        id: member._id,
        role,
        permissions,
        allStores,
        storeId: allStores ? undefined : selectedStoreId,
      })
      toast.success("Membre mis a jour")
      onOpenChange(false)
    } catch {
      toast.error("Échec de la mise a jour")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le membre</DialogTitle>
          <DialogDescription>
            {member.name} — {member.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Role */}
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => handleRoleChange(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* All Stores toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Tous les établissements</Label>
              <p className="text-xs text-muted-foreground">
                Acces a l'ensemble de la chaine
              </p>
            </div>
            <Switch
              checked={allStores}
              onCheckedChange={setAllStores}
            />
          </div>

          {/* Store selector */}
          {!allStores && stores && stores.length > 1 && (
            <div className="space-y-2">
              <Label>Établissement</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store: any) => (
                    <SelectItem key={store._id} value={store._id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              {PERMISSION_MODULES.map((mod) => (
                <Checkbox
                  key={mod.id}
                  label={mod.label}
                  checked={permissions.includes(mod.id)}
                  onCheckedChange={() => togglePermission(mod.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <ButtonGroup>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// === UTILITY FUNCTIONS ===

function getInitials(name: string): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp))
}
