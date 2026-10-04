<template>
  <div>
    <PageHero>
      <h1>Preise &amp; Pläne</h1>
      <p>Trailradar ist kostenlos. Mit Supporter bekommst du den Trail-Zustand – und hältst das Projekt am Laufen.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <div v-if="!isNative" class="interval-toggle" role="group" aria-label="Abrechnungszeitraum">
        <button
          type="button" data-testid="interval-monthly" class="toggle-btn"
          :class="{ active: interval === 'monthly' }" :aria-pressed="interval === 'monthly'"
          @click="interval = 'monthly'"
        >Monatlich</button>
        <button
          type="button" data-testid="interval-yearly" class="toggle-btn"
          :class="{ active: interval === 'yearly' }" :aria-pressed="interval === 'yearly'"
          @click="interval = 'yearly'"
        >
          Jährlich <span v-if="savingPercent" class="toggle-save">−{{ savingPercent }} %</span>
        </button>
      </div>

      <div class="plans">
        <section class="plan" data-testid="plan-free">
          <h2 class="plan-name">Free</h2>
          <p class="plan-tagline">Alles, um offizielle Trails zu finden.</p>
          <div v-if="!isNative" class="plan-price">
            <span class="plan-amount">0 €</span>
            <span class="plan-period">für immer</span>
          </div>
          <ul class="plan-features">
            <li v-for="f in FREE_FEATURES" :key="f">{{ f }}</li>
          </ul>
          <template v-if="!isNative">
            <NuxtLink v-if="authStore.isLoggedIn" to="/map" class="plan-btn plan-btn-secondary">Zur Karte</NuxtLink>
            <button v-else type="button" class="plan-btn plan-btn-secondary" @click="mapStore.authModalOpen = true">
              Kostenlos registrieren
            </button>
          </template>
        </section>

        <section class="plan plan-featured" data-testid="plan-supporter">
          <span class="plan-badge">Mit Trail-Zustand</span>
          <h2 class="plan-name">Supporter</h2>
          <p class="plan-tagline">Für alle, die vor der Fahrt wissen wollen, wie der Trail ist.</p>
          <div v-if="!isNative" class="plan-price">
            <template v-if="prices">
              <span class="plan-amount" data-testid="price">{{ priceMain }}</span>
              <span class="plan-period">{{ interval === 'monthly' ? 'pro Monat' : 'pro Jahr' }}</span>
              <span v-if="interval === 'yearly'" class="plan-sub">
                entspricht {{ perMonthOfYearly }} pro Monat – du sparst {{ savingPercent }} %
              </span>
            </template>
            <span v-else class="plan-period">Preis wird geladen …</span>
            <span class="plan-vat">Endpreis inkl. MwSt.</span>
          </div>
          <ul class="plan-features">
            <li class="plan-features-all">Alles aus Free</li>
            <li v-for="f in SUPPORTER_FEATURES" :key="f">{{ f }}</li>
          </ul>
          <div v-if="!isNative" class="plan-cta">
            <template v-if="!authStore.isLoggedIn">
              <button type="button" class="plan-btn" data-testid="supporter-cta" @click="mapStore.authModalOpen = true">
                Registrieren
              </button>
              <p v-if="promoActive" class="plan-promo">
                Mit der Registrierung bekommst du Trail-Zustand {{ SIGNUP_PROMO.weeks }} Wochen gratis.
              </p>
            </template>

            <template v-else-if="subStore.subscription">
              <p class="plan-state plan-state-strong">Du bist Supporter ❤️</p>
              <NuxtLink to="/profile" class="plan-btn plan-btn-secondary">Zu meinem Profil</NuxtLink>
            </template>

            <p v-else-if="subStore.eligibility?.reason === 'grant_active'" class="plan-state">
              Du hast Trail-Zustand noch gratis bis {{ fmt(subStore.entitlement.earlyAdopterFreeUntil) }}.
              Ab {{ fmt(subStore.eligibility.eligibleFrom) }} kannst du hier Supporter werden.
            </p>

            <template v-else-if="canBuy">
              <p class="plan-notice" data-testid="withdrawal-notice">
                Weiter geht es zu unserem Zahlungsanbieter Creem, bei dem du zahlungspflichtig bestellst. Es gelten
                unsere <NuxtLink to="/terms#supporter">Nutzungsbedingungen</NuxtLink> und die
                <a href="https://www.creem.io/buyer-terms" target="_blank" rel="noopener">Käuferbedingungen von Creem</a>.
                <template v-if="interval === 'yearly'">Nach dem ersten Jahr läuft das Abo monatlich weiter und ist monatlich kündbar.</template>
                Nicht zufrieden? 14 Tage Geld-zurück.
              </p>
              <label v-if="authStore.isAdmin" class="plan-test-mode">
                <input v-model="testMode" type="checkbox" data-testid="test-mode">
                Testmodus
              </label>
              <button type="button" class="plan-btn" data-testid="supporter-cta" :disabled="busy" @click="onCheckout">
                {{ subStore.isEarlyAdopter ? 'Supporter werden — Abrechnung startet sofort' : 'Supporter werden' }}
              </button>
              <p v-if="error" class="plan-error" role="alert">{{ error }}</p>
            </template>

            <p v-else class="plan-state">
              {{ subStore.loaded ? 'Supporter werden ist für dich gerade nicht möglich.' : 'Wird geladen …' }}
            </p>
          </div>
        </section>
      </div>

      <p v-if="isNative" class="native-note">Supporter kannst du auf trailradar.org abschließen.</p>

      <section v-else class="facts">
        <h2>Gut zu wissen</h2>
        <ul>
          <li><strong>Jederzeit kündbar</strong> zum Ende des Abrechnungszeitraums – mit einem Klick.</li>
          <li>Das Jahres-Abo läuft nach dem ersten Jahr monatlich weiter und ist dann monatlich kündbar.</li>
          <li><strong>14 Tage Geld-zurück</strong>, wenn du nicht zufrieden bist.</li>
          <li>Bezahlung und Rechnung über unseren Zahlungsanbieter Creem. Alle Preise sind Endpreise inkl. MwSt.</li>
          <li>
            Fragen? Schreib an <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>
            oder über das <NuxtLink to="/kontakt">Kontaktformular</NuxtLink>.
          </li>
        </ul>
        <p class="facts-terms">
          Alle Details stehen in den <NuxtLink to="/terms#supporter">Nutzungsbedingungen</NuxtLink>.
        </p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { startCheckout } from '~/communication/billing'
