<template>
  <section class="profile-section delete-account" data-testid="delete-account-section">
    <h3 class="section-title">Konto löschen</h3>

    <p v-if="authStore.isAdmin" class="delete-hint">
      Admin-Konten können nicht selbst gelöscht werden — bitte direkt in der Datenbank entfernen.
    </p>

    <template v-else>
      <p class="delete-text">
        Dein Konto, dein Profil, deine Favoriten und deine Rollen werden sofort und endgültig gelöscht.
        Deine Fotos, Kommentare und eingetragenen Spots bleiben für die Community erhalten und werden als
        „Gelöschter Nutzer“ angezeigt.
      </p>

      <p v-if="blockedBySubscription" class="delete-block" role="status">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        Du hast ein laufendes Supporter-Abo. Bitte kündige es zuerst, dann kannst du dein Konto löschen.
        <NuxtLink to="/kuendigen" class="delete-block-link">Abo kündigen</NuxtLink>
      </p>

      <button
        type="button"
        class="delete-open-btn"
        data-testid="delete-account-open"
        :disabled="!subStore.loaded || blockedBySubscription"
        @click="open"
      >
        Konto löschen
      </button>
    </template>

    <Teleport to="body">
      <div v-if="modalOpen" class="delete-backdrop" @click.self="close">
        <div class="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
          <h3 id="delete-account-title" class="delete-modal-title">Konto endgültig löschen?</h3>
          <p class="delete-modal-text">
            Das kann nicht rückgängig gemacht werden. Tippe <strong>{{ CONFIRM_WORD }}</strong> ein, um zu bestätigen.
          </p>
          <input
            v-model="typed"
            class="delete-input"
            data-testid="delete-account-input"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            :placeholder="CONFIRM_WORD"
            aria-label="Bestätigung"
          />
          <p v-if="error" class="delete-error" data-testid="delete-account-error" role="alert">{{ error }}</p>
          <div class="delete-actions">
            <button type="button" class="delete-cancel-btn" @click="close">Abbrechen</button>
            <button
              type="button"
              class="delete-confirm-btn"
              data-testid="delete-account-confirm"
              :disabled="!confirmed || deleting"
              @click="onDelete"
            >
              {{ deleting ? 'Wird gelöscht…' : 'Endgültig löschen' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { deleteAccount } from '~/communication/account'
import { showToast } from '~/utils/toast'

const CONFIRM_WORD = 'LÖSCHEN'

const authStore = useAuthStore()
const subStore = useSubscriptionStore()

const modalOpen = ref(false)
const typed = ref('')
const deleting = ref(false)
const error = ref('')

// UX only; delete-account re-checks. Manual grants never charge, a scheduled cancel won't charge again.
const blockedBySubscription = computed(() => {
  const sub = subStore.subscription
  return !!sub && sub.provider !== 'manual' && !sub.cancelAtPeriodEnd
})

const confirmed = computed(() => typed.value.trim().toUpperCase() === CONFIRM_WORD)

const ERRORS = {
  active_subscription: 'Du hast noch ein laufendes Abo. Bitte kündige es zuerst.',
  admin: 'Admin-Konten können nicht selbst gelöscht werden.',
  unknown: 'Dein Konto konnte nicht gelöscht werden. Bitte versuche es später erneut.',
} as const

function open() {
  typed.value = ''
  error.value = ''
  modalOpen.value = true
}

function close() {
  if (deleting.value) return
  modalOpen.value = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && modalOpen.value) close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

async function onDelete() {
  if (!confirmed.value) return
  error.value = ''
  deleting.value = true
  try {
    const res = await deleteAccount(await authStore.getToken())
    if (!res.ok) {
      error.value = ERRORS[res.error]
      return
    }
    // The account is already gone, so a failing server-side logout must not keep the user here.
    await authStore.signOut().catch(() => {})
    modalOpen.value = false
    showToast('Dein Konto wurde gelöscht. Ride on! 🤙', 'success')
    await navigateTo('/map')
  } catch {
    error.value = ERRORS.unknown
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.delete-account .section-title { color: #b91c1c; }

.delete-text,
.delete-hint {
  margin: 0 0 0.9em;
  font-size: 0.85em;
  line-height: 1.5;
  color: #4b5563;
}

.delete-block {
  margin: 0 0 0.9em;
  padding: 0.6em 0.8em;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 0.85em;
  line-height: 1.45;
}

.delete-block-link {
  display: inline-block;
  margin-left: 0.25em;
  font-weight: 700;
  color: inherit;
}

.delete-open-btn {
  min-height: 44px;
  padding: 0.5em 1.1em;
  border: 1.5px solid #dc2626;
  border-radius: 8px;
  background: #fff;
  color: #b91c1c;
  font-weight: 600;
  cursor: pointer;
}
.delete-open-btn:hover:not(:disabled) { background: #fef2f2; }
.delete-open-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.delete-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 1rem;
}

.delete-modal {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem 1.25rem 1.25rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  max-height: 90vh;
  overflow-y: auto;
}

.delete-modal-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: #1a202c;
}

.delete-modal-text {
  margin: 0 0 0.9rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: #4b5563;
}

/* 16px keeps iOS Safari from zooming into the field. */
.delete-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: 0.55rem 0.65rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  font-family: inherit;
  letter-spacing: 0.05em;
  outline: none;
}
.delete-input:focus { border-color: #dc2626; }

.delete-error {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 0.82rem;
}

.delete-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 1rem;
}

.delete-cancel-btn,
.delete-confirm-btn {
  min-height: 44px;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.delete-cancel-btn {
  border: 1.5px solid #d1d5db;
  background: #fff;
}
.delete-cancel-btn:hover { background: #f3f4f6; }

.delete-confirm-btn {
  border: none;
  background: #dc2626;
  color: #fff;
  font-weight: 600;
}
.delete-confirm-btn:hover:not(:disabled) { background: #b91c1c; }
.delete-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
