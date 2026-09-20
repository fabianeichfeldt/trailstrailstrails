<template>
  <section class="map-teaser-section">
    <!-- The positioned ancestor for the searchbar. It carries the sizing the
         old whole-teaser <NuxtLink> had, so the bar is measured against the
         teaser rather than against the full-bleed section. -->
    <div class="map-teaser-wrap">
      <div class="map-teaser">
        <!-- Fake browser chrome -->
        <div class="map-chrome">
          <div class="chrome-dots">
            <span /><span /><span />
          </div>
          <div class="chrome-bar">trailradar.org/map</div>
        </div>
        <!-- Map preview using OSM tiles as background -->
        <div class="map-preview">
          <!-- Colored marker blobs mimicking real markers -->
          <div class="marker marker-blue" style="top:28%;left:44%" />
          <div class="marker marker-blue" style="top:18%;left:26%" />
          <div class="marker marker-green" style="top:38%;left:58%" />
          <div class="marker marker-green" style="top:55%;left:37%" />
          <div class="marker marker-pink" style="top:45%;left:22%" />
          <div class="marker marker-blue" style="top:62%;left:50%" />
          <div class="marker marker-cluster" style="top:35%;left:17%">3</div>
          <div class="marker marker-cluster" style="top:68%;left:32%">2</div>
          <!-- CTA overlay — this is the link now. Clicking anywhere on the
               preview still goes to /map; only the chrome bar stopped being
               clickable, which is invisible to users. -->
          <NuxtLink to="/map" class="map-cta-overlay" aria-label="Zur interaktiven Karte">
            <span class="map-cta-btn">Zur Karte →</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Sibling of .map-teaser, not a child: .map-teaser is overflow:hidden,
           which would clip the results dropdown after ~two rows.
           The slot is a zero-height box aligned with the top edge of
           .map-preview, so the bar lands exactly where the old dummy pill sat
           — SearchBar's teaser variant only knows "10px below my containing
           block", it must not know about the fake browser chrome. -->
      <div class="teaser-search-slot">
        <SearchBar variant="teaser" @open-trail="onOpenTrail" @fly-to="onFlyTo" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import SearchBar from '~/components/map/SearchBar.vue'

// SearchBar is emit-only; the landing page's answer to "a result was picked"
// is to navigate to the map, where ?trail= / ?fly= are already handled in
// map.vue's onMapReady.
const router = useRouter()

function onOpenTrail(id: string) {
  router.push(`/map?trail=${id}`)
}

function onFlyTo(lat: number, lon: number) {
  router.push(`/map?fly=${lat},${lon}`)
}
</script>

<style scoped>
/* ── Map teaser ── */
.map-teaser-section {
  padding: 2.5rem 1rem;
  background: var(--color-page-bg, #0e0f10);
  display: flex;
  justify-content: center;
}
.map-teaser-wrap {
  /* Positioned ancestor for the searchbar slot. Percentage widths inside it
     are measured against the teaser, not against the full-bleed section. */
  position: relative;
  max-width: 780px;
  width: 100%;
  /* Pinned rather than content-derived so the slot below can line up with the
     preview's top edge without depending on the chrome bar's font metrics. */
  --map-chrome-height: 36px;
}

/* Zero-height, so it never intercepts a click meant for the CTA overlay. */
.teaser-search-slot {
  position: absolute;
  top: var(--map-chrome-height);
  left: 0;
  right: 0;
  height: 0;
}
.map-teaser {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.55);
  transition: transform 0.2s, box-shadow 0.2s;
}
.map-teaser:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 50px rgba(0,0,0,0.65);
}

/* Browser chrome bar */
.map-chrome {
  background: #2a2a2a;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  height: var(--map-chrome-height);
}
.chrome-dots { display: flex; gap: 5px; }
.chrome-dots span {
  width: 11px; height: 11px; border-radius: 50%;
  background: #555;
}
.chrome-dots span:nth-child(1) { background: #ff5f57; }
.chrome-dots span:nth-child(2) { background: #febc2e; }
.chrome-dots span:nth-child(3) { background: #28c840; }
.chrome-bar {
  flex: 1; background: #3a3a3a; border-radius: 5px;
  font-size: 0.7rem; color: #aaa; padding: 3px 10px; text-align: center;
}

/* Map preview area */
.map-preview {
  position: relative;
  height: 340px;
  background:
    url('/assets/map1.webp') -120px -80px / 512px 512px no-repeat,
    url('/assets/map2.webp') 392px -80px / 512px 512px no-repeat,
    #e8f0e8;
  overflow: hidden;
}

/* Markers */
.marker {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.marker::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  top: 5px;
  left: 5px;
}
.marker-blue { background: var(--color-trail, #3b82f6); }
.marker-green { background: var(--color-bikepark, #10b981); }
.marker-pink { background: #b91094; }
.marker-cluster {
  border-radius: 50%;
  transform: none;
  width: 26px;
  height: 26px;
  background: #10b981;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}
.marker-cluster::after { display: none; }

/* CTA overlay */
.map-cta-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  text-decoration: none;
  z-index: 3;
}
.map-teaser:hover .map-cta-overlay { background: rgba(0,0,0,0.18); }
.map-cta-btn {
  background: #00b347;
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.8rem 2.2rem;
  border-radius: 10px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.35);
  pointer-events: none;
}
</style>
