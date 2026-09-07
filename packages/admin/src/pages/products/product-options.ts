/**
 * The arithmetic behind a product's option groups, as pure functions.
 *
 * WHY PURE, AND WHY SEPARATE FROM THE COMPONENT: the same reason
 * `allergen-selection.ts` gives. `packages/admin` has no jsdom
 * (`vitest.config.ts` runs in `node`), so the control itself is untestable
 * here; splitting the array work out is what makes it provable.
 *
 * WHAT WENT WRONG, AND WHY IT NEEDED A TEST
 * -----------------------------------------
 * `addChoice` in `product-form.tsx` used to read:
 *
 *     const currentOptions = [...(options || [])]
 *     const option = currentOptions[optionIndex]
 *     option.choices.push(newChoice)
 *     setValue("options", currentOptions)
 *
 * The spread copies the *array*. Its elements are the very objects
 * react-hook-form is already holding, so `option.choices.push()` changed the
 * stored value before `setValue` was told anything had changed — leaving
 * `setValue` to compare a value against itself. The choice lands in form state
 * and no input is guaranteed to render for it, which is a button that visibly
 * does nothing.
 *
 * `addOption` never had the problem, because it only ever builds new objects.
 * That asymmetry is why "should add a new option group" passed everywhere while
 * "should add choices to an option" failed in the client template's CI on
 * 07/09/2026 — three attempts, on a run that was not sharded.
 *
 * So: every function here returns new objects along the path it changed, leaves
 * everything else identical by reference, and never touches its input. The
 * tests assert all three.
 */

/** The shape these functions need. The full option type lives in the form's schema. */
type OptionWithChoices<Choice> = { choices: Choice[] }

/**
 * `options` with `choice` appended to the group at `optionIndex`.
 *
 * Returns the input untouched when the index names no group, so a caller can
 * skip the write entirely.
 */
export function addChoiceAt<Choice, Option extends OptionWithChoices<Choice>>(
  options: readonly Option[],
  optionIndex: number,
  choice: Choice
): Option[] {
  if (!options[optionIndex]) return options as Option[]

  return options.map((current, index) =>
    index === optionIndex
      ? { ...current, choices: [...current.choices, choice] }
      : current
  )
}

/**
 * `options` without the choice at `choiceIndex` of the group at `optionIndex`.
 *
 * Returns the input untouched when either index names nothing.
 */
export function removeChoiceAt<Choice, Option extends OptionWithChoices<Choice>>(
  options: readonly Option[],
  optionIndex: number,
  choiceIndex: number
): Option[] {
  const option = options[optionIndex]
  if (!option || !option.choices[choiceIndex]) return options as Option[]

  return options.map((current, index) =>
    index === optionIndex
      ? { ...current, choices: current.choices.filter((_, i) => i !== choiceIndex) }
      : current
  )
}
