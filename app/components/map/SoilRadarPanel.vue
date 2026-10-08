<template>
  <section class="soil-panel" aria-labelledby="soil-title" data-testid="soil-panel">
    <h2 id="soil-title" class="title" data-testid="soil-title">Bodenzustand an den Spots</h2>
    <p class="subtitle" data-testid="soil-subtitle">Heute, geschätzt aus dem Wetter · Regler filtern</p>
    <div class="top">
      <span class="chip" data-testid="soil-counter">{{ matchCount }} von {{ totalCount }} Spots</span>
      <span v-if="store.mode === 'sample'" class="chip sample" data-testid="soil-sample-pill">Beispielansicht</span>
      <span
        v-else-if="freshText"
        class="fresh"
        :class="{ 'is-stale': store.freshness?.stale }"
        data-testid="soil-fresh"
      >{{ freshText }}</span>
    </div>

    <div
      ref="ramp"
      class="ramp"
      :style="{ background: gradient }"
      data-testid="soil-ramp"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <div class="shade left" :style="{ width: pct(store.range.lo) }" />
      <div class="shade right" :style="{ left: pct(store.range.hi) }" />
      <div
        v-for="h in HANDLES"
        :key="h"
        class="handle"
        :class="{ dragging: dragging === h }"
        :style="{ left: pct(store.range[h]) }"
        role="slider"
        tabindex="0"
        data-handle
        :data-which="h"
        :aria-label="h === 'lo' ? 'Trockenste Stufe' : 'Nässeste Stufe'"
        aria-valuemin="0"
        :aria-valuemax="MAX"
        :aria-valuenow="store.range[h]"
        :aria-valuetext="TICKS[store.range[h]]?.label"
        @keydown="onKey($event, h)"
      />
    </div>

    <div class="ticks" aria-hidden="true">
      <div v-for="(t, i) in TICKS" :key="t.label" class="tick" :style="{ left: pct(i) }">
        <span class="glyph" :style="{ background: axisColor(i) }" v-html="t.glyph" />
        <span class="tick-label">{{ t.label }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { SOIL_PALETTE, SOIL_GLYPHS, SOIL_LABELS, axisColor } from '~/map/soilBadge'
import { formatStand } from '~/utils/formatStand'

defineProps<{ matchCount: number; totalCount: number }>()

const store = useSoilRadarStore()

const MAX = 4
type Handle = 'lo' | 'hi'
const HANDLES: Handle[] = ['lo', 'hi']
const TICKS = (['dusty', 'dry', 'prime', 'damp', 'wet'] as const)
  .map(l => ({ label: SOIL_LABELS[l], glyph: SOIL_GLYPHS[l] }))
const gradient = `linear-gradient(90deg, ${SOIL_PALETTE.join(', ')})`
const pct = (v: number) => `${(v / MAX) * 100}%`

const ramp = ref<HTMLElement | null>(null)
const dragging = ref<Handle | null>(null)

// Handles never cross; equal values are allowed (single level).
function move(h: Handle, v: number) {
  const { lo, hi } = store.range
  const next = h === 'lo' ? Math.min(Math.max(0, v), hi) : Math.max(Math.min(MAX, v), lo)
  if (next === store.range[h]) return
  if (h === 'lo') store.setRange(next, hi)
  else store.setRange(lo, next)
}

function valueAt(clientX: number): number {
  const r = ramp.value!.getBoundingClientRect()
  return Math.round(((clientX - r.left) / r.width) * MAX)
}

function onDown(e: PointerEvent) {
  const grabbed = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]')
  const v = valueAt(e.clientX)
  const { lo, hi } = store.range
  // Tap on the bare ramp: closer handle wins; a tie goes to the side the tap is on.
  const dLo = Math.abs(v - lo)
  const dHi = Math.abs(v - hi)
  const nearest: Handle = dLo < dHi ? 'lo' : dHi < dLo ? 'hi' : v < lo ? 'lo' : 'hi'
  const h = (grabbed?.dataset.which as Handle | undefined) ?? nearest
  dragging.value = h
  try { ramp.value?.setPointerCapture?.(e.pointerId) } catch { /* capture is a nicety */ }
  if (!grabbed) move(h, v)
}

function onMove(e: PointerEvent) {
  if (dragging.value) move(dragging.value, valueAt(e.clientX))
}

function onUp(e: PointerEvent) {
  dragging.value = null
  try { ramp.value?.releasePointerCapture?.(e.pointerId) } catch { /* already released */ }
}

function onKey(e: KeyboardEvent, h: Handle) {
  const cur = store.range[h]
  const to: Record<string, number> = {
    ArrowLeft: cur - 1, ArrowDown: cur - 1, ArrowRight: cur + 1, ArrowUp: cur + 1, Home: 0, End: MAX,
  }
  if (!(e.key in to)) return
  e.preventDefault()
  move(h, to[e.key]!)
}

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
  margin: 0 -26px;
  font-size: 14px;
  font-weight: 700;
}
.subtitle {
  margin: 2px -26px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #4a5568;
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
  margin: 14px 0 8px;
  border-radius: 99px;
  touch-action: none;
  cursor: pointer;
}
/* Outside the chosen range the ramp is greyed, mirroring what the map does to pins. */
.shade { position: absolute; top: 0; bottom: 0; background: rgba(240, 240, 240, 0.72); pointer-events: none; }
.shade.left { left: 0; border-radius: 99px 0 0 99px; }
.shade.right { right: 0; border-radius: 0 99px 99px 0; }

/* 44px hit area around a 26px visible knob. */
.handle {
  position: absolute;
  top: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  cursor: grab;
  touch-action: none;
  outline: none;
}
.handle::before {
  content: '';
  position: absolute;
  inset: 9px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 3px #16c060;
  transition: transform 0.15s;
}
.handle.dragging::before { transform: scale(1.12); }
.handle:focus-visible::before { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 3px #16c060, 0 0 0 6px rgba(22, 192, 96, 0.35); }

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
  .handle::before { transition: none; }
}
</style>
