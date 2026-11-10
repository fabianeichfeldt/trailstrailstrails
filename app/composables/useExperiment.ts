import { computed } from 'vue'
import type { Assignment } from '~/analytics/experiments'

/** Variant for experiment `id`; null on SSR/prerender and when it isn't active, so callers render control. */
export function useExperiment(id: string) {
  const assignment = useState<Assignment | null>('experimentAssignment', () => null)
  return computed(() => (assignment.value?.experimentId === id ? assignment.value.variant : null))
}
