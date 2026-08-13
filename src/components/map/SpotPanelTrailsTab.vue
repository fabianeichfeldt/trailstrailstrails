<template>
  <p v-if="!trails.length" class="spot-empty">Keine Trails für diesen Spot.</p>
  <template v-else>
    <div
      v-for="t in trails"
      :key="t.id"
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
          <span class="spot-item-sub">{{ IMBA[t.difficulty].label }}</span>
        </div>
      </div>
      <div class="spot-item-right">
        <div class="spot-item-stats">
          <span>📍 {{ t.distance_km }} km</span>
          <span>↑{{ t.elevation_gain }}m &nbsp;↓{{ t.elevation_loss }}m</span>
          <span class="direction-tag">{{ DIR_LABEL[t.direction] }}</span>
        </div>
        <span class="spot-item-arrow">›</span>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import type { MtbTrail } from '~/types/MtbTypes'
import { IMBA } from '~/map/spot_panel/elevationSvg'
import { DIR_LABEL } from '~/map/spot_panel/spotPanelHtml'
import { deriveTrailStatus, type TrailStatusResult } from '~/types/TrailStatus'

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
