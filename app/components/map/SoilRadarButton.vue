<template>
  <button
    type="button"
    class="soil-radar-btn"
    :class="{ 'is-on': store.enabled, 'is-locked': access === 'locked', 'is-checking': access === 'checking' }"
    :aria-label="label"
    :aria-pressed="store.enabled ? 'true' : 'false'"
    :aria-busy="store.status === 'loading' ? 'true' : undefined"
    data-testid="soil-radar-button"
    @click="onTap"
  >
    <svg class="radar-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12 L19 7" />
    </svg>
    <span v-if="access === 'locked'" class="lock" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z" /></svg>
    </span>
  </button>
</template>

<script setup lang="ts">
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
</script>

<style scoped>
/* Same footprint and stack as .location-btn, one slot above it. */
.soil-radar-btn {
  position: absolute;
  right: 10px;
  bottom: calc(8em + 52px + env(safe-area-inset-bottom));
  z-index: 1000;
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
@media (prefers-reduced-motion: reduce) {
  .soil-radar-btn { transition: none; }
}
</style>
