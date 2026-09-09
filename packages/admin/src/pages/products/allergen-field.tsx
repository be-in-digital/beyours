"use client"

import { useId, useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge, Button, Checkbox, Input, Label } from "@be-in-digital/ui"
import type { Allergen } from "@be-in-digital/core/allergens"
import {
  addAllergenValue,
  isDeclarableAllergenValue,
  readAllergenSelection,
  removeAllergenValue,
  toggleAllergenValue,
  type AllergenOption,
} from "./allergen-selection"

/**
 * The one allergen input in the admin.
 *
 * Two surfaces write `products.allergens` and both render this component: the
 * product form, where an owner declares allergens by hand, and the AI review
 * card, where a GPT extractor prompted in French proposes them. They used to
 * disagree completely — the product form had no control at all, so the only
 * production writer of the field was an unvalidated comma-separated text box.
 * That is how unrecognised French free text reached the database, where it
 * silently failed to reach Uber Eats' structured allergen field.
 *
 * The vocabulary is `@be-in-digital/core/allergens` and the arithmetic is
 * `./allergen-selection`. Nothing about which names exist, how they are matched
 * or what they are called is decided here.
 *
 * The field stores free text, deliberately: refusing a name we do not know
 * would push a real declaration off the menu entirely. What it will not do is
 * pass an unknown name off as a verified allergen — those are listed apart,
 * marked "non vérifiée", with the consequence spelled out.
 */

export interface AllergenFieldProps {
  /** The stored list, straight out of the form or the AI suggestion. */
  value: readonly string[] | undefined
  /** Called with the new list. The component never mutates the one it is given. */
  onChange: (next: string[]) => void
  disabled?: boolean
  /**
   * `compact` shrinks the type and the input to sit inside the AI review card.
   * Behaviour is identical in both densities — only the classes differ.
   */
  density?: "default" | "compact"
}

interface Density {
  heading: string
  help: string
  choice: string
  input: string
  chip: string
}

const DENSITY: Record<"default" | "compact", Density> = {
  default: {
    heading: "text-sm font-medium leading-none",
    help: "text-xs text-muted-foreground",
    choice: "text-sm",
    input: "h-9",
    chip: "text-xs",
  },
  compact: {
    heading: "text-xs font-medium leading-none",
    help: "text-[11px] text-muted-foreground",
    choice: "text-xs",
    input: "h-7 text-xs",
    chip: "text-[11px]",
  },
}

export function AllergenField({
  value,
  onChange,
  disabled = false,
  density = "default",
}: AllergenFieldProps) {
  const uid = useId()
  const style = DENSITY[density]
  const [draft, setDraft] = useState("")
  const { allergens, diets, unverified } = readAllergenSelection(value)

  const toggle = (allergen: Allergen) => {
    onChange(toggleAllergenValue(value, allergen))
  }

  const commitDraft = () => {
    if (disabled || !isDeclarableAllergenValue(draft)) return
    onChange(addAllergenValue(value, draft))
    setDraft("")
  }

  const renderChoice = (option: AllergenOption) => {
    const id = `${uid}-${option.allergen}`
    return (
      <div key={option.allergen} className="flex items-center space-x-2">
        <Checkbox
          id={id}
          checked={option.selected}
          onCheckedChange={() => toggle(option.allergen)}
          disabled={disabled}
        />
        <Label htmlFor={id} className={style.choice}>
          {option.label}
        </Label>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Annex II — the legal disclosure */}
      <div className="space-y-1.5">
        <p id={`${uid}-legal`} className={style.heading}>
          Allergènes à déclarer
        </p>
        <p className={style.help}>
          Le règlement INCO (UE) 1169/2011 impose de déclarer ces allergènes sur
          la carte.
        </p>
        <div
          role="group"
          aria-labelledby={`${uid}-legal`}
          className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3"
        >
          {allergens.map(renderChoice)}
        </div>
      </div>

      {/* Dietary markers — deliberately not presented as allergens */}
      <div className="space-y-1.5">
        <p id={`${uid}-diet`} className={style.heading}>
          Régimes alimentaires
        </p>
        <p className={style.help}>
          Ce ne sont pas des allergènes : ils décrivent le plat, ils ne signalent
          aucun risque.
        </p>
        <div
          role="group"
          aria-labelledby={`${uid}-diet`}
          className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3"
        >
          {diets.map(renderChoice)}
        </div>
      </div>

      {/* Free text — kept, and marked for what it is */}
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-custom`} className={style.choice}>
          Autre mention
        </Label>
        <p className={style.help}>
          Une mention absente des listes ci-dessus est conservée telle quelle,
          mais signalée comme non vérifiée : elle n&apos;est pas envoyée dans le
          champ allergènes d&apos;Uber Eats et s&apos;imprime à part sur le
          ticket de cuisine. Un nom reconnu coche directement la case
          correspondante.
        </p>
        <div className="flex items-center gap-2">
          <Input
            id={`${uid}-custom`}
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDraft(e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              // This field lives inside a <form>; Enter would submit the
              // product instead of adding the mention the owner just typed.
              if (e.key !== "Enter") return
              e.preventDefault()
              commitDraft()
            }}
            placeholder="ex : sarrasin"
            className={style.input}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={commitDraft}
            disabled={disabled || !isDeclarableAllergenValue(draft)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>

        {unverified.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {unverified.map((entry) => (
              <li key={entry.raw}>
                <Badge
                  variant="outline"
                  className={`gap-1.5 py-1 pr-1 font-normal ${style.chip}`}
                >
                  <span>{entry.raw}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    non vérifiée
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onChange(removeAllergenValue(value, entry.raw))}
                    disabled={disabled}
                    aria-label={`Retirer la mention ${entry.raw}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
