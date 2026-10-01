<template>
  <div class="sd-section">
    <div class="sd-section-label"><i class="fas fa-globe" /> Website</div>
    <input
      type="url" class="sd-input bp-website" maxlength="500" inputmode="url"
      placeholder="https://…"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="sm-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeWebsiteUrl } from '~/spot_manager/spotWebsite'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const result = computed(() => normalizeWebsiteUrl(props.modelValue))
const error = computed(() => (result.value.ok ? '' : result.value.error))
</script>
