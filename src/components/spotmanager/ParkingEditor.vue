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
        <input v-model="form.name" type="text" class="sd-input parking-name-input" placeholder="z.B. Hauptparkplatz" maxlength="80" />
      </label>

      <div class="parking-field-label">
        Standort
        <div class="parking-location-hint" :class="{ 'is-unset': !location }">
          <span class="parking-location-badge" v-html="badgeHtml" />
          <span v-if="location">{{ location.lat.toFixed(6) }}, {{ location.lng.toFixed(6) }}</span>
          <span v-else>Auf die Karte rechts klicken, um den Standort zu setzen</span>
        </div>
      </div>

      <div class="parking-field-label">
        Infos <span class="parking-optional">(optional)</span>
        <div v-if="form.info.length" class="parking-info-list">
          <div v-for="(entry, i) in form.info" :key="i" class="parking-info-row">
            <input v-model="form.info[i]" type="text" class="sd-input parking-info-input" maxlength="120" placeholder="z.B. Öffnungszeiten: durchgehend geöffnet" />
            <button type="button" class="parking-info-remove" aria-label="Eintrag entfernen" @click="form.info.splice(i, 1)">
              <i class="fas fa-times" />
            </button>
          </div>
        </div>
        <div class="parking-info-suggestions">
          <button
            v-for="s in availableSuggestions" :key="s"
            type="button" class="parking-suggestion-chip"
            @click="addSuggestion(s)"
          >
            + {{ s }}
          </button>
          <button type="button" class="parking-suggestion-chip parking-suggestion-custom" @click="form.info.push('')">
            + Eigener Eintrag
          </button>
        </div>
      </div>
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
import type { MapViewLike } from '~/spot_manager/MapView'
import type { LatLng } from '~/spot_manager/coords'
import { parkingIconOptions } from '~/map/markerIcon'

const props = defineProps<{
  lot: ParkingRow | null   // null = create mode
  spotId: string
  jwt: string
  // Note: the parent's template auto-unwraps its `mapView` shallowRef when
  // binding `:map-view="mapView"`, so this prop receives the plain
  // MapViewLike instance, not a ref.
  mapView: MapViewLike | null
}>()

const emit = defineEmits<{
  cancel: []
  saved:  []
}>()

const isNew = computed(() => !props.lot)

// Suggested categories offered as chips — clicking one adds a pre-filled
// entry to the free-text info array. Purely a UI nudge, not a stored shape:
// the "info" column is just text[], nothing parses these labels back out.
const INFO_SUGGESTIONS = ['Öffnungszeiten', 'Gewichtsbeschränkung', 'Höhenbeschränkung', 'Kosten', 'Lademöglichkeit']

const form = reactive({
  name: props.lot?.name ?? '',
  info: [...(props.lot?.info ?? [])] as string[],
})

// Hide suggestions whose label has already been added, so repeat clicks
// don't pile up duplicate "Kosten: " entries.
const availableSuggestions = computed(() =>
  INFO_SUGGESTIONS.filter(s => !form.info.some(entry => entry.startsWith(`${s}:`))),
)

function addSuggestion(label: string) {
  form.info.push(`${label}: `)
}

const location = ref<LatLng | null>(
  props.lot ? { lat: props.lot.lat, lng: props.lot.lng } : null,
)

const badgeHtml = parkingIconOptions().html

const busy = ref(false)
const saveError = ref<string | null>(null)

const canSave = computed(() => form.name.trim().length > 0 && location.value !== null)

// Reuses the persistent big map (src/spot_manager/MapView.ts) as the
// coordinate picker instead of embedding a second Leaflet instance.
props.mapView?.enablePointPicker(location.value, (pos) => { location.value = pos })

onUnmounted(() => {
  props.mapView?.disablePointPicker()
})

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
      info: form.info.map(entry => entry.trim()).filter(Boolean),
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

.parking-location-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f0f6ff;
  font-size: 13px;
  font-weight: normal;
  text-transform: none;
  letter-spacing: 0;
  color: #111;
  font-family: monospace;
}
.parking-location-hint.is-unset {
  background: #fafafa;
  color: #999;
  font-family: inherit;
}
.parking-location-badge {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.parking-info-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.parking-info-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.parking-info-input {
  flex: 1;
  font-family: inherit;
  font-size: 13px;
  text-transform: none;
  letter-spacing: 0;
}

.parking-info-remove {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #999;
  cursor: pointer;
}
.parking-info-remove:hover { color: #d33; border-color: #d33; }

.parking-info-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.parking-suggestion-chip {
  font-size: 12px;
  font-weight: normal;
  text-transform: none;
  letter-spacing: 0;
  padding: 6px 10px;
  border: 1px dashed #c9d6e5;
  border-radius: 999px;
  background: #f7fafd;
  color: #0d5db8;
  cursor: pointer;
}
.parking-suggestion-chip:hover { background: #eaf2fb; }
.parking-suggestion-custom { color: #555; }

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
