<template>
  <div>
    <PageHero>
      <h1>Sei als Erstes dabei: Trailradar für Android.</h1>
      <p>Wir bauen gerade die Android-App. Trag dich ein und du bekommst als einer der Ersten Zugriff auf die Beta.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/" class="back-link">← Zurück zur Startseite</NuxtLink>

      <section class="section signup-row">
        <div class="form-col">
          <ul class="pitch">
            <li>Alle Trails, Bikeparks und Dirtparks direkt auf dem Handy.</li>
            <li>Offline-Karten für die nächste Tour ohne Empfang.</li>
            <li>Du hilfst mit, die App vor dem offiziellen Release rund zu machen.</li>
          </ul>

          <form v-if="status !== 'success' && status !== 'already'" @submit.prevent="handleSubmit">
            <div v-if="fieldError" class="form-error" role="alert">{{ fieldError }}</div>
            <div v-else-if="status === 'duplicate'" class="form-error" role="alert">
              Diese E-Mail-Adresse ist schon auf der Liste – danke, du bist schon dabei!
            </div>
            <div v-else-if="status === 'error'" class="form-error" role="alert">
              {{ errorMessage || 'Da ist etwas schiefgelaufen. Bitte versuch es gleich nochmal.' }}
            </div>

            <p class="form-note">
              Sorry, die Beta ist noch nicht ganz fertig. Trag dich einfach mit deiner E-Mail-Adresse
              ein und du bekommst eine Benachrichtigung, sobald es losgeht.
            </p>

            <label>
              <span>Name</span>
              <input v-model="name" type="text" autocomplete="name" required />
            </label>

            <label>
              <span>E-Mail</span>
              <input v-model="email" type="email" autocomplete="email" required />
            </label>

            <button class="primary" type="submit" :class="{ loading: status === 'submitting' }">
              Für die Beta eintragen
            </button>
          </form>

          <div v-else-if="status === 'already'" class="form-success" role="status">
            Du bist schon auf der Liste – wir melden uns, sobald die Beta startet.
          </div>

          <div v-else class="form-success" role="status">
            Danke, {{ name }}! Du bist auf der Liste – wir melden uns, sobald die Beta startet.
          </div>

          <p class="disclaimer">
            Die Daten werden ausschließlich für den Rollout der Android-App verwendet und nach der
            Beta-Phase gelöscht. Die Daten werden in Deutschland gespeichert und selbstverständlich
            nicht weitergegeben. Mehr dazu unter <NuxtLink to="/privacy">Datenschutz</NuxtLink>.
          </p>
        </div>

        <div class="visual-col">
          <div class="phone-frame">
            <img :src="'/assets/phone-mockup.png'" alt="Trailradar auf dem Smartphone" class="phone-image" />
            <div class="store-badge">
              <img :src="'/assets/playstore.jpg'" alt="Google Play" class="playstore-logo" />
              <span>Bald im Play Store</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { submitBetaSignup } from '../communication/betaSignup'
import { isValidEmail } from '../utils/isValidEmail'

const SIGNED_UP_KEY = 'android-beta-signed-up'

useSeoMeta({
  title: 'Android-Beta – Trailradar',
  description: 'Trag dich für die Trailradar Android-Beta ein und probiere die App als einer der Ersten aus.',
  robots: 'noindex',
})

const name = ref('')
const email = ref('')
const status = ref<'idle' | 'submitting' | 'success' | 'duplicate' | 'error' | 'already'>('idle')
const fieldError = ref('')
const errorMessage = ref('')

// Already signed up on this device — skip the form and the API call
// entirely instead of letting them submit again.
onMounted(() => {
  if (localStorage.getItem(SIGNED_UP_KEY) === '1') status.value = 'already'
})

async function handleSubmit() {
  if (status.value === 'submitting') return

  const trimmedName = name.value.trim()
  const trimmedEmail = email.value.trim()

  if (!trimmedName || !trimmedEmail) {
    fieldError.value = 'Bitte Name und E-Mail-Adresse ausfüllen.'
    return
  }
  if (!isValidEmail(trimmedEmail)) {
    fieldError.value = 'Bitte eine gültige E-Mail-Adresse eingeben.'
    return
  }
  fieldError.value = ''

  status.value = 'submitting'
  try {
    await submitBetaSignup(trimmedName, trimmedEmail)
    status.value = 'success'
    localStorage.setItem(SIGNED_UP_KEY, '1')
  } catch (e) {
    const duplicate = e instanceof Error && e.message === 'DUPLICATE_EMAIL'
    if (duplicate) {
      status.value = 'duplicate'
      localStorage.setItem(SIGNED_UP_KEY, '1')
    } else {
      status.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : ''
    }
  }
}
</script>

<style scoped>
.section { margin-bottom: 3em; }

.signup-row {
  display: flex;
  align-items: center;
  gap: 3rem;
}

.form-col { flex: 1 1 420px; }

.visual-col {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phone-frame {
  position: relative;
  width: 240px;
}

.phone-image {
  width: 100%;
  height: auto;
  display: block;
}

.store-badge {
  position: absolute;
  bottom: -14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.9rem 0.4rem 0.5rem;
  background: #ffffff;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  white-space: nowrap;
  font-size: 0.8rem;
  font-weight: 600;
  color: #1a1a1a;
}

.playstore-logo {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

@media (max-width: 700px) {
  .signup-row { flex-direction: column-reverse; gap: 2.5rem; }
  .phone-frame { width: 200px; }
}

.pitch {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.pitch li {
  padding-left: 1.6rem;
  position: relative;
}

.pitch li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--color-page-accent);
  font-weight: 700;
}

form { max-width: 420px; }

form label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.9rem;
}

form label span {
  font-size: 0.75rem;
  color: #666;
}

form input[type="email"],
form input[type="text"] {
  width: 100%;
  padding: .6em 1em;
  border-radius: 14px;
  border: 1px solid #ddd;
  background: white;
  font-size: .95em;
  box-sizing: border-box;
}

form input:focus {
  outline: none;
  border-color: var(--color-page-accent);
}

.form-note {
  margin: 0 0 1.2rem;
  padding: .7rem .9rem;
  border-radius: 12px;
  background: rgba(88, 194, 125, 0.1);
  border: 1px solid rgba(88, 194, 125, 0.25);
  color: #3a3a3a;
  font-size: .85rem;
  line-height: 1.5;
}

.primary {
  width: 100%;
  margin-top: .5em;
  padding: .9em;
  border-radius: 999px;
  background: var(--color-page-accent);
  color: #0f1a12;
  font-weight: 600;
  font-size: .95em;
  border: none;
  cursor: pointer;
}

.primary.loading { opacity: .6; pointer-events: none; }

.form-error {
  margin-bottom: 1rem;
  padding: .6rem .8rem;
  border-radius: 10px;
  background: #fee2e2;
  color: #991b1b;
  font-size: .85rem;
  max-width: 420px;
}

.form-success {
  padding: 1rem 1.2rem;
  border-radius: 14px;
  background: #f5f5f5;
  max-width: 420px;
  font-weight: 500;
}

.disclaimer {
  margin-top: 1.2rem;
  max-width: 420px;
  font-size: 0.75rem;
  line-height: 1.5;
  color: #888;
}
</style>
