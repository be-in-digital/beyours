"use client"

import { useRouter } from "next/navigation"
import { useAdminAuthStore } from "../stores/admin-auth-store"
import { Avatar, AvatarFallback, AvatarImage } from "@beindigital-engine/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@beindigital-engine/ui"
import { toast } from "sonner"
import { LogOut, ChevronsUpDown, Settings } from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "../ui/sidebar"

function getInitials(name?: string, email?: string): string {
  if (name) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }
  return email?.charAt(0).toUpperCase() ?? "?"
}

/**
 * Compact user menu for sidebar footer
 */
export function SidebarUserMenu() {
  const router = useRouter()
  const user = useAdminAuthStore((s) => s.user)
  const signOut = useAdminAuthStore((s) => s.signOut)

  const handleSignOut = async () => {
    if (signOut) await signOut()
    toast.success("Déconnexion réussie")
    router.push("/sign-in")
  }

  if (!user) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
            >
              <Avatar size="sm">
                {user.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
                <AvatarFallback className="text-[10px]">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate text-xs font-medium">{user.name ?? user.email}</span>
                {user.name && (
                  <span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground/60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" side="top" align="start" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium">{user.name ?? user.email}</p>
                {user.name && (
                  <p className="text-[10px] text-muted-foreground">{user.email}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")} className="text-xs">
              <Settings className="mr-2 size-3.5" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-xs">
              <LogOut className="mr-2 size-3.5" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
