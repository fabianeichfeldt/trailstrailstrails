<template>
  <div>
    <PageHero>
      <h1>Danke für deine Unterstützung</h1>
      <p>Wir schalten dein Supporter-Abo frei.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <div v-if="!authStore.isLoggedIn" class="danke-box">
        <span class="danke-icon" aria-hidden="true"><i class="fa-solid fa-user"></i></span>
        <p class="danke-text">Melde dich an, damit wir deine Freischaltung prüfen können.</p>
        <button class="btn-primary" @click="mapStore.authModalOpen = true">Anmelden</button>
      </div>

      <div v-else-if="state === 'success'" class="danke-box danke-success">
        <span class="danke-icon danke-icon-done" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
        <h2>Danke! Trail-Zustand ist freigeschaltet.</h2>
        <p class="danke-text">Öffne einen Spot auf der Karte – der Trail-Zustand steht jetzt direkt in den Details.</p>
        <NuxtLink to="/map" class="btn-primary">Zur Karte</NuxtLink>
      </div>

      <div v-else-if="state === 'timeout'" class="danke-box">
        <span class="danke-icon" aria-hidden="true"><i class="fa-solid fa-hourglass-half"></i></span>
        <p class="danke-text danke-text-strong">Zahlung eingegangen — die Freischaltung dauert noch einen Moment.</p>
        <p class="danke-text">Du kannst die Seite schließen; die Freischaltung passiert automatisch.</p>
        <NuxtLink to="/map" class="btn-primary">Zur Karte</NuxtLink>
      </div>

      <div v-else class="danke-box" aria-live="polite">
        <span class="danke-icon danke-icon-wait" aria-hidden="true"></span>
        <p class="danke-text danke-text-strong">Zahlung eingegangen — wir schalten dich gerade frei …</p>
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
/* Same ink + trail green as the Supporter card on /plans. */
.danke-box {
  position: relative;
  overflow: hidden;
  max-width: 30rem;
  margin: 1rem auto 2rem;
  padding: 2.5rem 1.5rem 2rem;
  border-radius: 24px;
  background: linear-gradient(150deg, var(--color-supporter-bg), var(--color-supporter-bg-end));
  color: #f3f4f3;
  text-align: center;
}
.danke-box::before {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-radial-gradient(circle at 50% -30%, transparent 0 22px, rgba(255, 255, 255, 0.06) 22px 23px);
  pointer-events: none;
}
.danke-box > * { position: relative; }

.danke-icon {
  display: inline-grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  margin-bottom: 1.25rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: #d6dbd8;
  font-size: 1.4rem;
}
.danke-icon-done { background: var(--color-page-accent); color: var(--color-page-bg); font-size: 1.7rem; }
.danke-icon-wait {
  background: none;
  border: 4px solid rgba(255, 255, 255, 0.12);
  border-top-color: var(--color-page-accent);
  animation: danke-spin 0.9s linear infinite;
}
/* The one moment of motion: the check lands once the unlock is confirmed. */
.danke-success .danke-icon-done { animation: danke-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

.container .danke-box h2 { margin: 0 0 0.6rem; font-size: 1.4rem; font-weight: 800; color: #fff; }
.danke-box .danke-text { margin: 0 0 0.6rem; font-size: 0.92rem; line-height: 1.5; color: var(--color-supporter-muted); }
.danke-box .danke-text-strong { font-size: 1rem; font-weight: 700; color: #fff; }

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  margin-top: 1rem;
  padding: 0 1.75rem;
  border: none;
  border-radius: 999px;
  background: var(--color-page-accent);
  color: var(--color-page-bg);
  font: inherit;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}
.btn-primary:hover { background: #6fd292; text-decoration: none; }
.btn-primary:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }

@keyframes danke-spin { to { transform: rotate(360deg); } }
@keyframes danke-pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .danke-success .danke-icon-done { animation: none; }
  .danke-icon-wait { animation-duration: 2.5s; }
}
</style>
