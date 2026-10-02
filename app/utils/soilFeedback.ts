import type { ConditionIndex, ConditionRange } from '~/types/Weather'

export function sameRange(a: ConditionRange, b: ConditionRange): boolean {
  return a.lo === b.lo && a.hi === b.hi
}

/**
 * The scale's tap rules, as a pure function.
 *
 * - Tapping the lone selected segment again resets to the model's range.
 * - Tapping a segment outside the current selection extends it to include the
 *   segment — unless the selection is still the untouched model range, where
 *   the first tap replaces the estimate ("select alone") rather than growing it.
 * - Tapping a segment inside a multi-segment selection narrows to that segment
 *   alone (the spec is silent here; without it a range could only be shrunk by
 *   resetting).
 */
export function nextRange(
  current: ConditionRange,
  tapped: ConditionIndex,
  model: ConditionRange,
): ConditionRange {
  const lone = current.lo === current.hi
  if (lone && current.lo === tapped) return { lo: model.lo, hi: model.hi }

  const untouched = sameRange(current, model)
  const inside = tapped >= current.lo && tapped <= current.hi
  if (untouched || inside) return { lo: tapped, hi: tapped }

  return {
    lo: Math.min(current.lo, tapped) as ConditionIndex,
    hi: Math.max(current.hi, tapped) as ConditionIndex,
  }
}
