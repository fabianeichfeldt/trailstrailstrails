<template>
  <div>
    <PageHero>
      <h1>Verträge hier kündigen</h1>
      <p>Kündige dein TrailRadar-Abo mit einem Klick – ohne Umwege.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section v-if="receivedAt" class="kd-box" aria-live="polite">
        <h2>Kündigung eingegangen</h2>
        <p>
          Deine Kündigung ist am {{ receivedLabel }} bei uns eingegangen.
          <template v-if="viaForm">Eine Bestätigung ist per E-Mail unterwegs (falls zu dieser Adresse ein Abo besteht).</template>
        </p>
      </section>

      <section v-else-if="authStore.isLoggedIn && subscriptionStore.subscription && subscriptionStore.isCancelScheduled" class="kd-box">
        <h2>TrailRadar Supporter</h2>
        <p>Dein Abo endet am {{ periodEnd }}. Bis dahin behältst du alle Vorteile.</p>
        <button class="btn-primary" :disabled="busy" @click="onResume">Kündigung zurücknehmen</button>
        <p v-if="error" class="kd-error" role="alert">{{ error }}</p>
      </section>

      <section v-else-if="authStore.isLoggedIn && isLive" class="kd-box">
        <h2>TrailRadar Supporter</h2>
        <p v-if="periodEnd">Nächste Verlängerung bzw. Laufzeitende: {{ periodEnd }}</p>
        <button class="btn-danger" :disabled="busy" @click="onCancelLoggedIn">Jetzt kündigen</button>
        <p v-if="error" class="kd-error" role="alert">{{ error }}</p>
      </section>

      <form v-else class="kd-box" novalidate @submit.prevent="onSubmitForm">
        <p>Gib den Namen und die E-Mail-Adresse an, mit denen du das Abo abgeschlossen hast.</p>
        <label for="kd-name">Name</label>
        <input id="kd-name" v-model="name" name="name" type="text" autocomplete="name" required>
        <label for="kd-email">E-Mail</label>
        <input id="kd-email" v-model="email" name="email" type="email" autocomplete="email" inputmode="email" required>
        <p v-if="error" class="kd-error" role="alert">{{ error }}</p>
        <button type="submit" class="btn-danger" :disabled="busy">Jetzt kündigen</button>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import { cancelSubscription, resumeSubscription } from '~/communication/billing'
import { formatDate } from '~/utils/formatDate'
import { isValidEmail } from '~/utils/isValidEmail'

const TITLE = 'Verträge hier kündigen'
useSeoMeta({ title: TITLE, robots: 'noindex' })
useHead({ title: TITLE })

const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const name = ref('')
const email = ref('')
const busy = ref(false)
const error = ref('')
const receivedAt = ref<string | null>(null)
const viaForm = ref(false)

const isLive = computed(() => {
  const s = subscriptionStore.subscription
  return !!s && (s.status === 'active' || s.status === 'past_due') && !s.cancelAtPeriodEnd
})
const periodEnd = computed(() => {
  const end = subscriptionStore.subscription?.currentPeriodEnd
  return end ? formatDate(end) : ''
})
const receivedLabel = computed(() => {
  if (!receivedAt.value) return ''
  const d = new Date(receivedAt.value)
  const tz = 'Europe/Berlin'
  const date = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  return `${date} um ${time} Uhr`
})

const GENERIC_ERROR = 'Das hat leider nicht geklappt. Bitte versuch es gleich noch einmal.'

async function run(input: Parameters<typeof cancelSubscription>[0], form: boolean) {
  busy.value = true
  error.value = ''
  try {
    const res = await cancelSubscription(input)
    if (res.ok) {
      viaForm.value = form
      receivedAt.value = res.receivedAt
    } else {
      error.value = res.error === 'rate_limited'
        ? 'Zu viele Anfragen – bitte versuch es in einer Stunde erneut.'
        : GENERIC_ERROR
    }
  } finally {
    busy.value = false
  }
}

async function onCancelLoggedIn() {
  const jwt = await authStore.getToken()
  await run({ jwt }, false)
}

async function onSubmitForm() {
  if (!name.value.trim()) { error.value = 'Bitte gib deinen Namen an.'; return }
  if (!isValidEmail(email.value.trim())) { error.value = 'Bitte gib eine gültige E-Mail-Adresse an.'; return }
  await run({ email: email.value.trim(), name: name.value.trim() }, true)
}

async function onResume() {
  busy.value = true
  error.value = ''
  try {
    const jwt = await authStore.getToken()
    const res = await resumeSubscription(jwt)
    if (res.ok) await subscriptionStore.load()
    else error.value = GENERIC_ERROR
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.kd-box {
  max-width: 32rem;
  margin: 1.5rem auto;
  padding: 1.25rem 1rem;
  background: var(--color-bg-card-solid);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-sizing: border-box;
}

label { display: block; margin: 0.8rem 0 0.25rem; font-weight: 600; font-size: 0.9rem; }

input {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: 0 0.75rem;
  font-size: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.btn-primary,
.btn-danger {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 1rem;
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary { background: var(--color-primary); }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-danger { background: #b91c1c; }
.btn-danger:hover:not(:disabled) { background: #991b1b; }
button:disabled { opacity: 0.6; cursor: not-allowed; }

.kd-error { margin: 0.8rem 0 0; color: #991b1b; font-size: 0.9rem; }
</style>
