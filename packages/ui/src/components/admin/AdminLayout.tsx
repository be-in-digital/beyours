"use client"

import * as React from "react"
import { Menu, X } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../Button"

export interface AdminLayoutProps {
  sidebar: React.ReactNode
  header?: React.ReactNode
  children: React.ReactNode
  className?: string
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  sidebar,
  header,
  children,
  className,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

  return (
    <div className={cn("flex h-screen overflow-hidden", className)}>
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-background transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar close button (mobile only) */}
          <div className="flex items-center justify-between border-b p-4 md:hidden">
            <span className="font-semibold">Menu</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fermer le menu"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto">{sidebar}</div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        {header && (
          <header className="border-b bg-background">
            <div className="flex h-16 items-center gap-4 px-6">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Ouvrir le menu"
                aria-expanded={isSidebarOpen}
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
              {header}
            </div>
          </header>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-muted/10 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export { AdminLayout }
