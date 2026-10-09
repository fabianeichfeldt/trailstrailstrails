<template>
  <Transition name="intro">
    <div
      v-if="show"
      class="soil-intro"
      role="dialog"
      aria-labelledby="soil-intro-title"
      aria-describedby="soil-intro-text"
      data-testid="soil-intro"
      @keydown.esc="emit('dismiss')"
    >
      <button type="button" class="close" aria-label="Hinweis schließen" data-testid="soil-intro-close" @click="emit('dismiss')">×</button>
      <span class="tag">Neu · {{ FEATURES.soil_radar.label }}</span>
      <h2 id="soil-intro-title">Wo fährt's sich heute am besten?</h2>
      <p id="soil-intro-text">
        Der {{ FEATURES.soil_radar.label }} legt den Bodenzustand aller Spots über die Karte – berechnet aus
        Regen der letzten Tage, aktuellem Wetter und Bodenart.
      </p>
      <div class="levels" aria-hidden="true">
        <span v-for="(l, i) in LEVELS" :key="l" class="level" :style="{ background: SOIL_PALETTE[i] }" v-html="SOIL_GLYPHS[l]" />
      </div>
      <button type="button" class="cta" data-testid="soil-intro-try" @click="emit('try')">Radar starten</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { FEATURES } from '~/entitlements/features'
import { SOIL_PALETTE, SOIL_GLYPHS } from '~/map/soilBadge'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ try: []; dismiss: [] }>()

// Same order as SOIL_PALETTE: dusty → wet.
const LEVELS = ['dusty', 'dry', 'prime', 'damp', 'wet'] as const
</script>

<style scoped>
/* Sits left of the radar button, bottom-aligned with it, arrow pointing at it. */
.soil-intro {
  position: absolute;
  right: 66px;
  bottom: calc(8em + 52px + var(--soil-lift, 0px) + env(safe-area-inset-bottom));
  z-index: 1001;
  width: min(18rem, calc(100vw - 92px));
  box-sizing: border-box;
  padding: 14px 14px 12px;
  border-radius: 14px;
  background: #1a2035;
  color: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.soil-intro::after {
  content: '';
  position: absolute;
  right: -7px;
  bottom: 15px;
  width: 14px;
  height: 14px;
  background: #1a2035;
  transform: rotate(45deg);
  border-radius: 2px;
}
.tag {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 99px;
  background: rgba(22, 192, 96, 0.18);
  color: #5be39a;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
h2 { margin: 0; padding-right: 28px; font-size: 17px; line-height: 1.25; }
p { margin: 0; font-size: 13.5px; line-height: 1.45; color: #c9d1e0; }
.levels { display: flex; gap: 6px; }
.level {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.level :deep(svg) { width: 15px; height: 15px; }
.cta {
  min-height: 44px;
  border: none;
  border-radius: 999px;
  background: #16c060;
  color: #0e1a12;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.cta:hover { background: #1fd36d; }
.close {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 44px;
  height: 44px;
  border: none;
  background: none;
  color: #c9d1e0;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.cta:focus-visible, .close:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.intro-enter-active, .intro-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.intro-enter-from, .intro-leave-to { opacity: 0; transform: translateX(10px); }
@media (prefers-reduced-motion: reduce) {
  .intro-enter-active, .intro-leave-active { transition: none; }
}
</style>
