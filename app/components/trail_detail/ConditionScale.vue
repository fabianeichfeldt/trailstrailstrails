<template>
  <div class="cs" :class="{ 'cs-interactive': interactive, loading }" :aria-busy="loading ? 'true' : undefined">
    <div v-if="label" class="cs-label">{{ label }}</div>

    <!-- Interactive: a group of real buttons, so touch, click and keyboard
         (Tab, Space, Enter) all work without extra handlers. -->
    <div v-if="interactive" class="cs-track" role="group" :aria-label="label || 'Bodenzustand'">
      <button
        v-for="(name, i) in NAMES"
        :key="name"
        type="button"
        class="cs-seg"
        :class="[`lv-${i}`, { on: isOn(i) }]"
        :aria-pressed="isOn(i) ? 'true' : 'false'"
        :aria-label="name"
        @click="emit('select', i as ConditionIndex)"
      >
        {{ name }}
      </button>
    </div>

    <!-- Read-only: one picture for assistive technology, not four unlabelled boxes. -->
    <div v-else class="cs-track" role="img" :aria-label="summary">
      <span
        v-for="(name, i) in NAMES"
        :key="name"
        class="cs-seg"
        :class="[`lv-${i}`, { on: isOn(i) }]"
        aria-hidden="true"
      >
        {{ name }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConditionIndex, ConditionRange } from '~/types/Weather'

/**
 * The four soil levels as one scale, dry to wet. Read-only in the Trail-Zustand
 * card (the model's estimate), interactive in the feedback sheet (the rider's
 * correction). Owns no state: the range comes in, taps go out.
 */
const props = defineProps<{
  range: ConditionRange
  interactive?: boolean
  /** Model range for the picked time is being fetched. */
  loading?: boolean
  label?: string
}>()
const emit = defineEmits<{ select: [index: ConditionIndex] }>()

const NAMES = ['Staubig', 'Perfekt', 'Feucht', 'Nass']

function isOn(i: number): boolean {
  return i >= props.range.lo && i <= props.range.hi
}

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

.cs-track {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

.cs-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 2px;
  border: 1.5px solid #e4e9f0;
  border-radius: 8px;
  background: #f7f9fc;
  color: #8a96a8;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  text-align: center;
}

/* Selected segments take the same colours as the verdict variants on the card. */
.cs-seg.on.lv-0 { background: #fefcbf; border-color: #ecc94b; color: #744210; }
.cs-seg.on.lv-1 { background: #f0faf5; border-color: #48bb78; color: #276749; }
.cs-seg.on.lv-2 { background: #ebf4ff; border-color: #63b3ed; color: #1a365d; }
.cs-seg.on.lv-3 { background: #fff1f1; border-color: #fc8181; color: #822727; }

.cs-interactive .cs-seg {
  min-height: 48px;
  font-size: 13px;
  cursor: pointer;
  touch-action: manipulation;
}
.cs-interactive .cs-seg:focus-visible {
  outline: 2px solid #1a2035;
  outline-offset: 2px;
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
