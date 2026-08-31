<template>
  <div class="trails-page">

    <!-- Region page -->
    <template v-if="isRegion">
      <section class="hero-region">
        <div class="hero-inner">
          <p class="hero-eyebrow">Offizielle MTB-Trails</p>
          <h1>Trails {{ region!.pronom }}</h1>
          <p class="hero-sub">Community-basiert · gepflegt · aktuell</p>
          <NuxtLink to="/map" class="btn-primary">Zur interaktiven Karte →</NuxtLink>
        </div>
      </section>

      <section class="map-section content-section region-map-section">
        <iframe
          v-if="regionEmbedSrc"
          :src="regionEmbedSrc"
          class="trail-map region-map"
          frameborder="0"
          loading="lazy"
          title="Trailradar Karte"
        />
      </section>

      <section v-if="region!.descr" class="region-descr content-section">
        <div class="prose" v-html="region!.descr" />
      </section>

      <section class="region-cta content-section">
        <div class="cta-box">
          <h2>Alle Trails auf einen Blick</h2>
          <p>Finde {{ region!.pronom }} und ganz Deutschland alle offiziellen Mountainbike-Trails auf unserer interaktiven Karte.</p>
          <NuxtLink to="/map" class="btn-primary">Karte öffnen</NuxtLink>
        </div>
      </section>

      <section class="other-regions content-section">
        <h2>Weitere Regionen</h2>
        <ul class="region-list">
          <li v-for="(r, key) in otherRegions" :key="key">
            <NuxtLink :to="`/trails/${key}`">Trails {{ r.pronom }}</NuxtLink>
          </li>
        </ul>
      </section>
    </template>

    <!-- Trail detail page -->
    <template v-else-if="trail && trailForStore">
      <SpotDetailHero :trail="trailForStore" />

      <SpotDetailStatus :details="details" />

      <SpotDetailPhotos
        :trail="trailForStore"
        :details="details"
        @uploaded="refreshDetails"
      />

      <SpotDetailNav :trail="trailForStore" :parking-count="spotPanelStore.parkingLots.length" />

      <!-- Touren/Trails/Parkplätze + the embedded map form one "explore"
           block: stacked list-then-map on mobile, side-by-side (map left,
           list right) from tablet width up — see .explore-grid below. -->
      <div class="explore-grid">
        <div class="explore-list">
          <section v-if="trailForStore.type === 'trail'" id="touren" class="content-section card">
            <h2>Touren</h2>
            <SpotPanelToursTab />
          </section>

          <section v-if="trailForStore.type === 'trail'" id="trails" class="content-section card">
            <h2>Trails</h2>
            <SpotPanelTrailsTab />
          </section>

          <section v-if="spotPanelStore.parkingLots.length" id="parking" class="content-section card">
            <h2>Parkplätze</h2>
            <SpotPanelParkingTab :lots="spotPanelStore.parkingLots" @fly-to="onParkingFlyTo" />
          </section>
        </div>

        <!-- Embedded map — token-scoped widget, same iframe pattern as
             before this rework (Decision 9: double-Leaflet-bundle cost
             accepted), now with panning/zooming enabled (interactive=1)
             since this is trailradar.org's own page, not a third-party
             embed. -->
        <div class="explore-map">
          <section class="map-section content-section">
            <iframe
              v-if="embedSrc"
              ref="mapIframeEl"
              :src="embedSrc"
              class="trail-map"
              frameborder="0"
              loading="lazy"
              title="Trailradar Karte"
            />
            <NuxtLink :to="`/map?trail=${trailForStore.id}`" class="map-all-trails-btn">Trailradar Karte</NuxtLink>
          </section>
        </div>
      </div>

      <SpotDetailDescription :trail="trailForStore" :details="details" />

      <section id="comments" class="content-section card">
        <h2>Kommentare</h2>
        <SpotPanelComments />
      </section>

      <SpotDetailRules :details="details" />

      <SpotDetailVideo :details="details" />

      <section class="bottom-cta content-section">
        <p class="bottom-cta-label">Alle offiziellen MTB-Trails auf einen Blick</p>
        <NuxtLink :to="mapFlyToHref" class="btn-bottom-cta">
          <IconSend class="btn-icon" />
          Auf Trailradar entdecken
        </NuxtLink>
        <p class="bottom-cta-sub">GPX-Tracks · Filter · Community-Updates</p>
      </section>
    </template>

    <!-- 404 -->
    <template v-else>
      <section class="not-found content-section">
        <h1>Nicht gefunden</h1>
        <p>Dieser Trail oder diese Region existiert nicht.</p>
        <NuxtLink to="/map" class="btn-primary">Zur Karte</NuxtLink>
      </section>
    </template>

    <ReportErrorModal />
  </div>
