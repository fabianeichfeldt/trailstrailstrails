<template>
  <section class="hero">
    <NuxtLink to="/" class="logo-link">
      <img :src="'/assets/logo.webp'" alt="Trailradar Logo" class="logo" />
    </NuxtLink>
    <div class="hero-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  height: 70vh;
  background: url('/assets/hero-desktop.webp') center / cover no-repeat;
  display: flex;
  align-items: flex-end;
}

.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.2));
}

.logo-link {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  z-index: 10;
}

.logo {
  border-radius: 16px;
  height: 90px;
  width: auto;
  box-shadow: var(--shadow-logo);
}

.hero-content {
  position: relative;
  z-index: 1;
  padding: 4rem;
  max-width: 900px;
  color: #fff;
}

.hero-content :deep(h1) {
  font-size: clamp(2.5rem, 5vw, 4rem);
  line-height: 1.2;
  margin-bottom: 0.5em;
}

.hero-content :deep(p) {
  font-size: 1.1rem;
  color: var(--color-page-muted);
  margin: 0;
}

@media (max-width: 900px) {
  .hero-content {
    padding: 2.5rem;
  }
}
</style>
