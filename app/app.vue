<template>
  <NuxtLoadingIndicator color="#2a9d5c" :height="3" :throttle="0" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <div id="toast-container"></div>
</template>

<style>
/* Standalone PWA / native shell draw under the status bar — keep the bar visible below it. */
.nuxt-loading-indicator { top: env(safe-area-inset-top, 0px) !important; }
</style>
