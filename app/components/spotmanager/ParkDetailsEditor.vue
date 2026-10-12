<template>
  <div class="sd-editor bpe">
    <div class="sm-form-header">
      <button class="sm-btn-back" aria-label="Zurück" @click="emit('cancel')"><i class="fas fa-arrow-left" /></button>
      <h3>Spot-Details</h3>
    </div>

    <div v-if="caps.parkKind" class="sd-section" data-testid="park-kind">
      <div class="sd-section-label"><i class="fas fa-shapes" /> Art</div>
      <div class="sd-status-grid">
        <button
          v-for="k in KINDS"
          :key="k.key"
          type="button"
          class="sd-status-card"
          :class="{ active: kind[k.key] }"
          :aria-pressed="kind[k.key]"
          style="--status-color:#8d6e63"
          @click="kind[k.key] = !kind[k.key]"
        >
          <i class="fas sd-status-icon" :class="k.icon" />
          <span>{{ k.label }}</span>
        </button>
      </div>
      <span v-if="kindError" class="sd-field-error" role="alert">{{ kindError }}</span>
    </div>

    <div class="sd-section">
      <div class="sd-section-label"><i class="fas fa-circle-half-stroke" /> Status</div>
      <div class="sd-status-grid">
        <button
          v-for="s in OPTIONS"
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
      <textarea v-model="openingHours" class="sd-textarea" placeholder="z.B. Mo–So 9:00–17:00" />
    </div>

    <div class="sd-section">
      <div class="sd-section-label"><i class="fas fa-align-left" /> Beschreibung</div>
      <textarea v-model="description" class="sd-textarea" :placeholder="`Allgemeine Infos zum ${caps.label}…`" />
      <div class="sd-char-hint" :class="{ 'is-over': descTooLong }">{{ description.length }}/{{ MAX_DESC }}</div>
      <span v-if="descTooLong" class="sd-field-error" role="alert">Die Beschreibung darf höchstens {{ MAX_DESC }} Zeichen lang sein.</span>
    </div>

    <div class="sd-section">
      <SpotWebsiteField v-model="website" :error="websiteError" />
    </div>

    <SpotInvitationCodes :spot-id="spot.id" />

    <p v-if="saveError" class="sm-error">{{ saveError }}</p>
    <div class="sd-save-row">
      <button type="button" class="sm-btn-secondary" @click="emit('cancel')">Abbrechen</button>
      <button type="button" class="sm-btn-primary" :disabled="busy" @click="save">
        <i class="fas fa-save" /> Speichern
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import type { SpotRow, ParkDetailsRow, SpotStatus, DirtParkKind } from '~/spot_manager/Api'
import { upsertParkDetails, setSpotWebsite, setDirtParkKind } from '~/spot_manager/Api'
import { normalizeWebsiteUrl } from '~/spot_manager/spotWebsite'
import { SPOT_CAPABILITIES, type ParkDetailsTable } from '~/spot_manager/spotTypes'
import SpotWebsiteField from './SpotWebsiteField.vue'
import SpotInvitationCodes from './SpotInvitationCodes.vue'

const props = defineProps<{ spot: SpotRow; details: ParkDetailsRow | null; jwt: string }>()
const emit = defineEmits<{
  cancel: []
  saved: [details: ParkDetailsRow, spotPatch: { url: string } & Partial<DirtParkKind>]
}>()

const caps = computed(() => SPOT_CAPABILITIES[props.spot.type])

const MAX_DESC = 2000
const OPTIONS = [
  { value: 'open' as SpotStatus, icon: 'fa-circle-check', label: 'Offen', color: '#2e7d32' },
  { value: 'closed' as SpotStatus, icon: 'fa-ban', label: 'Gesperrt', color: '#c62828' },
]

// Legacy values (unknown/limited/null) stay selected-by-none and are kept if untouched.
const status = ref<SpotStatus | null>(props.details?.status ?? null)
const openingHours = ref(props.details?.opening_hours ?? '')
const description = ref(props.details?.trail_description ?? '')
// A spot can be both; the map filters on each flag separately.
const KINDS = [
  { key: 'pumptrack' as const, icon: 'fa-wave-square', label: 'Pumptrack' },
  { key: 'dirtpark' as const, icon: 'fa-mountain', label: 'Dirt-Jumps' },
]
const kind = reactive<DirtParkKind>({ pumptrack: !!props.spot.pumptrack, dirtpark: !!props.spot.dirtpark })
const kindError = ref('')
const website = ref(props.spot.url ?? '')
const websiteError = ref('')
const saveError = ref('')
const busy = ref(false)

const descTooLong = computed(() => description.value.length > MAX_DESC)

async function save() {
  saveError.value = ''
  websiteError.value = ''
  kindError.value = ''
  const site = normalizeWebsiteUrl(website.value)
  if (!site.ok) { websiteError.value = site.error; return }
  if (descTooLong.value) return
  if (caps.value.parkKind && !kind.pumptrack && !kind.dirtpark) {
    kindError.value = 'Mindestens eine Art auswählen.'
    return
  }

  busy.value = true
  try {
    const row: ParkDetailsRow = {
      id: props.spot.id,
      status: status.value,
      opening_hours: openingHours.value.trim() || null,
      trail_description: description.value.trim() || null,
    }
    const saved = await upsertParkDetails(caps.value.detailsTable as ParkDetailsTable, row, props.jwt)
    if (site.url !== (props.spot.url ?? '')) await setSpotWebsite(props.spot.id, site.url, props.jwt)
    if (!caps.value.parkKind) {
      emit('saved', saved ?? row, { url: site.url })
      return
    }
    if (kind.pumptrack !== !!props.spot.pumptrack || kind.dirtpark !== !!props.spot.dirtpark) {
      await setDirtParkKind(props.spot.id, { ...kind }, props.jwt)
    }
    emit('saved', saved ?? row, { url: site.url, ...kind })
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Speichern fehlgeschlagen'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.bpe { min-width: 0; }
.bpe .sd-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.bpe .sd-status-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 64px; padding: 14px 8px; border-radius: 10px; cursor: pointer; transition: all .15s;
  border: 2px solid #e8e8e8; background: #fafafa; font-size: 12px; font-weight: 600; color: #555;
}
.bpe .sd-status-card:hover { border-color: var(--status-color); background: color-mix(in srgb, var(--status-color) 8%, #fff); }
.bpe .sd-status-card.active { border-color: var(--status-color); background: color-mix(in srgb, var(--status-color) 12%, #fff); color: var(--status-color); }
.bpe .sd-textarea { width: 100%; box-sizing: border-box; min-height: 96px; }
.bpe .sd-char-hint { font-size: 11px; color: #999; text-align: right; }
.bpe .sd-char-hint.is-over, .bpe .sd-field-error { color: #c62828; font-size: 12px; }
.bpe .sd-save-row { display: flex; gap: 8px; padding-top: 14px; }
.bpe .sd-save-row button { flex: 1; min-height: 44px; }
</style>
