"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface DropdownMenuItem {
  label: string
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
  separator?: boolean
}

export interface DropdownMenuProps {
  trigger: React.ReactNode
  items: DropdownMenuItem[]
  align?: "left" | "right"
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = "right",
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={menuRef} className="relative inline-block">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, index) => {
            if (item.separator) {
              return (
                <div
                  key={`separator-${index}`}
                  className="my-1 h-px bg-border"
                />
              )
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick()
                    setIsOpen(false)
                  }
                }}
                disabled={item.disabled}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                  item.disabled
                    ? "pointer-events-none opacity-50"
                    : item.destructive
                    ? "text-destructive focus:bg-destructive focus:text-destructive-foreground"
                    : "focus:bg-accent focus:text-accent-foreground"
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { DropdownMenu }