import { getSupporterPrices } from '~/communication/plans'
import { SIGNUP_PROMO, isSignupPromoActive } from '~/entitlements/features'

useSeoMeta({
  title: 'Preise & Pläne',
  ogTitle: 'Preise & Pläne | Trailradar',
  description: 'Trailradar ist kostenlos. Supporter bringt den Trail-Zustand: Bodenzustand und Wetter für jeden Spot.',
  ogUrl: 'https://trailradar.org/plans',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/plans' }],
})

const FREE_FEATURES = [
  'Karte aller offiziellen MTB-Trails, Bikeparks und Dirtparks',
  'Spot-Details mit Status, Regeln und Öffnungszeiten',
  'GPX-Touren mit Höhenprofil',
  'Fotos, Likes und Kommentare',
  'Neue Spots eintragen',
]

const SUPPORTER_FEATURES = [
  'Trail-Zustand für jeden Spot: Wie fahrbar ist der Boden gerade – von staubig bis schlammig?',
  'Regen der letzten 10 Tage und Wetter-Vorschau, Tag für Tag',
  'Aktuelles Wetter am Spot',
  'Live-Hinweis, ob eine Regensperre gerade greift',
  'Du unterstützt ein unabhängiges, werbefreies Projekt',
]

const authStore = useAuthStore()
const mapStore = useMapStore()
const subStore = useSubscriptionStore()
const isNative = useIsNativeApp()

// Build-time value for the static HTML, refreshed on mount so a price change needs no rebuild.
const { data: prices, refresh } = useAsyncData('supporter-prices', () => getSupporterPrices())
// Decided after mount: a prerender from before the promo's end must not freeze it into static HTML.
const promoActive = ref(false)
onMounted(() => {
  refresh()
  promoActive.value = isSignupPromoActive()
})

const interval = ref<'monthly' | 'yearly'>('monthly')
const testMode = ref(false)
const busy = ref(false)
const error = ref('')

const canBuy = computed(() => subStore.canBuy(isNative.value))

function fmt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : ''
}

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

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100)
}

const priceMain = computed(() => {
  const p = prices.value
  if (!p) return ''
  return money(interval.value === 'monthly' ? p.monthlyCents : p.yearlyCents, p.currency)
})

