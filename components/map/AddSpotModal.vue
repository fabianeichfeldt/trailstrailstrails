<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="add-spot-backdrop"
      data-testid="add-spot-backdrop"
      @click.self="$emit('close')"
    >
      <div class="add-spot-modal" data-testid="add-spot-modal" role="dialog" aria-modal="true">
        <button class="add-spot-close" aria-label="Schließen" @click="$emit('close')">×</button>
        <h3 class="add-spot-title">Neuer Eintrag</h3>

        <!-- Type selector — pill toggle, text only like the original popup -->
        <div class="type-switch" role="group" aria-label="Spot-Typ">
          <label v-for="t in TYPES" :key="t.value" class="type-option" :data-type="t.value" :data-testid="`add-spot-type-label-${t.value}`">
            <input
              type="radio"
              name="add-spot-type"
              :value="t.value"
              v-model="formType"
              :data-testid="`add-spot-type-${t.value}`"
            />
            <span class="switch-btn">{{ t.label }}</span>
          </label>
        </div>

        <!-- Dirtpark sub-type — toggle buttons like the original -->
        <div v-if="formType === 'dirtpark'" class="add-spot-subtype-label">
          Was findest du hier?
        </div>
        <div v-if="formType === 'dirtpark'" class="multi-select">
          <label class="multi-option" data-testid="add-spot-pumptrack">
            <input type="checkbox" v-model="pumptrack" />
            <span class="multi-btn">Pumptrack</span>
          </label>
          <label class="multi-option" data-testid="add-spot-dirtpark-flag">
            <input type="checkbox" v-model="dirtparkFlag" />
            <span class="multi-btn">Dirtpark</span>
          </label>
        </div>

        <!-- Name -->
        <label class="add-spot-label">
          Name *
          <input
            v-model="name"
            class="add-spot-input"
            data-testid="add-spot-name"
            type="text"
            placeholder="Trailname"
            maxlength="120"
          />
        </label>
        <p v-if="nameError" class="add-spot-field-error" data-testid="add-spot-name-error">
          {{ nameError }}
        </p>

        <!-- Coordinates display -->
        <div class="add-spot-location">📍 {{ lat.toFixed(5) }}, {{ lng.toFixed(5) }}</div>

        <!-- URL -->
        <label class="add-spot-label">
          Website <span class="add-spot-optional">(optional)</span>
          <input
            v-model="url"
            class="add-spot-input"
            data-testid="add-spot-url"
            type="url"
            placeholder="https://…"
          />
        </label>

        <!-- Instagram — always visible, optional -->
        <label class="add-spot-label">
          Instagram vom Verein/Trailbauer <span class="add-spot-optional">(optional)</span>
          <input
            v-model="instagram"
            class="add-spot-input"
            data-testid="add-spot-instagram"
            type="text"
            placeholder="@username"
          />
        </label>

        <!-- Creator — pre-filled + read-only when logged in, free text otherwise -->
        <label class="add-spot-label">
          Eingetragen von…
          <span v-if="!authStore.isLoggedIn" class="add-spot-optional">(optional)</span>
          <input
            v-model="creator"
            class="add-spot-input"
            :class="{ 'add-spot-input-readonly': authStore.isLoggedIn }"
            data-testid="add-spot-creator"
            type="text"
            :readonly="authStore.isLoggedIn"
            placeholder="Dein Name oder Nick, Instagram etc."
          />
        </label>

        <!-- Feedback -->
        <p v-if="error" class="add-spot-error" data-testid="add-spot-error">{{ error }}</p>
        <p v-if="success" class="add-spot-success" data-testid="add-spot-success">
          ✓ Eingereicht! Wird nach Prüfung freigeschaltet.
        </p>

        <!-- Actions -->
        <div class="add-spot-actions">
          <button class="add-spot-btn-cancel" @click="$emit('close')">Abbrechen</button>
          <button
            class="add-spot-btn-submit"
            data-testid="add-spot-submit"
            :disabled="submitting || success"
            @click="submit"
          >
            {{ submitting ? 'Wird gesendet…' : 'Speichern' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { submitSpot } from '~/src/communication/add_spot'
import type { anyTrailType } from '~/src/types/Trail'

const authStore = useAuthStore()

const props = defineProps<{
  open: boolean
  lat: number
  lng: number
  initialType?: string
}>()

const emit = defineEmits<{
  close: []
  submitted: [{ id: string; name: string; type: string }]
}>()

const TYPES = [
  { value: 'trail',    label: 'Trail' },
  { value: 'bikepark', label: 'Bike Park' },
  { value: 'dirtpark', label: 'Dirtpark/Pumptrack' },
]

const formType    = ref(props.initialType ?? 'trail')
const name        = ref('')
const url         = ref('')
const instagram   = ref('')
const creator     = ref('')
const pumptrack   = ref(false)
const dirtparkFlag = ref(false)
const submitting  = ref(false)
const error       = ref('')
const success     = ref(false)
const nameError   = ref('')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    formType.value  = props.initialType ?? 'trail'
    name.value      = ''
    url.value       = ''
    instagram.value = ''
    creator.value   = authStore.isLoggedIn ? authStore.nickname : ''
    pumptrack.value = false
    dirtparkFlag.value = false
    error.value     = ''
    success.value   = false
    nameError.value = ''
  },
)

