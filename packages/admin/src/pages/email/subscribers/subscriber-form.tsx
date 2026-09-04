"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import {
  Button,
  ButtonGroup,
  Input,
  Label,
  DialogFooter,
} from "@be-in-digital/ui"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"

const subscriberSchema = z.object({
  email: z.string().email("Email invalide"),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  tags: z.string().optional(), // comma-separated
})

type SubscriberFormData = z.infer<typeof subscriberSchema>

interface SubscriberFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function SubscriberForm({ onSuccess, onCancel }: SubscriberFormProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const createMutation = useMutation(api?.emailSubscribers?.create)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubscriberFormData>({
    resolver: zodResolver(subscriberSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      tags: "",
    },
  })

  const onSubmit = async (data: SubscriberFormData) => {
    if (!storeId) return
    try {
      const tags = data.tags
        ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : []
      await createMutation({
        storeId,
        email: data.email,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        tags,
        source: "manual",
      })
      // `source: "manual"` is written `active` with the opt-in already
      // recorded, so no confirmation is sent — the owner is asserting the
      // consent directly. The toast said one was, which was untrue twice over:
      // no code sent any confirmation at all until the storefront path was
      // wired, and this path is the one that never will.
      toast.success("Abonné ajouté", {
        description:
          "Inscrit directement, sans email de confirmation : vous attestez de son consentement.",
      })
      onSuccess?.()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de l'ajout : ${message}`)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          placeholder="client@example.com"
          autoFocus
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            {...register("firstName")}
            placeholder="Marie"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            {...register("lastName")}
            placeholder="Dupont"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          {...register("tags")}
          placeholder="vip, fidèle (séparés par des virgules)"
        />
        <p className="text-xs text-muted-foreground">
          Ajout manuel : l&apos;abonné est actif immédiatement, sans email de
          confirmation. N&apos;ajoutez ici que des adresses dont vous avez
          recueilli le consentement.
        </p>
      </div>

      <DialogFooter>
        <ButtonGroup>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Ajout..." : "Ajouter l'abonné"}
          </Button>
        </ButtonGroup>
      </DialogFooter>
    </form>
  )
}
