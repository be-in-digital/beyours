"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Separator,
  SidebarTrigger,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@be-yours/ui"
import { getBreadcrumbData } from "../config/route-titles"
import { toast } from "sonner"
import { Globe, Moon, Sun } from "lucide-react"

const languages = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "ar", label: "العربية" },
]

interface AdminHeaderProps {
  /** Slot for the store selector dropdown */
  storeSelector?: React.ReactNode
}

export function AdminHeader({ storeSelector }: AdminHeaderProps) {
  const pathname = usePathname()
  const { parentLabel, parentHref, currentLabel } = getBreadcrumbData(pathname)
  const { theme, setTheme } = useTheme()
  const [currentLang, setCurrentLang] = useState("fr")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = document.cookie
      .split("; ")
      .find((c) => c.startsWith("lang="))
      ?.split("=")[1]
    if (saved) setCurrentLang(saved)
  }, [])

  const handleLanguageChange = (code: string) => {
    const lang = languages.find((l) => l.code === code)
    setCurrentLang(code)
    document.cookie = `lang=${code}; path=/; max-age=${60 * 60 * 24 * 365}`
    toast.success(`Langue changée : ${lang?.label ?? code}`)
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4">
      {/*
        `min-w-0` so this half can actually give way.

        The header is `justify-between` between two groups, and neither could
        shrink: at 375 px their sum came to 382 px and the whole admin scrolled
        sideways under the thumb. A flex child refuses to shrink below its
        content unless `min-width: 0` says otherwise.
      */}
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
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
                <BreadcrumbPage className="truncate text-sm font-medium">
                  {currentLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {storeSelector && (
          // Capped on a phone: a long restaurant name is what pushed the group
          // past the viewport. Unbounded again from `sm` upwards.
          <div className="min-w-0 max-w-[7.5rem] sm:max-w-none">{storeSelector}</div>
        )}

        {/* Language switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Globe className="size-4" />
              <span className="uppercase text-xs font-medium">{currentLang}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={currentLang === lang.code ? "font-medium bg-accent" : ""}
              >
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
