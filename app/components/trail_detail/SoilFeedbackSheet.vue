<template>
  <Teleport to="body">
    <div class="backdrop" data-testid="soil-backdrop" @click.self="emit('close')">
      <div
        ref="dialogEl"
        class="sheet"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown.esc.stop="emit('close')"
      >
        <div class="sheet-head">
          <h2 :id="titleId">Wie ist der Boden?</h2>
          <button type="button" class="sheet-close" aria-label="Schließen" data-testid="soil-close" @click="emit('close')">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <p v-if="fb.state.value === 'done'" class="sheet-thanks" role="status">
          Danke! Deine Rückmeldung hilft uns, die Schätzung zu verbessern.
        </p>

        <template v-else>
          <ConditionScale
            interactive
            :range="fb.range.value"
            :loading="fb.pending.value"
            label="Deine Einschätzung"
            @select="fb.tap"
          />
          <p class="sheet-hint">Tippe ein Feld, um es zu wählen; tippe ein weiteres, um die Spanne zu erweitern.</p>

          <label class="sheet-field" :for="pickerId">
            <span class="sheet-field-label">Wann bist du gefahren?</span>
            <input
              :id="pickerId"
              type="datetime-local"
              class="sheet-picker"
              :value="fb.observedLocal.value"
              :min="fb.minLocal"
              :max="fb.maxLocal"
              @input="fb.setObservedLocal(($event.target as HTMLInputElement).value)"
            />
          </label>

          <div class="sheet-toggles">
            <label class="sheet-toggle">
              <input v-model="fb.snowFrost.value" type="checkbox" />
              <span>Schnee/Frost</span>
            </label>
            <label class="sheet-toggle">
              <input v-model="fb.raining.value" type="checkbox" />
              <span>Regen</span>
            </label>
          </div>

          <p v-if="fb.noVerdict.value" class="sheet-msg" role="alert" data-testid="soil-no-verdict">
            Für diesen Zeitpunkt haben wir keine Schätzung
          </p>
          <p v-else-if="fb.loadFailed.value" class="sheet-msg" role="alert" data-testid="soil-load-failed">
            Die Schätzung für diesen Zeitpunkt konnte nicht geladen werden. Wähle einen anderen Zeitpunkt oder versuche es später erneut.
          </p>
          <p v-else-if="fb.state.value === 'error'" class="sheet-msg" role="alert" data-testid="soil-error">
            Das hat nicht geklappt. Bitte versuche es erneut.
          </p>

          <button
            type="button"
            class="sheet-submit"
            data-testid="soil-submit"
            :disabled="!fb.canSubmit.value"
            @click="fb.submit()"
          >
            {{ fb.state.value === 'sending' ? 'Sende …' : fb.changed.value ? 'Senden' : 'Stimmt so' }}
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ConditionRange } from '~/types/Weather'
import { useSoilFeedback } from '~/composables/useSoilFeedback'
import ConditionScale from '~/components/trail_detail/ConditionScale.vue'

/**
 * Rider feedback on the soil verdict: bottom sheet on phones, dialog on wider
 * screens (CSS only). Mounted by the card when the rider opts in, so it only
 * ever exists on the client. All state lives in `useSoilFeedback`.
 */
const props = defineProps<{
  spotType: string
  spotId: string
  /** The model's range for right now — the starting point of the correction. */
  modelRange: ConditionRange
}>()
const emit = defineEmits<{ close: [] }>()

const uid = Math.random().toString(36).slice(2, 8)
const titleId = `soil-title-${uid}`
const pickerId = `soil-when-${uid}`

const fb = useSoilFeedback(() => ({ spotType: props.spotType, spotId: props.spotId }), props.modelRange)

const dialogEl = ref<HTMLElement | null>(null)

// Brief thank-you, then the sheet gets out of the way.
let closeTimer: ReturnType<typeof setTimeout> | undefined
watch(fb.state, (s) => {
  if (s === 'done') closeTimer = setTimeout(() => emit('close'), 1600)
})

// The page behind must not scroll while the sheet is open (iOS rubber-bands
// straight through a fixed overlay otherwise).
let previousOverflow = ''
onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialogEl.value?.focus()
})
onBeforeUnmount(() => {
  clearTimeout(closeTimer)
  document.body.style.overflow = previousOverflow
})
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(26, 32, 53, 0.5);
}

.sheet {
  width: 100%;
  max-width: 520px;
  max-height: 92dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  box-sizing: border-box;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  background: #fff;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.18);
  outline: none;
}

@media (min-width: 600px) {
  .backdrop { align-items: center; }
  .sheet {
    border-radius: 16px;
    padding-bottom: 16px;
  }
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.sheet-head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a2035;
}
.sheet-close {
  width: 44px;
  height: 44px;
  margin-right: -10px;
  border: none;
  background: transparent;
  font-size: 28px;
  line-height: 1;
  color: #4a5568;
  cursor: pointer;
}

.sheet-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b7686;
  line-height: 1.4;
}

.sheet-field {
  display: block;
  margin-top: 16px;
}
.sheet-field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #4a5568;
}
.sheet-picker {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: 0 10px;
  border: 1.5px solid #e4e9f0;
  border-radius: 10px;
  font: inherit;
  /* 16px stops iOS Safari from zooming the page when the field is focused. */
  font-size: 16px;
  color: #1a2035;
  background: #fff;
}

.sheet-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.sheet-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #e4e9f0;
  border-radius: 10px;
  font-size: 14px;
  color: #1a2035;
  cursor: pointer;
}
.sheet-toggle input {
  width: 18px;
  height: 18px;
}

.sheet-msg {
  margin: 14px 0 0;
  padding: 9px 11px;
  background: #fff1f1;
  border: 1px solid #fed7d7;
  border-radius: 9px;
  font-size: 13px;
  color: #822727;
  line-height: 1.4;
}

.sheet-submit {
  width: 100%;
  min-height: 48px;
  margin-top: 16px;
  border: none;
  border-radius: 12px;
  background: #1a2035;
  color: #fff;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
.sheet-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.sheet-submit:focus-visible {
  outline: 2px solid #1a2035;
  outline-offset: 2px;
}

.sheet-thanks {
  margin: 8px 0 12px;
  font-size: 15px;
  line-height: 1.45;
  color: #276749;
}
</style>
