<template>
  <div>
    <PageHero>
      <h1>Preise &amp; Pläne</h1>
      <p>Trailradar ist kostenlos. Mit Supporter bekommst du den Trail-Zustand – und hältst das Projekt am Laufen.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <PlanCards />

      <section v-if="!isNative" class="facts">
        <h2>Gut zu wissen</h2>
        <ul class="facts-grid">
          <li>
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
            <span><strong>Jederzeit kündbar</strong> zum Ende des Abrechnungszeitraums – mit einem Klick.
              Das Jahres-Abo läuft nach dem ersten Jahr monatlich weiter und ist dann monatlich kündbar.</span>
          </li>
          <li>
            <i class="fa-solid fa-hand-holding-heart" aria-hidden="true"></i>
            <span><strong>14 Tage Geld-zurück</strong>, wenn du nicht zufrieden bist.</span>
          </li>
          <li>
            <i class="fa-solid fa-receipt" aria-hidden="true"></i>
            <span>Bezahlung und Rechnung über unseren Zahlungsanbieter Creem. Alle Preise sind Endpreise inkl. MwSt.</span>
          </li>
          <li>
            <i class="fa-solid fa-envelope" aria-hidden="true"></i>
            <span>
              Fragen? Schreib an <SupportEmail />
              oder über das <NuxtLink to="/kontakt">Kontaktformular</NuxtLink>.
            </span>
          </li>
        </ul>
        <p class="facts-terms">
          Alle Details stehen in den <NuxtLink to="/terms#supporter">Nutzungsbedingungen</NuxtLink>.
        </p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import SupportEmail from '~/components/SupportEmail.vue'
import PlanCards from '~/components/plans/PlanCards.vue'

useSeoMeta({
  title: 'Preise & Pläne',
  ogTitle: 'Preise & Pläne | Trailradar',
  description: 'Trailradar ist kostenlos. Supporter bringt den Trail-Zustand: Bodenzustand und Wetter für jeden Spot.',
  ogUrl: 'https://trailradar.org/plans',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/plans' }],
})

const isNative = useIsNativeApp()
</script>

<style scoped>
.facts { max-width: 800px; margin: 3.5rem auto 0; }
.container .facts h2 { margin: 0 0 1.25rem; font-size: 1.15rem; font-weight: 800; }
.facts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem 2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.facts-grid li {
  display: flex;
  gap: 0.9rem;
  font-size: 0.88rem;
  line-height: 1.55;
  color: #374151;
}
.facts-grid i {
  flex: 0 0 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #eef0ef;
  color: var(--color-page-bg);
  font-size: 0.9rem;
}
.facts-grid strong { color: #111827; }
.facts a { color: #1f7a45; text-decoration: underline; }
.facts .facts-terms { margin: 1.75rem 0 0; font-size: 0.82rem; color: #6b7280; }

@media (min-width: 720px) {
  .facts-grid { grid-template-columns: 1fr 1fr; }
}
</style>
