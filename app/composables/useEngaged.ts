import { ref, onScopeDispose } from 'vue'
import { hasEngaged, onEngaged } from '~/analytics/track'

/** Reactive "this visit has fired `engaged`" (in memory per page load, like the event itself). */
export function useEngaged() {
  const engaged = ref(hasEngaged())
  const off = onEngaged(() => { engaged.value = true })
  onScopeDispose(off)
  return engaged
}