</template>

<script setup lang="ts">
import { regions } from '@@/build/region'
import IconSend from '~/assets/icons/send.svg'
import SpotDetailHero from '~/components/trail_detail/SpotDetailHero.vue'
import SpotDetailStatus from '~/components/trail_detail/SpotDetailStatus.vue'
import SpotDetailPhotos from '~/components/trail_detail/SpotDetailPhotos.vue'
import SpotDetailNav from '~/components/trail_detail/SpotDetailNav.vue'
import SpotDetailDescription from '~/components/trail_detail/SpotDetailDescription.vue'
import SpotDetailRules from '~/components/trail_detail/SpotDetailRules.vue'
import SpotDetailVideo from '~/components/trail_detail/SpotDetailVideo.vue'
import SpotPanelToursTab from '~/components/map/SpotPanelToursTab.vue'
import SpotPanelTrailsTab from '~/components/map/SpotPanelTrailsTab.vue'
import SpotPanelParkingTab from '~/components/map/SpotPanelParkingTab.vue'
import SpotPanelComments from '~/components/map/SpotPanelComments.vue'
import ReportErrorModal from '~/components/map/ReportErrorModal.vue'
import { bakedTrailDetails } from '~/utils/bakedTrailDetails'
import { getTrailDetails } from '~/communication/trails'
import { TrailDetails } from '~/types/TrailDetails'
import type { Trail } from '~/types/Trail'

const EMBED_TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4'
//const EMBED_BASE = 'https://trailradar.org'
const EMBED_BASE = ''
const route = useRoute()
const slug = route.params.slug as string
const region = regions[slug as keyof typeof regions] ?? null
const isRegion = !!region

// Trust the SSR-embedded payload for hydration (default getCachedData
// behavior) instead of forcing a redundant client refetch of identical
// data: with a forced refetch, Vue's hydration comparison runs against
// the still-pending state before that promise resolves, producing a
// spurious hydration mismatch even though the resolved value ends up
// identical to what the server already rendered. Live/dynamic fields
// (status, likes, GPX, parking) are already refreshed separately and
// safely post-mount, via refreshDetails() and spotPanelStore.load() below.
const { data: trail, refresh: refreshTrail } = await useAsyncData(`trail-${slug}`, async () => {
  if (isRegion) return null
  try {
    return await $fetch<Record<string, any>>(`/api/trail/${slug}`)
  } catch {
    return null
  }
})

const regionEmbedSrc = computed(() => {
  if (!region) return ''
  return `${EMBED_BASE}/embed/${EMBED_TOKEN}?lat=${region.lat}&lng=${region.lng}&zoom=${region.zoom}&parentHost=trailradar.org`
})

const otherRegions = computed(() =>
  Object.fromEntries(
    Object.entries(regions)
      .filter(([k]) => k !== slug)
      .slice(0, 12),
  ),
)

// ── Spot-detail data orchestration ──────────────────────────────────────
// `trailForStore` re-shapes the SSG-baked JSON (base trail fields + the
// trail_details row + type + photos — see server/api/trail/[id].get.ts)
// into the Trail-shaped object the (repurposed) spotPanel store and the new
// section components expect. `bakedDetails` seeds `details` below so the
// description/rules/photos/opening-hours sections render immediately from
// the prerendered payload — see app/utils/bakedTrailDetails.ts.
const trailForStore = computed<Trail | null>(() => (!isRegion && trail.value) ? (trail.value as unknown as Trail) : null)
const bakedDetails = computed(() => bakedTrailDetails(trail.value))

