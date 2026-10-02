import { computed, onScopeDispose, ref } from 'vue'
import type { ConditionIndex, ConditionRange } from '~/types/Weather'
import { fetchTrailCondition } from '~/communication/weather'
import { submitSoilReport, type SoilReportFlag } from '~/communication/soilReports'
import { nextRange, sameRange } from '~/utils/soilFeedback'

export const DEBOUNCE_MS = 400
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export type SubmitState = 'idle' | 'sending' | 'done' | 'error'

/** `datetime-local` value (local time, minute precision) for a date. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * State of the soil-feedback sheet: the rider's range, the ride time, the
 * optional toggles, and submission.
 *
 * The token comes from the shared auth store (never a second auth state).
 * Changing the ride time re-asks `trail-condition` for that instant, debounced,
 * and the answer replaces the pre-filled range; submit stays disabled until it
 * lands. A stale answer (the picker moved on meanwhile) is dropped.
 */
export function useSoilFeedback(
  source: () => { spotType: string; spotId: string },
  initialModelRange: ConditionRange,
) {
  const auth = useAuthStore()

  // Window fixed when the sheet opens: `max` must not move under the rider's
  // finger, and the value we send is always <= the server's now.
  const openedAt = new Date()
  const minLocal = toLocalInput(new Date(openedAt.getTime() - WINDOW_MS))
  const maxLocal = toLocalInput(openedAt)

  const observedLocal = ref(maxLocal)
  const modelRange = ref<ConditionRange>({ ...initialModelRange })
  const range = ref<ConditionRange>({ ...initialModelRange })
  const snowFrost = ref(false)
  const raining = ref(false)

  const pending = ref(false)
  const loadFailed = ref(false)
  const noVerdict = ref(false)
  const state = ref<SubmitState>('idle')

  const changed = computed(
    () => !sameRange(range.value, modelRange.value) || snowFrost.value || raining.value,
  )
  const canSubmit = computed(
    () => state.value !== 'sending' && !pending.value && !loadFailed.value && !noVerdict.value,
  )

  function tap(index: ConditionIndex) {
    range.value = nextRange(range.value, index, modelRange.value)
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let seq = 0

  function observedIso(): string {
    return new Date(observedLocal.value).toISOString()
  }

  function setObservedLocal(value: string) {
    if (!value || Number.isNaN(new Date(value).getTime())) return
    observedLocal.value = value
    const mySeq = ++seq
    pending.value = true
    loadFailed.value = false
    clearTimeout(timer)
    timer = setTimeout(() => void refetch(mySeq), DEBOUNCE_MS)
  }

  async function refetch(mySeq: number) {
    const spot = source()
    const condition = await fetchTrailCondition(
      spot.spotType,
      spot.spotId,
      await auth.getToken(),
      undefined,
      observedIso(),
    )
    if (mySeq !== seq) return
    pending.value = false
    const next = condition?.verdict.range
    if (!condition) {
      loadFailed.value = true
      return
    }
    if (!next) {
      noVerdict.value = true
      return
    }
    noVerdict.value = false
    modelRange.value = { ...next }
    range.value = { ...next }
  }

  async function submit() {
    if (!canSubmit.value) return
    state.value = 'sending'
    const flags: SoilReportFlag[] = []
    if (snowFrost.value) flags.push('snow', 'frozen')
    if (raining.value) flags.push('raining')
    const spot = source()
    const result = await submitSoilReport(
      {
        spotType: spot.spotType,
        spotId: spot.spotId,
        observedAt: observedIso(),
        rangeLo: range.value.lo,
        rangeHi: range.value.hi,
        flags,
      },
      await auth.getToken(),
    )
    if (result.ok) {
      state.value = 'done'
      return
    }
    if (result.error === 'no_soil_verdict') noVerdict.value = true
    state.value = 'error'
  }

  onScopeDispose(() => {
    clearTimeout(timer)
    seq++
  })

  return {
    minLocal,
    maxLocal,
    observedLocal,
    setObservedLocal,
    modelRange,
    range,
    snowFrost,
    raining,
    changed,
    pending,
    loadFailed,
    noVerdict,
    canSubmit,
    state,
    tap,
    submit,
  }
}
