<template>
  <button
    type="button"
    class="soil-radar-btn"
    :class="{ 'is-on': store.enabled, 'is-locked': access === 'locked', 'is-checking': access === 'checking', 'is-new': highlight && !store.enabled }"
    :aria-label="label"
    :aria-pressed="store.enabled ? 'true' : 'false'"
    :aria-busy="store.status === 'loading' ? 'true' : undefined"
    data-testid="soil-radar-button"
    @click="onTap"
  >
    <IconRadar class="radar-icon" width="22" height="22" aria-hidden="true" />
    <span v-if="access === 'locked'" class="lock" aria-hidden="true">
      <IconLock width="10" height="10" />
    </span>
  </button>
</template>

<script setup lang="ts">
import IconRadar from '~/assets/icons/radar.svg'
import IconLock from '~/assets/icons/lock.svg'

defineProps<{ highlight?: boolean }>()
const emit = defineEmits<{ teaser: [] }>()

const store = useSoilRadarStore()
const access = useFeatureAccess('soil_radar')

const label = computed(() => {
  if (access.value === 'locked') return 'Boden-Radar ansehen (Supporter-Funktion)'
  return store.enabled ? 'Boden-Radar ausschalten' : 'Boden-Radar einschalten'
})

// A tap during "checking" waits for the answer, so a Supporter never sees a locked flash.
const queued = ref(false)

function act(a: 'allowed' | 'locked') {
  if (a === 'locked') emit('teaser')
  else store.toggle()
}

function onTap() {
  if (access.value === 'checking') {
    queued.value = true
    return
  }
  act(access.value)
}

watch(access, (a) => {
  if (a === 'checking' || !queued.value) return
  queued.value = false
  act(a)
})

// The intro callout and the /map?radar=1 deep link take the same path as a tap.
defineExpose({ activate: onTap })
</script>

<style scoped>
/* Same footprint and stack as .location-btn, one slot above it. */
.soil-radar-btn {
  position: absolute;
  right: 10px;
  bottom: calc(8em + 52px + var(--soil-lift, 0px) + env(safe-area-inset-bottom));
  z-index: 1000;
  font-size: 1em; /* same em base as .location-btn so the stack lines up */
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: none;
  border-radius: 0.4em;
  background: #2b6cb0;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 0.25s, background 0.25s;
}
.soil-radar-btn:hover { background: #3182ce; }
.soil-radar-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.soil-radar-btn.is-checking { opacity: 0.85; }
.soil-radar-btn.is-on {
  background: #2f3b4a;
  box-shadow: 0 0 0 2px #16c060, 0 0 14px 2px rgba(22, 192, 96, 0.55);
}
.lock {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #1a2035;
  color: #fff;
  border: 2px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Pulse until the radar has been tried once — the button alone was easy to miss. */
.soil-radar-btn.is-new::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  animation: soil-pulse 2s ease-out infinite;
  pointer-events: none;
}
@keyframes soil-pulse {
  0% { box-shadow: 0 0 0 0 rgba(22, 192, 96, 0.75); }
  70% { box-shadow: 0 0 0 12px rgba(22, 192, 96, 0); }
  100% { box-shadow: 0 0 0 0 rgba(22, 192, 96, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .soil-radar-btn { transition: none; }
  .soil-radar-btn.is-new::before { animation: none; box-shadow: 0 0 0 3px #16c060; }
}
</style>
