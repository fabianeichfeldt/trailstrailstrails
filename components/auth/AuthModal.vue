<template>
  <Teleport to="body">
    <div v-if="mapStore.authModalOpen" class="auth-backdrop" @click.self="mapStore.authModalOpen = false">
      <div class="auth-card">

        <!-- Header -->
        <div class="auth-header">
          <img src="/assets/logo.webp" alt="Trailradar Logo" class="auth-logo" />
          <h2>{{ mode === 'signin' ? 'Anmelden' : 'Konto erstellen' }}</h2>
          <p class="auth-sub">
            {{ mode === 'signin'
              ? 'Melde dich an, um Trails hinzuzufügen, Fotos hochzuladen und vieles mehr.'
              : 'Erstelle dein Trailradar-Konto und werde Teil der Community.' }}
          </p>
        </div>

        <!-- Error -->
        <div v-if="error" class="auth-error" role="alert">{{ error }}</div>

        <!-- Sign In Form -->
        <form v-if="mode === 'signin'" @submit.prevent="handleSignIn">
          <label>
            <span>E-Mail</span>
            <input v-model="email" type="email" autocomplete="email" required />
          </label>

          <label>
            <span>Passwort</span>
            <div class="password-field">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                minlength="8"
              />
              <button type="button" class="toggle-password" @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'">
                <i :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
              </button>
            </div>
          </label>

          <div class="forgot-password">
            <a href="#" @click.prevent="handleForgotPassword">Passwort vergessen?</a>
          </div>

          <button class="primary" type="submit" :class="{ loading }">Weiter</button>
        </form>

        <!-- Sign Up Form -->
        <form v-else @submit.prevent="handleSignUp">
          <label>
            <span>Nickname</span>
            <input v-model="nickname" type="text" autocomplete="username" required minlength="3" />
          </label>
          <label>
            <span>E-Mail</span>
            <input v-model="email" type="email" autocomplete="email" required />
          </label>
          <label>
            <span>Passwort</span>
            <div class="password-field">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                required minlength="8"
              />
              <button type="button" class="toggle-password" @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'">
                <i :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
              </button>
            </div>
          </label>
          <label>
            <span>Passwort wiederholen</span>
            <div class="password-field">
              <input
                v-model="passwordRepeat"
                :type="showPasswordRepeat ? 'text' : 'password'"
                autocomplete="new-password"
                required minlength="8"
              />
              <button type="button" class="toggle-password" @click="showPasswordRepeat = !showPasswordRepeat"
                :aria-label="showPasswordRepeat ? 'Passwort verbergen' : 'Passwort anzeigen'">
                <i :class="showPasswordRepeat ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
              </button>
            </div>
          </label>

          <label class="consent-checkbox">
            <input v-model="privacyConsent" type="checkbox" required />
            <span class="custom-checkbox"></span>
            <span class="consent-text">
              Ich habe die
              <NuxtLink to="/privacy" target="_blank" rel="noopener">Datenschutzerklärung</NuxtLink>
              und die
              <NuxtLink to="/terms" target="_blank" rel="noopener">Nutzungsbedingungen</NuxtLink>
              gelesen und akzeptiere diese.
            </span>
          </label>

          <button class="primary" type="submit" :class="{ loading }">Registrieren</button>
        </form>

        <div class="divider"><span>oder</span></div>

        <button class="oauth google" type="button" @click="handleGoogle">
          <i class="fab fa-google"></i>
          <span>Mit Google {{ mode === 'signin' ? 'anmelden' : 'registrieren' }}</span>
        </button>

        <p class="switch">
          <template v-if="mode === 'signin'">
            Noch kein Konto? <a href="#" @click.prevent="switchMode('signup')">Registrieren</a>
          </template>
          <template v-else>
            Schon ein Konto? <a href="#" @click.prevent="switchMode('signin')">Anmelden</a>
          </template>
        </p>

        <button class="cancel" type="button" @click="mapStore.authModalOpen = false">Abbrechen</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const mapStore = useMapStore()

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const passwordRepeat = ref('')
const nickname = ref('')
const privacyConsent = ref(false)
const showPassword = ref(false)
const showPasswordRepeat = ref(false)
const error = ref('')
const loading = ref(false)

function switchMode(m: 'signin' | 'signup') {
  mode.value = m
  error.value = ''
  password.value = ''
  passwordRepeat.value = ''
  showPassword.value = false
  showPasswordRepeat.value = false
}

watch(() => mapStore.authModalOpen, (open) => {
  if (open) {
    error.value = ''
    mode.value = 'signin'
  }
})

async function handleSignIn() {
  error.value = ''
  loading.value = true
  try {
    await authStore.signIn(email.value, password.value)
    mapStore.authModalOpen = false
  } catch {
    error.value = 'Fehler beim Anmelden. Bitte versuche es erneut.'
  } finally {
    loading.value = false
  }
}

