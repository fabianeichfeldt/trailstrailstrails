<template>
  <section class="profile-section plan-card" data-testid="plan-card">
    <h3 class="section-title">Mein Abo</h3>

    <p class="plan-name">{{ planName }}</p>

    <p v-if="statusLine" class="plan-status">{{ statusLine }}</p>
    <p v-if="subStore.isPastDue" class="plan-warning" role="alert">
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
  if (!sub && subStore.isEarlyAdopter) return `Gratis bis ${fmt(subStore.entitlement.earlyAdopterFreeUntil)}`
  return ''
})

const showBuy = computed(() => !subStore.subscription && subStore.canBuy(isNative.value))
const showNativeHint = computed(() => isNative.value && !subStore.subscription)

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
.plan-name { font-size: 1.05rem; font-weight: 700; margin: 0; }
.plan-status { margin: 0.2rem 0 0; color: #555; font-size: 0.9rem; }
.plan-warning {
  margin: 0.6rem 0 0; padding: 0.6rem 0.8rem; border-radius: 10px;
  background: #fef3c7; color: #92400e; font-size: 0.85rem;
}
.plan-error {
  margin: 0.6rem 0 0; padding: 0.6rem 0.8rem; border-radius: 10px;
  background: #fee2e2; color: #991b1b; font-size: 0.85rem;
}
.plan-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.9rem; }
.plan-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; padding: 0 1.2rem; border-radius: 8px;
  border: 1px solid #ccc; background: #fff; color: #333;
  font-size: 0.9rem; font-weight: 600; text-decoration: none; cursor: pointer;
}
.plan-btn:disabled { opacity: 0.6; pointer-events: none; }
.plan-btn-primary { background: var(--color-primary); border-color: var(--color-primary); color: #fff !important; }
.plan-btn-primary:hover { background: var(--color-primary-hover); }
.plan-hint { margin: 0.8rem 0 0; color: #555; font-size: 0.9rem; }
.plan-cancel-link {
  display: inline-flex; align-items: center; min-height: 44px;
  margin-top: 0.4rem; font-size: 0.8rem; color: #777; text-decoration: underline;
}
</style>
