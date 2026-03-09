/**
 * Segment filter builder
 *
 * Builds a predicate function from segment rules for client-side filtering.
 * Supports dot-notation field access, all operators, AND/OR combinations.
 *
 * The same logic runs server-side in emailSegments.countMatchingSubscribers.
 */

export type SegmentOperator =
  | "equals"
  | "not_equals"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "not_contains"
  | "before"
  | "after"
  | "in_last_days"

export type RuleOperator = "and" | "or"

export interface SegmentRule {
  id: string
  field: string
  operator: SegmentOperator
  value: string
}

/**
 * Get a nested value from an object using dot-notation path.
 * Example: getNestedValue(obj, "metadata.totalOrders") → obj.metadata.totalOrders
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

/**
 * Evaluate a single rule against a subscriber object.
 */
export function evaluateRule(
  subscriber: Record<string, unknown>,
  rule: SegmentRule
): boolean {
  const value = getNestedValue(subscriber, rule.field)
  const ruleValue = rule.value

  switch (rule.operator) {
    case "equals":
      return String(value) === ruleValue

    case "not_equals":
      return String(value) !== ruleValue

    case "gt":
      return Number(value) > Number(ruleValue)

    case "lt":
      return Number(value) < Number(ruleValue)

    case "gte":
      return Number(value) >= Number(ruleValue)

    case "lte":
      return Number(value) <= Number(ruleValue)

    case "contains":
      if (Array.isArray(value)) return value.includes(ruleValue)
      return String(value).toLowerCase().includes(ruleValue.toLowerCase())

    case "not_contains":
      if (Array.isArray(value)) return !value.includes(ruleValue)
      return !String(value).toLowerCase().includes(ruleValue.toLowerCase())

    case "before":
      return Number(value) < Number(ruleValue)

    case "after":
      return Number(value) > Number(ruleValue)

    case "in_last_days": {
      const days = Number(ruleValue)
      if (isNaN(days)) return false
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      return Number(value) >= cutoff
    }

    default:
      return false
  }
}

/**
 * Build a subscriber predicate from a list of rules and an operator.
 *
 * @param rules - Array of segment rules
 * @param ruleOperator - "and" = all rules must match, "or" = any rule must match
 * @returns A predicate function: (subscriber) => boolean
 */
export function buildSegmentFilter(
  rules: SegmentRule[],
  ruleOperator: RuleOperator
): (subscriber: Record<string, unknown>) => boolean {
  if (rules.length === 0) {
    // No rules = match all subscribers
    return () => true
  }

  return (subscriber: Record<string, unknown>): boolean => {
    const results = rules.map((rule) => evaluateRule(subscriber, rule))
    return ruleOperator === "and"
      ? results.every(Boolean)
      : results.some(Boolean)
  }
}
