<template>
  <p v-if="text" class="spot-summary">{{ text }}</p>
</template>

<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<style scoped>
.spot-summary {
  margin: 0.4em 0 1em;
  color: #4a5568;
  font-size: 0.92em;
  line-height: 1.6;
}
</style>
