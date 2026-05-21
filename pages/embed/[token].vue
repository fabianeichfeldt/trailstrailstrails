<template>
  <div class="embed-container">
    <div ref="mapEl" class="embed-map" />

    <div v-if="error" class="embed-error">
      <img src="/assets/logo.webp" class="embed-error-logo" alt="Trailradar" />
      <p class="embed-error-msg">{{ errorMessage }}</p>
      <a href="https://trailradar.org" target="_blank" rel="noopener" class="embed-error-link">
        trailradar.org
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmbedTrail } from '~/server/routes/_embed/[token].get'
import { markerIconOptions } from '~/src/map/markerIcon'
import {
  DIFF_COLOR,
  computeTrailStats, trailTooltipHtml, placeholderDesc,
  positionTooltip, createTooltipEl,
} from '~/src/map/trailTooltip'

definePageMeta({ layout: 'embed' })

const route  = useRoute()
const mapEl  = ref<HTMLElement | null>(null)
const error  = ref(false)
const errorMessage = ref('Dieser Embed ist für diese Domain nicht autorisiert.')

const token      = route.params.token as string
const lat        = parseFloat(route.query.lat        as string) || 47.8
const lng        = parseFloat(route.query.lng        as string) || 13.0
const zoom       = parseInt(route.query.zoom         as string) || 10
const parentHost = (route.query.parentHost as string) || ''

onMounted(async () => {
  let trails: EmbedTrail[] = []

  try {
    const qs = parentHost ? `?parentHost=${encodeURIComponent(parentHost)}` : ''
    const res = await fetch(`/_embed/${encodeURIComponent(token)}${qs}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg: Record<string, string> = {
        HOST_NOT_ALLOWED: 'Dieser Embed ist für diese Domain nicht autorisiert.',
        TOKEN_NOT_FOUND:  'Ungültiger Embed-Token.',
        TOKEN_INACTIVE:   'Dieser Embed wurde deaktiviert.',
      }
      errorMessage.value = msg[body.statusMessage] ?? 'Embed konnte nicht geladen werden.'
      error.value = true
      return
    }
    trails = await res.json()
  } catch {
    errorMessage.value = 'Embed konnte nicht geladen werden.'
    error.value = true
    return
  }

  if (!mapEl.value) return

  const L = (await import('leaflet')).default

  const map = L.map(mapEl.value, { zoomControl: false })
  map.setView([lat, lng], zoom)
  map.setMaxZoom(19)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  // Shared elevation tooltip element
  const tooltipEl = createTooltipEl(map.getContainer())
  const containerW = () => map.getContainer().clientWidth

  function showPolylineTooltip(name: string, difficulty: string | null, points: [number, number, number][], e: any) {
    const stats = computeTrailStats(points)
    const desc  = difficulty ? placeholderDesc(difficulty) : 'Eine abwechslungsreiche Tour durch die Trailanlage.'
    tooltipEl.innerHTML = trailTooltipHtml(name, difficulty, desc, stats)
    positionTooltip(tooltipEl, e.containerPoint.x, e.containerPoint.y, containerW())
  }

  // Tooltip hide is delayed so the mouse can move from the line to the card
  // and click "Spot öffnen" without the card vanishing in between.
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleHide() {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { tooltipEl.style.display = 'none' }, 800)
  }
  function cancelHide() { if (hideTimer) clearTimeout(hideTimer) }
  tooltipEl.addEventListener('mouseenter', cancelHide)
  tooltipEl.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none' })

  let touchHideTimer: ReturnType<typeof setTimeout> | null = null

  // Bind hover/touch tooltip events to a hit-area polyline.
  function addPolylineWithTooltip(
    latlngs: [number, number][],
    visibleOpts: any,
    name: string,
    difficulty: string | null,
    points: [number, number, number][],
    openUrl: string,
  ) {
    L.polyline(latlngs, { ...visibleOpts, interactive: false }).addTo(map)
    const hit = L.polyline(latlngs, { weight: 20, opacity: 0.001, color: '#000' }).addTo(map)

    function show(e: { containerPoint: { x: number; y: number } }) {
      showPolylineTooltip(name, difficulty, points, e)
      // Bind "Spot öffnen" button to open trail page in new tab
      tooltipEl.querySelector('.ttr-open')?.addEventListener('click', (ev) => {
        ev.stopPropagation()
        window.open(openUrl, '_blank', 'noopener')
      }, { once: true })
    }

    hit.on('mouseover', (e: any) => { cancelHide(); show(e) })
    hit.on('mousemove', (e: any) => positionTooltip(tooltipEl, e.containerPoint.x, e.containerPoint.y, containerW()))
    hit.on('mouseout',  scheduleHide)
    hit.on('touchstart', (e: any) => {
      if (touchHideTimer) clearTimeout(touchHideTimer)
      const touch = e.originalEvent.touches[0]
      const rect  = map.getContainer().getBoundingClientRect()
      show({ containerPoint: { x: touch.clientX - rect.left, y: touch.clientY - rect.top } })
      touchHideTimer = setTimeout(() => { tooltipEl.style.display = 'none' }, 3000)
    }, { passive: true })
  }

  for (const trail of trails) {
    const appUrl = `https://trailradar.org/trails/${trail.id}`
    const popup  = `<strong>${trail.name}</strong><br><a href="${appUrl}" target="_blank" rel="noopener">In Trailradar öffnen ↗</a>`
    const hasGpx = trail.gpx_trails.length > 0 || trail.gpx_tours.length > 0

    // Tours added first — their SVG elements sit below trails.
    // Trails added second — their hit areas are on top when stacked.
    for (const t of trail.gpx_tours) {
      const latlngs = t.gpx_points.map(([la, ln]) => [la, ln] as [number, number])
      addPolylineWithTooltip(
        latlngs,
        { color: '#555', weight: 3, opacity: 0.6, dashArray: '8, 6' },
        t.name, null, t.gpx_points, appUrl,
      )
    }

    for (const t of trail.gpx_trails) {
      const latlngs = t.gpx_points.map(([la, ln]) => [la, ln] as [number, number])
      addPolylineWithTooltip(
        latlngs,
        { color: DIFF_COLOR[t.difficulty] ?? '#888', weight: 4, opacity: 0.85 },
        t.name, t.difficulty, t.gpx_points, appUrl,
      )
    }

    // Spot marker — always shown (acts as the clickable "open in app" entry point)
    // When GPX is present this anchors the spot; when absent it's the only indicator.
    const icon = L.divIcon(markerIconOptions(trail.type, trail.approved ?? false))
    L.marker([trail.latitude, trail.longitude], { icon, opacity: hasGpx ? 0.7 : 1 })
      .addTo(map)
      .bindPopup(popup)
  }
})
</script>

<style scoped>
.embed-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.embed-map {
  width: 100%;
  height: 100%;
}

.embed-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #f5f5f5;
  font-family: system-ui, sans-serif;
  text-align: center;
  padding: 24px;
}

.embed-error-logo {
  height: 40px;
  opacity: 0.6;
}

.embed-error-msg {
  font-size: 14px;
  color: #555;
  max-width: 280px;
}

.embed-error-link {
  font-size: 13px;
  color: #1b4332;
  text-decoration: none;
  opacity: 0.7;
}
</style>
