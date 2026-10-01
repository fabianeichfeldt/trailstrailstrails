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
          v-for="s in STATUS" :key="s.value" type="button"
          class="sd-status-card" :class="{ active: status === s.value }"
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
      <textarea v-model="hours" class="sd-input bp-hours" rows="3" maxlength="500" placeholder="z.B. Mo–So 9:00–17:00" />
    </div>

    <div class="sd-section">
      <div class="sd-section-label"><i class="fas fa-align-left" /> Beschreibung</div>
      <textarea v-model="description" class="sd-input bp-description" rows="5" placeholder="Allgemeine Infos zum Bikepark" />
      <div class="sd-char-hint">{{ description.length }}/{{ MAX_DESCRIPTION }}</div>
    </div>

    <SpotWebsiteField v-model="website" />

    <SpotInvitationCodes :spot-id="spot.id" />

    <div class="sm-form-actions">
      <p v-if="saveError" class="sm-error">{{ saveError }}</p>
      <button class="sm-btn-secondary" @click="emit('cancel')">Abbrechen</button>
      <button class="sm-btn-primary" :disabled="busy" @click="save">
        <i class="fas fa-save" /> Speichern
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SpotRow, BikeParkDetailsRow } from '~/spot_manager/Api'
import { upsertBikeParkDetails, setSpotWebsite } from '~/spot_manager/Api'
import { normalizeWebsiteUrl } from '~/spot_manager/spotWebsite'
import SpotInvitationCodes from './SpotInvitationCodes.vue'
import SpotWebsiteField from './SpotWebsiteField.vue'

const MAX_DESCRIPTION = 2000
const STATUS = [
  { value: 'open',   label: 'Offen',    icon: 'fa-circle-check', color: '#22c55e' },
  { value: 'closed', label: 'Gesperrt', icon: 'fa-circle-xmark', color: '#ef4444' },
]

const props = defineProps<{
  spot: SpotRow
  details: BikeParkDetailsRow | null
  jwt: string
}>()
const emit = defineEmits<{ cancel: []; saved: [row: BikeParkDetailsRow] }>()

// Legacy 'unknown'/null status shows neither card selected.
const status = ref<string | null>(props.details?.status ?? null)
const hours = ref(props.details?.opening_hours ?? '')
const description = ref(props.details?.trail_description ?? '')
const website = ref(props.spot.url ?? '')
const busy = ref(false)
const saveError = ref('')

async function save() {
  saveError.value = ''
  const url = normalizeWebsiteUrl(website.value)
  if (!url.ok) { saveError.value = url.error; return }
  const desc = description.value.trim()
  if (desc.length > MAX_DESCRIPTION) { saveError.value = `Beschreibung zu lang (max. ${MAX_DESCRIPTION} Zeichen).`; return }

  busy.value = true
  try {
    const saved = await upsertBikeParkDetails({
      id: props.spot.id,
      status: status.value,
      opening_hours: hours.value.trim(),
      trail_description: desc,
      last_update: new Date().toISOString(),
    }, props.jwt)
    if (url.value !== (props.spot.url ?? '').trim()) await setSpotWebsite(props.spot.id, url.value, props.jwt)
    emit('saved', saved)
  } catch (e: any) {
    saveError.value = `Fehler: ${e.message}`
  } finally {
    busy.value = false
  }
}
</script>