const perMonthOfYearly = computed(() => {
  const p = prices.value
  return p ? money(p.yearlyCents / 12, p.currency) : ''
})

// Rounded down so the page never promises more than the real saving.
const savingPercent = computed(() => {
  const p = prices.value
  if (!p || !p.monthlyCents) return 0
  return Math.max(0, Math.floor((1 - p.yearlyCents / (p.monthlyCents * 12)) * 100))
})
</script>

<style scoped>
.interval-toggle {
  display: flex;
  gap: 0.3rem;
  width: fit-content;
  margin: 0 auto 1.5rem;
  padding: 0.25rem;
  background: #eceeed;
  border-radius: 999px;
}
.toggle-btn {
  min-height: 44px;
  padding: 0 1.2rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}
.toggle-btn.active { background: #fff; color: #111827; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15); }
.toggle-save {
  margin-left: 0.3rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 0.75rem;
  font-weight: 700;
}

.plans {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  max-width: 760px;
  margin: 0 auto;
}

.plan {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 1.6rem 1.4rem;
  background: #fff;
  border: 1px solid #e3e6e4;
  border-radius: 20px;
  box-sizing: border-box;
}
.plan-featured {
  border: 2px solid var(--color-primary);
  box-shadow: 0 10px 30px rgba(43, 108, 176, 0.12);
}
.plan-badge {
  position: absolute;
  top: -0.8rem;
  left: 1.4rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
}

.plan-name { margin: 0; font-size: 1.15rem; }
.plan-tagline { margin: 0.25rem 0 0.9rem; color: #6b7280; font-size: 0.85rem; }

.plan-price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.5rem;
  margin-bottom: 1.2rem;
}
.plan-amount { font-size: 1.8rem; font-weight: 800; line-height: 1.1; color: #111827; }
.plan-period { color: #4b5563; font-size: 0.85rem; }
.plan-sub, .plan-vat { flex-basis: 100%; font-size: 0.75rem; color: #6b7280; }
.plan-sub { color: #15803d; font-weight: 600; }

.plan-features {
  flex: 1;
  margin: 0 0 1.4rem;
  padding: 0;
  list-style: none;
}
.plan-features li {
  position: relative;
  padding: 0.3rem 0 0.3rem 1.6rem;
  font-size: 0.88rem;
  line-height: 1.45;
}
.plan-features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  top: 0.32rem;
  width: 1.1rem;
  height: 1.1rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #dcfce7;
  color: #15803d;
  font-size: 0.72rem;
  font-weight: 800;
}
.plan-features .plan-features-all { font-weight: 700; }

.plan-btn {
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
  font-size: 0.92rem;
  text-decoration: none;
  cursor: pointer;
  box-sizing: border-box;
}
.plan-btn:disabled { background: #cbd5e1; color: #475569; cursor: default; }
.plan-btn-secondary {
  background: #fff;
  color: var(--color-primary);
  border: 1.5px solid var(--color-primary);
}
.plan-notice { margin: 0 0 0.8rem; font-size: 0.75rem; line-height: 1.45; color: #6b7280; }
.plan-state { margin: 0 0 0.8rem; font-size: 0.88rem; color: #374151; }
.plan-state-strong { font-weight: 700; font-size: 1rem; }
.plan-error {
  margin: 0.75rem 0 0;
  padding: 0.55rem 0.75rem;
  font-size: 0.82rem;
  color: #b91c1c;
  background: #fef2f2;
  border-radius: 10px;
}
.plan-test-mode { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; font-size: 0.82rem; }
.plan-test-mode input { width: 20px; height: 20px; }
.plan-promo { margin: 0.75rem 0 0; font-size: 0.8rem; color: #15803d; text-align: center; }

.native-note { max-width: 760px; margin: 1.5rem auto 0; text-align: center; color: #4b5563; }

.facts { max-width: 760px; margin: 2.5rem auto 0; }
.facts h2 { font-size: 1rem; margin: 0 0 0.6rem; }
.facts ul { margin: 0; padding-left: 1.2rem; }
.facts li { margin-bottom: 0.4rem; line-height: 1.5; font-size: 0.88rem; }
.facts-terms { margin-top: 0.8rem; font-size: 0.82rem; color: #4b5563; }

@media (min-width: 720px) {
  .plans { grid-template-columns: 1fr 1fr; }
  .plan { padding: 1.4rem 1.3rem; }
}
</style>