async function handleSignUp() {
  error.value = ''
  if (password.value !== passwordRepeat.value) {
    error.value = 'Passwörter stimmen nicht überein.'
    return
  }
  loading.value = true
  try {
    await authStore.signUp(email.value, password.value, nickname.value)
    await authStore.signIn(email.value, password.value)
    mapStore.authModalOpen = false
  } catch {
    error.value = 'Fehler beim Registrieren. Bitte versuche es erneut.'
  } finally {
    loading.value = false
  }
}

async function handleForgotPassword() {
  if (!email.value) {
    error.value = 'Bitte gib deine E-Mail-Adresse ein.'
    return
  }
  await authStore.resetPassword(email.value)
  mapStore.authModalOpen = false
}

async function handleGoogle() {
  await authStore.signInWithGoogle()
}
</script>

<style scoped>
.auth-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 14, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  overflow-y: auto;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}

@media (max-width: 800px) {
  .auth-backdrop { align-items: flex-start; }
}

.auth-card {
  background: #f7f7f5;
  color: #1c1c1c;
  width: 100%;
  max-width: 420px;
  margin: 1em;
  padding: 1.5em;
  border-radius: 22px;
  box-shadow: 0 30px 80px rgba(0,0,0,.45);
}

.auth-header {
  text-align: center;
  margin-bottom: 1.2rem;
}

.auth-logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  margin-bottom: 0.6rem;
}

.auth-header h2 { margin: 0; font-size: 1.2em; }

.auth-sub { margin-top: .4em; font-size: .85rem; color: #666; }

.auth-error {
  margin-bottom: 1rem;
  padding: .6rem .8rem;
  border-radius: 10px;
  background: #fee2e2;
  color: #991b1b;
  font-size: .85rem;
}

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
form input[type="text"],
form input[type="password"] {
  width: 100%;
  padding: .5em 1em;
  border-radius: 14px;
  border: 1px solid #ddd;
  background: white;
  font-size: .9em;
  box-sizing: border-box;
}

form input:focus {
  outline: none;
  border-color: #58c27d;
}

.password-field {
  position: relative;
  display: flex;
  align-items: center;
}

.password-field input { padding-right: 3rem; }

.toggle-password {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: #888;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  border-radius: 999px;
  transition: color .2s, background .2s;
}

.toggle-password:hover { color: #58c27d; background: rgba(88,194,125,.12); }

.forgot-password {
  text-align: right;
  margin-top: -0.25rem;
  margin-bottom: 1.25rem;
}

.forgot-password a { font-size: .85rem; color: #666; text-decoration: none; }
.forgot-password a:hover { text-decoration: underline; }

.primary {
  width: 100%;
  margin-top: .5em;
  padding: .9em;
  border-radius: 999px;
  background: #58c27d;
  color: #0f1a12;
  font-weight: 600;
  font-size: .95em;
  border: none;
  cursor: pointer;
}

.primary.loading { opacity: .6; pointer-events: none; }

.divider {
  margin: 1em 0;
  display: flex;
  align-items: center;
  gap: .8em;
  color: #999;
  font-size: .85em;
}

.divider::before, .divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #ddd;
}

.oauth.google {
  width: 100%;
  padding: .75em;
  border-radius: 999px;
  border: 1px solid #ddd;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .6em;
  font-weight: 500;
  cursor: pointer;
  font-size: .9em;
}

.switch {
  margin-top: 1.2em;
  text-align: center;
  font-size: .85em;
  color: #666;
}

.switch a { color: #58c27d; font-weight: 500; text-decoration: none; }

.cancel {
  margin-top: 1.5em;
  width: 100%;
  background: none;
  border: none;
  font-size: .85em;
  color: #777;
  cursor: pointer;
}

/* Consent checkbox */
.consent-checkbox {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 0.8rem 0 1rem;
  cursor: pointer;
  user-select: none;
}

.consent-checkbox input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: auto;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 2px solid #ccc;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color .2s, background .2s;
}

.custom-checkbox::after {
  content: "";
  width: 9px;
  height: 5px;
  border-left: 2px solid white;
  border-bottom: 2px solid white;
  transform: rotate(-45deg) scale(0);
  transition: transform .15s ease;
}

.consent-checkbox input:checked + .custom-checkbox {
  background: #58c27d;
  border-color: #58c27d;
}

.consent-checkbox input:checked + .custom-checkbox::after {
  transform: rotate(-45deg) scale(1);
}

.consent-text {
  font-size: 0.75em;
  line-height: 1.4;
  color: #555;
}

.consent-text a { color: #58c27d; font-weight: 500; text-decoration: none; }
.consent-text a:hover { text-decoration: underline; }
</style>
