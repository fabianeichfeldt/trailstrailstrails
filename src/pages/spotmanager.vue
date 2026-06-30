<template>
  <div class="sm-page">
    <ClientOnly>
      <div v-if="!authStore.isLoggedIn" class="sm-access-denied">
        <p>Bitte erst einloggen.</p>
        <button class="sm-btn-primary" @click="mapStore.authModalOpen = true">Anmelden</button>
      </div>
      <div v-else-if="!authStore.isAdmin && !authStore.isTrailcrew" class="sm-access-denied">
        <p>Kein Zugriff. Trailcrew- oder Admin-Rolle erforderlich.</p>
      </div>
      <SpotManagerApp v-else />
      <AuthModal />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'map' })

useSeoMeta({ title: 'Spot Manager' })

const authStore = useAuthStore()
const mapStore = useMapStore()
</script>

<style scoped>
.sm-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.sm-access-denied {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  font-size: 16px;
  color: #444;
  background: #f0f2f5;
}
.sm-btn-primary {
  background: #0077cc; color: #fff; border: none;
  padding: 10px 22px; border-radius: 8px; font-size: 14px; cursor: pointer;
}
</style>
