<template>
  <div class="sd-editor">
    <div class="sm-form-header">
      <button class="sm-btn-back" @click="emit('cancel')"><i class="fas fa-arrow-left" /></button>
      <h3>Spot-Details</h3>
    </div>

    <div class="sd-section">
      <div class="sd-section-label"><i class="fas fa-circle-half-stroke" /> Status</div>
      <div class="sd-status-grid">
        <button
          v-for="s in STATUS_OPTIONS"
          :key="s.value"
          type="button"
          class="sd-status-card"
          :class="{ active: status === s.value }"
          :style="`--status-color:${s.color}`"
          @click="status = s.value"
        >
          <i class="fas sd-status-icon" :class="s.icon" />
          <span>{{ s.label }}</span>
        </button>
      </div>
    </div>

    <div class="sd-section">
      <div class="sd-section-label"><i class="fas fa-clock" /> Öffnungszeiten</div>
      <input v-model="hours" type="text" class="sd-input bp-hours" maxlength="200" placeholder="z.B. Mo–Fr 9–17 Uhr" />
    </div>

    <SpotWebsiteField v-model="website" />

    <div class="sd-section">
      <div class="sd-section-label"><i class="fas fa-align-left" /> Beschreibung</div>
      <textarea v-model="description" class="sd-textarea" placeholder="Allgemeine Infos zum Spot…" />
      <div class="sd-char-hint">{{ description.length }}/{{ DESCRIPTION_MAX }}</div>
      <p v-if="descriptionError" class="sm-error">{{ descriptionError }}</p>
    </div>

    <SpotInvitationCodes :spot-id="spot.id" />

    <p v-if="saveError" class="sm-error">{{ saveError }}</p>
    <div class="sd-save-row">
      <button class="sm-btn-secondary" @click="emit('cancel')">Abbrechen</button>
      <button class="sm-btn-primary" :disabled="busy || !!websiteError || !!descriptionError" @click="save">
        <i class="fas fa-save" /> Speichern
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { upsertBikeParkDetails, setSpotWebsite } from '../../spot_manager/Api'
import type { BikeParkDetailsRow, SpotRow } from '../../spot_manager/Api'
import { normalizeWebsiteUrl } from '../../spot_manager/spotWebsite'
import type { SpotStatus } from '../../utils/spotStatusBanner'
import SpotWebsiteField from './SpotWebsiteField.vue'
import SpotInvitationCodes from './SpotInvitationCodes.vue'

const props = defineProps<{ spot: SpotRow; details: BikeParkDetailsRow | null; jwt: string }>()
const emit = defineEmits<{ saved: [row: BikeParkDetailsRow]; cancel: [] }>()

const DESCRIPTION_MAX = 2000
const STATUS_OPTIONS: { value: SpotStatus; label: string; icon: string; color: string }[] = [
  { value: 'open', label: 'Offen', icon: 'fa-circle-check', color: '#22c55e' },
  { value: 'closed', label: 'Gesperrt', icon: 'fa-ban', color: '#ef4444' },
]

// Legacy 'unknown'/null: no option is selected until the user picks one.
const status = ref<SpotStatus>(props.details?.status ?? 'unknown')
const hours = ref(props.details?.opening_hours ?? '')
const description = ref(props.details?.trail_description ?? '')
const initialWebsite = props.spot.url ?? ''
const website = ref(initialWebsite)
const busy = ref(false)
const saveError = ref('')

const websiteError = computed(() => {
  try { normalizeWebsiteUrl(website.value); return '' } catch (e: any) { return e.message as string }
})
const descriptionError = computed(() =>
  description.value.length > DESCRIPTION_MAX ? `Die Beschreibung darf höchstens ${DESCRIPTION_MAX} Zeichen lang sein.` : '')

async function save() {
  if (websiteError.value || descriptionError.value) return
  busy.value = true
  saveError.value = ''
  try {
    const url = normalizeWebsiteUrl(website.value)
    const row: BikeParkDetailsRow = {
      id: props.spot.id,
      status: status.value,
      opening_hours: hours.value.trim() || null,
      trail_description: description.value.trim() || null,
      last_update: new Date().toISOString(),
    }
    const saved = await upsertBikeParkDetails(row, props.jwt)
    if (url !== initialWebsite.trim()) await setSpotWebsite(props.spot.id, url, props.jwt)
    emit('saved', saved)
  } catch (e: any) {
    saveError.value = `Fehler: ${e.message}`
  } finally {
    busy.value = false
  }
}
</script>
