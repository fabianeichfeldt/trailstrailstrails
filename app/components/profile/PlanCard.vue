<template>
  <section class="profile-section plan-card" data-testid="plan-card">
    <h3 class="section-title">Mein Abo</h3>

    <div class="pass" :class="{ 'pass-paid': isPaid }">
      <div class="pass-head">
        <p class="plan-name">{{ planName }}</p>
        <span v-if="chip" class="pass-chip" :class="`pass-chip-${chip.tone}`" data-testid="plan-chip">{{ chip.label }}</span>
      </div>

      <p v-if="memberSince" class="pass-since">{{ memberSince }}</p>
      <p v-if="statusLine" class="plan-status">{{ statusLine }}</p>
      <p v-if="showPitch" class="pass-pitch">
        Mit Supporter siehst du für jeden Spot, wie fahrbar der Trail gerade ist.
      </p>

      <p v-if="subStore.isPastDue" class="plan-warning" role="alert">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        Zahlung fehlgeschlagen — bitte Zahlungsmittel aktualisieren.
      </p>
      <p v-if="error" class="plan-error" role="alert">{{ error }}</p>

      <div class="plan-actions">
        <button v-if="subStore.isPastDue" type="button" class="plan-btn plan-btn-primary" :disabled="busy" @click="onPortal">
          Zahlungsmittel aktualisieren
        </button>
        <button v-if="subStore.subscription?.hasCustomer && !subStore.isPastDue" type="button" class="plan-btn" :disabled="busy" @click="onPortal">
          Abo verwalten
        </button>
        <button v-if="subStore.isCancelScheduled" type="button" class="plan-btn plan-btn-primary" :disabled="busy" @click="onResume">
          Kündigung zurücknehmen
        </button>
        <NuxtLink v-if="subStore.subscription && !subStore.isCancelScheduled" to="/kuendigen" class="plan-btn plan-cancel">
          Kündigen
        </NuxtLink>
        <NuxtLink v-if="showBuy" to="/plans" class="plan-btn plan-btn-primary">Supporter werden</NuxtLink>
      </div>

      <p v-if="showNativeHint" class="plan-hint">Supporter kannst du auf trailradar.org abschließen.</p>
    </div>

    <NuxtLink to="/kuendigen" class="plan-cancel-link">Verträge hier kündigen</NuxtLink>
  </section>
</template>

<script setup lang="ts">
import { openPortal, resumeSubscription } from '~/communication/billing'
import { planNameForLevel } from '~/entitlements/features'

const subStore = useSubscriptionStore()
const authStore = useAuthStore()
const isNative = useIsNativeApp()

const busy = ref(false)
const error = ref('')

const planName = computed(() => {
  const level = subStore.entitlement.level
  return level > 0 ? planNameForLevel(level) : 'Kostenlos'
})

const CREW_LABEL = { trailcrew: 'Trailcrew', admin: 'Admin' } as const

function fmt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : ''
}

const statusLine = computed(() => {
  const sub = subStore.subscription
  if (sub && !subStore.isPastDue) {
    const date = fmt(sub.currentPeriodEnd)
    if (!date) return ''
    return subStore.isCancelScheduled ? `endet am ${date}` : `verlängert sich am ${date}`
  }
  if (!sub && subStore.crewRole) return `Gratis als ${CREW_LABEL[subStore.crewRole]}`
  if (!sub && subStore.isEarlyAdopter) return `Gratis bis ${fmt(subStore.entitlement.earlyAdopterFreeUntil)}`
  return ''
})

// Any paid level, including the early-adopter grant, gets the dark Supporter card.
const isPaid = computed(() => subStore.entitlement.level > 0)

const chip = computed<{ label: string; tone: 'ok' | 'warn' | 'bad' } | null>(() => {
  if (subStore.isPastDue) return { label: 'Zahlung offen', tone: 'bad' }
  if (subStore.isCancelScheduled) return { label: 'Gekündigt', tone: 'warn' }
  if (subStore.subscription) return { label: 'Aktiv', tone: 'ok' }
  if (subStore.crewRole || subStore.isEarlyAdopter) return { label: 'Gratis', tone: 'ok' }
  return null
})

const memberSince = computed(() => {
  const created = subStore.subscription?.createdAt
  if (!created) return ''
  return `Supporter seit ${new Date(created).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`
})

// Crew never needs to pay, so no upsell even once a signup grant has run out.
const showBuy = computed(() => !subStore.subscription && !subStore.crewRole && subStore.canBuy(isNative.value))
const showNativeHint = computed(() => isNative.value && !subStore.subscription)
const showPitch = computed(() => !isPaid.value && !isNative.value)

async function onPortal() {
  error.value = ''
  busy.value = true
  try {
    const res = await openPortal(await authStore.getToken())
    if (res.ok) window.location.href = res.url
    else error.value = 'Das Kundenportal konnte nicht geöffnet werden. Bitte versuche es später erneut.'
  } finally {
    busy.value = false
  }
}

