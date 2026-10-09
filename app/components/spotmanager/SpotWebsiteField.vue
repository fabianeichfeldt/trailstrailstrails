<template>
  <label class="swf">
    <span class="swf-label">Website</span>
    <input
      type="url"
      inputmode="url"
      autocomplete="off"
      class="sd-input"
      :class="{ 'is-invalid': !!error }"
      :value="modelValue"
      placeholder="https://…"
      maxlength="500"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="sd-field-error" role="alert">{{ error }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<style scoped>
.swf { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.swf-label { font-size: 12px; font-weight: 600; color: #555; }
.swf .sd-input { min-height: 44px; width: 100%; box-sizing: border-box; }
.swf .is-invalid { border-color: #c62828; }
.sd-field-error { font-size: 12px; color: #c62828; }
</style>
