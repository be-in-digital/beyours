"use client"

import { Info, ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@be-in-digital/ui"
import type { FieldInfoProps } from "./settings-types"

// ---------------------------------------------------------------------------
// Info dialog helper — renders an (i) icon that opens a guide dialog
// ---------------------------------------------------------------------------

export function FieldInfo({ title, description, steps, links, note }: FieldInfoProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Aide : ${title}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="!max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
            {steps.map((step, i) => (
              <li key={i}>{step.text}</li>
            ))}
          </ol>
          {links && links.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Liens utiles</p>
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {link.label}
                </a>
              ))}
            </div>
          )}
          {note && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">{note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