async function onResume() {
  error.value = ''
  busy.value = true
  try {
    const res = await resumeSubscription(await authStore.getToken())
    if (res.ok) await subStore.load()
    else error.value = 'Die Kündigung konnte nicht zurückgenommen werden. Bitte versuche es später erneut.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
/* Same ink + trail green as the Supporter card on /plans. Card-scoped selectors
   outrank the layout's `.page-layout .container p` colour. */
.pass {
  position: relative;
  overflow: hidden;
  padding: 1.25rem 1.25rem 1.1rem;
  border-radius: 20px;
  background: #f5f6f5;
  color: #1f2937;
}
.pass-paid {
  background: linear-gradient(150deg, var(--color-supporter-bg), var(--color-supporter-bg-end));
  color: #f3f4f3;
}
.pass-paid::before {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-radial-gradient(circle at 105% -20%, transparent 0 18px, rgba(255, 255, 255, 0.06) 18px 19px);
  pointer-events: none;
}
.pass > * { position: relative; }

.pass-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.pass .plan-name { margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.01em; color: #111827; }
.pass-paid .plan-name { color: #fff; }

.pass-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
  white-space: nowrap;
}
.pass-chip::before { content: ""; width: 0.45rem; height: 0.45rem; border-radius: 50%; background: currentColor; }
.pass-chip-ok { background: rgba(255, 255, 255, 0.12); color: var(--color-supporter-accent); }
.pass-chip-warn { background: rgba(251, 191, 36, 0.16); color: #fbbf24; }
.pass-chip-bad { background: rgba(248, 113, 113, 0.16); color: #f87171; }
.pass:not(.pass-paid) .pass-chip-ok { background: #d9f2e1; color: #1f7a45; }

.pass .pass-since { margin: 0.2rem 0 0; font-size: 0.82rem; color: var(--color-supporter-muted); }
.pass .plan-status { margin: 0.35rem 0 0; font-size: 0.92rem; color: #4b5563; }
.pass-paid .plan-status { color: #d6dbd8; }
.pass .pass-pitch { margin: 0.35rem 0 0; font-size: 0.88rem; line-height: 1.45; color: #4b5563; }

.pass .plan-warning {
  display: flex; gap: 0.55rem; align-items: baseline;
  margin: 0.9rem 0 0; padding: 0.65rem 0.8rem; border-radius: 12px;
  background: rgba(251, 191, 36, 0.14); color: #fcd34d; font-size: 0.85rem;
}
.pass .plan-error {
  margin: 0.9rem 0 0; padding: 0.65rem 0.8rem; border-radius: 12px;
  background: #fee2e2; color: #991b1b; font-size: 0.85rem;
}
.pass-paid .plan-error { background: rgba(220, 38, 38, 0.18); color: #fecaca; }

.plan-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-top: 1.1rem; }
.plan-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; padding: 0 1.25rem; border-radius: 999px;
  border: 1.5px solid #d1d5db; background: #fff; color: #1f2937;
  font: inherit; font-size: 0.9rem; font-weight: 700; text-decoration: none; cursor: pointer;
}
.plan-btn:hover { border-color: #1f2937; text-decoration: none; }
.plan-btn:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 2px; }
.plan-btn:disabled { opacity: 0.6; pointer-events: none; }
.pass-paid .plan-btn { background: transparent; border-color: rgba(255, 255, 255, 0.35); color: #fff; }
.pass-paid .plan-btn:hover { background: rgba(255, 255, 255, 0.08); }
.pass-paid .plan-btn:focus-visible { outline-color: #fff; }
.pass .plan-btn-primary { background: var(--color-supporter-bg); border-color: var(--color-supporter-bg); color: #fff; }
.pass .plan-btn-primary:hover { background: var(--color-supporter-bg-end); }
.pass-paid .plan-btn-primary { background: var(--color-page-accent); border-color: var(--color-page-accent); color: var(--color-page-bg); }
.pass-paid .plan-btn-primary:hover { background: #6fd292; }
/* Cancelling stays reachable but reads as the quiet option next to "Abo verwalten". */
.pass .plan-cancel { border-color: transparent; background: transparent; color: #6b7280; }
.pass-paid .plan-cancel { border-color: transparent; color: var(--color-supporter-muted); }
.pass .plan-cancel:hover { text-decoration: underline; border-color: transparent; background: transparent; }

.pass .plan-hint { margin: 0.8rem 0 0; color: #6b7280; font-size: 0.88rem; }
.pass-paid .plan-hint { color: var(--color-supporter-muted); }
.plan-cancel-link {
  display: inline-flex; align-items: center; min-height: 44px;
  margin-top: 0.3rem; font-size: 0.8rem; color: #6b7280; text-decoration: underline;
}
</style>
