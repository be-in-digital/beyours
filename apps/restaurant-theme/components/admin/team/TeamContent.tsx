"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { PlusIcon, UserIcon, MoreVerticalIcon, TrashIcon } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LoadingState } from "@/components/admin/LoadingState"
import { EmptyState } from "@/components/admin/EmptyState"

type Role = "manager" | "kitchen" | "waiter" | "delivery"

const roleConfig: Record<Role, { label: string; color: string }> = {
  manager: { label: "Manager", color: "bg-primary text-primary-foreground" },
  kitchen: { label: "Kitchen", color: "bg-orange-500 text-white" },
  waiter: { label: "Waiter", color: "bg-blue-500 text-white" },
  delivery: { label: "Delivery", color: "bg-green-500 text-white" },
}

export function TeamContent() {
  const storeId = useAdminStoreId()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState<Role>("waiter")
  const [permissions, setPermissions] = useState<string[]>([])

  const teamMembers = useQuery(
    api.teamMembers.list,
    storeId ? { storeId } : "skip"
  )

  const createMember = useMutation(api.teamMembers.create)
  const toggleActive = useMutation(api.teamMembers.toggleActive)
  const removeMember = useMutation(api.teamMembers.remove)

  const handleAddMember = async () => {
    if (!storeId || !userId || !role) {
      toast.error("Please fill all required fields")
      return
    }

    try {
      await createMember({
        storeId,
        userId,
        role,
        permissions,
        isActive: true,
      })
      toast.success("Team member added successfully")
      setIsAddDialogOpen(false)
      setUserId("")
      setRole("waiter")
      setPermissions([])
    } catch (error) {
      toast.error("Failed to add team member")
      console.error(error)
    }
  }

  const handleToggleActive = async (id: Id<"teamMembers">) => {
    try {
      await toggleActive({ id })
      toast.success("Status updated successfully")
    } catch (error) {
      toast.error("Failed to update status")
      console.error(error)
    }
  }

  const handleRemoveMember = async (id: Id<"teamMembers">) => {
    try {
      await removeMember({ id })
      toast.success("Team member removed successfully")
    } catch (error) {
      toast.error("Failed to remove team member")
      console.error(error)
    }
  }

  if (!storeId) {
    return (
      <EmptyState
        icon={UserIcon}
        title="No store selected"
        description="Please select a store to manage team members"
      />
    )
  }

  if (teamMembers === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage staff accounts and permissions
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add a new staff member to your team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  placeholder="Enter user ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                    <SelectItem value="waiter">Waiter</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMember}>Add Member</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teamMembers.length === 0 ? (
        <EmptyState
          icon={UserIcon}
          title="No team members"
          description="Add your first team member to get started"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teamMembers.map((member: any) => (
            <div
              key={member._id}
              className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.userId.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.userId}</p>
                    <Badge
                      className={cn(
                        "mt-1",
                        roleConfig[member.role as Role]?.color
                      )}
                    >
                      {roleConfig[member.role as Role]?.label || member.role}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVerticalIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleRemoveMember(member._id)}
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <Label htmlFor={`active-${member._id}`} className="text-sm">
                  Active
                </Label>
                <Switch
                  id={`active-${member._id}`}
                  checked={member.isActive}
                  onCheckedChange={() => handleToggleActive(member._id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
