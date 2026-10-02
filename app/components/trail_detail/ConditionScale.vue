<template>
  <div class="cs" :class="{ 'cs-interactive': interactive, loading }" :aria-busy="loading ? 'true' : undefined">
    <div v-if="label" class="cs-label">{{ label }}</div>

    <!-- Interactive: a group of real buttons, so touch, click and keyboard
         (Tab, Space, Enter) all work without extra handlers. The buttons are
         invisible overlays with an oversized hit area; the visible bar stays
         thin, like a slider's thin track under a fat thumb-drag zone. -->
    <div v-if="interactive" class="cs-track" role="group" :aria-label="label || 'Bodenzustand'">
      <div class="cs-bar" aria-hidden="true">
        <div class="cs-fill" :style="fillStyle" />
      </div>
      <button
        v-for="(name, i) in NAMES"
        :key="name"
        type="button"
        class="cs-hit"
        :aria-pressed="isOn(i) ? 'true' : 'false'"
        :aria-label="name"
        @click="emit('select', i as ConditionIndex)"
      />
    </div>

    <!-- Read-only: one picture for assistive technology, not four unlabelled boxes. -->
    <div v-else class="cs-track" role="img" :aria-label="summary">
      <div class="cs-bar" aria-hidden="true">
        <div class="cs-fill" :style="fillStyle" />
      </div>
    </div>

    <!-- Tick labels are the colour-independent signal: bold/dark inside the
         range, muted outside it, always legible without relying on hue. -->
    <div class="cs-ticks" aria-hidden="true">
      <span v-for="(name, i) in NAMES" :key="name" class="cs-tick" :class="{ on: isOn(i) }">{{ name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConditionIndex, ConditionPositionRange, ConditionRange } from '~/types/Weather'

/**
 * The four soil levels as one continuous scale, dry to wet: a single gradient
 * track with a positioned fill bar, not four separate coloured boxes. Read-only
 * in the Trail-Zustand card (the model's estimate), interactive in the feedback
 * sheet (the rider's correction). Owns no state: the range comes in, taps go out.
 *
 * The fill's geometry normally snaps to whole blocks, driven by the discrete
 * `range`. When `positionRange` (the model's continuous companion value) is
 * also given, the fill instead spans exactly that finer position — e.g.
 * 44%-50% instead of always 25%-75% — for a tighter, more accurate-looking
 * band. Colours, tick bold/dim state and the summary/aria-label text always
 * keep using the discrete `range`; only the fill's geometry becomes continuous.
 */
const props = defineProps<{
  range: ConditionRange
  positionRange?: ConditionPositionRange | null
  interactive?: boolean
  /** Model range for the picked time is being fetched. */
  loading?: boolean
  label?: string
}>()
const emit = defineEmits<{ select: [index: ConditionIndex] }>()

const NAMES = ['Staubig', 'Trocken', 'Perfekt', 'Feucht', 'Schlammig']

/** Avoids IEEE-754 float noise (e.g. `2.6 - 1.4` -> `1.2000000000000002`) leaking into the emitted CSS. */
function round2(x: number): number {
  return Math.round(x * 100) / 100
}

// Sand-yellow → olive → green → teal → blue: dry to wet, carried entirely by
// the fill bar — the track itself is neutral, so this is the only colour on
// the scale.
const COLORS = ['#f2c744', '#bfc547', '#8bc34a', '#29b6b6', '#2f6fb0']
const QUARTER = 100 / NAMES.length

function isOn(i: number): boolean {
  return i >= props.range.lo && i <= props.range.hi
}

const fillStyle = computed(() => {
  const { lo, hi } = props.range
  const pos = props.positionRange
  const left = round2((pos ? pos.lo : lo) * QUARTER)
  const width = round2((pos ? pos.hi - pos.lo : hi - lo + 1) * QUARTER)
  const background = lo === hi ? COLORS[lo] : `linear-gradient(90deg, ${COLORS[lo]}, ${COLORS[hi]})`
  return { left: `${left}%`, width: `${width}%`, background }
})

const summary = computed(() => {
  const { lo, hi } = props.range
  const span = lo === hi ? NAMES[lo] : `${NAMES[lo]} bis ${NAMES[hi]}`
  return props.label ? `${props.label}: ${span}` : span
})
</script>

<style scoped>
.cs-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #8a96a8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

/* The track: a plain neutral rail, like a slider groove — all the colour
   lives in the fill, so the actual range reads as a real, unmistakable bar
   instead of a brighter patch on an already-coloured background. */
.cs-track {
  position: relative;
}

.cs-bar {
  position: relative;
  height: 10px;
  border-radius: 99px;
  overflow: hidden;
  background: #e4e9f0;
}

.cs-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 99px;
}

/* Interactive: four equal, effectively-invisible overlay buttons across the
   track, each with an oversized touch target around the thin visual bar. */
.cs-interactive .cs-track {
  display: flex;
  height: 44px;
  align-items: center;
}

.cs-interactive .cs-bar {
  position: absolute;
  left: 0;
  right: 0;
}

.cs-hit {
  position: relative;
  flex: 1 1 0;
  min-height: 44px;
  height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
}
.cs-hit:focus-visible {
  outline: 2px solid #1a2035;
  outline-offset: 2px;
  border-radius: 6px;
}

/* Ticks: the colour-independent signal below the track. */
.cs-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
}
.cs-tick {
  font-size: 11px;
  font-weight: 600;
  color: #8a96a8;
  text-align: center;
}
.cs-tick:first-child { text-align: left; }
.cs-tick:last-child { text-align: right; }
.cs-tick.on {
  font-weight: 700;
  color: #1a2035;
}

.cs.loading .cs-track {
  opacity: 0.45;
  animation: cs-pulse 1s ease-in-out infinite;
}
@keyframes cs-pulse {
  50% { opacity: 0.7; }
}
@media (prefers-reduced-motion: reduce) {
  .cs.loading .cs-track { animation: none; }
}
</style>