// "View on map" CTA (Decision 10): navigates to /map and flies/centers the
// camera on the spot's marker instead of reopening a panel on top —
// there's no panel any more, this page *is* the detail view now. map.vue
// reads `fly` and calls the live map's flyToPlace() once it's ready, the
// same pattern it already uses for `trail` (see onMapReady there).
const mapFlyToHref = computed(() => {
  if (!trailForStore.value) return '/map'
  return `/map?fly=${trailForStore.value.latitude},${trailForStore.value.longitude}`
})

const spotPanelStore = useSpotPanelStore()
const authStore = useAuthStore()
const supabaseUser = useSupabaseUser()

// interactive=1: unlike third-party embeds, this is trailradar.org's own
// page for this exact spot, so panning/zooming the map here can't hijack a
// host page's scroll the way a third-party iframe embed could.
const embedSrc = computed(() => {
  if (!trail.value) return ''
  return `${EMBED_BASE}/embed/${EMBED_TOKEN}?lat=${trail.value.latitude}&lng=${trail.value.longitude}&zoom=11&parentHost=trailradar.org&interactive=1`
})

// Clicking a Touren/Trails row (SpotPanelTrailsTab.vue/SpotPanelToursTab.vue)
// flies the embedded map to that trail instead of the spot's own marker.
// Center point: midpoint of the GPX track's start and end (not a centroid
// of every point) — a cheap, good-enough proxy for "where this trail is".
const selectedItemFocus = computed<{ lat: number; lng: number } | null>(() => {
  const { selectedItemId, selectedItemKind, data } = spotPanelStore
  if (!selectedItemId || !selectedItemKind || !data) return null
  const list = selectedItemKind === 'trail' ? data.trails : data.tours
  const item = list.find(i => i.id === selectedItemId)
  const points = item?.gpxPoints
  if (!points?.length) return null
  const [startLat, startLng] = points[0]
  const [endLat, endLng] = points[points.length - 1]
  return { lat: (startLat + endLat) / 2, lng: (startLng + endLng) / 2 }
})

// Reloading the iframe's `src` on every row click would work but reload the
// whole map (tile flash, lost pan/zoom state) — jarring compared to the
// live map's flyTo(). Posting a message instead lets the embed page's own
// Leaflet instance animate to the new view without a reload; see the
// `message` listener in app/pages/embed/[token].vue. Same-origin postMessage
// only (EMBED_BASE is a relative, same-origin path), so window.location.origin
// is a safe target.
const mapIframeEl = ref<HTMLIFrameElement | null>(null)
const FLY_TO_TRAIL_ZOOM = 14

function flyMapTo(lat: number, lng: number, zoom: number) {
  const win = mapIframeEl.value?.contentWindow
  if (!win) return
  win.postMessage({ type: 'trailradar:flyTo', lat, lng, zoom }, window.location.origin)
}

watch(selectedItemFocus, (focus) => {
  if (focus) {
    flyMapTo(focus.lat, focus.lng, FLY_TO_TRAIL_ZOOM)
  } else if (trailForStore.value) {
    flyMapTo(trailForStore.value.latitude, trailForStore.value.longitude, 11)
  }
})

// Clicking a Parkplätze row (SpotPanelParkingTab.vue) flies the embedded
// map to that lot, same as clicking a Touren/Trails row.
function onParkingFlyTo(lat: number, lng: number) {
  flyMapTo(lat, lng, FLY_TO_TRAIL_ZOOM)
}

// `details` (trail_details row: status/rules/description/photos/videos/
// likes) is owned here rather than by any single section component, since
// it now feeds several sibling sections (SpotDetailStatus, SpotDetailPhotos,
// SpotDetailDescription, SpotDetailRules, SpotDetailVideo) instead of one
// monolithic card. Seeded from the SSG-baked payload so content renders
// immediately (SEO-safe, no loading flash); onMounted() below then kicks
// off a live getTrailDetails() refresh for the genuinely dynamic bits that
// aren't in the static payload at all: status_hint freshness and likes.
const details = ref<TrailDetails>(bakedDetails.value)

