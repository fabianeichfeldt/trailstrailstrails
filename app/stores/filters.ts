import type { Trail } from '~/types/Trail'
import { SPOT_TYPES } from '~/types/SpotTypes'
import type { ConditionLevel } from '~/types/Weather'
import { levelToAxis } from '~/types/SoilMap'

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
      const def = SPOT_TYPES[t.type]
      if (!def) return true
      const key = def.pumptrackFilterKey && (t as { pumptrack?: boolean }).pumptrack ? def.pumptrackFilterKey : def.filterKey
      return flags[key].value
    })
  }

  // 'none' = no soil verdict; the caller shows those only while the range is the full 0..4
  function soilMatch(level: ConditionLevel | undefined, range: { lo: number; hi: number }): 'match' | 'ghost' | 'none' {
    const axis = levelToAxis(level)
    if (axis === null) return 'none'
    return axis >= range.lo && axis <= range.hi ? 'match' : 'ghost'
  }

  return { showTrails, showBikeparks, showDirtparks, showPumptracks, useCluster, grayscaleMap, apply, soilMatch }
})
