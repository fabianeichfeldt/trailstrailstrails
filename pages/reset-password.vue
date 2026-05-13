<template>
  <div class="rp-page">
    <section class="rp-hero">
      <NuxtLink to="/" class="rp-logo">
        <img src="/assets/logo.webp" alt="Trailradar Logo" />
      </NuxtLink>
      <div class="rp-hero-content">
        <h1>Passwort zurücksetzen.</h1>
      </div>
    </section>

    <main class="rp-container">
      <div class="rp-card">
        <div class="rp-header">
          <img src="/assets/logo.webp" alt="Trailradar Logo" class="rp-logo-img" />
          <h2>Neues Passwort erstellen</h2>
        </div>

        <form @submit.prevent="submit">
          <label class="rp-label">
            <span>Passwort</span>
            <div class="rp-password-field">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                required
                minlength="8"
              />
              <button type="button" class="rp-toggle" :aria-label="showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'" @click="showPassword = !showPassword">
                <i class="fas" :class="showPassword ? 'fa-eye-slash' : 'fa-eye'" />
              </button>
            </div>
          </label>

          <label class="rp-label">
            <span>Passwort wiederholen</span>
            <div class="rp-password-field">
              <input
                v-model="passwordConfirm"
                :type="showConfirm ? 'text' : 'password'"
                autocomplete="new-password"
                required
                minlength="8"
              />
              <button type="button" class="rp-toggle" :aria-label="showConfirm ? 'Passwort verbergen' : 'Passwort anzeigen'" @click="showConfirm = !showConfirm">
                <i class="fas" :class="showConfirm ? 'fa-eye-slash' : 'fa-eye'" />
              </button>
            </div>
          </label>

          <p v-if="errorMsg" class="rp-error">{{ errorMsg }}</p>
          <p v-if="successMsg" class="rp-success">{{ successMsg }}</p>

          <button class="rp-btn-primary" type="submit" :disabled="busy">
            {{ busy ? 'Speichern…' : 'Speichern' }}
          </button>
        </form>

        <NuxtLink to="/" class="rp-btn-cancel">zurück</NuxtLink>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Neues Passwort – Trailradar',
  description: 'Neues Passwort erstellen für trailradar.org',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/reset-password' }],
})

const authStore = useAuthStore()
const router = useRouter()

const password = ref('')
const passwordConfirm = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const busy = ref(false)

async function submit() {
  errorMsg.value = ''
  if (password.value !== passwordConfirm.value) {
    errorMsg.value = 'Passwörter stimmen nicht überein'
    return
  }
  busy.value = true
  try {
    await authStore.updatePassword(password.value)
    successMsg.value = 'Passwort gespeichert. Du wirst weitergeleitet…'
    setTimeout(() => router.push('/'), 1500)
  } catch (e: any) {
    errorMsg.value = e.message || 'Fehler beim Speichern'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.rp-page {
  min-height: 100vh;
  background: var(--color-page-bg);
  color: var(--color-page-text);
  font-family: var(--font-base);
}

.rp-hero {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 2rem 1.5rem;
  background: linear-gradient(135deg, #0d1b2a, #1a3a5c);
}

.rp-logo img { height: 48px; width: auto; border-radius: 8px; }

.rp-hero-content h1 {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  margin: 0;
}

.rp-container {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.rp-card {
  background: #fff;
  color: #333;
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
}

.rp-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.rp-logo-img { height: 48px; width: auto; margin-bottom: 0.75rem; border-radius: 8px; }

.rp-header h2 {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.rp-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #444;
}

.rp-password-field {
  position: relative;
  display: flex;
  align-items: center;
}

.rp-password-field input {
  width: 100%;
  padding: 0.6rem 2.5rem 0.6rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.rp-password-field input:focus { border-color: #2b6cb0; }

.rp-toggle {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #888;
  padding: 0.2rem;
  font-size: 0.95rem;
  line-height: 1;
}

.rp-error {
  background: #fee2e2;
  color: #b91c1c;
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.rp-success {
  background: #dcfce7;
  color: #166534;
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.rp-btn-primary {
  width: 100%;
  background: #2b6cb0;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 0.75rem;
}

.rp-btn-primary:hover:not(:disabled) { background: #3182ce; }
.rp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.rp-btn-cancel {
  display: block;
  text-align: center;
  color: #666;
  font-size: 0.85rem;
  text-decoration: none;
  padding: 0.4rem;
}
.rp-btn-cancel:hover { color: #333; }
</style>
