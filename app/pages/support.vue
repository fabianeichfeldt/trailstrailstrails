<template>
  <div>
    <PageHero>
      <h1 class="hero-title">Trailradar ist ein Feierabendprojekt.</h1>
      <p>Gebaut von einem, der Vollzeit arbeitet, Mountainbike fährt und Trails baut – und mit deiner Unterstützung am Laufen bleibt.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section class="split story">
        <div>
          <p class="lead">
            Hinter Trailradar steckt kein Konzern und kein Startup mit Investoren – sondern ich, Fabian,
            Mountainbiker. Tagsüber habe ich einen ganz normalen Vollzeitjob. Abends und am Wochenende fahre ich
            Mountainbike, schaufle bei den Bärenleite Trails in Bayreuth mit – und baue an Trailradar.
          </p>
          <p>
            Trailradar ist werbefrei und unabhängig, und das soll so bleiben. Karte, Spots und Trails bleiben
            kostenlos. Wer mehr will – oder einfach möchte, dass das Projekt weiterläuft – hat mit dem
            Supporter-Plan eine Möglichkeit, mich zu unterstützen.
          </p>
        </div>
        <img :src="'/assets/trailbau.webp'" alt="Trailbau in der Community" />
      </section>

      <section class="contribution">
        <h2>Wofür dein Beitrag ist</h2>
        <ul class="facts-grid">
          <li>
            <i class="fa-solid fa-server" aria-hidden="true"></i>
            <span>Server und Datenbank, auf denen Karte, Fotos und GPX-Touren laufen</span>
          </li>
          <li>
            <i class="fa-solid fa-cloud-sun-rain" aria-hidden="true"></i>
            <span>Wetter- und Bodendaten für den Trail-Zustand</span>
          </li>
          <li>
            <i class="fa-solid fa-mobile-screen" aria-hidden="true"></i>
            <span>Gebühren für die App Stores und die Domain</span>
          </li>
          <li>
            <i class="fa-solid fa-moon" aria-hidden="true"></i>
            <span>Viele Abende nach Feierabend – statt auf dem Trail</span>
          </li>
        </ul>
      </section>

      <PlanCards />
      <p v-if="!isNative" class="plans-details">
        Kündigung, Geld-zurück &amp; Bezahlung – alle Details unter <NuxtLink to="/plans">Preise &amp; Pläne</NuxtLink>.
      </p>

      <section class="give-back">
        <h2>Auch ohne Geld kannst du viel bewegen</h2>
        <ul class="facts-grid">
          <li>
            <i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>
            <span>
              <strong><NuxtLink to="/map">Trails eintragen</NuxtLink></strong> – fehlende Strecken ergänzen oder
              Infos aktualisieren.
            </span>
          </li>
          <li>
            <i class="fa-solid fa-flag" aria-hidden="true"></i>
            <span>
              <strong>Fehler melden</strong> – falscher Name, neue Streckenführung, geänderter Zustand?
              <NuxtLink to="/kontakt">Sag Bescheid</NuxtLink>.
            </span>
          </li>
          <li>
            <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
            <span><strong>Teilen</strong> – in deiner WhatsApp-Gruppe, im Verein, auf Instagram oder im Forum.</span>
          </li>
        </ul>
      </section>
    </main>

    <footer class="cta">
      <h2>Gemeinsam für legale Trails</h2>
      <p>Trailradar wächst nicht neben der Community – sondern mit ihr.
        Danke, dass du Teil davon bist.</p>
      <p style="margin-top:2rem;"><strong>Happy Trails.</strong></p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import PlanCards from '~/components/plans/PlanCards.vue'

const isNative = useIsNativeApp()

useSeoMeta({
  title: 'Support – Trailradar unterstützen',
  description: 'Trailradar ist ein Feierabendprojekt. Unterstütze es mit dem Supporter-Plan – oder mit neuen Trails, Feedback und Teilen.',
  ogUrl: 'https://trailradar.org/support',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/support' }],
})
</script>

<style scoped>
/* "Feierabendprojekt." is wider than a 375px viewport at hero size; lang="de" gives proper hyphenation. */
.hero-title { hyphens: auto; }

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
  margin-bottom: 3rem;
}
.split img {
  width: 100%;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}
.lead { font-size: 1.2rem; color: #444; }

.contribution, .give-back { max-width: 800px; margin: 0 auto 3rem; }
.contribution h2, .give-back h2 { margin: 0 0 1.25rem; font-size: 1.15rem; font-weight: 800; }

/* Same icon-tile look as the facts list on /plans, reused here for both info lists. */
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
.facts-grid a {
  position: relative;
  color: #1f7a45;
  text-decoration: underline;
}
/* 44px tap target without breaking the sentence's line height. */
.facts-grid a::after { content: ""; position: absolute; inset: -12px -4px; }

.plans-details { max-width: 800px; margin: 1.75rem auto 0; text-align: center; font-size: 0.88rem; color: #6b7280; }

@media (max-width: 900px) {
  .split { grid-template-columns: 1fr; }
}

@media (min-width: 720px) {
  .facts-grid { grid-template-columns: 1fr 1fr; }
}
</style>
