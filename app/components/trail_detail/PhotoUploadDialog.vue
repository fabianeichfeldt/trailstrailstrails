<template>
  <Teleport to="body">
    <div class="photo-upload-dialog backdrop" @click.self="emit('cancel')">
      <form
        ref="dialogEl"
        class="sheet"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown.esc.stop="emit('cancel')"
        @submit.prevent="emit('confirm', copyright)"
      >
        <div class="sheet-head">
          <h2 :id="titleId">Foto hochladen</h2>
          <button type="button" class="sheet-close photo-upload-cancel" aria-label="Abbrechen" @click="emit('cancel')">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="preview">
          <img v-if="previewUrl" :src="previewUrl" alt="Vorschau" />
          <span v-if="previewCredit" class="photo-copyright">© {{ previewCredit }}</span>
        </div>

        <label class="sheet-field" :for="inputId">
          <span class="sheet-field-label">Copyright / Fotograf:in</span>
          <input
            :id="inputId"
            v-model="copyright"
            name="copyright"
            type="text"
            class="sheet-input"
            :maxlength="COPYRIGHT_MAX_LENGTH"
            placeholder="z.B. Max Muster oder @insta_name"
            autocomplete="off"
          />
        </label>
        <p class="sheet-hint">
          Wird dauerhaft auf dem Foto eingeblendet. Du kannst es später in deinem Profil ergänzen oder ändern.
        </p>

        <button type="submit" class="sheet-submit">Hochladen</button>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { COPYRIGHT_MAX_LENGTH, normalizeCopyright } from '~/utils/photoCopyright'

const props = defineProps<{ file: File; initialCopyright?: string }>()
const emit = defineEmits<{ confirm: [copyright: string]; cancel: [] }>()

const uid = Math.random().toString(36).slice(2, 8)
const titleId = `photo-upload-title-${uid}`
const inputId = `photo-upload-copyright-${uid}`

const copyright = ref(props.initialCopyright ?? '')
const previewCredit = computed(() => normalizeCopyright(copyright.value))
const previewUrl = URL.createObjectURL(props.file)

const dialogEl = ref<HTMLElement | null>(null)

// Same scroll lock as SoilFeedbackSheet: iOS rubber-bands through a fixed overlay otherwise.
let previousOverflow = ''
onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialogEl.value?.focus()
})
onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  URL.revokeObjectURL(previewUrl)
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

.preview {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #111;
  aspect-ratio: 4 / 3;
  max-height: 38dvh;
  width: 100%;
}
.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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
.sheet-input {
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

.sheet-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b7686;
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
.sheet-submit:focus-visible {
  outline: 2px solid #1a2035;
  outline-offset: 2px;
}
</style>