async function updateLikeButton(d: TrailDetails) {
  try {
    const user = { id: supabaseUser.value?.id ?? '' }
    spotPanelStore.isLiked = !!user.id && !!d.likes?.find(l => l.user_id === user.id)
  } catch {
    spotPanelStore.isLiked = false
  }
  spotPanelStore.likeVisible = true
}

async function refreshDetails() {
  const item = trailForStore.value
  if (!item) return
  const id = item.id
  try {
    const d = await getTrailDetails(item)
    if (trailForStore.value?.id !== id) return // spot moved on while the fetch was in flight
    await updateLikeButton(d)
    details.value = d
  } catch (e) {
    console.warn('Failed to refresh live trail details, keeping prerendered content:', e)
  }
}

// spotPanelStore.load()/loadComments() do real network fetches — onMounted
// never fires during SSR/prerender, so this is inherently client-only (see
// CLAUDE.md's "No live Nitro server in production"); no extra guard needed.
function loadLiveSpotData(item: Trail) {
  spotPanelStore.load(item)
  spotPanelStore.loadComments(item.id, {
    userId: supabaseUser.value?.id ?? '',
    isAdmin: authStore.isAdmin,
    isTrailcrew: authStore.isTrailcrew,
  })
}

onMounted(async () => {
  // Runs after hydration completes, not during it: safe to let this update
  // `trail` reactively (a normal post-mount re-render, not a hydration
  // comparison) even if it resolves to something different than SSR got.
  // clearNuxtData() is required, not cosmetic: calling refreshTrail() alone
  // is a silent no-op here — Nuxt still treats the SSR-time promise for
  // this key as satisfying the request and skips a real refetch unless the
  // cached entry is explicitly cleared first (confirmed by direct
  // reproduction against a mocked endpoint).
  if (!isRegion) {
    clearNuxtData(`trail-${slug}`)
    await refreshTrail()
  }
  if (trailForStore.value) {
    loadLiveSpotData(trailForStore.value)
    refreshDetails()
  }
})

// Client-side navigation to a different spot's page (e.g. via search)
// reuses this page's component instance — reload for the new spot.
watch(
  () => trailForStore.value?.id,
  (id, oldId) => {
    if (!id || id === oldId || !trailForStore.value) return
    details.value = bakedDetails.value
    loadLiveSpotData(trailForStore.value)
    refreshDetails()
  },
)

const pageTitle = isRegion
  ? `Offizielle MTB Trails ${region!.pronom}`
  : trail.value
    ? trail.value.name
    : 'Trail'

const pageDescription = isRegion
  ? `Finde offizielle Mountainbike Trails ${region!.pronom}. Community-basiert und aktuell.`
  : trail.value?.trail_description
    || (trail.value ? `${trail.value.name} – offizieller MTB-Trail auf Trailradar.` : '')

const ogImage = trail.value?.photos?.[0]?.url ?? 'https://trailradar.org/assets/hero-desktop.webp'

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogUrl: `https://trailradar.org/trails/${slug}/`,
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
  ogType: 'website',
  ogImage: isRegion ? 'https://trailradar.org/assets/hero-desktop.webp' : ogImage,
})

useHead({
  link: [{ rel: 'canonical', href: `https://trailradar.org/trails/${slug}/` }],
  script: trail.value && !isRegion
    ? [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SportsActivityLocation',
            name: trail.value.name,
            description: pageDescription,
            sport: 'Mountainbiking',
            geo: {
              '@type': 'GeoCoordinates',
              latitude: trail.value.latitude,
              longitude: trail.value.longitude,
            },
            url: `https://trailradar.org/trails/${slug}/`,
            ...(trail.value.photos?.[0]?.url ? { image: trail.value.photos[0].url } : {}),
          }),
        },
      ]
    : [],
})
</script>

<style scoped>
.trails-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1em 4em;
  background: #fff;
  color: #1a2035;
  min-height: 100vh;
}

