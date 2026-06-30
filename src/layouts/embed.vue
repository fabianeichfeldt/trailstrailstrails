<template>
  <div class="embed-root">
    <slot />
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #__nuxt, .embed-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
