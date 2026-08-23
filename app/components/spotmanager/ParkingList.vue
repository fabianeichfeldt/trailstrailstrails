<template>
  <div class="parking-list">
    <div class="sm-section-header">
      <h3>Parkplätze <span class="sm-count">{{ lots.length }}</span></h3>
      <button class="sm-btn-add" @click="emit('create')">
        <i class="fas fa-plus" /> Parkplatz
      </button>
    </div>

    <p v-if="loading" class="sm-center-msg">Lade…</p>
    <p v-else-if="error" class="sm-center-msg sm-error">{{ error }}</p>

    <div v-else-if="lots.length === 0" class="sm-empty">
      Noch keine Parkplätze für diesen Spot. Füge einen hinzu, damit er auf der Karte und im Spot-Panel erscheint.
    </div>

    <div v-else class="parking-rows">
      <div v-for="lot in lots" :key="lot.id" class="parking-row" @click="emit('edit', lot)">
        <div class="parking-row-badge" v-html="badgeHtml" />
        <div class="parking-row-info">
          <strong>{{ lot.name }}</strong>
          <span class="parking-row-coords">{{ lot.lat.toFixed(5) }}, {{ lot.lng.toFixed(5) }}</span>
        </div>
        <button class="sm-btn-icon sm-btn-danger" title="Löschen" @click.stop="emit('delete', lot)">
          <i class="fas fa-trash" />
        </button>
        <span class="spot-item-arrow">›</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ParkingRow } from '~/spot_manager/Api'
import { parkingIconOptions } from '~/map/markerIcon'

defineProps<{
  lots: ParkingRow[]
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  create: []
  edit:   [lot: ParkingRow]
  delete: [lot: ParkingRow]
}>()

// Reuse the exact same badge icon rendered on the main map — no separate
// "list icon" is maintained.
const badgeHtml = parkingIconOptions().html
</script>

<style scoped>
.parking-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.parking-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.parking-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
  /* Comfortable touch target on mobile */
  min-height: 48px;
}
.parking-row:hover { border-color: #0d5db8; background: #f0f6ff; }

.parking-row-badge {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.parking-row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.parking-row-info strong {
  font-size: 13px;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.parking-row-coords {
  font-size: 11px;
  color: #999;
  font-family: monospace;
}

@media (max-width: 600px) {
  .parking-row { padding: 12px; }
}
</style>
