<template>
  <!-- v-html keeps the email_off comments in the SSR output; Cloudflare would otherwise serve "[email protected]" to non-JS readers. -->
  <span class="support-email" v-html="html" />
</template>

<script setup lang="ts">
const SUPPORT_EMAIL = 'webmaster@trailradar.org'
const html = `<!--email_off--><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><!--email_on-->`
</script>
