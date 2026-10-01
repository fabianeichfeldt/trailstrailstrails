<template>
  <div class="bpe">
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
      <textarea v-model="openingHours" data-test="hours" class="sd-textarea" rows="3"
        placeholder="z.B. Sa/So 9–17 Uhr" />
    </div>

    <div class="sd-section">
      <div class="sd-section-label"><i class="fas fa-align-left" /> Beschreibung</div>
      <textarea v-model="description" data-test="description" class="sd-textarea" rows="6" />
      <div class="bpe-count" :class="{ 'bpe-count--over': descriptionTooLong }">{{ description.length }}/{{ MAX_DESCRIPTION }}</div>
      <p v-if="descriptionTooLong" class="sm-error" role="alert">Die Beschreibung darf höchstens {{ MAX_DESCRIPTION }} Zeichen lang sein.</p>
    </div>

    <div class="sd-section">
      <SpotWebsiteField v-model="website" :error="websiteError" />
    </div>

    <p v-if="saveError" class="sm-error" role="alert">{{ saveError }}</p>
    <div class="sm-form-actions">
      <button type="button" class="sm-btn-secondary bpe-btn" data-test="cancel" @click="emit('cancel')">Abbrechen</button>
      <button type="button" class="sm-btn-primary bpe-btn" data-test="save" :disabled="saving" @click="save">
        {{ saving ? 'Speichern…' : 'Speichern' }}
      </button>
    </div>

    <SpotInvitationCodes :spot-id="spot.id" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { upsertBikeParkDetails, setSpotWebsite } from '~/spot_manager/Api'
import type { BikeParkDetailsRow, SpotRow, SpotStatus } from '~/spot_manager/Api'
import { normalizeWebsiteUrl } from '~/spot_manager/spotWebsite'
import SpotWebsiteField from './SpotWebsiteField.vue'
import SpotInvitationCodes from './SpotInvitationCodes.vue'

const props = defineProps<{ spot: SpotRow; details: BikeParkDetailsRow | null; jwt: string }>()
const emit = defineEmits<{ saved: [BikeParkDetailsRow]; cancel: [] }>()

const MAX_DESCRIPTION = 2000
const STATUS_OPTIONS: { value: SpotStatus; label: string; icon: string; color: string }[] = [
  { value: 'open', label: 'Offen', icon: 'fa-circle-check', color: '#2e7d32' },
  { value: 'closed', label: 'Gesperrt', icon: 'fa-ban', color: '#d32f2f' },
]

// Legacy unknown/null/limited: nothing preselected until the editor picks one.
const initialStatus = props.details?.status
const status = ref<SpotStatus | null>(initialStatus === 'open' || initialStatus === 'closed' ? initialStatus : null)
const openingHours = ref(props.details?.opening_hours ?? '')
const description = ref(props.details?.trail_description ?? '')
const website = ref(props.spot.url ?? '')
const websiteError = ref('')
const saveError = ref('')
const saving = ref(false)

const descriptionTooLong = computed(() => description.value.length > MAX_DESCRIPTION)

async function save() {
  saveError.value = ''
  websiteError.value = ''
  const url = normalizeWebsiteUrl(website.value)
  if (!url.ok) { websiteError.value = url.error; return }
  if (descriptionTooLong.value) return

  saving.value = true
  try {
    const row: BikeParkDetailsRow = {
      id: props.spot.id,
      status: status.value,
      opening_hours: openingHours.value.trim() || null,
      trail_description: description.value.trim() || null,
      last_update: new Date().toISOString(),
    }
    const saved = await upsertBikeParkDetails(row, props.jwt)
    if (url.url !== (props.spot.url ?? '')) await setSpotWebsite(props.spot.id, url.url, props.jwt)
    emit('saved', saved)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bpe { display: flex; flex-direction: column; }
.sd-section { padding: 14px 0; border-bottom: 1px solid #f0f0f0; display: flex; flex-direction: column; gap: 10px; }
.sd-section-label { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #888; }
.sd-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sd-status-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 14px 8px; border-radius: 10px; cursor: pointer; transition: all .15s;
  border: 2px solid #e8e8e8; background: #fafafa; font-size: 12px; font-weight: 600; color: #555;
}
.sd-status-card:hover { border-color: var(--status-color); background: color-mix(in srgb, var(--status-color) 8%, #fff); }
.sd-status-card.active {
  border-color: var(--status-color);
  background: color-mix(in srgb, var(--status-color) 12%, #fff);
  color: var(--status-color);
}
.sd-status-icon { font-size: 22px; }
.bpe-count { align-self: flex-end; font-size: 11px; color: #999; }
.bpe-count--over { color: #d32f2f; }
.bpe-btn { min-height: 44px; }
.sm-form-actions { padding: 14px 0; }
</style>
