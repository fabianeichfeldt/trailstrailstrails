<template>
  <p v-if="!lots.length" class="spot-empty">Keine Parkplätze für diesen Spot.</p>
  <template v-else>
    <div
      v-for="lot in lots"
      :key="lot.id"
      class="spot-item parking-item"
      :class="{ active: lot.id === selectedId }"
      :data-id="lot.id"
      data-kind="parking"
      @click="select(lot)"
    >
      <div class="spot-item-left">
        <div class="parking-badge">P</div>
        <div class="spot-item-info">
          <div class="spot-item-name"><strong>{{ lot.name }}</strong></div>
          <div class="parking-hints">
            <div v-for="(line, i) in lot.info ?? []" :key="i" class="parking-hint">{{ line }}</div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import type { SpotParkingLot } from '~/communication/trails'

const props = defineProps<{
  lots: SpotParkingLot[]
  highlightId?: string
}>()

const emit = defineEmits<{ flyTo: [lat: number, lng: number] }>()

// Selection here is local to this component — parking lots aren't part of
// spotPanelStore's selectedItemId/selectedItemKind (that's Touren/Trails
// only). `highlightId` seeds it so a caller can still preselect a lot.
const selectedId = ref<string | undefined>(props.highlightId)

function select(lot: SpotParkingLot) {
  selectedId.value = lot.id
  emit('flyTo', lot.lat, lot.lng)
}
</script>
