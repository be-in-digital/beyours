"use client"

import * as React from "react"
import { Menu, X } from "lucide-react"
import { cn } from "../lib/utils"

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  logo?: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
}

const Navbar = React.forwardRef<HTMLElement, NavbarProps>(
  ({ className, logo, children, actions, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)

    return (
      <nav
        ref={ref}
        className={cn(
          "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          className
        )}
        {...props}
      >
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            {logo}
            {/* Desktop navigation */}
            <div className="hidden md:flex md:items-center md:gap-6">
              {children}
            </div>
          </div>

          {/* Actions + Mobile toggle */}
          <div className="flex items-center gap-4">
            {actions}
            <button
              type="button"
              className="md:hidden"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {isOpen && (
          <div className="border-t md:hidden">
            <div className="container space-y-2 py-4">{children}</div>
          </div>
        )}
      </nav>
    )
  }
)
Navbar.displayName = "Navbar"

export { Navbar }
