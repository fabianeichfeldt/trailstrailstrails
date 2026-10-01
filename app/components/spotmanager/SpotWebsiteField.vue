<template>
  <div class="sd-section">
    <div class="sd-section-label"><i class="fas fa-globe" /> Website</div>
    <input
      type="url"
      class="sd-input"
      :value="modelValue"
      maxlength="500"
      placeholder="https://…"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="sm-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeWebsiteUrl } from '../../spot_manager/spotWebsite'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const error = computed(() => {
  try { normalizeWebsiteUrl(props.modelValue); return '' } catch (e: any) { return e.message as string }
})
</script>
