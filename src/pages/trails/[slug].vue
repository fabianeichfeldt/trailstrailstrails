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
    <template v-else-if="trail">
      <section class="trail-hero">
        <p class="hero-eyebrow">{{ typeLabel }}</p>
        <h1>{{ trail.name }}</h1>
        <NuxtLink :to="`/map?trail=${slug}`" class="btn-discover">
          <IconSend class="btn-icon" />
          Trailradar-Karte öffnen
        </NuxtLink>
      </section>

      <!-- Map CTA -->
      <section class="map-section content-section">
        <iframe
          v-if="embedSrc"
          :src="embedSrc"
          class="trail-map"
          frameborder="0"
          loading="lazy"
          title="Trailradar Karte"
        />
        <NuxtLink :to="`/map?trail=${slug}`" class="map-cta-overlay">
          <div class="map-cta-inner">
            <IconSend class="btn-icon" />
            Auf der Karte entdecken
          </div>
        </NuxtLink>
      </section>

      <section v-if="trail.trail_description || trail.description" class="trail-descr content-section card">
        <h2>Beschreibung</h2>
        <p>{{ trail.trail_description || trail.description }}</p>
      </section>

      <section v-if="trail.rules && trail.rules.length" class="trail-rules content-section card">
        <h2>Regeln & Hinweise</h2>
        <ul class="rules-list">
          <li v-for="(rule, i) in trail.rules" :key="i">{{ rule }}</li>
        </ul>
      </section>

      <section v-if="trail.photos && trail.photos.length" class="trail-photos content-section">
        <h2 class="section-label">Fotos</h2>
        <div class="photo-grid">
          <img v-for="photo in trail.photos" :key="photo.id" :src="photo.url" :alt="trail.name" loading="lazy" />
        </div>
      </section>

      <section class="trail-info content-section card">
        <h2>Infos</h2>
        <dl class="info-list">
          <div v-if="trail.opening_hours">
            <dt>Öffnungszeiten</dt>
            <dd>{{ trail.opening_hours }}</dd>
          </div>
          <div>
            <dt>Koordinaten</dt>
            <dd>{{ trail.latitude?.toFixed(5) }}, {{ trail.longitude?.toFixed(5) }}</dd>
          </div>
        </dl>
      </section>

      <section class="bottom-cta content-section">
        <p class="bottom-cta-label">Alle offiziellen MTB-Trails auf einen Blick</p>
        <NuxtLink :to="`/map?trail=${slug}`" class="btn-bottom-cta">
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

  </div>
</template>

<script setup lang="ts">
import { regions } from '~/build/region'
import IconSend from '~/assets/icons/send.svg'

const EMBED_TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4'
//const EMBED_BASE = 'https://trailradar.org'
const EMBED_BASE = ''
const route = useRoute()
const slug = route.params.slug as string
const region = regions[slug as keyof typeof regions] ?? null
const isRegion = !!region

const { data: trail } = await useAsyncData(`trail-${slug}`, async () => {
  if (isRegion) return null
  try {
    return await $fetch<Record<string, any>>(`/api/trail/${slug}`)
  } catch {
    return null
  }
})

const embedSrc = computed(() => {
  if (!trail.value) return ''
  return `${EMBED_BASE}/embed/${EMBED_TOKEN}?lat=${trail.value.latitude}&lng=${trail.value.longitude}&zoom=11&parentHost=trailradar.org`
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

const typeLabel = computed(() => {
  const t = trail.value?.type
  if (t === 'bikepark') return 'Bikepark'
  if (t === 'dirtpark') return 'Dirtpark / Pumptrack'
  return 'Trail'
})

const statusColor = computed(() => {
  const s = trail.value?.status
  if (s === 'open') return 'green'
  if (s === 'closed') return 'red'
  if (s === 'limited') return 'orange'
  return 'gray'
})

const statusLabel = computed(() => {
  const s = trail.value?.status
  if (s === 'open') return 'Geöffnet'
  if (s === 'closed') return 'Geschlossen'
  if (s === 'limited') return 'Eingeschränkt'
  return 'Unbekannt'
})

const accessLabel = computed(() => {
  const a = trail.value?.access_type
  if (a === 'free') return 'Kostenlos'
  if (a === 'paid') return 'Kostenpflichtig'
  if (a === 'membership') return 'Mitgliedschaft'
  return a
})

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
  max-width: 860px;
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

.map-cta-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 2em;
  background: linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.52) 100%);
  text-decoration: none;
  transition: background 0.2s;
  cursor: pointer;
}
.map-cta-overlay:hover {
  background: linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.38) 100%);
}

.map-cta-inner {
  display: inline-flex;
  align-items: center;
  gap: 0.55em;
  background: #2a9d5c;
  color: white;
  font-weight: 700;
  font-size: 1rem;
  padding: 0.8em 2em;
  border-radius: 2em;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  transition: transform 0.15s, background 0.15s, box-shadow 0.15s;
  letter-spacing: 0.01em;
}
.map-cta-overlay:hover .map-cta-inner {
  transform: translateY(-3px);
  background: #239052;
  box-shadow: 0 8px 32px rgba(0,0,0,0.45);
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
