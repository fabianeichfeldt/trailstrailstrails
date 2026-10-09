<template>
  <footer class="page-footer">
    <nav>
      <NuxtLink to="/">Startseite</NuxtLink>
      <NuxtLink to="/map">Karte</NuxtLink>
      <NuxtLink to="/articles">Trailgespräche</NuxtLink>
      <NuxtLink to="/faq">FAQ</NuxtLink>
      <NuxtLink to="/about">Über mich</NuxtLink>
      <NuxtLink to="/support">Unterstützen</NuxtLink>
      <NuxtLink to="/plans">Preise</NuxtLink>
      <NuxtLink to="/kuendigen">Verträge hier kündigen</NuxtLink>
      <NuxtLink to="/kontakt">Kontakt</NuxtLink>
      <NuxtLink to="/impressum">Impressum</NuxtLink>
      <NuxtLink to="/privacy">Datenschutz</NuxtLink>
      <NuxtLink to="/terms">AGB</NuxtLink>
      <a href="https://www.instagram.com/trailradar.germany" target="_blank" rel="noopener noreferrer">Instagram</a>
    </nav>
    <p class="footer-email">Support: <SupportEmail /></p>
    <p class="copyright">© {{ year }} Trailradar</p>
  </footer>
</template>

<script setup lang="ts">
import SupportEmail from '~/components/SupportEmail.vue'
const year = new Date().getFullYear()
</script>

<style scoped>
.page-footer {
  background: var(--color-footer-bg);
  padding: 2rem 1.5rem;
  text-align: center;
}

.page-footer nav {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.page-footer nav a,
.page-footer nav :deep(a) {
  color: var(--color-footer-text);
  font-size: 0.85rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: rgba(147, 147, 147, 0.35);
  transition: color 0.15s, text-decoration-color 0.15s;
  padding: 0.25rem 0;
}

.page-footer nav a:hover,
.page-footer nav :deep(a):hover {
  color: #fff;
  text-decoration-color: rgba(255, 255, 255, 0.5);
}

.footer-email {
  color: var(--color-footer-text);
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
}

.footer-email :deep(a) {
  color: inherit;
  text-underline-offset: 3px;
}

.copyright {
  color: #555;
  font-size: 0.8rem;
  margin: 0;
}
</style>
