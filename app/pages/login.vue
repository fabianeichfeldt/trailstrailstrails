<template>
  <div>
    <AuthModal />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
useSeoMeta({ robots: 'noindex' })

const mapStore = useMapStore()

onMounted(() => {
  mapStore.authModalOpen = true
  navigateTo('/map')
})
</script>
