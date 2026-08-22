"use client"

import { useState } from "react"
import type { ImageToProductMode } from "@be-in-digital/convex-schema/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Label,
} from "@be-in-digital/ui"
import { Camera, FileText, Sparkles } from "lucide-react"
import { ImageUploader, type ImageUploaderProps } from "../../../components/image-uploader"

interface ImageUploadStepProps {
  onAnalyze: (imageUrl: string, mode: ImageToProductMode) => void
  onRequestUploadUrl: ImageUploaderProps["onRequestUploadUrl"]
  isLoading: boolean
}

export function ImageUploadStep({
  onAnalyze,
  onRequestUploadUrl,
  isLoading,
}: ImageUploadStepProps) {
  const [imageUrl, setImageUrl] = useState("")
  const [mode, setMode] = useState<ImageToProductMode>("single")

  const canAnalyze = imageUrl.length > 0 && !isLoading

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Créer depuis une image</CardTitle>
        <CardDescription>
          Uploadez une photo de plat ou de menu — l'IA analysera l'image pour
          pre-remplir les informations produit.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Image upload */}
        <ImageUploader
          value={imageUrl}
          onChange={setImageUrl}
          onRequestUploadUrl={onRequestUploadUrl}
          folder="products"
          accept="image/jpeg,image/png,image/webp"
          maxSizeMB={15}
          label="Photo du plat ou du menu"
          placeholder="Deposez une image ici ou cliquez pour parcourir"
        />

        {/* Mode selection */}
        <div className="space-y-2">
          <Label>Type d'analyse</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                mode === "single"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <Camera className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Plat unique</p>
                <p className="text-xs text-muted-foreground">
                  Photo d'un seul produit
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("menu")}
              className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                mode === "menu"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Menu / Carte</p>
                <p className="text-xs text-muted-foreground">
                  Photo d'un menu avec plusieurs produits
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Analyze button */}
        <Button
          onClick={() => onAnalyze(imageUrl, mode)}
          disabled={!canAnalyze}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {isLoading ? "Analyse en cours..." : "Analyser l'image"}
        </Button>
      </CardContent>
    </Card>
  )
}
