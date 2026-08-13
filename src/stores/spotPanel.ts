import type { Trail } from '~/types/Trail'
import { fetchMultipleSpotParking, type SpotParkingLot } from '~/communication/trails'

// Phase 1 of the spotPanel.ts → Vue/Pinia migration (see
// docs/superpowers/specs/2026-08-13-spot-panel-vue-migration-design.md).
// Only the state/actions the Parking tab island actually needs are here —
// tabs/comments/tours/trails/elevation are added in later phases, not
// stubbed out ahead of time.
export const useSpotPanelStore = defineStore('spotPanel', () => {
  const currentItem = ref<Trail | null>(null)
  const isOpen = ref(false)

  const parkingLots = ref<SpotParkingLot[]>([])
  const highlightedParkingLotId = ref<string | null>(null)
  const parkingTabForceVisible = ref(false)

  /**
   * Direct port of the vanilla class's private loadParking()/renderParking()
   * pair — same call into fetchMultipleSpotParking, same guard against a
   * fetch resolving after the panel has already moved on to a different
   * spot (or closed).
   */
  async function loadParking(spotId: string) {
    try {
      const byId = await fetchMultipleSpotParking([spotId])
      if (currentItem.value?.id !== spotId) return
      parkingLots.value = byId.get(spotId) ?? []
    } catch (err) {
      console.warn('Failed to fetch spot parking data:', err)
    }
  }

  return {
    currentItem,
    isOpen,
    parkingLots,
    highlightedParkingLotId,
    parkingTabForceVisible,
    loadParking,
  }
})
