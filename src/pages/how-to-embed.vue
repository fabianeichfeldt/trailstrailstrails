<template>
  <div>
    <PageHero>
      <h1>Zeig deine Trails auf deiner eigenen Website</h1>
      <p>Bindet die Trailradar-Karte mit wenigen Zeilen Code in eure Website ein –
        mit euren eigenen Trails, immer aktuell, ohne eigenen Pflegeaufwand.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section class="section">
        <p class="lead">
          Ob Tourismusverband, Bikepark oder Trailgebiet: Mit dem Trailradar-Embed
          zeigt ihr eure Strecken direkt auf eurer eigenen Seite – als interaktive Karte.
        </p>
        <p>Die Daten kommen live aus Trailradar: Status, GPX-Tracks und Öffnungszeiten.
          Über den Trailradar-Spotmanager lassen sich Änderungen schnell und unkompliziert einpflegen.</p>
      </section>

      <section class="section">
        <h2>So sieht das aus</h2>
        <p>Ein Beispiel: eine eingebettete Karte für ein Trailgebiet im nördlichen Baden-Württemberg –
          genau so, wie sie auch auf eurer Website erscheinen würde.</p>

        <div class="embed-example">
          <div class="ee-chrome">
            <div class="ee-dots"><span /><span /><span /></div>
            <div class="ee-bar">deine-website.de</div>
          </div>
          <iframe
            class="ee-frame"
            :src="demoEmbedSrc"
            title="Trailradar Karteneinbettung – Beispiel"
            loading="lazy"
            allowfullscreen
          />
        </div>
        <p class="caption">Beispiel: eingebettete Karte für ein Trailgebiet im nördlichen Baden-Württemberg</p>
      </section>

      <section class="section">
        <h2>Code zum Einbetten</h2>
        <p>Fügt diesen Code an der Stelle eurer Seite ein, an der die Karte erscheinen soll.
          Ersetzt <code>DEIN-TOKEN</code> durch euren Embed-Token.</p>

        <CodeSnippet :code="snippet" />
      </section>

      <section class="section">
        <h2>Optionen</h2>
        <table class="options-table">
          <thead>
            <tr><th>Option</th><th>Beschreibung</th><th>Standard</th></tr>
          </thead>
          <tbody>
            <tr><td><code>token</code></td><td>Euer Embed-Token (erforderlich)</td><td>–</td></tr>
            <tr><td><code>target</code></td><td>CSS-Selector des Ziel-Elements</td><td><code>#trailradar-embed</code></td></tr>
            <tr><td><code>center</code></td><td><code>[lat, lng]</code> des Kartenausschnitts</td><td>–</td></tr>
            <tr><td><code>zoom</code></td><td>Zoomstufe der Karte</td><td>–</td></tr>
            <tr><td><code>height</code></td><td>Höhe des eingebetteten Bereichs</td><td><code>500px</code></td></tr>
            <tr><td><code>baseUrl</code></td><td>Nur für Self-Hosting / lokale Entwicklung</td><td><code>https://trailradar.org</code></td></tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Häufige Fragen</h2>

        <div class="faq-item">
          <h3>Was kostet das?</h3>
          <p>Es gibt kein festes Preismodell und keinen Self-Checkout. Die Kosten hängen vom Umfang ab
            (z. B. Anzahl der Trails, Domains, Individualisierung). Schreibt uns – gemeinsam schauen wir,
            was für euch möglich ist und was es kostet.</p>
        </div>

        <div class="faq-item">
          <h3>Wie bekomme ich einen Token?</h3>
          <p>Tokens werden nicht automatisiert vergeben. Meldet euch per Mail, dann besprechen wir Umfang
            und Kosten und richten euch anschließend einen Token ein.</p>
        </div>

        <div class="faq-item">
          <h3>Kann ich mehrere Trailgebiete in einem Embed zeigen?</h3>
          <p>Ja. Ein Token kann mehrere Spots umfassen – welche, legen wir bei der Einrichtung gemeinsam fest.</p>
        </div>

        <div class="faq-item">
          <h3>Ist die eingebettete Karte responsive?</h3>
          <p>Ja. Die Karte passt sich in der Breite automatisch an, die Höhe legt ihr über die
            <code>height</code>-Option fest.</p>
        </div>
      </section>
    </main>

    <footer class="cta">
      <h2>Interesse an einem Embed?</h2>
      <p>Schreibt uns kurz, für welches Trailgebiet ihr die Karte einbinden möchtet.</p>
      <p>Gemeinsam besprechen wir, was möglich ist und was es kostet – einen Self-Checkout gibt es nicht.</p>
      <a href="mailto:webmaster@trailradar.org" class="contact-button">Kontakt aufnehmen</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
const DEMO_LAT  = 49.0069
const DEMO_LNG  = 8.4037
const DEMO_ZOOM = 10

// Real embed token, scoped to a demo spot near Karlsruhe, allowed for trailradar.org itself —
// used to render a genuine embed on this page (not a mockup).
const demoToken = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4'
const demoEmbedSrc = `/embed/${demoToken}?lat=${DEMO_LAT}&lng=${DEMO_LNG}&zoom=${DEMO_ZOOM}`

const snippet = `<div id="trailradar-embed" style="height:500px"></div>
<script src="https://trailradar.org/embed.js"><\/script>
<script>
  TrailRadar.mount({
    token: 'DEIN-TOKEN',
    center: [${DEMO_LAT}, ${DEMO_LNG}], // z.B. euer Trailgebiet
    zoom: ${DEMO_ZOOM},
    height: '500px',
  });
<\/script>`

useSeoMeta({
  title: 'Karte einbetten – Trailradar für eure Website',
  description: 'Bindet die Trailradar-Karte mit wenigen Zeilen Code in eure Website ein. Anleitung, Beispiel und Code zum Kopieren.',
  ogUrl: 'https://trailradar.org/how-to-embed',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/how-to-embed' }],
})
</script>

<style scoped>
.section { margin-bottom: 4em; }

.lead {
  font-size: 1.2rem;
  color: #444;
}

.caption {
  margin-top: 0.8rem;
  font-size: 0.85rem;
  color: #777;
  text-align: center;
}

/* Visual example mockup */
.embed-example {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}

.ee-chrome {
  background: #2a2a2a;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
}

.ee-dots { display: flex; gap: 5px; }
.ee-dots span { width: 11px; height: 11px; border-radius: 50%; background: #555; }
.ee-dots span:nth-child(1) { background: #ff5f57; }
.ee-dots span:nth-child(2) { background: #febc2e; }
.ee-dots span:nth-child(3) { background: #28c840; }

.ee-bar {
  flex: 1;
  background: #3a3a3a;
  border-radius: 5px;
  font-size: 0.7rem;
  color: #aaa;
  padding: 3px 10px;
  text-align: center;
}

.ee-frame {
  display: block;
  width: 100%;
  height: 400px;
  border: none;
}

.options-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.options-table th,
.options-table td {
  text-align: left;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid #e2e8f0;
}

.options-table th { color: var(--color-primary); }
.options-table code { font-size: 0.85em; }

.faq-item + .faq-item { margin-top: 2em; }
.faq-item h3 { color: var(--color-primary); font-size: 1.15em; }

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

@media (max-width: 600px) {
  .ee-frame { height: 300px; }
  .options-table { display: block; overflow-x: auto; white-space: nowrap; }
}
</style>
