<template>
  <div>
    <PageHero>
      <h1>Danke für deine Unterstützung</h1>
      <p>Wir schalten dein Supporter-Abo frei.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <div v-if="!authStore.isLoggedIn" class="danke-box">
        <p>Melde dich an, damit wir deine Freischaltung prüfen können.</p>
        <button class="btn-primary" @click="mapStore.authModalOpen = true">Anmelden</button>
      </div>

      <div v-else-if="state === 'success'" class="danke-box">
        <h2>Danke! Trail-Zustand ist freigeschaltet.</h2>
        <NuxtLink to="/map" class="btn-primary">Zur Karte</NuxtLink>
      </div>

      <div v-else-if="state === 'timeout'" class="danke-box">
        <p>Zahlung eingegangen — die Freischaltung dauert noch einen Moment.</p>
        <p class="hint">Du kannst die Seite schließen; die Freischaltung passiert automatisch.</p>
        <NuxtLink to="/map" class="btn-primary">Zur Karte</NuxtLink>
      </div>

      <div v-else class="danke-box" aria-live="polite">
        <p>Zahlung eingegangen — wir schalten dich gerade frei …</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const MAX_TRIES = 15
const INTERVAL_MS = 2000

useSeoMeta({ title: 'Danke für deine Unterstützung', robots: 'noindex' })
useHead({ meta: [{ name: 'robots', content: 'noindex' }] })

const authStore = useAuthStore()
const mapStore = useMapStore()
const subscriptionStore = useSubscriptionStore()

const state = ref<'polling' | 'success' | 'timeout'>('polling')
let timer: ReturnType<typeof setInterval> | null = null
let tries = 0
let busy = false

function stop() {
  if (timer) clearInterval(timer)
  timer = null
}

async function tick() {
  if (busy) return
  busy = true
  tries++
  try {
    await subscriptionStore.load()
  } finally {
    busy = false
  }
  if (!timer) return
  if (subscriptionStore.entitlement.level >= 1) {
    state.value = 'success'
    stop()
  } else if (tries >= MAX_TRIES) {
    state.value = 'timeout'
    stop()
  }
}

function start() {
  if (timer || state.value !== 'polling') return
  tries = 0
  timer = setInterval(tick, INTERVAL_MS)
}

watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) start()
  else stop()
}, { immediate: true })

onUnmounted(stop)
</script>

<style scoped>
.danke-box {
  max-width: 32rem;
  margin: 1.5rem auto;
  padding: 1.5rem 1rem;
  text-align: center;
}

.hint { color: var(--color-text-muted); font-size: 0.9rem; }

.btn-primary {
  display: inline-block;
  min-height: 44px;
  line-height: 44px;
  padding: 0 1.5rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.btn-primary:hover { background: var(--color-primary-hover); }
</style>
