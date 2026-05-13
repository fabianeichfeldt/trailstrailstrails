<template>
  <div>
    <slot />
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
useHead({
  htmlAttrs: { class: 'page-layout' },
})
</script>

<style>
/* Scoped to pages using the default layout via html class */

.page-layout body {
  background: var(--color-page-bg);
  color: var(--color-page-text);
  line-height: 1.7;
  font-family: 'Inter', system-ui, sans-serif;
}

.page-layout a {
  color: var(--color-page-accent);
}

/* Content container — white card below the hero */
.page-layout .container {
  max-width: 1000px;
  padding: 1em 2em 4em;
  margin: auto;
  background: #ffffff;
  color: #1a1a1a;
  border-radius: 32px 32px 0 0;
}

.page-layout .container p { color: #2a2a2a; }

.page-layout .container h2 {
  color: #111;
  margin-top: 1.5em;
}

/* Back navigation */
.page-layout .back-link {
  display: inline-block;
  margin: 0 0 2em;
  font-weight: 600;
  color: var(--color-primary);
  font-size: 0.9em;
}

.page-layout .back-link:hover { color: #1a4a80; text-decoration: none; }

/* Dark CTA band above footer */
.page-layout .cta {
  background: var(--color-page-bg-light);
  padding: 4rem 2rem;
  text-align: center;
}

.page-layout .cta h2 { margin-bottom: 1rem; }

.page-layout .cta p {
  color: var(--color-page-muted);
  max-width: 700px;
  margin: auto;
}
</style>
