<template>
  <section class="soil-panel" aria-labelledby="soil-title" data-testid="soil-panel">
    <div class="top">
      <h2 id="soil-title" class="title" data-testid="soil-title">Wie ist der Boden gerade?</h2>
      <span v-if="store.mode === 'sample'" class="chip sample" data-testid="soil-sample-pill">Beispielansicht</span>
      <span
        v-else-if="freshText"
        class="fresh"
        :class="{ 'is-stale': store.freshness?.stale }"
        data-testid="soil-fresh"
      >{{ freshText }}</span>
    </div>

    <div class="ramp" :style="{ background: gradient }" data-testid="soil-ramp" />

    <div class="ticks">
      <div v-for="(t, i) in TICKS" :key="t.label" class="tick" :style="{ left: pct(i) }">
        <span class="glyph" :style="{ background: axisColor(i) }" aria-hidden="true" v-html="t.glyph" />
        <span class="tick-label">{{ t.label }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { SOIL_PALETTE, SOIL_GLYPHS, SOIL_LABELS, axisColor } from '~/map/soilBadge'
import { formatStand } from '~/utils/formatStand'

const store = useSoilRadarStore()

const MAX = 4
const TICKS = (['dusty', 'dry', 'prime', 'damp', 'wet'] as const)
  .map(l => ({ label: SOIL_LABELS[l], glyph: SOIL_GLYPHS[l] }))
const gradient = `linear-gradient(90deg, ${SOIL_PALETTE.join(', ')})`
const pct = (v: number) => `${(v / MAX) * 100}%`

// Legend only for now: a range saved by the former slider would ghost pins with no way back.
onMounted(() => {
  if (store.range.lo !== 0 || store.range.hi !== MAX) store.setRange(0, MAX)
})

const freshText = computed(() => {
  const f = store.freshness
  if (!f) return ''
  if (f.stale) return 'Daten veraltet'
  return `${formatStand(f.computedAt)}${f.offline ? ' · offline' : ''}`
})
</script>

<style scoped>
.soil-panel {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: calc(14px + env(safe-area-inset-bottom));
  z-index: 1100;
  box-sizing: border-box;
  max-width: 34em;
  margin: 0 auto;
  /* Side padding fits half of "Schlammig", the widest end label, centred on its stop. */
  padding: 12px 38px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  font: 600 12px system-ui, sans-serif;
  color: #222;
  animation: panel-up 0.3s ease-out;
}
.title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 -26px 10px;
}
.chip {
  padding: 4px 10px;
  border-radius: 99px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.chip.sample { background: #1a2035; color: #fff; }
.fresh { color: #4a5568; font-weight: 500; }
.fresh.is-stale { color: #b45309; font-weight: 700; }

.ramp {
  position: relative;
  height: 16px;
  margin: 4px 0 8px;
  border-radius: 99px;
}
.ticks { position: relative; height: 46px; }
.tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.glyph {
  display: block;
  width: 20px;
  height: 20px;
  padding: 3px;
  box-sizing: border-box;
  border-radius: 50%;
}
.glyph :deep(svg) { display: block; width: 100%; height: 100%; }
.tick-label { font-size: 11px; font-weight: 600; white-space: nowrap; }

@keyframes panel-up { from { transform: translateY(120%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .soil-panel { animation: none; }
}
</style>
