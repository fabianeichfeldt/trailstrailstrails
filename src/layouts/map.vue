<template>
  <div class="map-layout">
    <slot />
    <ClientOnly>
      <PwaBanner />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
useHead({
  htmlAttrs: { class: 'map-layout-page' },
})
</script>

<style>
.map-layout {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.map-layout-page body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-base);
  background-size: cover;
  background-repeat: repeat-y;
  background-attachment: fixed;
  background-blend-mode: multiply;
}

@media (max-width: 800px) {
  .map-layout-page body {
    background-image: url('/assets/hero-mobile.webp');
    background-color: #1212125d;
  }
}

@media (min-width: 800px) {
  .map-layout-page body {
    background-image: url('/assets/hero-tablet.webp');
    background-color: #1212125d;
  }
}

@media (min-width: 1200px) {
  .map-layout-page body {
    background-image: url('/assets/hero-desktop.webp');
    background-color: #1212125d;
  }
}
</style>
