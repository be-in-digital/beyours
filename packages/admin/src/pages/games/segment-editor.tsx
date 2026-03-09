"use client"

import { useState } from "react"
import { PlusIcon, TrashIcon, TrophyIcon, XCircleIcon, MessageCircleQuestionIcon, ChevronDownIcon } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@beindigital-engine/ui"

export interface WheelSection {
  label: string
  color: string
  probability: number
  isWinning: boolean
  prizeId?: string
}

interface Prize {
  _id: string
  name: string
}

const DEFAULT_COLORS = [
  "#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181",
  "#AA96DA", "#FCBAD3", "#A8D8EA", "#FF9A3C", "#1B9AAA",
]

function WeightHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <MessageCircleQuestionIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 font-medium">Comment fonctionne la taille ?</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/40">
          Ce chiffre controle la place que prend la case sur la roue. Plus le chiffre est grand,
          plus la case est grande.
          <br />
          <strong>Exemple :</strong> taille 2 et taille 8 = la premiere prend 20% de la roue, la seconde
          80%. Meme chiffre partout = toutes les cases ont la meme taille.
        </div>
      )}
    </div>
  )
}

interface SegmentEditorProps {
  sections: WheelSection[]
  onChange: (sections: WheelSection[]) => void
  prizes: Prize[]
}

export function SegmentEditor({ sections, onChange, prizes }: SegmentEditorProps) {
  const addSection = () => {
    const colorIndex = sections.length % DEFAULT_COLORS.length
    onChange([
      ...sections,
      {
        label: "",
        color: DEFAULT_COLORS[colorIndex] ?? "#cccccc",
        probability: 1,
        isWinning: false,
      },
    ])
  }

  const removeSection = (index: number) => {
    if (sections.length <= 2) return
    onChange(sections.filter((_, i) => i !== index))
  }

  const updateSection = (index: number, updates: Partial<WheelSection>) => {
    onChange(sections.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }

  const totalProbability = sections.reduce((sum, s) => sum + s.probability, 0)
  const winningSections = sections.filter((s) => s.isWinning).length
  const losingSections = sections.filter((s) => !s.isWinning).length

  return (
    <div className="space-y-5">
      {/* Header with add button and stats */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Cases de la roue</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sections.length} cases au total — {winningSections} gagnante{winningSections > 1 ? "s" : ""}, {losingSections} perdante{losingSections > 1 ? "s" : ""}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addSection}>
          <PlusIcon className="mr-2 h-3 w-3" />
          Ajouter une case
        </Button>
      </div>

      {/* Segments list */}
      <div className="space-y-4">
        {sections.map((section, index) => {
          const pct = totalProbability > 0 ? Math.round((section.probability / totalProbability) * 100) : 0
          return (
            <div
              key={index}
              className={`border rounded-lg p-4 space-y-4 ${
                section.isWinning
                  ? "border-green-200 bg-green-50/50 dark:border-green-800/50 dark:bg-green-950/20"
                  : "border-border/50"
              }`}
            >
              {/* Row 1: Badge + Label + Delete */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                    section.isWinning
                      ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </div>
                <Input
                  className="flex-1"
                  placeholder="Texte affiche (ex : Bravo !, Perdu, -10%...)"
                  value={section.label}
                  onChange={(e) => updateSection(index, { label: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeSection(index)}
                  disabled={sections.length <= 2}
                  title="Supprimer cette case"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>

              {/* Row 2: Color + Weight + Percentage + Winning toggle */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pl-10">
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground shrink-0">Couleur</Label>
                  <input
                    type="color"
                    value={section.color}
                    onChange={(e) => updateSection(index, { color: e.target.value })}
                    className="h-8 w-8 rounded border border-input cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground shrink-0">Taille</Label>
                  <Input
                    className="w-16"
                    type="number"
                    min={1}
                    value={section.probability}
                    onChange={(e) => updateSection(index, { probability: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                  <span className="text-xs font-medium tabular-nums text-muted-foreground w-10">{pct}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={section.isWinning}
                    onCheckedChange={(checked) =>
                      updateSection(index, {
                        isWinning: checked,
                        ...(!checked ? { prizeId: undefined } : {}),
                      })
                    }
                  />
                  <Label className="text-xs flex items-center gap-1.5">
                    {section.isWinning ? (
                      <>
                        <TrophyIcon className="h-3 w-3 text-green-600" />
                        <span className="text-green-700 dark:text-green-400 font-medium">Gagnante</span>
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="h-3 w-3 text-muted-foreground" />
                        <span>Perdante</span>
                      </>
                    )}
                  </Label>
                </div>
              </div>

              {/* Row 3: Prize selector (only if winning) */}
              {section.isWinning && (
                <div className="pl-10">
                  {prizes.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">Prix a gagner</Label>
                      <Select
                        value={section.prizeId ?? ""}
                        onValueChange={(v) => updateSection(index, { prizeId: v || undefined })}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Choisir un prix..." />
                        </SelectTrigger>
                        <SelectContent>
                          {prizes.map((prize) => (
                            <SelectItem key={prize._id} value={prize._id}>
                              {prize.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Creez des prix dans l'onglet "Prix" pour les associer ici.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {sections.length < 2 && (
        <p className="text-xs text-destructive">Minimum 2 cases requises.</p>
      )}

      {/* Weight explanation — collapsible */}
      <WeightHelp />

      {/* Visual preview */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Apercu de la roue</Label>
        <div className="flex justify-center pt-2">
          <svg viewBox="0 0 200 200" width="180" height="180">
            {(() => {
              if (totalProbability === 0) return null
              let startAngle = 0
              return sections.map((section, i) => {
                const angle = (section.probability / totalProbability) * 360
                const endAngle = startAngle + angle
                const startRad = ((startAngle - 90) * Math.PI) / 180
                const endRad = ((endAngle - 90) * Math.PI) / 180
                const x1 = 100 + 90 * Math.cos(startRad)
                const y1 = 100 + 90 * Math.sin(startRad)
                const x2 = 100 + 90 * Math.cos(endRad)
                const y2 = 100 + 90 * Math.sin(endRad)
                const largeArc = angle > 180 ? 1 : 0
                const path = `M100,100 L${x1},${y1} A90,90 0 ${largeArc},1 ${x2},${y2} Z`
                startAngle = endAngle
                return <path key={i} d={path} fill={section.color} stroke="white" strokeWidth="1.5" />
              })
            })()}
            <circle cx="100" cy="100" r="18" fill="white" />
            {/* Pointer triangle */}
            <polygon points="100,5 95,15 105,15" fill="#333" />
          </svg>
        </div>
      </div>
    </div>
  )
}
