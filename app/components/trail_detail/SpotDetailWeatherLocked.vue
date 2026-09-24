<template>
  <!-- Same skeleton as the real card — label above, card below — so the page does
       not jump when access resolves. -->
  <section class="content-section spot-detail-weather" data-testid="weather-locked">
    <div class="section-label">{{ FEATURES.trail_condition.label }}</div>

    <div class="wx-locked">
      <!-- The real card, fed a fixed good-weather sample and blurred. Decoration
           only, and made up: hidden from assistive technology so a screen reader
           never announces "Hero Dirt" as this spot's verdict, and inert so nothing
           in it can be focused or clicked. -->
      <div class="wx-sample-wrap" aria-hidden="true" inert>
        <SpotDetailWeather :trail="SAMPLE_TRAIL" :weather="sample" :loading="false" sample />
      </div>

      <!-- No purchase button on purpose: there is no billing flow to send anyone
           to yet, and a dead "Upgrade" link is worse than none. -->
      <div class="wx-lock">
        <div class="wx-lock-pill">
          <span class="wx-lock-icon" aria-hidden="true">🔒</span>
          <strong>{{ FEATURES.trail_condition.label }} ist eine {{ plan }}-Funktion</strong>
          <span class="wx-lock-hint">
            Bodenzustand und Wetter-Vorschau für jeden Spot — hier eine Beispielansicht.
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Trail } from '~/types/Trail'
import { FEATURES, minPlanName } from '~/entitlements/features'
import { sampleSpotWeather } from '~/utils/sampleWeather'
import SpotDetailWeather from '~/components/trail_detail/SpotDetailWeather.vue'

// Derived from the registry rather than typed here, so moving the feature to
// another tier changes this card with it.
const plan = minPlanName('trail_condition')

// Built once, locally: no request, and nothing about the spot in it. This card
// only ever renders after mount (access is "checking" while prerendering), so a
// date-relative sample cannot mismatch the static HTML.
const sample = sampleSpotWeather(new Date())
const SAMPLE_TRAIL = { type: 'trail', id: 'sample', name: 'Beispiel' } as Trail
</script>

<style scoped>
/* Frames the blurred sample like a real card. The blur bleeds at its edges, so
   the border has to belong to this wrapper, not to the sample inside it. */
.wx-locked {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e9f0;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}

.wx-sample-wrap {
  /* Soft enough that the colours, icons and bar chart clearly read as "a weather
     card" — the sample is made up, so how legible its small text gets is not a
     concern. 4px: one step less than the first version's 5px, on request. */
  filter: blur(4px);
  pointer-events: none;
  user-select: none;
}
/* The label lives outside the blur, and the sample's own frame would double the
   wrapper's — so both are stripped from the sample. */
.wx-sample-wrap :deep(.content-section) {
  margin-bottom: 0;
}
.wx-sample-wrap :deep(.section-label) {
  display: none;
}
.wx-sample-wrap :deep(.card) {
  border-color: transparent;
  box-shadow: none;
}

.wx-lock {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.8em;
}
/* A small solid pill rather than a wash over the whole card: the sample's
   colours stay visible around it, and the hint is fully readable. */
.wx-lock-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  max-width: 30em;
  padding: 0.85em 1.3em;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e4e9f0;
  border-radius: 12px;
  box-shadow: 0 4px 18px rgba(26, 32, 53, 0.12);
}
.wx-lock-icon {
  font-size: 24px;
  line-height: 1;
}
.wx-lock-pill strong {
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.25;
  color: #1a2035;
}
.wx-lock-hint {
  font-size: 12.5px;
  line-height: 1.45;
  color: #4a5568;
}
</style>
