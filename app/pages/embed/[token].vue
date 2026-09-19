<template>
  <div class="embed-container">
    <div ref="mapEl" class="embed-map" />

    <div v-if="error" class="embed-error">
      <img :src="'/assets/logo.webp'" class="embed-error-logo" alt="Trailradar" />
      <p class="embed-error-msg">{{ errorMessage }}</p>
      <a href="https://trailradar.org" target="_blank" rel="noopener" class="embed-error-link">
        trailradar.org
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmbedTrail } from '~/server/routes/_embed/[token].get'
import { createMiniMap, type MiniMapHandle, type MiniMapInput, type MiniMapMarker, type MiniMapPolyline } from '~/map/miniMap'
import { shouldShowGpx } from '~/map/gpxZoomThreshold'
import { parseEmbedQuery, getRequestedSearch } from '~/utils/embedQuery'
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css'

definePageMeta({ layout: 'embed' })

const mapEl  = ref<HTMLElement | null>(null)
const error  = ref(false)
const errorMessage = ref('Dieser Embed ist für diese Domain nicht autorisiert.')

// Everything below is set up inside an async onMounted (after awaits for the
// _embed fetch and the mini-map's Leaflet dynamic import), where the
// component instance is no longer active — so onUnmounted can't be
// registered there. Own the teardown from synchronous setup instead: hand
// listeners the AbortController's signal, and destroy the map handle here.
const teardown = new AbortController()
let handle: MiniMapHandle | null = null
onUnmounted(() => {
  teardown.abort()
  handle?.destroy()
})

// Groups a spot's tracks / marker / parking into the neutral mini-map shape.
// Per-spot decision (matches the old inline behaviour): a spot past the GPX
// zoom threshold contributes its tracks; below it, its marker. Parking lots
// always contribute a marker. `p.id` stays the *spot* id so a polyline click
// opens the right trail page.
function toMiniMapInput(trails: EmbedTrail[], center: [number, number], zoom: number): MiniMapInput {
  const polylines: MiniMapPolyline[] = []
  const markers: MiniMapMarker[] = []

  for (const t of trails) {
    const hasGpx = t.gpx_trails.length > 0 || t.gpx_tours.length > 0
    if (shouldShowGpx(hasGpx, zoom)) {
      for (const tour of t.gpx_tours) {
        polylines.push({ id: t.id, kind: 'tour', name: tour.name, difficulty: null, points: tour.gpx_points })
      }
      for (const tr of t.gpx_trails) {
        polylines.push({ id: t.id, kind: 'trail', name: tr.name, difficulty: tr.difficulty || null, points: tr.gpx_points })
      }
    } else {
      markers.push({
        lat: t.latitude,
        lng: t.longitude,
        kind: 'spot',
        spotType: t.type,
        approved: t.approved ?? false,
        popupHtml: `<strong>${t.name}</strong><br><a href="https://trailradar.org/trails/${t.id}" target="_blank" rel="noopener">In Trailradar öffnen ↗</a>`,
      })
    }
    for (const lot of t.parking) {
      markers.push({ lat: lot.lat, lng: lot.lng, kind: 'parking', name: lot.name })
    }
  }

  return { center, zoom, polylines, markers }
}

onMounted(async () => {
  // /embed/[token] is a prerendered dynamic route. Once Nuxt's client-side
  // router takes over, it rewrites window.location to its own canonical
  // route URL — bare path, no trailing slash, no query string — and that
  // rewrite stands for the page's lifetime, not just a brief hydration
  // window. So window.location.search (read here or anywhere else) can't
  // be trusted for this route; getRequestedSearch() reads the Navigation
  // Timing entry instead, which reflects the real requested URL and is
  // never touched by that later History API rewrite.
  const token = useRoute().params.token as string
  const { lat, lng, zoom, parentHost, interactive } = parseEmbedQuery(getRequestedSearch())

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

  const openTrail = (p: MiniMapPolyline) =>
    window.open(`https://trailradar.org/trails/${p.id}`, '_blank', 'noopener')

  handle = await createMiniMap(mapEl.value, toMiniMapInput(trails, [lat, lng], zoom), {
    interactive,
    onPolylineActivate: openTrail,
    onTooltipAction: openTrail,
  })

  // Lets the parent page (app/pages/trails/[slug].vue) fly the map to a
  // trail/tour without reloading this iframe — reloading on every row click
  // flashes the tiles and loses pan/zoom state, unlike a real flyTo(). The
  // parent can now be cross-origin (the Capacitor native shell runs at
  // https://localhost and loads this iframe from https://trailradar.org), so
  // on top of event.source === window.parent we also allow-list the origin.
  const FLY_TO_ALLOWED_ORIGINS = ['https://trailradar.org', window.location.origin]
  function onFlyToMessage(event: MessageEvent) {
    if (event.source !== window.parent) return
    if (!FLY_TO_ALLOWED_ORIGINS.includes(event.origin)) return
    const data = event.data
    if (!data || data.type !== 'trailradar:flyTo') return
    const { lat: flyLat, lng: flyLng, zoom: flyZoom } = data
    if (typeof flyLat !== 'number' || typeof flyLng !== 'number') return
    handle?.flyTo(flyLat, flyLng, typeof flyZoom === 'number' ? flyZoom : undefined)
  }
  window.addEventListener('message', onFlyToMessage, { signal: teardown.signal })
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
