"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Separator } from "../ui/separator"
import { SidebarTrigger } from "../ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb"
import { getBreadcrumbData } from "../config/route-titles"
import { Moon, Sun } from "lucide-react"

interface AdminHeaderProps {
  /** Slot for the store selector dropdown */
  storeSelector?: React.ReactNode
  /** Slot for the language switcher — replaces the built-in one when provided */
  languageSwitcher?: React.ReactNode
}

export function AdminHeader({ storeSelector, languageSwitcher }: AdminHeaderProps) {
  const pathname = usePathname()
  const { parentLabel, parentHref, currentLabel } = getBreadcrumbData(pathname)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {parentLabel && parentHref ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={parentHref} className="text-sm">
                      {parentLabel}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-medium">
                    {currentLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sm font-medium">
                  {currentLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">
        {storeSelector && (
          <div className="w-48">{storeSelector}</div>
        )}

        {/* Language switcher */}
        {languageSwitcher}

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {mounted && theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>
      </div>
    </header>
  )
}