watch(
  () => props.initialType,
  (t) => { if (t) formType.value = t },
)

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

async function submit() {
  nameError.value = ''
  error.value = ''
  if (!name.value.trim()) {
    nameError.value = 'Bitte gib einen Namen ein.'
    return
  }

  submitting.value = true
  try {
    const client = useSupabaseClient()
    const { data: { session } } = await (client as any).auth.getSession()
    const jwt = session?.access_token ?? ''

    await submitSpot(
      {
        type:       formType.value as anyTrailType,
        name:       name.value.trim(),
        latitude:   props.lat,
        longitude:  props.lng,
        url:        url.value || undefined,
        instagram:  instagram.value || undefined,
        creator:    creator.value || undefined,
        creator_id: session?.user?.id ?? undefined,
        pumptrack:  formType.value === 'dirtpark' ? pumptrack.value : undefined,
        dirtpark:   formType.value === 'dirtpark' ? dirtparkFlag.value : undefined,
      },
      jwt,
    )

    success.value = true
    emit('submitted', { id: '', name: name.value.trim(), type: formType.value })
    setTimeout(() => emit('close'), 2000)
  } catch (e: any) {
    error.value = e.message ?? 'Unbekannter Fehler'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.add-spot-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 1rem;
}

.add-spot-modal {
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

.add-spot-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: #666;
  line-height: 1;
  padding: 0.2rem 0.5rem;
}
.add-spot-close:hover { color: #111; }

.add-spot-title {
  margin: 0 0 0.9rem;
  font-size: 1rem;
  font-weight: 700;
  color: #1a202c;
}

/* Type-switch — reuse the original pill-toggle style */
.type-switch {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  background: #f1f5f9;
  border-radius: 9999px;
  padding: 0.25em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  gap: 0.25em;
  width: 100%;
  margin-bottom: 0.9rem;
}
.type-option {
  position: relative;
  cursor: pointer;
  user-select: none;
  flex: 1;
  display: flex;
  justify-content: center;
}
.type-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.switch-btn {
  display: inline-block;
  padding: 0.35em 0.6em;
  border-radius: 9999px;
  font-size: 0.82em;
  font-weight: 500;
  color: #333;
  background: transparent;
  transition: all 0.2s ease;
  text-align: center;
  width: 100%;
}
.type-option:hover .switch-btn { background: #e2e8f0; }
.type-option input:checked + .switch-btn {
  background: #2b6cb0;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

/* Dirtpark sub-type toggle */
.add-spot-subtype-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.4rem;
}

.multi-select {
  display: flex;
  gap: 6px;
  margin-bottom: 0.85rem;
}
.multi-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #2b6cb0;
  font-size: 0.8em;
  color: #2b6cb0;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}
.multi-option input { display: none; }
.multi-option input:checked + .multi-btn {
  background: #2b6cb0;
  color: white;
}
.multi-option { outline: none; cursor: pointer; }

/* Fields */
.add-spot-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.65rem;
}
.add-spot-optional {
  font-weight: 400;
  color: #9ca3af;
}
.add-spot-input {
  padding: 0.45rem 0.6rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}
.add-spot-input:focus { border-color: #2b6cb0; }
.add-spot-input-readonly {
  background: #f9fafb;
  color: #6b7280;
  cursor: default;
}

.add-spot-location {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.65rem;
}

.add-spot-field-error {
  color: #dc2626;
  font-size: 0.78rem;
  margin: -0.4rem 0 0.5rem;
}

.add-spot-error {
  color: #dc2626;
  font-size: 0.82rem;
  padding: 0.5rem 0.75rem;
  background: #fef2f2;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}
.add-spot-success {
  color: #15803d;
  font-size: 0.82rem;
  padding: 0.5rem 0.75rem;
  background: #f0fdf4;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.add-spot-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 1rem;
}
.add-spot-btn-cancel {
  padding: 0.45rem 1rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.add-spot-btn-cancel:hover { background: #f3f4f6; }

.add-spot-btn-submit {
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 6px;
  background: #2b6cb0;
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.add-spot-btn-submit:hover:not(:disabled) { background: #3182ce; }
.add-spot-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
