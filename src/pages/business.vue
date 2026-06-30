<template>
  <div>
    <PageHero>
      <h1>Erreiche Mountainbiker. Genau dort, wo sie fahren.</h1>
      <p>Trailradar ist die zentrale Plattform für offiziell angelegte MTB-Trailgebiete in Deutschland.
        Sichtbarkeit – direkt auf der Karte. Direkt in der Community.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section class="section">
        <p class="lead">
          Trailradar ist eine dynamisch wachsende Plattform mit einer klaren Mission:
          Offizielle Mountainbike-Trailgebiete sichtbar machen.
        </p>
        <p>Keine allgemeine Outdoor-Seite. Kein beliebiges Portal. Sondern ein fokussierter Touchpoint
          für eine klar definierte Zielgruppe: aktive Mountainbiker.</p>
      </section>

      <section class="section split">
        <div>
          <h2>Kooperationen für Marken & Industrie</h2>
          <p>Trailradar ist die einzige Plattform in Deutschland, auf der alle offiziell angelegten
            MTB-Trailgebiete gebündelt zu finden sind.</p>
          <p>Die Nutzer sind keine zufälligen Besucher – sondern aktive Biker, die gezielt nach Trails suchen.</p>

          <div class="highlight-box">
            <strong>Was das für die Marke bedeutet:</strong>
            <ul>
              <li>Präzise Zielgruppe ohne Streuverlust</li>
              <li>Positionierung im legalen & nachhaltigen MTB-Umfeld</li>
              <li>Glaubwürdige Präsenz innerhalb einer Community-Plattform</li>
              <li>Kein überladenes Werbeumfeld</li>
            </ul>
          </div>
        </div>
        <img src="/assets/trailhead.webp" alt="MTB Community" />
      </section>

      <section class="section split">
        <img src="/assets/mtb_school.webp" alt="MTB Trails Deutschland" />
        <div>
          <h2>Kooperationen für MTB-spezifische Anbieter</h2>
          <p>Du betreibst eine Fahrtechnikschule, ein Bike-Hotel, eine MTB-Verleihstation oder ein
            vergleichbares Angebot? Dann ist Trailradar der ideale Ort für deine Sichtbarkeit.</p>

          <div class="highlight-box">
            <strong>Dein Vorteil:</strong>
            <ul>
              <li>Präsenz direkt auf der Karte</li>
              <li>Sichtbarkeit im unmittelbaren Trail-Kontext</li>
              <li>Relevante Zielgruppe mit konkreter Ride-Intention</li>
              <li>Klare regionale Zuordnung</li>
            </ul>
          </div>
        </div>
      </section>
    </main>

    <footer class="cta">
      <h2>Lass uns sprechen</h2>
      <p>Wenn du Interesse an einer Kooperation hast, freue ich mich über eine unverbindliche Nachricht.</p>
      <p>Gemeinsam finden wir ein Modell, das zur Marke, zur Community und zur Plattform passt.</p>
      <a href="mailto:webmaster@trailradar.org" class="contact-button">Kontakt aufnehmen</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Kooperationen – Sichtbarkeit in der MTB-Community',
  description: 'Kooperation mit Trailradar: Erreiche Mountainbiker direkt auf der Karte.',
  ogUrl: 'https://trailradar.org/business',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/business' }],
})
</script>

<style scoped>
.section { margin-bottom: 4em; }

.lead {
  font-size: 1.2rem;
  color: #444;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}

.split img {
  width: 100%;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.highlight-box {
  background: #f0f4f8;
  border-left: 4px solid var(--color-primary);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin: 1.5rem 0;
}

.highlight-box ul {
  margin: 0.5em 0 0;
  padding-left: 1.25em;
  color: #2a2a2a;
}

.contact-button {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.9rem 2rem;
  background: var(--color-page-accent);
  color: #000;
  font-weight: 700;
  border-radius: 999px;
  text-decoration: none;
  transition: opacity 0.15s;
}

.contact-button:hover { opacity: 0.85; text-decoration: none; }

@media (max-width: 900px) {
  .split { grid-template-columns: 1fr; }
}
</style>