/* ── Region hero ── */
.hero-region {
  background: linear-gradient(135deg, #1b7a4a, #2a9d5c);
  color: white;
  border-radius: 0 0 1.2em 1.2em;
  padding: 3em 2em 2.5em;
  margin: 0 -1em 2em;
  text-align: center;
}

.hero-eyebrow {
  font-size: 0.72em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.8;
  margin: 0 0 0.4em;
  font-weight: 600;
}

.hero-region h1 {
  font-size: 2em;
  font-weight: 700;
  margin: 0 0 0.3em;
}

.hero-sub {
  font-size: 0.85em;
  opacity: 0.85;
  margin: 0 0 1.5em;
}

/* ── Trail hero ── */
.trail-hero {
  padding: 1.8em 0 0.6em;
}

.trail-hero .hero-eyebrow {
  color: #2a9d5c;
  opacity: 1;
}

.trail-hero h1 {
  font-size: clamp(1.6em, 5vw, 2.4em);
  font-weight: 800;
  color: #1a2035;
  margin: 0.1em 0 0;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

/* ── Shared icon size ── */
.btn-icon { width: 15px; height: 15px; flex-shrink: 0; }

/* ── Trail hero button ── */
.btn-discover {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  margin-top: 1em;
  background: #1a2035;
  color: #fff;
  font-weight: 700;
  font-size: 0.9em;
  padding: 0.7em 1.5em;
  border-radius: 2em;
  text-decoration: none;
  transition: background 0.15s, transform 0.15s;
  box-shadow: 0 2px 10px rgba(0,0,0,0.18);
}
.btn-discover:hover { background: #2a3550; transform: translateY(-1px); }

/* ── Bottom CTA ── */
.bottom-cta {
  text-align: center;
  background: linear-gradient(135deg, #1b7a4a, #2a9d5c);
  border-radius: 14px;
  padding: 2.2em 1.5em 2em;
  margin-top: 0.5em;
}
.bottom-cta-label {
  color: rgba(255,255,255,0.85);
  font-size: 0.82em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 1em;
}
.btn-bottom-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.55em;
  background: #fff;
  color: #1b7a4a;
  font-weight: 800;
  font-size: 1.05em;
  padding: 0.8em 2em;
  border-radius: 2em;
  text-decoration: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  transition: transform 0.15s, box-shadow 0.15s;
}
.btn-bottom-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.25); }
.bottom-cta-sub {
  color: rgba(255,255,255,0.65);
  font-size: 0.75em;
  margin: 0.9em 0 0;
}

/* ── Buttons ── */
.btn-primary {
  display: inline-block;
  background: #2a9d5c;
  color: white;
  font-weight: 600;
  font-size: 0.85em;
  padding: 0.6em 1.4em;
  border-radius: 2em;
  text-decoration: none;
  transition: background 0.15s, transform 0.15s;
  box-shadow: 0 2px 8px rgba(42,157,92,0.25);
}
.btn-primary:hover { background: #239052; transform: translateY(-1px); }

/* ── Map section ── */
.map-section {
  position: relative;
  margin-left: -1em;
  margin-right: -1em;
}

.trail-map {
  width: 100%;
  height: 420px;
  background: #e8f0e8;
  display: block;
  isolation: isolate;
}

.map-all-trails-btn {
  position: absolute;
  top: 0.8em;
  right: 0.8em;
  z-index: 2;
  background: #1a2035;
  color: #fff;
  font-size: 0.78em;
  font-weight: 600;
  padding: 0.5em 1em;
  border-radius: 2em;
  text-decoration: none;
  box-shadow: 0 2px 10px rgba(0,0,0,0.25);
  transition: background 0.15s, transform 0.15s;
}
.map-all-trails-btn:hover {
  background: #2a3550;
  transform: translateY(-1px);
}

/* ── Explore block (Touren/Trails/Parkplätze + map) ──
   Mobile: list sections stacked above the map (Touren → Trails →
   Parkplätze → Map). From tablet width up: side-by-side, map on the left,
   list on the right, map pinned while the list scrolls past it. */
.explore-grid {
  display: flex;
  flex-direction: column;
  gap: 1.2em;
}
.explore-list {
  display: flex;
  flex-direction: column;
  gap: 1.2em;
}
.explore-list .content-section {
  margin-bottom: 0;
}

@media (min-width: 900px) {
  .explore-grid {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    grid-template-areas: "map list";
    align-items: start;
    gap: 1.4em;
  }
  /* Grid tracks default to a min-width based on their content's min-content
     size, not the fr fraction — the list's nowrap stat/name spans were
     inflating this column past its 1fr share and squeezing the map column
     narrower than intended. min-width: 0 lets the fr ratio actually apply;
     long content wraps instead of forcing the track wider. */
  .explore-list { grid-area: list; min-width: 0; }
  .explore-map {
    grid-area: map;
    position: sticky;
    top: 4.6em;
  }
  .explore-map .map-section {
    margin-left: 0;
    margin-right: 0;
  }
  .explore-map .trail-map {
    height: 520px;
  }
}

/* ── Cards ── */
.card {
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 12px;
  padding: 1.4em 1.6em;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}

/* ── Content sections ── */
.content-section {
  margin-bottom: 1.2em;
}

.content-section h2 {
  font-size: 0.78em;
  font-weight: 700;
  color: #8a96a8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 0.8em;
}

.section-label {
  font-size: 0.78em;
  font-weight: 700;
  color: #8a96a8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 0.8em;
}

/* ── Prose (region descr) ── */
.prose { line-height: 1.7; color: #4a5568; font-size: 0.9em; }
.prose :deep(h2) { font-size: 1.1em; margin: 1.2em 0 0.4em; color: #1a2035; font-weight: 700; }
.prose :deep(h3) { font-size: 1em; margin: 1em 0 0.3em; color: #2a9d5c; }
.prose :deep(strong) { color: #1a2035; }
.prose :deep(ul), .prose :deep(ol) { padding-left: 1.4em; }
.prose :deep(li) { margin-bottom: 0.3em; }
.prose :deep(p) { margin: 0.6em 0; }

/* ── CTA box ── */
.cta-box {
  background: #f0faf5;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 1.5em 2em;
  text-align: center;
}
.cta-box h2 { color: #166534; margin: 0 0 0.5em; font-size: 1em; text-transform: none; letter-spacing: 0; color: #1a2035; font-weight: 700; }
.cta-box p { color: #4a5568; font-size: 0.84em; margin: 0 0 1em; }

/* ── Other regions ── */
.other-regions h2 { font-size: 0.78em; font-weight: 700; color: #8a96a8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.8em; }
.region-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
}
.region-list a {
  display: inline-block;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 2em;
  padding: 0.3em 0.8em;
  font-size: 0.75em;
  color: #2a9d5c;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}
.region-list a:hover { background: #f0faf5; border-color: #bbf7d0; }

/* ── Description ── */
.trail-descr p {
  line-height: 1.7;
  color: #4a5568;
  font-size: 0.9em;
  margin: 0;
}

/* ── Rules ── */
.rules-list {
  padding-left: 1.4em;
  line-height: 1.8;
  color: #4a5568;
  font-size: 0.88em;
  margin: 0;
}

/* ── Photos ── */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.7em;
}
.photo-grid img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e4e9f0;
}

/* ── Info table ── */
.info-list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5em 1.5em;
  font-size: 0.85em;
  margin: 0;
}
.info-list > div { display: contents; }
.info-list dt { color: #8a96a8; font-weight: 600; }
.info-list dd { color: #1a2035; margin: 0; }

/* ── 404 ── */
.not-found {
  text-align: center;
  padding: 4em 1em;
}
.not-found h1 { color: #8a96a8; font-size: 1.5em; }
.not-found p { color: #8a96a8; margin-bottom: 1.5em; font-size: 0.9em; }

.region-map {
  height: 480px;
}

/* ── Responsive ── */
@media (min-width: 600px) {
  .map-section {
    margin-left: 0;
    margin-right: 0;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid #e4e9f0;
    box-shadow: 0 2px 16px rgba(0,0,0,0.08);
  }

  .region-map {
    height: 540px;
  }
}
</style>
