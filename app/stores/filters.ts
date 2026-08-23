import type { Trail } from '~/types/Trail'

export const useFiltersStore = defineStore('filters', () => {
  const showTrails = ref(true)
  const showBikeparks = ref(true)
  const showDirtparks = ref(true)
  const showPumptracks = ref(true)
  const useCluster = ref(true)

  // Applied on top of the raw trails list — used by the map composable
  function apply(items: Trail[]): Trail[] {
    return items.filter(t => {
      if (t.type === 'trail') return showTrails.value
      if (t.type === 'bikepark') return showBikeparks.value
      if (t.type === 'dirtpark') {
        const d = t as import('~/types/Trail').DirtPark
        if (d.pumptrack) return showPumptracks.value
        return showDirtparks.value
      }
      return true
    })
  }

  return { showTrails, showBikeparks, showDirtparks, showPumptracks, useCluster, apply }
})
