<template>
  <section v-if="details.rules && details.rules.length > 0" id="regeln" class="content-section card spot-detail-rules">
    <h2>Regeln</h2>
    <p v-for="(r, i) in details.rules" :key="i">{{ r }}</p>
  </section>
</template>

<script setup lang="ts">
import type { TrailDetails } from '~/types/TrailDetails'

// Split out of the former monolithic SpotDetailInfo.vue as its own
// top-level section, placed after Comments per the drastic-redesign order.
defineProps<{ details: TrailDetails }>()
</script>

<style scoped>
.spot-detail-rules p {
  color: #4a5568;
  font-size: 0.9em;
  line-height: 1.7;
  margin: 0 0 0.4em;
}
</style>
