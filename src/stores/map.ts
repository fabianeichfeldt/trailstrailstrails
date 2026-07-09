export const useMapStore = defineStore('map', () => {
  // Currently selected trail/park — drives the side panel
  const activeTrailId = ref<string | null>(null)
  const panelOpen = ref(false)

  // User's GPS position from the browser Geolocation API
  const userLocation = ref<[number, number] | null>(null)

  // UI overlay visibility
  const authModalOpen = ref(false)
  const drawerOpen = ref(false)

  // Report-an-error modal — triggered from the vanilla-JS map layer via
  // the injected Auth adapter's openReportModal(), same mechanism as authModalOpen
  const reportModalOpen = ref(false)
  const reportModalTrailId = ref<string | null>(null)
  const reportModalTrailName = ref<string | null>(null)

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
    reportModalOpen,
    reportModalTrailId,
    reportModalTrailName,
    openTrail,
    closePanel,
  }
})
