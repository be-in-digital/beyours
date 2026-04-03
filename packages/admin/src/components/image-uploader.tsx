"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, X, Loader2, AlertCircle } from "lucide-react"
import { Button, Label } from "@be-in-digital/ui"

type UploadState = "idle" | "uploading" | "error"

interface PresignedUrlResult {
  uploadUrl: string
  key: string
  publicUrl: string
}

export interface ImageUploaderProps {
  value: string
  onChange: (url: string) => void
  onRequestUploadUrl: (args: {
    folder: string
    contentType: string
  }) => Promise<PresignedUrlResult>
  folder?: string
  accept?: string
  maxSizeMB?: number
  label?: string
  placeholder?: string
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]

export function ImageUploader({
  value,
  onChange,
  onRequestUploadUrl,
  folder = "email",
  accept = "image/*",
  maxSizeMB = 10,
  label,
  placeholder = "Déposez une image ici ou cliquez pour parcourir",
}: ImageUploaderProps) {
  const [state, setState] = useState<UploadState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return `Type non supporté (${file.type}). Acceptés : JPEG, PNG, WebP, SVG, GIF`
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)}MB). Max : ${maxSizeMB}MB`
      }
      return null
    },
    [maxSizeMB]
  )

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        setState("error")
        return
      }

      setState("uploading")
      setError(null)
      setProgress(10)

      try {
        // Get presigned URL from Convex
        setProgress(20)
        const { uploadUrl, publicUrl } = await onRequestUploadUrl({
          folder,
          contentType: file.type,
        })

        // Upload directly to S3
        setProgress(50)
        const response = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        })

        if (!response.ok) {
          throw new Error(`Upload échoué (${response.status})`)
        }

        setProgress(100)
        onChange(publicUrl)
        setState("idle")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors de l'upload"
        setError(message)
        setState("error")
      }
    },
    [folder, onChange, onRequestUploadUrl, validateFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) uploadFile(file)
    },
    [uploadFile]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) uploadFile(file)
      // Reset input so same file can be re-selected
      e.target.value = ""
    },
    [uploadFile]
  )

  const handleRemove = useCallback(() => {
    onChange("")
    setState("idle")
    setError(null)
  }, [onChange])

  // Preview mode
  if (value) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <div className="relative group rounded-md border overflow-hidden">
          <img
            src={value}
            alt="Aperçu"
            className="w-full h-auto max-h-48 object-contain bg-muted/30"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1.5 right-1.5 rounded-full bg-destructive/90 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] text-muted-foreground hover:text-primary"
        >
          {showUrlInput ? "Masquer" : "Coller une URL"}
        </button>
        {showUrlInput && (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          />
        )}
      </div>
    )
  }

  // Upload zone
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => state !== "uploading" && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 cursor-pointer transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5"
            : state === "error"
              ? "border-destructive/50 bg-destructive/5"
              : "border-muted-foreground/30 hover:border-primary/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />

        {state === "uploading" ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Upload en cours...</p>
            <div className="w-full max-w-[120px] h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : state === "error" ? (
          <>
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-xs text-destructive text-center">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setState("idle")
                setError(null)
              }}
              className="text-xs h-7"
            >
              Réessayer
            </Button>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center">{placeholder}</p>
            <p className="text-[10px] text-muted-foreground/70">
              JPEG, PNG, WebP, SVG, GIF — Max {maxSizeMB}MB
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowUrlInput(!showUrlInput)}
        className="text-[11px] text-muted-foreground hover:text-primary"
      >
        {showUrlInput ? "Masquer" : "Coller une URL"}
      </button>
      {showUrlInput && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        />
      )}
    </div>
  )
}
