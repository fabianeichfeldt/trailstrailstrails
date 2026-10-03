<template>
  <div>
    <PageHero>
      <h1>Supporter werden</h1>
      <p>Hilf mit, dass Trailradar unabhängig und werbefrei bleibt.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section class="section">
        <h2>Das bekommst du</h2>
        <ul class="benefits">
          <li>
            <strong>Trail-Zustand:</strong> Bodenzustand und Wetter-Prognose für deinen Spot —
            damit du weißt, ob sich die Fahrt lohnt.
          </li>
          <li>
            <strong>Unabhängiges Projekt:</strong> Trailradar ist ein Herzensprojekt der Community.
            Mit deinem Beitrag finanzierst du Server, Datenquellen und Weiterentwicklung.
          </li>
        </ul>
      </section>

      <section class="section buy-box">
        <template v-if="isNative">
          <p class="note">Supporter kannst du auf trailradar.org abschließen.</p>
        </template>

        <template v-else>
          <div v-if="prices" class="interval-toggle" role="group" aria-label="Abrechnungszeitraum">
            <button
              type="button" data-testid="interval-monthly" class="toggle-btn"
              :class="{ active: interval === 'monthly' }" :aria-pressed="interval === 'monthly'"
              @click="interval = 'monthly'"
            >Monatlich</button>
            <button
              type="button" data-testid="interval-yearly" class="toggle-btn"
              :class="{ active: interval === 'yearly' }" :aria-pressed="interval === 'yearly'"
              @click="interval = 'yearly'"
            >Jährlich</button>
          </div>

          <p v-if="priceText" class="price" data-testid="price">{{ priceText }}</p>

          <!-- Not logged in -->
          <template v-if="!authStore.isLoggedIn">
            <p v-if="promoActive" class="note">Mit der Registrierung bekommst du Trail-Zustand {{ SIGNUP_PROMO.weeks }} Wochen gratis.</p>
            <button type="button" class="cta" data-testid="supporter-cta" @click="mapStore.authModalOpen = true">
              Registrieren
            </button>
          </template>

          <!-- Already subscribed -->
          <template v-else-if="subStore.subscription">
            <p class="note strong">Du bist Supporter ❤️</p>
            <NuxtLink to="/profile" class="cta cta-link">Zu meinem Profil</NuxtLink>
          </template>

          <!-- Free grant still running for too long to buy -->
          <p v-else-if="subStore.eligibility?.reason === 'grant_active'" class="note">
            Du hast Trail-Zustand noch gratis bis {{ fmt(subStore.entitlement.earlyAdopterFreeUntil) }}.
            Ab {{ fmt(subStore.eligibility.eligibleFrom) }} kannst du hier Supporter werden.
          </p>

          <!-- Can buy -->
          <template v-else-if="canBuy">
            <!-- LEGAL REVIEW: placeholder copy for the digital-content withdrawal notice -->
            <p class="withdrawal" data-testid="withdrawal-notice">
              Mit dem Klick auf „Supporter werden“ stimmst du zu, dass die Leistung sofort beginnt.
              Damit erlischt dein Widerrufsrecht, sobald die Leistung vollständig erbracht wurde.
            </p>
            <label v-if="authStore.isAdmin" class="test-mode">
              <input v-model="testMode" type="checkbox" data-testid="test-mode" />
              Testmodus
            </label>
            <button type="button" class="cta" data-testid="supporter-cta" :disabled="busy" @click="onCheckout">
              {{ subStore.isEarlyAdopter ? 'Supporter werden — Abrechnung startet sofort' : 'Supporter werden' }}
            </button>
            <p v-if="error" class="error" role="alert">{{ error }}</p>
          </template>

          <p v-else class="note">
            {{ subStore.loaded ? 'Supporter werden ist für dich gerade nicht möglich.' : 'Wird geladen …' }}
          </p>
        </template>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { getSupporterPrices, startCheckout, type BillingInterval } from '~/communication/billing'
import { SIGNUP_PROMO, isSignupPromoActive } from '~/entitlements/features'

useHead({ title: 'Supporter werden – Trailradar' })

const authStore = useAuthStore()
const mapStore = useMapStore()
const subStore = useSubscriptionStore()
const isNative = useIsNativeApp()

// Build-time value for the static HTML, refreshed on mount so a price change needs no rebuild.
const { data: prices, refresh } = useAsyncData('supporter-prices', () => getSupporterPrices())
// Decided after mount: a prerender from before the promo's end must not freeze the promise into static HTML.
const promoActive = ref(false)
onMounted(() => {
  refresh()
  promoActive.value = isSignupPromoActive()
})

const interval = ref<BillingInterval>('monthly')
const testMode = ref(false)
const busy = ref(false)
const error = ref('')

const canBuy = computed(() => subStore.canBuy(isNative.value))

function fmt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : ''
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100)
}

const priceText = computed(() => {
  const p = prices.value
  if (!p) return ''
  if (interval.value === 'monthly') return `${money(p.monthlyCents, p.currency)} / Monat`
  return `${money(p.yearlyCents / 12, p.currency)} / Monat · ${money(p.yearlyCents, p.currency)} pro Jahr`
})

async function onCheckout() {
  error.value = ''
  busy.value = true
  try {
    const res = await startCheckout(await authStore.getToken(), interval.value, testMode.value ? 'test' : undefined)
    if (res.ok) {
      window.location.href = res.checkoutUrl
    } else if (res.error === 'already_subscribed') {
      error.value = 'Du hast bereits ein Abo.'
    } else if (res.error === 'grant_active') {
      error.value = `Dein Gratis-Zeitraum läuft noch.${res.eligibleFrom ? ` Ab ${fmt(res.eligibleFrom)} kannst du Supporter werden.` : ''}`
    } else {
      error.value = 'Das hat leider nicht geklappt. Bitte versuche es später noch einmal.'
    }
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.section { margin-bottom: 2em; }
.benefits { padding-left: 1.2rem; }
.benefits li { margin-bottom: 0.6rem; }

.buy-box {
  background: #f5f5f5;
  padding: 1.4rem;
  border-radius: 20px;
  max-width: 480px;
  box-sizing: border-box;
}

.interval-toggle {
  display: flex;
  gap: 0.4rem;
  padding: 0.25rem;
  background: #e5e5e5;
  border-radius: 999px;
  margin-bottom: 1rem;
}
.toggle-btn {
  flex: 1;
  min-height: 44px;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.toggle-btn.active { background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15); }

.price { font-size: 1.3rem; font-weight: 700; margin: 0 0 1rem; overflow-wrap: anywhere; }
.note { margin: 0 0 1rem; }
.note.strong { font-weight: 700; font-size: 1.1rem; }
.withdrawal { font-size: 0.8rem; color: #555; margin: 0 0 0.8rem; }
.test-mode { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; font-size: 0.85rem; }
.test-mode input { width: 20px; height: 20px; }

.cta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  padding: 0.5rem 1rem;
  box-sizing: border-box;
  border: none;
  border-radius: 999px;
  background: var(--color-page-accent);
  color: #000 !important;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}
.cta:disabled { opacity: 0.6; pointer-events: none; }

.error {
  margin: 0.8rem 0 0;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.9rem;
}
</style>
