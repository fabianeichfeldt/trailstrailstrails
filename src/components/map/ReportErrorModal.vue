<template>
  <Teleport to="body">
    <div
      v-if="mapStore.reportModalOpen"
      class="report-error-backdrop"
      data-testid="report-error-backdrop"
      @click.self="close"
    >
      <div class="report-error-modal" data-testid="report-error-modal" role="dialog" aria-modal="true">
        <h3 class="report-error-title">Etwas stimmt nicht?</h3>
        <p class="report-error-sub">{{ mapStore.reportModalTrailName }}</p>
        <p class="report-error-intro">
          Wir geben uns größte Mühe, alle Infos aktuell und korrekt zu halten - aber manchmal schleicht sich ein
          Fehler ein. Beschreibe möglichst genau, was an der Beschreibung oder den Trails nicht stimmt, und falls
          bekannt, gerne auch gleich die Korrektur.
        </p>

        <label class="report-error-label">
          Was stimmt nicht?
          <textarea
            v-model="message"
            class="report-error-textarea"
            data-testid="report-error-textarea"
            maxlength="1000"
            placeholder="Was stimmt nicht?"
            rows="5"
          />
        </label>
        <div class="report-error-counter" data-testid="report-error-counter">{{ message.length }} / 1000</div>

        <p v-if="error" class="report-error-error" data-testid="report-error-error">{{ error }}</p>

        <div class="report-error-actions">
          <button class="report-error-btn-cancel" data-testid="report-error-cancel" @click="close">Abbrechen</button>
          <button
            class="report-error-btn-submit"
            data-testid="report-error-submit"
            :disabled="message.trim() === '' || submitting"
            @click="submit"
          >
            {{ submitting ? 'Wird gesendet…' : 'Senden' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { submitReport } from '~/communication/report'
import { showToast } from '~/utils/toast'

const authStore = useAuthStore()
const mapStore = useMapStore()

const message = ref('')
const submitting = ref(false)
const error = ref('')

watch(() => mapStore.reportModalOpen, (open) => {
  if (open) {
    message.value = ''
    error.value = ''
    submitting.value = false
  }
})

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && mapStore.reportModalOpen) close()
}

function close() {
  mapStore.reportModalOpen = false
  message.value = ''
  error.value = ''
}

async function submit() {
  if (!mapStore.reportModalTrailId) return
  error.value = ''
  submitting.value = true
  try {
    await submitReport(
      mapStore.reportModalTrailId,
      mapStore.reportModalTrailName ?? '',
      message.value.trim(),
      authStore.isLoggedIn ? authStore.userId : undefined,
    )
    showToast('Danke, wir schauen uns das an! 🙏', 'success')
    message.value = ''
    mapStore.reportModalOpen = false
  } catch (e: any) {
    error.value = 'Senden fehlgeschlagen, bitte versuche es erneut.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.report-error-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 1rem;
}

.report-error-modal {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem 1.25rem 1.25rem;
  width: 100%;
  max-width: 420px;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  max-height: 90vh;
  overflow-y: auto;
}

.report-error-title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 700;
  color: #1a202c;
}

.report-error-sub {
  margin: 0 0 0.9rem;
  font-size: 0.82rem;
  color: #6b7280;
}

.report-error-intro {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: #4b5563;
}

.report-error-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.3rem;
}

.report-error-textarea {
  padding: 0.55rem 0.65rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.report-error-textarea:focus { border-color: #2b6cb0; }

.report-error-counter {
  text-align: right;
  font-size: 0.72rem;
  color: #9ca3af;
  margin-bottom: 0.65rem;
}

.report-error-error {
  color: #dc2626;
  font-size: 0.82rem;
  padding: 0.5rem 0.75rem;
  background: #fef2f2;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.report-error-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 1rem;
}

.report-error-btn-cancel {
  padding: 0.45rem 1rem;
  min-height: 44px;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.report-error-btn-cancel:hover { background: #f3f4f6; }

.report-error-btn-submit {
  padding: 0.45rem 1rem;
  min-height: 44px;
  border: none;
  border-radius: 6px;
  background: #2b6cb0;
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.report-error-btn-submit:hover:not(:disabled) { background: #3182ce; }
.report-error-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
