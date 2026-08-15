"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Menu, Plus, LogOut, ChevronDown, ExternalLink } from "lucide-react";
import { titleForPath } from "./nav";
import { useAdmin } from "./auth-gate";
import { Avatar } from "@/components/admin/ui/avatar";
import { Button } from "@/components/admin/ui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/admin/ui/dropdown";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const admin = useAdmin();
  const { signOut } = useAuthActions();
  const title = titleForPath(pathname);

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenu}
          className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="truncate font-display text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="default">
          <Link href="/admin/incidents/nouveau">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Incident</span>
          </Link>
        </Button>

        {admin && (
          <Dropdown
            trigger={
              <button
                type="button"
                className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-surface-2"
              >
                <Avatar name={admin.displayName} color="var(--primary)" />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[10rem] truncate text-sm font-medium text-foreground">
                    {admin.displayName}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Superadmin
                  </span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            }
          >
            <DropdownLabel>{admin.email ?? "—"}</DropdownLabel>
            <DropdownSeparator />
            <Link href="/" target="_blank">
              <DropdownItem>
                <ExternalLink />
                Voir le site
              </DropdownItem>
            </Link>
            <DropdownSeparator />
            <DropdownItem destructive onClick={() => void signOut()}>
              <LogOut />
              Se déconnecter
            </DropdownItem>
          </Dropdown>
        )}
      </div>
    </header>
  );
}
