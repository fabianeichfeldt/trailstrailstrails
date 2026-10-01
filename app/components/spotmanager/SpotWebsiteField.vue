<template>
  <label class="swf">
    <span class="swf-label">Website</span>
    <input
      type="url"
      class="sd-input swf-input"
      :class="{ 'swf-input--error': error }"
      :value="modelValue"
      placeholder="https://…"
      inputmode="url"
      autocomplete="off"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="swf-error" role="alert">{{ error }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<style scoped>
.swf { display: flex; flex-direction: column; gap: 6px; }
.swf-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #888; }
.swf-input { min-height: 44px; }
.swf-input--error { border-color: #d32f2f; }
.swf-error { font-size: 12px; color: #d32f2f; }
</style>
