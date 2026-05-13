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
        <div class="hero-inner">
          <p class="hero-eyebrow">{{ typeLabel }}</p>
          <h1>{{ trail.name }}</h1>
          <div class="trail-badges">
            <span v-if="trail.approved" class="badge badge-green">Offiziell</span>
            <span v-else class="badge badge-gray">Nicht verifiziert</span>
            <span v-if="trail.status" :class="`badge badge-${statusColor}`">{{ statusLabel }}</span>
          </div>
          <NuxtLink :to="`/map?trail=${slug}`" class="btn-primary">In Karte öffnen →</NuxtLink>
        </div>
      </section>

      <section v-if="trail.trail_description || trail.description" class="trail-descr content-section">
        <h2>Beschreibung</h2>
        <p>{{ trail.trail_description || trail.description }}</p>
      </section>

      <section v-if="trail.rules && trail.rules.length" class="trail-rules content-section">
        <h2>Regeln & Hinweise</h2>
        <ul class="rules-list">
          <li v-for="(rule, i) in trail.rules" :key="i">{{ rule }}</li>
        </ul>
      </section>

      <section v-if="trail.photos && trail.photos.length" class="trail-photos content-section">
        <h2>Fotos</h2>
        <div class="photo-grid">
          <img v-for="photo in trail.photos" :key="photo.id" :src="photo.url" :alt="trail.name" loading="lazy" />
        </div>
      </section>

      <section class="trail-info content-section">
        <h2>Infos</h2>
        <dl class="info-list">
          <div v-if="trail.access_type">
            <dt>Zugang</dt>
            <dd>{{ accessLabel }}</dd>
          </div>
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
  ? `Offizielle MTB Trails ${region!.pronom} | Trailradar`
  : trail.value
    ? `${trail.value.name} – Trailradar`
    : 'Trail – Trailradar'

const pageDescription = isRegion
  ? `Finde offizielle Mountainbike Trails ${region!.pronom}. Community-basiert und aktuell.`
  : trail.value?.trail_description
    || (trail.value ? `${trail.value.name} – offizieller MTB-Trail auf Trailradar.` : '')

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogUrl: `https://trailradar.org/trails/${slug}/`,
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})

// Redirect human visitors to the map with the trail open.
// onMounted is client-only; Google crawls the static SSG HTML before any JS runs.
onMounted(() => {
  if (!isRegion && trail.value) {
    navigateTo(`/map?trail=${slug}`, { replace: true })
  }
})

useHead({
  link: [{ rel: 'canonical', href: `https://trailradar.org/trails/${slug}/` }],
  script: trail.value
    ? [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: trail.value.name,
            description: pageDescription,
            geo: {
              '@type': 'GeoCoordinates',
              latitude: trail.value.latitude,
              longitude: trail.value.longitude,
            },
            url: `https://trailradar.org/trails/${slug}/`,
          }),
        },
      ]
    : [],
})
</script>

<style scoped>
.trails-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 1em 4em;
}

.hero-region,
.trail-hero {
  background: linear-gradient(135deg, #1a3a5c, #2b6cb0);
  color: white;
  border-radius: 0 0 1.2em 1.2em;
  padding: 3em 2em 2.5em;
  margin: 0 -1em 2em;
  text-align: center;
}

.hero-eyebrow {
  font-size: 0.75em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.75;
  margin: 0 0 0.4em;
}

.hero-region h1,
.trail-hero h1 {
  font-size: 2em;
  font-weight: 700;
  margin: 0 0 0.3em;
}

.hero-sub {
  font-size: 0.85em;
  opacity: 0.8;
  margin: 0 0 1.5em;
}

.btn-primary {
  display: inline-block;
  background: white;
  color: #2b6cb0;
  font-weight: 600;
  font-size: 0.85em;
  padding: 0.6em 1.4em;
  border-radius: 2em;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.25); }

.trail-badges {
  display: flex;
  gap: 0.5em;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1.2em;
}

.badge {
  font-size: 0.7em;
  font-weight: 600;
  padding: 0.25em 0.7em;
  border-radius: 2em;
}
.badge-green { background: #c6f6d5; color: #276749; }
.badge-red { background: #fed7d7; color: #9b2c2c; }
.badge-orange { background: #feebc8; color: #975a16; }
.badge-gray { background: #e2e8f0; color: #4a5568; }

.content-section {
  margin-bottom: 2em;
}

.prose { line-height: 1.7; color: #333; }
.prose :deep(h2) { font-size: 1.2em; margin: 1.2em 0 0.4em; color: #1a3a5c; }
.prose :deep(h3) { font-size: 1em; margin: 1em 0 0.3em; color: #2b6cb0; }
.prose :deep(strong) { color: #1a3a5c; }
.prose :deep(ul), .prose :deep(ol) { padding-left: 1.4em; }
.prose :deep(li) { margin-bottom: 0.3em; }
.prose :deep(p) { margin: 0.6em 0; }

.cta-box {
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  border-radius: 0.8em;
  padding: 1.5em 2em;
  text-align: center;
}
.cta-box h2 { color: #2b6cb0; margin: 0 0 0.5em; font-size: 1.2em; }
.cta-box p { color: #4a5568; font-size: 0.85em; margin: 0 0 1em; }

.other-regions h2 { font-size: 1em; color: #666; margin-bottom: 0.8em; }
.region-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
}
.region-list a {
  display: inline-block;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 2em;
  padding: 0.3em 0.8em;
  font-size: 0.75em;
  color: #2b6cb0;
  text-decoration: none;
  transition: background 0.15s;
}
.region-list a:hover { background: #ebf8ff; }

.trail-descr p {
  line-height: 1.7;
  color: #444;
}

.rules-list {
  padding-left: 1.4em;
  line-height: 1.8;
  color: #444;
  font-size: 0.9em;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.8em;
}
.photo-grid img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 0.5em;
}

.info-list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.3em 1.5em;
  font-size: 0.85em;
}
.info-list > div { display: contents; }
.info-list dt { color: #666; font-weight: 600; }
.info-list dd { color: #333; margin: 0; }

.not-found {
  text-align: center;
  padding: 4em 1em;
}
.not-found h1 { color: #666; }
.not-found p { color: #888; margin-bottom: 1.5em; }
</style>
