<template>
  <p v-if="!lots.length" class="spot-empty">Keine Parkplätze für diesen Spot.</p>
  <template v-else>
    <div
      v-for="lot in lots"
      :key="lot.id"
      class="spot-item parking-item"
      :class="{ active: lot.id === highlightId }"
      :data-id="lot.id"
      data-kind="parking"
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

defineProps<{
  lots: SpotParkingLot[]
  highlightId?: string
}>()
</script>
