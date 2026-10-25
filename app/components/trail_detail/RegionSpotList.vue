<template>
  <section v-if="spots.length" class="region-spots content-section">
    <h2>{{ heading }}</h2>
    <ul class="region-spot-list">
      <li v-for="s in spots" :key="s.slug">
        <NuxtLink :to="canonicalPath(`/trails/${s.slug}`)" class="region-spot-link">
          <span class="region-spot-name">{{ s.name }}</span>
          <span class="region-spot-meta">
            {{ SPOT_TYPES[s.type].label }}
            <span v-if="s.approved" class="region-spot-badge">offiziell</span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { SPOT_TYPES } from '~/types/SpotTypes'
import { canonicalPath } from '~/utils/seo'
import type { RegionSpot } from '@@/build/regionSpots'

defineProps<{ spots: RegionSpot[]; heading: string }>()
</script>

<style scoped>
.region-spot-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5em;
}
.region-spot-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8em;
  min-height: 44px;
  padding: 0.5em 0.9em;
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 10px;
  color: #1a2035;
  text-decoration: none;
}
.region-spot-link:hover { background: #f0faf5; border-color: #bbf7d0; }
.region-spot-name { font-weight: 600; font-size: 0.9em; }
.region-spot-meta { display: flex; align-items: center; gap: 0.5em; font-size: 0.78em; color: #8a96a8; white-space: nowrap; }
.region-spot-badge {
  background: #e7f7ee;
  color: #1b7a4a;
  border-radius: 2em;
  padding: 0.15em 0.65em;
  font-weight: 600;
}
@media (min-width: 700px) {
  .region-spot-list { grid-template-columns: 1fr 1fr; }
}
</style>
