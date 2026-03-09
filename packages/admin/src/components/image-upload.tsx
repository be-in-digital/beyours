"use client"

import { useState, useRef, useCallback } from "react"
import { UploadIcon, XIcon, Loader2Icon, ImageIcon } from "lucide-react"

export interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  folder: string
  placeholder?: string
  className?: string
}

export function ImageUpload({
  value,
  onChange,
  folder,
  placeholder = "Glissez une image ou cliquez pour sélectionner",
  className = "",
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(
    async (file: File) => {
      setError(null)
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", folder)

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Upload failed")
        }

        const data = await response.json()
        onChange(data.url)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed"
        setError(message)
      } finally {
        setIsUploading(false)
      }
    },
    [folder, onChange]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) upload(file)
      if (inputRef.current) inputRef.current.value = ""
    },
    [upload]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file?.type.startsWith("image/")) {
        upload(file)
      } else {
        setError("Seules les images sont acceptées")
      }
    },
    [upload]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleRemove = useCallback(() => {
    onChange("")
    setError(null)
  }, [onChange])

  if (value) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div
          className="relative h-32 rounded-lg overflow-hidden border border-border/50"
          style={{ background: `url(${value}) center/cover no-repeat` }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <p className="text-white/80 text-sm font-medium">Aperçu avec overlay</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white/80 transition-colors cursor-pointer"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {isUploading ? (
          <>
            <Loader2Icon className="h-8 w-8 text-muted-foreground animate-spin" />
            <span className="text-sm text-muted-foreground">Upload en cours...</span>
          </>
        ) : (
          <>
            <UploadIcon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center">{placeholder}</span>
            <span className="text-xs text-muted-foreground/60">JPG, PNG, WebP — 10 Mo max</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!value && !error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 text-muted-foreground">
          <ImageIcon className="h-8 w-8 opacity-50" />
          <span className="text-sm">Aucune image — fond dégradé par défaut</span>
        </div>
      )}
    </div>
  )
}
