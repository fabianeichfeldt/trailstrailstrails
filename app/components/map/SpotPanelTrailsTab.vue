<template>
  <p v-if="!trails.length" class="spot-empty">Keine Trails für diesen Spot.</p>
  <template v-else>
    <template v-for="t in trails" :key="t.id">
      <div
        class="spot-item"
        :class="rowClass(t)"
        :data-id="t.id"
        data-kind="trail"
        @click="select(t.id)"
      >
        <div class="spot-item-left">
          <span class="imba-dot" :style="{ background: IMBA[t.difficulty].hex }" :title="IMBA[t.difficulty].label"></span>
          <div class="spot-item-info">
            <div class="spot-item-name">
              <strong>{{ t.name }}</strong>
              <span v-if="statusOf(t).state === 'closed'" class="trail-status-tag trail-status-tag-closed">Gesperrt</span>
              <span v-else-if="statusOf(t).state === 'closing_soon'" class="trail-status-tag trail-status-tag-hint">Hinweis</span>
              <a
                v-if="t.gpx_url"
                class="spot-item-dl"
                :href="t.gpx_url"
                :download="`${t.name}.gpx`"
                aria-label="GPX herunterladen"
                @click.stop
              ><i class="fas fa-download"></i></a>
            </div>
            <span class="spot-item-sub">
              {{ IMBA[t.difficulty].label }}
            </span>
          </div>
        </div>
        <div class="spot-item-right">
          <div class="spot-item-stats-prominent">
            <span class="stat-distance">{{ formatDistanceMeters(t.distance_km) }}</span>
            <span class="stat-elevation">
              <span class="stat-up">↑{{ t.elevation_gain }}m</span>
              <span class="stat-down">↓{{ t.elevation_loss }}m</span>
            </span>
          </div>
          <span class="spot-item-arrow">›</span>
        </div>
      </div>
      <!-- Mounted right after its own row, not after the whole list — see
           spotPanel.ts's `data`/`selectedItemId` comment. -->
      <SpotPanelElevation
        v-if="isActive(t.id)"
        :on-hover="noop"
        :on-hover-end="noop"
      />
    </template>
  </template>
</template>

<script setup lang="ts">
import type { MtbTrail } from '~/types/MtbTypes'
import { IMBA } from '~/map/spot_panel/elevationSvg'
import { deriveTrailStatus, type TrailStatusResult } from '~/types/TrailStatus'
import { formatDistanceMeters } from '~/utils/formatDistance'
import SpotPanelElevation from '~/components/map/SpotPanelElevation.vue'

// Elevation-hover-highlights-map-marker is dropped on the routed spot-detail
// page (app/pages/trails/[slug].vue) — there's no live interactive map here
// to target, only a read-only embed iframe. SpotPanelElevation keeps the
// callback props anyway so it doesn't need to know that; this is the only
// caller, and it always passes no-ops.
function noop() {}

const store = useSpotPanelStore()

const trails = computed<MtbTrail[]>(() => store.data?.trails ?? [])

function statusOf(t: MtbTrail): TrailStatusResult {
  return deriveTrailStatus({ closed_from: t.closed_from, closed_to: t.closed_to, hint: t.hint }, new Date())
}

function rowClass(t: MtbTrail): Record<string, boolean> {
  const state = statusOf(t).state
  return {
    active: isActive(t.id),
    'trail-status-row-closed': state === 'closed',
    'trail-status-row-hint': state === 'closing_soon',
  }
}

function isActive(id: string): boolean {
  return store.selectedItemId === id && store.selectedItemKind === 'trail'
}

function select(id: string) {
  store.selectItem(id, 'trail')
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
  font-size: 0.85em;
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
