<template>
  <div class="trail-status-fields">
    <label class="trail-status-field-label">
      Von
      <div class="trail-status-inline-field">
        <input v-model="von" type="datetime-local" class="sd-input" />
        <button type="button" class="sm-btn-secondary trail-status-btn" @click="setNow">Jetzt</button>
      </div>
    </label>

    <label class="trail-status-field-label">
      Bis
      <div class="trail-status-inline-field">
        <input v-model="bis" type="datetime-local" class="sd-input" :disabled="!von" />
        <button type="button" class="sm-btn-secondary trail-status-btn" :disabled="!von" @click="setTomorrow">Morgen</button>
      </div>
    </label>

    <p v-if="von && !bis" class="trail-status-hint">
      Ohne Enddatum bleibt der Trail gesperrt, bis du ihn hier wieder öffnest.
    </p>

    <button v-if="von || bis" type="button" class="sm-btn-secondary trail-status-clear-btn" @click="clearClosure">
      <i class="fas fa-lock-open" /> Sperrung aufheben
    </button>

    <label class="trail-status-field-label">
      Hinweis
      <textarea v-model="hintText" class="sd-textarea trail-status-textarea" rows="3" maxlength="300"
        placeholder="z.B. Nach Regen rutschig" />
    </label>
    <div class="trail-status-char-hint">{{ hintText.length }}/300</div>
  </div>
</template>

<script setup lang="ts">
import { isoToDatetimeLocal, datetimeLocalToIso, nowAsDatetimeLocal, tomorrowEndOfDayAsDatetimeLocal } from '../../spot_manager/trailStatusForm'

const props = defineProps<{
  closedFrom: string | null  // ISO 8601, or null when not closed
  closedTo:   string | null  // ISO 8601, or null when open-ended/unset
  hint:       string | null
}>()

const emit = defineEmits<{
  'update:closedFrom': [string | null]
  'update:closedTo':   [string | null]
  'update:hint':       [string | null]
}>()

// Local `datetime-local` editable state, seeded once from the ISO props the
// parent holds. Like ParkingEditor, this component is mounted fresh per edit
// session (SpotManagerApp swaps `view` rather than keeping this alive across
// trails), so a one-time seed on setup — no prop watcher — is enough.
const von = ref(isoToDatetimeLocal(props.closedFrom))
const bis = ref(isoToDatetimeLocal(props.closedTo))
const hintText = ref(props.hint ?? '')

watch(von, (value) => {
  if (!value) bis.value = ''
  emit('update:closedFrom', datetimeLocalToIso(value))
})

watch(bis, (value) => {
  emit('update:closedTo', datetimeLocalToIso(value))
})

watch(hintText, (value) => {
  const trimmed = value.trim()
  emit('update:hint', trimmed ? trimmed : null)
})

function setNow() {
  von.value = nowAsDatetimeLocal()
}

function setTomorrow() {
  if (!von.value) return
  bis.value = tomorrowEndOfDayAsDatetimeLocal()
}

function clearClosure() {
  von.value = ''
  bis.value = ''
}
</script>

<style scoped>
.trail-status-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trail-status-field-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #555;
}

.trail-status-inline-field {
  display: flex;
  gap: 8px;
  align-items: center;
}

.trail-status-inline-field .sd-input {
  flex: 1;
  min-width: 0;
}

.trail-status-btn {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 9px 14px;
}

.trail-status-hint {
  margin: -4px 0 0;
  font-size: 11px;
  color: #999;
}

.trail-status-clear-btn {
  align-self: flex-start;
  color: #c62828;
  border-color: #f0a0a0;
}
.trail-status-clear-btn:hover { background: #fdecea; }

.trail-status-textarea {
  min-height: 80px;
}

.trail-status-char-hint {
  font-size: 11px;
  color: #bbb;
  text-align: right;
  margin-top: -8px;
}

@media (max-width: 600px) {
  .trail-status-inline-field { flex-wrap: wrap; }
  .trail-status-btn { flex: 1; }
}
</style>
