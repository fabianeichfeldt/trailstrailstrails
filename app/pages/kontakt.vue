<template>
  <div>
    <PageHero>
      <h1>Kontakt</h1>
      <p>Fragen, Hinweise oder Feedback? Schreib uns.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section class="contact-card">
        <div v-if="sent" class="contact-sent" data-testid="contact-sent" aria-live="polite">
          <div class="contact-sent-icon" aria-hidden="true">✓</div>
          <h2>Danke für deine Nachricht!</h2>
          <p>Wir melden uns so bald wie möglich bei dir.</p>
          <NuxtLink to="/map" class="contact-btn contact-btn-link">Zur Karte</NuxtLink>
        </div>

        <form v-else novalidate @submit.prevent="onSubmit">
          <label class="contact-field">
            <span>Name <small>(optional)</small></span>
            <input
              v-model="name" data-testid="contact-name" type="text" name="name"
              autocomplete="name" maxlength="100"
            >
          </label>

          <label class="contact-field">
            <span>E-Mail-Adresse</span>
            <input
              v-model="email" data-testid="contact-email" type="email" name="email"
              autocomplete="email" inputmode="email" required
              :aria-invalid="errorField === 'email'"
            >
          </label>

          <label class="contact-field">
            <span>Nachricht</span>
            <textarea
              v-model="message" data-testid="contact-message" name="message"
              rows="6" maxlength="5000" required
              :aria-invalid="errorField === 'message'"
            />
          </label>

          <!-- Honeypot: invisible to people, bots fill it in. -->
          <div class="contact-hp" aria-hidden="true">
            <label>Website <input v-model="website" type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>

          <p v-if="error" class="contact-error" role="alert">{{ error }}</p>

          <button type="submit" class="contact-btn" :disabled="busy">
            {{ busy ? 'Wird gesendet …' : 'Nachricht senden' }}
          </button>

          <p class="contact-note">
            Wir nutzen deine Angaben nur, um deine Anfrage zu beantworten. Mehr dazu in der
            <NuxtLink to="/privacy">Datenschutzerklärung</NuxtLink>.
          </p>
        </form>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { sendContactMessage, type ContactField } from '~/communication/contact'

useSeoMeta({
  title: 'Kontakt',
  ogTitle: 'Kontakt | Trailradar',
  ogUrl: 'https://trailradar.org/kontakt',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/kontakt' }],
})

const name = ref('')
const email = ref('')
const message = ref('')
const website = ref('')
const busy = ref(false)
const sent = ref(false)
const error = ref('')
const errorField = ref<ContactField | null>(null)

const FIELD_ERRORS: Record<ContactField, string> = {
  email: 'Bitte gib eine gültige E-Mail-Adresse an, damit wir antworten können.',
  message: 'Deine Nachricht braucht mindestens 10 Zeichen.',
  name: 'Der Name ist zu lang (höchstens 100 Zeichen).',
}

function fail(field: ContactField | null, text: string) {
  errorField.value = field
  error.value = text
}

async function onSubmit() {
  error.value = ''
  errorField.value = null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return fail('email', FIELD_ERRORS.email)
  if (message.value.trim().length < 10) return fail('message', FIELD_ERRORS.message)

  busy.value = true
  try {
    const res = await sendContactMessage({
      name: name.value.trim(), email: email.value.trim(), message: message.value.trim(), website: website.value,
    })
    if (res.ok) sent.value = true
    else if (res.error === 'invalid') fail(res.field, FIELD_ERRORS[res.field])
    else fail(null, 'Das hat leider nicht geklappt. Versuch es später noch einmal oder schreib direkt an webmaster@trailradar.org.')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.contact-card {
  max-width: 560px;
  background: #f7f8f7;
  border: 1px solid #e6e9e7;
  border-radius: 20px;
  padding: 1.5rem;
  box-sizing: border-box;
}

.contact-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.1rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: #1f2937;
}
.contact-field small { font-weight: 400; color: #6b7280; }

.contact-field input,
.contact-field textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 48px;
  padding: 0.75rem 0.9rem;
  font: inherit;
  font-weight: 400;
  font-size: 16px; /* below 16px iOS zooms into the field */
  color: #111827;
  background: #fff;
  border: 1.5px solid #d6dbd8;
  border-radius: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.contact-field textarea { resize: vertical; min-height: 9rem; line-height: 1.5; }
.contact-field input:focus,
.contact-field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.18);
}
.contact-field [aria-invalid="true"] { border-color: #dc2626; }

.contact-hp {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.contact-error {
  margin: 0 0 1rem;
  padding: 0.65rem 0.85rem;
  font-size: 0.88rem;
  color: #b91c1c;
  background: #fef2f2;
  border-radius: 10px;
}

.contact-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font: inherit;
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s;
}
.contact-btn:hover { background: var(--color-primary-hover); }
.contact-btn:disabled { opacity: 0.6; cursor: default; }
.contact-btn-link { margin-top: 1.25rem; }

.contact-note {
  margin: 0.9rem 0 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #6b7280;
}

.contact-sent { text-align: center; padding: 0.5rem 0; }
.contact-sent-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 0.75rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #dcfce7;
  color: #15803d;
  font-size: 1.6rem;
  font-weight: 700;
}
.contact-sent h2 { margin: 0 0 0.4rem; font-size: 1.2rem; }
.contact-sent p { margin: 0; color: #4b5563; }

@media (min-width: 600px) {
  .contact-card { padding: 2rem; }
  .contact-btn { width: auto; }
}
</style>
