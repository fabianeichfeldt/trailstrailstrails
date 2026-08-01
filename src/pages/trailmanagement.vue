<template>
  <div>
    <PageHero>
      <h1>Trailstatus sichtbar gemacht</h1>
      <p>Wir alle fahren am liebsten über unsere Trails. Aber manchmal geht das leider nicht. Sei es wegen Trailbau, Forstarbeiten oder Schäden.
        Mit Trailradar könnt ihr jetzt Trails für einen festen Zeitraum oder unbefristet sperren oder auch nur einen Hinweis hinterlassen für eure
        Community – und zeigt den Status live auf Trailradar und auf eurer eigenen Website.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section class="section">
        <p class="lead">
          Trailbau, Forstarbeiten, Schäden – Trails sind leider nicht immer
          durchgehend befahrbar. Der Trailradar-Spotmanager gibt euch ein Werkzeug an die Hand,
          um das direkt und ohne Umweg zu kommunizieren.
        </p>
        <p>Keine veraltete Info, die noch wochenlang herumgeistert. Der Status wird übersichtlich auf der Karte dargestellt.
        Auf Trailradar und gerne auch auf eurer Website.</p>
      </section>

      <section class="section split">
        <div>
          <h2>Sperrzeitraum frei wählbar</h2>
          <p>Legt im Spotmanager fest, ob ein Trail befristet oder unbefristet gesperrt ist. Oder fügt einen Hinweis hinzu wenn ihr über etwas informieren wollt.</p>
          <div class="highlight-box">
            <ul>
              <li><strong>Befristet</strong> – z. B. für ein Wochenende Forstarbeiten oder ein Trailbautag.
                Der Status verschwindet automatisch, sobald der Zeitraum abgelaufen ist.</li>
              <li><strong>Unbefristet</strong> – z. B. für die Winterpause oder bis auf Weiteres. Ihr hebt
                die Sperre auf, sobald der Trail wieder freigegeben ist.</li>
              <li><strong>Hinweistext</strong> – ein kurzer Hinweis um die Fahrer zu informieren, sichtbar direkt im
                Popup auf der Karte.</li>
            </ul>
          </div>
          <p>Änderungen sind sofort live – ohne Freigabeprozess, ohne Wartezeit.</p>
        </div>
        <img
          :src="'/assets/trail-closure-example.png'"
          alt="Sperrhinweis auf der Trailradar-Karte: Aktuell gesperrt, seit 01.08.2026 bis 01.08.2026, Hinweis von Trailcrew Beste Trails"
        />
      </section>

      <section class="section">
        <h2>Auch auf eurer eigenen Website</h2>
        <p>Der Status ist nicht nur auf Trailradar sichtbar. Über das Kartenwidget oder eine Ampel zeigt ihr eure Trails
          samt Live-Status direkt auf eurer eigenen Website – mit wenigen
          Zeilen Code, immer aktuell, ohne doppelte Pflege.</p>
        <NuxtLink to="/how-to-embed" class="inline-link">Mehr zum Karten-Embed →</NuxtLink>
      </section>

      <section class="section">
        <h2>Wer kann Trails verwalten?</h2>
        <p>Der Spotmanager ist ausschließlich für Trailcrews und Admins zugänglich – Trailbauer mit
          realer Verantwortung für den jeweiligen Trail. Trailcrew-Zugänge werden von uns manuell
          vergeben, damit Status, Sperrzeiten und GPX-Daten eines Spots verlässlich bleiben.</p>
      </section>
    </main>

    <footer class="cta">
      <h2>Ihr betreut ein Trailgebiet?</h2>
      <p>Meldet euch, wenn ihr euren Spot selbst pflegen wollt – wir richten euch einen
        Trailcrew-Zugang ein.</p>
      <a href="mailto:webmaster@trailradar.org" class="contact-button">Kontakt aufnehmen</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Trailmanagement für Trailcrews – Trailradar',
  description: 'Sperrt Trails befristet oder unbefristet, hinterlasst einen Hinweis für eure Community und zeigt den Status live auf Trailradar und eurer eigenen Website.',
  ogUrl: 'https://trailradar.org/trailmanagement',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/trailmanagement' }],
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
  margin: 0;
  padding-left: 1.25em;
  color: #2a2a2a;
}

.highlight-box li + li { margin-top: 0.5em; }

.inline-link {
  display: inline-block;
  margin-top: 0.5rem;
  font-weight: 600;
  color: var(--color-primary);
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
