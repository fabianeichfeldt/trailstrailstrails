<template>
  <div class="embed-root">
    <slot />
  </div>
</template>

<script setup lang="ts">
useHead({
  htmlAttrs: { class: 'embed-layout-page' },
})
</script>

<style>
/* Scoped to pages using the embed layout via html class — this is an
   unscoped `html`/`body`/`*` reset, and in dev Vite injects every loaded
   component's <style> as a persistent global tag that never unloads on
   navigation (unlike prod, where each prerendered page only ships its own
   page's CSS). Without the .embed-layout-page gate, visiting /embed/[token]
   once in a dev session permanently breaks scroll (overflow: hidden) and
   strips margin/padding on every element, on every other page, until the
   dev server is restarted. */

.embed-layout-page,
.embed-layout-page body,
.embed-layout-page #__nuxt,
.embed-layout-page .embed-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.embed-layout-page .embed-root,
.embed-layout-page .embed-root *,
.embed-layout-page .embed-root *::before,
.embed-layout-page .embed-root *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
</style>
