import { describe, it, expect } from "vitest"
import {
  addChoiceAt,
  removeChoiceAt,
} from "../pages/products/product-options"

/**
 * The defect these pin is not "the wrong choices came back" — the old code
 * produced the right *contents*. It mutated the caller's objects on the way,
 * so react-hook-form's stored value changed before `setValue` was told, and
 * the re-render that shows the new row was no longer guaranteed.
 *
 * So the assertions that matter here are about identity, not contents: what
 * must be new, what must be untouched, and what must stay the same object so
 * an unrelated group does not re-render.
 */

type Choice = { id: string; name: string; priceModifier: number }
type Option = { id: string; name: string; required: boolean; choices: Choice[] }

const fixture = (): Option[] => [
  {
    id: "opt_1",
    name: "Taille",
    required: true,
    choices: [{ id: "c_1", name: "Petite", priceModifier: 0 }],
  },
  { id: "opt_2", name: "Sauce", required: false, choices: [] },
]

const NEW_CHOICE: Choice = { id: "c_new", name: "", priceModifier: 0 }

describe("addChoiceAt", () => {
  it("appends the choice to the named group", () => {
    const next = addChoiceAt(fixture(), 0, NEW_CHOICE)

    expect(next[0]!.choices.map((c) => c.id)).toEqual(["c_1", "c_new"])
    expect(next[1]!.choices).toEqual([])
  })

  it("leaves the input array and every object in it untouched", () => {
    const before = fixture()
    const snapshot = structuredClone(before)

    addChoiceAt(before, 0, NEW_CHOICE)

    // This is the assertion the old implementation failed: it pushed onto
    // `before[0].choices`, so the caller's value had already changed.
    expect(before).toEqual(snapshot)
  })

  it("returns new objects along the path it changed", () => {
    const before = fixture()
    const next = addChoiceAt(before, 0, NEW_CHOICE)

    expect(next).not.toBe(before)
    expect(next[0]).not.toBe(before[0])
    expect(next[0]!.choices).not.toBe(before[0]!.choices)
  })

  it("keeps untouched groups identical by reference", () => {
    const before = fixture()
    const next = addChoiceAt(before, 0, NEW_CHOICE)

    // Not merely equal — the same object, so nothing downstream re-renders for
    // a group that did not change.
    expect(next[1]).toBe(before[1])
  })

  it("returns the input unchanged when the index names no group", () => {
    const before = fixture()

    expect(addChoiceAt(before, 7, NEW_CHOICE)).toBe(before)
    expect(addChoiceAt(before, -1, NEW_CHOICE)).toBe(before)
  })
})

describe("removeChoiceAt", () => {
  it("drops the named choice and only that one", () => {
    const before: Option[] = [
      {
        id: "opt_1",
        name: "Taille",
        required: true,
        choices: [
          { id: "c_1", name: "Petite", priceModifier: 0 },
          { id: "c_2", name: "Grande", priceModifier: 2 },
        ],
      },
    ]

    expect(removeChoiceAt(before, 0, 0)[0]!.choices.map((c) => c.id)).toEqual([
      "c_2",
    ])
  })

  it("leaves the input array and every object in it untouched", () => {
    const before = fixture()
    const snapshot = structuredClone(before)

    removeChoiceAt(before, 0, 0)

    expect(before).toEqual(snapshot)
  })

  it("returns new objects along the path it changed", () => {
    const before = fixture()
    const next = removeChoiceAt(before, 0, 0)

    expect(next).not.toBe(before)
    expect(next[0]).not.toBe(before[0])
    expect(next[0]!.choices).not.toBe(before[0]!.choices)
    expect(next[1]).toBe(before[1])
  })

  it("returns the input unchanged when either index names nothing", () => {
    const before = fixture()

    expect(removeChoiceAt(before, 7, 0)).toBe(before)
    expect(removeChoiceAt(before, 0, 7)).toBe(before)
    // Group 2 exists but holds no choices at all.
    expect(removeChoiceAt(before, 1, 0)).toBe(before)
  })
})
