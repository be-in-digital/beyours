"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { PlusIcon, Trash2, Users } from "lucide-react"
import {
  Button,
  ButtonGroup,
  Input,
  Textarea,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@beindigital-engine/ui"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId, useDebounce } from "../../../hooks/admin-hooks"

type RuleOperator =
  | "equals" | "not_equals"
  | "gt" | "lt" | "gte" | "lte"
  | "contains" | "not_contains"
  | "before" | "after" | "in_last_days"

interface SegmentRule {
  id: string
  field: string
  operator: RuleOperator
  value: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Segment = any

const FIELDS = [
  { value: "status", label: "Statut" },
  { value: "source", label: "Source" },
  { value: "tags", label: "Tags" },
  { value: "metadata.totalOrders", label: "Nombre de commandes" },
  { value: "metadata.totalSpent", label: "Total dépensé (centimes)" },
  { value: "metadata.averageOrderValue", label: "Panier moyen (centimes)" },
  { value: "metadata.lastOrderAt", label: "Dernière commande" },
  { value: "metadata.city", label: "Ville" },
  { value: "metadata.language", label: "Langue" },
  { value: "createdAt", label: "Date d'inscription" },
]

const OPERATORS: { value: RuleOperator; label: string; types: string[] }[] = [
  { value: "equals", label: "est égal à", types: ["all"] },
  { value: "not_equals", label: "n'est pas égal à", types: ["all"] },
  { value: "contains", label: "contient", types: ["text"] },
  { value: "not_contains", label: "ne contient pas", types: ["text"] },
  { value: "gt", label: "supérieur à", types: ["number", "date"] },
  { value: "lt", label: "inférieur à", types: ["number", "date"] },
  { value: "gte", label: "supérieur ou égal à", types: ["number", "date"] },
  { value: "lte", label: "inférieur ou égal à", types: ["number", "date"] },
  { value: "before", label: "avant", types: ["date"] },
  { value: "after", label: "après", types: ["date"] },
  { value: "in_last_days", label: "dans les X derniers jours", types: ["date"] },
]

function generateId() {
  return crypto.randomUUID().slice(0, 7)
}

function newRule(): SegmentRule {
  return { id: generateId(), field: "status", operator: "equals", value: "" }
}

interface SegmentFormDialogProps {
  segment?: Segment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SegmentFormDialog({ segment, open, onOpenChange }: SegmentFormDialogProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const createMutation = useMutation(api?.emailSegments?.create)
  const updateMutation = useMutation(api?.emailSegments?.update)

  const isEdit = !!segment

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [rules, setRules] = useState<SegmentRule[]>([newRule()])
  const [ruleOperator, setRuleOperator] = useState<"and" | "or">("and")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Populate from segment when editing
  useEffect(() => {
    if (open && segment) {
      setName(segment.name ?? "")
      setDescription(segment.description ?? "")
      setRules(segment.rules && segment.rules.length > 0 ? segment.rules : [newRule()])
      setRuleOperator(segment.ruleOperator ?? "and")
    } else if (open && !segment) {
      setName("")
      setDescription("")
      setRules([newRule()])
      setRuleOperator("and")
    }
  }, [open, segment])

  // Debounced rule preview count
  const debouncedRules = useDebounce(rules, 500)
  const debouncedOperator = useDebounce(ruleOperator, 500)

  const previewCount = useQuery(
    api?.emailSegments?.countMatchingSubscribers,
    storeId && debouncedRules.length > 0 && debouncedRules.every((r) => r.field && r.operator && r.value)
      ? { storeId, rules: debouncedRules, ruleOperator: debouncedOperator }
      : "skip"
  ) as number | undefined

  const updateRule = (id: string, patch: Partial<SegmentRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSubmit = async () => {
    if (!storeId || !name.trim()) {
      toast.error("Le nom du segment est requis")
      return
    }
    if (rules.some((r) => !r.value.trim())) {
      toast.error("Toutes les règles doivent avoir une valeur")
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit) {
        await updateMutation({
          id: segment._id,
          name: name.trim(),
          description: description.trim() || undefined,
          rules,
          ruleOperator,
        })
        toast.success("Segment mis à jour")
      } else {
        await createMutation({
          storeId,
          name: name.trim(),
          description: description.trim() || undefined,
          rules,
          ruleOperator,
        })
        toast.success("Segment créé")
      }
      onOpenChange(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec : ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le segment" : "Nouveau segment"}</DialogTitle>
          <DialogDescription>
            Définissez les règles pour cibler un groupe d&apos;abonnés spécifique
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="seg-name">Nom du segment *</Label>
            <Input
              id="seg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex : Clients VIP"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="seg-desc">Description</Label>
            <Textarea
              id="seg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle du segment"
              rows={2}
            />
          </div>

          {/* Rule operator toggle */}
          <div className="space-y-2">
            <Label>Condition globale</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRuleOperator("and")}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  ruleOperator === "and"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border"
                }`}
              >
                ET (toutes les règles)
              </button>
              <button
                type="button"
                onClick={() => setRuleOperator("or")}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  ruleOperator === "or"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border"
                }`}
              >
                OU (au moins une règle)
              </button>
            </div>
          </div>

          {/* Rules */}
          <div className="space-y-3">
            <Label>Règles de filtrage</Label>
            {rules.map((rule, index) => (
              <div key={rule.id} className="flex items-start gap-2">
                {index > 0 && (
                  <span className="w-8 shrink-0 text-center text-xs text-muted-foreground pt-2.5 font-medium">
                    {ruleOperator === "and" ? "ET" : "OU"}
                  </span>
                )}
                {index === 0 && <span className="w-8 shrink-0" />}

                <div className="grid flex-1 grid-cols-3 gap-2">
                  {/* Field */}
                  <Select value={rule.field} onValueChange={(v) => updateRule(rule.id, { field: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator */}
                  <Select
                    value={rule.operator}
                    onValueChange={(v) => updateRule(rule.id, { operator: v as RuleOperator })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value */}
                  <Input
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder="Valeur"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRule(rule.id)}
                  disabled={rules.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRules((prev) => [...prev, newRule()])}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter une règle
            </Button>
          </div>

          {/* Preview count */}
          <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {previewCount === undefined
                ? "Calcul en cours..."
                : `${previewCount} abonné${previewCount > 1 ? "s" : ""} correspond${previewCount <= 1 ? "" : "ent"} à ces critères`}
            </span>
          </div>
        </div>

        <DialogFooter>
          <ButtonGroup>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : isEdit ? "Mettre à jour" : "Créer le segment"}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
