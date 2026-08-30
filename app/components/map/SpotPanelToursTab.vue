<template>
  <p v-if="!tours.length" class="spot-empty">Keine Touren für diesen Spot.</p>
  <template v-else>
    <div
      v-for="t in tours"
      :key="t.id"
      class="spot-item"
      :class="{ active: isActive(t.id) }"
      :data-id="t.id"
      data-kind="tour"
      @click="select(t.id)"
    >
      <div class="spot-item-left">
        <div class="imba-dots">
          <span
            v-for="d in tourDifficulties(t)"
            :key="d"
            class="imba-dot"
            :style="{ background: IMBA[d].hex }"
            :title="IMBA[d].label"
          ></span>
        </div>
        <div class="spot-item-info">
          <div class="spot-item-name">
            <strong>{{ t.name }}</strong>
            <a
              v-if="t.gpx_url"
              class="spot-item-dl"
              :href="t.gpx_url"
              :download="`${t.name}.gpx`"
              aria-label="GPX herunterladen"
              @click.stop
            ><i class="fas fa-download"></i></a>
          </div>
          <span class="spot-item-sub">{{ t.trailCount }} Trails · {{ t.duration_minutes }} min</span>
        </div>
      </div>
      <div class="spot-item-right">
        <div class="spot-item-stats-prominent">
          <span class="stat-distance">{{ t.distance_km }} km</span>
          <span class="stat-elevation">
            <span class="stat-up">↑{{ t.elevation_gain }}m</span>
            <span class="stat-down">↓{{ t.elevation_loss }}m</span>
          </span>
        </div>
        <span class="spot-item-arrow">›</span>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import type { ImbaColor, MtbTour } from '~/types/MtbTypes'
import { IMBA } from '~/map/spot_panel/elevationSvg'

// Row selection writes straight to the store; useTrailMap.ts watches
// selectedItemId/selectedItemKind to drive Leaflet polyline/tour-segment
// rendering, and SpotPanelElevation.vue reads them for the elevation panel.
const store = useSpotPanelStore()

const tours = computed<MtbTour[]>(() => store.data?.tours ?? [])

function isActive(id: string): boolean {
  return store.selectedItemId === id && store.selectedItemKind === 'tour'
}

function tourDifficulties(tour: MtbTour): ImbaColor[] {
  const seen = new Set<ImbaColor>()
  const result: ImbaColor[] = []
  for (const seg of tour.segments) {
    if (seg.type !== 'trail' || !seg.difficulty) continue
    if (seen.has(seg.difficulty)) continue
    seen.add(seg.difficulty)
    result.push(seg.difficulty)
  }
  return result
}

function select(id: string) {
  store.selectItem(id, 'tour')
}
</script>

<style scoped>
.spot-item-stats-prominent {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}
.stat-distance {
  font-size: 1em;
  font-weight: 800;
  color: #1a2035;
  white-space: nowrap;
}
.stat-elevation {
  display: flex;
  gap: 6px;
  font-size: 0.74em;
  font-weight: 700;
  white-space: nowrap;
}
.stat-up { color: #2a9d5c; }
.stat-down { color: #c53030; }
</style>
