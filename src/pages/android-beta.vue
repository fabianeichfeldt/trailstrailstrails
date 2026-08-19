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

          <form v-if="status !== 'success'" @submit.prevent="handleSubmit">
            <div v-if="status === 'duplicate'" class="form-error" role="alert">
              Diese E-Mail-Adresse ist schon auf der Liste – danke, du bist schon dabei!
            </div>
            <div v-else-if="status === 'error'" class="form-error" role="alert">
              Da ist etwas schiefgelaufen. Bitte versuch es gleich nochmal.
            </div>

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

          <div v-else class="form-success" role="status">
            Danke, {{ name }}! Du bist auf der Liste – wir melden uns, sobald die Beta startet.
          </div>
        </div>

        <div class="visual-col">
          <img :src="'/assets/playstore.jpg'" alt="Google Play" class="playstore-logo" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { submitBetaSignup } from '../communication/betaSignup'

useSeoMeta({
  title: 'Android-Beta – Trailradar',
  description: 'Trag dich für die Trailradar Android-Beta ein und probiere die App als einer der Ersten aus.',
  robots: 'noindex',
})

const name = ref('')
const email = ref('')
const status = ref<'idle' | 'submitting' | 'success' | 'duplicate' | 'error'>('idle')

async function handleSubmit() {
  status.value = 'submitting'
  try {
    await submitBetaSignup(name.value.trim(), email.value.trim())
    status.value = 'success'
  } catch (e) {
    status.value = e instanceof Error && e.message === 'DUPLICATE_EMAIL' ? 'duplicate' : 'error'
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
  gap: 1.5rem;
}

.playstore-logo {
  width: 120px;
  height: 120px;
  object-fit: contain;
}

@media (max-width: 700px) {
  .signup-row { flex-direction: column-reverse; }
  .visual-col { margin-bottom: 0.5rem; }
  .playstore-logo { width: 90px; height: 90px; }
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
</style>
