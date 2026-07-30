<template>
  <div class="parking-editor">
    <div class="sm-form-header">
      <button class="sm-btn-back" @click="emit('cancel')">
        <i class="fas fa-arrow-left" />
      </button>
      <h3>{{ isNew ? 'Parkplatz erstellen' : 'Parkplatz bearbeiten' }}</h3>
    </div>

    <div class="parking-editor-body">
      <label class="parking-field-label">
        Name
        <input v-model="form.name" type="text" class="sd-input" placeholder="z.B. Hauptparkplatz" maxlength="80" />
      </label>

      <div class="parking-field-label">
        Standort
        <LocationPicker v-model="location" />
      </div>

      <label class="parking-field-label">
        Gewichtsbeschränkung <span class="parking-optional">(optional)</span>
        <textarea v-model="form.weight_limit_hint" class="sd-textarea parking-hint-textarea" rows="2" placeholder="z.B. 3,5t – keine Wohnmobile" />
      </label>

      <label class="parking-field-label">
        Öffnungszeiten <span class="parking-optional">(optional)</span>
        <textarea v-model="form.opening_hours_hint" class="sd-textarea parking-hint-textarea" rows="2" placeholder="z.B. durchgehend geöffnet" />
      </label>

      <label class="parking-field-label">
        Kosten <span class="parking-optional">(optional)</span>
        <textarea v-model="form.cost_hint" class="sd-textarea parking-hint-textarea" rows="2" placeholder="z.B. kostenlos / 5€ Tagesticket" />
      </label>

      <label class="parking-field-label">
        Lademöglichkeit <span class="parking-optional">(optional)</span>
        <textarea v-model="form.charging_hint" class="sd-textarea parking-hint-textarea" rows="2" placeholder="z.B. 2 Ladesäulen auf dem Gelände" />
      </label>
    </div>

    <div class="sm-form-actions parking-editor-footer">
      <p v-if="saveError" class="sm-error parking-save-error">{{ saveError }}</p>
      <button class="sm-btn-secondary" @click="emit('cancel')">Abbrechen</button>
      <button class="sm-btn-primary" :disabled="busy || !canSave" @click="save">
        <i class="fas fa-save" /> Speichern
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ParkingRow } from '~/spot_manager/Api'
import { upsertParking } from '~/spot_manager/Api'
import LocationPicker from '~/spot_manager/LocationPicker.vue'
import type { LatLng } from '~/spot_manager/locationPickerUtils'

const props = defineProps<{
  lot: ParkingRow | null   // null = create mode
  spotId: string
  jwt: string
}>()

const emit = defineEmits<{
  cancel: []
  saved:  []
}>()

const isNew = computed(() => !props.lot)

const form = reactive({
  name:               props.lot?.name ?? '',
  weight_limit_hint:  props.lot?.weight_limit_hint  ?? '',
  opening_hours_hint: props.lot?.opening_hours_hint ?? '',
  cost_hint:          props.lot?.cost_hint          ?? '',
  charging_hint:      props.lot?.charging_hint      ?? '',
})

const location = ref<LatLng | null>(
  props.lot ? { lat: props.lot.lat, lng: props.lot.lng } : null,
)

const busy = ref(false)
const saveError = ref<string | null>(null)

const canSave = computed(() => form.name.trim().length > 0 && location.value !== null)

async function save() {
  if (!location.value) {
    saveError.value = 'Bitte einen Standort auf der Karte auswählen.'
    return
  }
  saveError.value = null
  busy.value = true
  try {
    await upsertParking({
      id: props.lot?.id,
      spot_id: props.spotId,
      name: form.name.trim(),
      lat: location.value.lat,
      lng: location.value.lng,
      weight_limit_hint:  form.weight_limit_hint.trim()  || null,
      opening_hours_hint: form.opening_hours_hint.trim() || null,
      cost_hint:          form.cost_hint.trim()          || null,
      charging_hint:      form.charging_hint.trim()      || null,
    }, props.jwt)
    emit('saved')
  } catch (e: any) {
    saveError.value = e.message ?? 'Speichern fehlgeschlagen.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.parking-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.parking-editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.parking-field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.parking-optional {
  font-weight: normal;
  text-transform: none;
  letter-spacing: 0;
  color: #aaa;
}

.parking-hint-textarea {
  resize: vertical;
  font-family: inherit;
  font-size: 13px;
  text-transform: none;
  letter-spacing: 0;
}

.parking-editor-footer {
  border-top: 1px solid #e5e7eb;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}

.parking-save-error {
  font-size: 12px;
}

@media (max-width: 600px) {
  .parking-editor-body { padding: 10px; gap: 14px; }
}
</style>
