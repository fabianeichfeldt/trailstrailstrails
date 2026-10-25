<template>
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;color:#555">
    <p>Weiterleitung…</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
useSeoMeta({ robots: 'noindex' })

onMounted(() => navigateTo('/map'))
</script>
