<template>
  <div>
    <AuthModal />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const mapStore = useMapStore()

onMounted(() => {
  mapStore.authModalOpen = true
  navigateTo('/map')
})
</script>
