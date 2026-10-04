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
        <section class="plan plan-free" data-testid="plan-free">
          <h2 class="plan-name">Free</h2>
          <p class="plan-tagline">Alles, um offizielle Trails zu finden.</p>
          <div v-if="!isNative" class="plan-price">
            <span class="plan-amount">0 €</span>
            <span class="plan-period">für immer</span>
          </div>
          <ul class="plan-features">
            <li v-for="f in FREE_FEATURES" :key="f">
              <i class="fa-solid fa-check plan-icon" aria-hidden="true"></i>{{ f }}
            </li>
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
            <li class="plan-features-all">
              <i class="fa-solid fa-check plan-icon" aria-hidden="true"></i>Alles aus Free
            </li>
            <li v-for="f in SUPPORTER_FEATURES" :key="f.text">
              <i :class="['fa-solid', f.icon, 'plan-icon']" aria-hidden="true"></i>{{ f.text }}
            </li>
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
              <NuxtLink to="/profile" class="plan-btn plan-btn-ghost">Zu meinem Profil</NuxtLink>
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
        <ul class="facts-grid">
          <li>
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
            <span><strong>Jederzeit kündbar</strong> zum Ende des Abrechnungszeitraums – mit einem Klick.
              Das Jahres-Abo läuft nach dem ersten Jahr monatlich weiter und ist dann monatlich kündbar.</span>
          </li>
          <li>
            <i class="fa-solid fa-hand-holding-heart" aria-hidden="true"></i>
            <span><strong>14 Tage Geld-zurück</strong>, wenn du nicht zufrieden bist.</span>
          </li>
          <li>
            <i class="fa-solid fa-receipt" aria-hidden="true"></i>
            <span>Bezahlung und Rechnung über unseren Zahlungsanbieter Creem. Alle Preise sind Endpreise inkl. MwSt.</span>
          </li>
          <li>
            <i class="fa-solid fa-envelope" aria-hidden="true"></i>
            <span>
              Fragen? Schreib an <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>
              oder über das <NuxtLink to="/kontakt">Kontaktformular</NuxtLink>.
            </span>
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
  { icon: 'fa-mountain', text: 'Trail-Zustand für jeden Spot: Wie fahrbar ist der Boden gerade – von staubig bis schlammig?' },
  { icon: 'fa-cloud-rain', text: 'Regen der letzten 10 Tage und Wetter-Vorschau, Tag für Tag' },
  { icon: 'fa-temperature-half', text: 'Aktuelles Wetter am Spot' },
  { icon: 'fa-road-barrier', text: 'Live-Hinweis, ob eine Regensperre gerade greift' },
  { icon: 'fa-heart', text: 'Du unterstützt ein unabhängiges, werbefreies Projekt' },
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
/* Ink + trail green come from the site chrome (--color-page-*), so the Supporter card matches header and footer. */
.interval-toggle {
  display: flex;
  gap: 0.25rem;
  width: fit-content;
  margin: 0.5rem auto 2.25rem;
  padding: 0.3rem;
  background: #eef0ef;
  border-radius: 999px;
}
.toggle-btn {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 1.3rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  color: #4b5563;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.toggle-btn:hover:not(.active) { color: #111827; }
.toggle-btn.active { background: var(--color-supporter-bg); color: #fff; }
.toggle-btn:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 2px; }
.toggle-save {
  margin-left: 0.45rem;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  background: #d9f2e1;
  color: #1f7a45;
  font-size: 0.75rem;
  font-weight: 800;
}
.toggle-btn.active .toggle-save { background: var(--color-page-accent); color: var(--color-page-bg); }

.plans {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.plan {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 1.75rem 1.5rem 1.5rem;
  border-radius: 24px;
}
.plan-free { background: #f5f6f5; color: #1f2937; }
.plan-featured {
  background: linear-gradient(150deg, var(--color-supporter-bg), var(--color-supporter-bg-end));
  color: #f3f4f3;
  box-shadow: 0 24px 48px -20px rgba(31, 59, 45, 0.5);
}
/* Faint contour lines: the topo-map motif, kept behind the content. */
.plan-featured::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    repeating-radial-gradient(circle at 110% -10%, transparent 0 22px, rgba(255, 255, 255, 0.06) 22px 23px);
  pointer-events: none;
}
.plan-featured > * { position: relative; }
.plan-badge {
  position: absolute;
  top: -0.85rem;
  left: 1.5rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  background: var(--color-page-accent);
  color: var(--color-page-bg);
  font-size: 0.78rem;
  font-weight: 800;
}
.plan-featured > .plan-badge { position: absolute; }

/* Card-scoped selectors outrank the layout's `.page-layout .container p/h2` colours. */
.plan .plan-name { margin: 0; font-size: 1.35rem; font-weight: 800; color: #111827; }
.plan-featured .plan-name { color: #fff; }
.plan .plan-tagline { margin: 0.35rem 0 1.25rem; font-size: 0.88rem; line-height: 1.45; color: #6b7280; }
.plan-featured .plan-tagline { color: var(--color-supporter-muted); }

.plan-price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.55rem;
  padding-bottom: 1.25rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid #e3e6e4;
}
.plan-featured .plan-price { border-bottom-color: rgba(255, 255, 255, 0.12); }
.plan-amount { font-size: 2.6rem; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
.plan-free .plan-amount { color: #374151; }
.plan-featured .plan-amount { color: #fff; }
.plan-period { font-size: 0.9rem; color: #6b7280; }
.plan-featured .plan-period { color: var(--color-supporter-muted); }
.plan-sub, .plan-vat { flex-basis: 100%; font-size: 0.78rem; color: #6b7280; }
.plan-featured .plan-vat { color: var(--color-supporter-muted); }
.plan-sub { margin-top: 0.35rem; color: #1f7a45; font-weight: 700; }
.plan-featured .plan-sub { color: var(--color-supporter-accent); }

.plan-features {
  flex: 1;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}
.plan-features li {
  display: flex;
  gap: 0.75rem;
  padding: 0.4rem 0;
  font-size: 0.9rem;
  line-height: 1.45;
}
.plan-icon {
  flex: 0 0 1.25rem;
  margin-top: 0.2rem;
  text-align: center;
  font-size: 0.85rem;
  color: #9ca3af;
}
.plan-featured .plan-icon { color: var(--color-supporter-accent); }
.plan-features .plan-features-all { font-weight: 700; color: #fff; }

.plan-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 50px;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 999px;
  background: var(--color-page-accent);
  color: var(--color-page-bg);
  font: inherit;
  font-weight: 800;
  font-size: 0.95rem;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.plan-btn:hover { background: #6fd292; text-decoration: none; }
.plan-btn:active { transform: scale(0.98); }
.plan-btn:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.plan-btn:disabled { background: rgba(255, 255, 255, 0.15); color: var(--color-supporter-muted); cursor: default; transform: none; }
.plan-btn-secondary {
  background: #fff;
  color: #1f2937;
  border: 1.5px solid #d1d5db;
}
.plan-btn-secondary:hover { background: #fff; border-color: #1f2937; }
.plan-btn-secondary:focus-visible { outline-color: var(--color-primary); }
.plan-btn-ghost {
  background: transparent;
  color: #fff;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
}
.plan-btn-ghost:hover { background: rgba(255, 255, 255, 0.08); }

.plan-featured .plan-notice { margin: 0 0 1rem; font-size: 0.76rem; line-height: 1.5; color: var(--color-supporter-muted); }
.plan-featured .plan-notice a { color: #d6dbd8; text-decoration: underline; }
.plan-featured .plan-state { margin: 0 0 1rem; font-size: 0.9rem; line-height: 1.45; color: #d6dbd8; }
.plan-featured .plan-state-strong { font-weight: 800; font-size: 1.05rem; color: #fff; }
.plan-featured .plan-error {
  margin: 0.85rem 0 0;
  padding: 0.6rem 0.8rem;
  font-size: 0.84rem;
  color: #fecaca;
  background: rgba(220, 38, 38, 0.18);
  border-radius: 12px;
}
.plan-test-mode { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; font-size: 0.84rem; }
.plan-test-mode input { width: 20px; height: 20px; accent-color: var(--color-page-accent); }
.plan-featured .plan-promo { margin: 0.85rem 0 0; font-size: 0.82rem; color: var(--color-supporter-accent); text-align: center; }

.container .native-note { max-width: 800px; margin: 1.75rem auto 0; text-align: center; color: #4b5563; }

.facts { max-width: 800px; margin: 3.5rem auto 0; }
.container .facts h2 { margin: 0 0 1.25rem; font-size: 1.15rem; font-weight: 800; }
.facts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem 2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.facts-grid li {
  display: flex;
  gap: 0.9rem;
  font-size: 0.88rem;
  line-height: 1.55;
  color: #374151;
}
.facts-grid i {
  flex: 0 0 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #eef0ef;
  color: var(--color-page-bg);
  font-size: 0.9rem;
}
.facts-grid strong { color: #111827; }
.facts a { color: #1f7a45; text-decoration: underline; }
.facts .facts-terms { margin: 1.75rem 0 0; font-size: 0.82rem; color: #6b7280; }

@media (min-width: 720px) {
  .plans { grid-template-columns: 1fr 1fr; align-items: stretch; }
  .plan { padding: 2rem 1.75rem 1.75rem; }
  .facts-grid { grid-template-columns: 1fr 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .toggle-btn, .plan-btn { transition: none; }
  .plan-btn:active { transform: none; }
}
</style>
