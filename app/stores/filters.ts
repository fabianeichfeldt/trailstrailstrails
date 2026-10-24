import type { Trail } from '~/types/Trail'
import { SPOT_TYPES, isSpotType } from '~/types/SpotTypes'

const GRAYSCALE_KEY = 'map-grayscale'

// Default on; only an explicit stored "0" turns it off. Storage can throw (private mode, blocked data).
function readGrayscalePref(): boolean {
  try {
    return localStorage.getItem(GRAYSCALE_KEY) !== '0'
  } catch {
    return true
  }
}

export const useFiltersStore = defineStore('filters', () => {
  const showTrails = ref(true)
  const showBikeparks = ref(true)
  const showDirtparks = ref(true)
  const showPumptracks = ref(true)
  const useCluster = ref(true)
  const grayscaleMap = ref(readGrayscalePref())

  watch(grayscaleMap, (on) => {
    try {
      localStorage.setItem(GRAYSCALE_KEY, on ? '1' : '0')
    } catch { /* preference just won't persist */ }
  })

  // Applied on top of the raw trails list — used by the map composable
  function apply(items: Trail[]): Trail[] {
    const flags = { showTrails, showBikeparks, showDirtparks, showPumptracks }
    return items.filter(t => {
      if (!isSpotType(t.type)) return true
      const def = SPOT_TYPES[t.type]
      const key = def.pumptrackFilterKey && (t as { pumptrack?: boolean }).pumptrack ? def.pumptrackFilterKey : def.filterKey
      return flags[key].value
    })
  }

  return { showTrails, showBikeparks, showDirtparks, showPumptracks, useCluster, grayscaleMap, apply }
})
