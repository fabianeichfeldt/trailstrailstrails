export const useMapStore = defineStore('map', () => {
  // Currently selected trail/park — drives the side panel
  const activeTrailId = ref<string | null>(null)
  const panelOpen = ref(false)

  // User's GPS position from the browser Geolocation API
  const userLocation = ref<[number, number] | null>(null)

  // UI overlay visibility
  const authModalOpen = ref(false)
  const drawerOpen = ref(false)

  function openTrail(id: string) {
    activeTrailId.value = id
    panelOpen.value = true
  }

  function closePanel() {
    activeTrailId.value = null
    panelOpen.value = false
  }

  return {
    activeTrailId,
    panelOpen,
    userLocation,
    authModalOpen,
    drawerOpen,
    openTrail,
    closePanel,
  }
})
