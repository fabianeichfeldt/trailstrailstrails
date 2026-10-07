<template>
  <div class="sheet-backdrop" @click.self="emit('close')">
    <div
      ref="dialog"
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="soil-locked-title"
      tabindex="-1"
      data-testid="soil-locked-sheet"
      @keydown.esc="emit('close')"
    >
      <button type="button" class="close" aria-label="Schließen" data-testid="soil-locked-close" @click="emit('close')">×</button>

      <h2 id="soil-locked-title">
        <template v-if="loggedIn">{{ FEATURES.soil_radar.label }} ist eine {{ plan }}-Funktion</template>
        <template v-else>{{ promoActive ? 'Für begrenzte Zeit kostenlos' : `${FEATURES.soil_radar.label} für Supporter` }}</template>
      </h2>
      <p class="hint">
        Das war eine Beispielansicht. Mit dem {{ FEATURES.soil_radar.label }} siehst du auf einen Blick, wo der Boden gerade
        <strong>Hero Dirt</strong> ist, und filterst die Karte nach Trockenheit.
      </p>

      <template v-if="!loggedIn">
        <button type="button" class="cta" data-testid="soil-locked-cta" @click="mapStore.authModalOpen = true">
          {{ promoActive ? `Jetzt registrieren – ${SIGNUP_PROMO.weeks} Wochen kostenlos` : 'Jetzt registrieren' }}
        </button>
      </template>
      <NuxtLink v-else to="/plans" class="cta" data-testid="soil-locked-link">Supporter werden</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FEATURES, minPlanName, SIGNUP_PROMO, isSignupPromoActive } from '~/entitlements/features'

const emit = defineEmits<{ close: [] }>()

// Shared stores only; auth state is never copied locally.
const authStore = useAuthStore()
const mapStore = useMapStore()
const loggedIn = computed(() => authStore.isLoggedIn)
const plan = minPlanName('soil_radar')
const promoActive = isSignupPromoActive()

// Escape works only if focus is inside the dialog.
const dialog = ref<HTMLElement | null>(null)
onMounted(() => dialog.value?.focus())
</script>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(15, 20, 35, 0.35);
}
.sheet {
  position: relative;
  width: 100%;
  max-width: 30em;
  box-sizing: border-box;
  padding: 1.4em 1.2em calc(1.2em + env(safe-area-inset-bottom));
  background: #fff;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0.6em;
  outline: none;
  animation: sheet-up 0.25s ease-out;
}
h2 { margin: 0; padding-right: 44px; font-size: 18px; line-height: 1.25; color: #1a2035; }
.hint { margin: 0; font-size: 14px; line-height: 1.45; color: #4a5568; }
.close {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 44px;
  height: 44px;
  border: none;
  background: none;
  font-size: 28px;
  line-height: 1;
  color: #4a5568;
  cursor: pointer;
}
.cta {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px 16px;
  box-sizing: border-box;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  color: #1a5c3a;
  background: #e6f4ec;
  border: 1px solid #b7dcc6;
  border-radius: 999px;
  cursor: pointer;
}
.cta:hover { background: #d5ecdf; }
.cta:focus-visible, .close:focus-visible { outline: 2px solid #1a5c3a; outline-offset: 2px; }
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .sheet { animation: none; } }
</style>
