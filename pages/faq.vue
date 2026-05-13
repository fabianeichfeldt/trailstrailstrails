<template>
  <div>
    <PageHero>
      <h1>FAQ – Häufige Fragen</h1>
      <p>Zu offiziell gebauten MTB-Trails, dem Trailradar-Projekt und Tipps für deine nächste Tour.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/" class="back-link">← Zurück zur Karte</NuxtLink>

      <nav class="faq-nav">
        <h2>Direkt zu deiner Frage</h2>
        <ul>
          <li><a href="#off-map">🔹 Darf ich Trails fahren, die nicht in dieser Karte stehen?</a></li>
          <li><a href="#official">🔹 Was macht einen Trail offiziell?</a></li>
          <li><a href="#missing">🔹 Warum fehlen manche Bikeparks/Trails?</a></li>
          <li><a href="#submit">🔹 Kann ich selbst Trails melden?</a></li>
          <li><a href="#packing-tour">🔹 Was sollte ich auf eine MTB-Tour mitnehmen?</a></li>
          <li><a href="#packing-park">🔹 Was sollte ich beim Bikeparkbesuch mitnehmen?</a></li>
        </ul>
      </nav>

      <div class="faq-item" id="off-map">
        <h3>Darf ich Trails fahren, die nicht in dieser Karte stehen?</h3>
        <p>Ja, in vielen Regionen ist das möglich. Bitte informiere dich jedoch immer bei lokalen Behörden,
          Forstämtern oder Kommunen über geltende Regelungen, insbesondere in Schutzgebieten.</p>
      </div>

      <div class="faq-item" id="official">
        <h3>Was macht einen Trail offiziell?</h3>
        <p>Ein offizieller Trail wurde in enger Abstimmung mit Behörden geplant, genehmigt und gebaut.
          Zudem wird er von einer zuständigen Organisation wie einem Verein, Betreiber oder einer Kommune gepflegt.</p>
      </div>

      <div class="faq-item" id="missing">
        <h3>Warum finde ich hier nicht alle offiziellen Bikeparks oder Trails?</h3>
        <p>Trailradar ist ein Community-Projekt. Neue Spots werden laufend ergänzt – gerne auch von dir! Wenn du
          einen offiziell gebauten Trail kennst, trag ihn direkt auf der Karte ein oder kontaktiere uns.</p>
      </div>

      <div class="faq-item" id="submit">
        <h3>Kann ich selbst Trails melden?</h3>
        <p>Ja! Trage den Trail direkt in die Karte ein oder melde dich via Instagram
          (<a href="https://www.instagram.com/trailradar.germany/" target="_blank" rel="noopener">@trailradar.germany</a>)
          oder per Mail an <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>.</p>
      </div>

      <div class="faq-item" id="packing-tour">
        <h3>Was sollte ich auf eine MTB-Tour mitnehmen?</h3>
        <p>Für eine sichere Tour empfehlen sich: <strong>Multitool</strong>, <strong>Wasserflasche</strong>
          oder Trinkblase, <strong>Mini-Pumpe</strong>, <strong>Tire Plugs</strong> oder Ersatzschlauch,
          energiereiche Snacks sowie Helm und ggf. Protektoren.</p>
      </div>

      <div class="faq-item" id="packing-park">
        <h3>Was sollte ich beim Bikeparkbesuch mitnehmen?</h3>
        <p>Bei einem <strong>Bikepark-Besuch</strong> wird das Material stärker belastet. Empfohlen werden:
          <strong>Pumpe</strong>, <strong>Multitool</strong>, <strong>Dichtmilch</strong>,
          <strong>Ersatzschlauch</strong>, <strong>Tire Plugs</strong>, <strong>Ersatzreifen</strong>,
          <strong>Ersatzbremsbeläge</strong> sowie <strong>Fullface-Helm</strong> und Protektoren.</p>
      </div>
    </main>

    <footer class="cta">
      <h2>Trailradar lebt von euch</h2>
      <p>Wenn ein Trail fehlt, sich etwas geändert hat oder dir ein Fehler auffällt – melde dich.
        Trailradar wächst mit der Community, nicht neben ihr.</p>
      <p style="margin-top:2rem;">In diesem Sinne: <strong>Happy Trails.</strong></p>
    </footer>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'FAQ – MTB-Trails finden & Vorbereitung deiner Tour | Trailradar',
  description: 'Häufige Fragen zu offiziell gebauten MTB-Trails sowie Tipps zur Vorbereitung deiner Mountainbike-Tour.',
  ogTitle: 'FAQ – MTB-Trails & Vorbereitung deiner Tour | Trailradar',
  ogDescription: 'Alles über offiziell gebaute MTB-Trails und die wichtigste Ausrüstung für deine nächste Tour.',
  ogType: 'article',
  ogUrl: 'https://trailradar.org/faq',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/faq' }],
  script: [{
    type: 'application/ld+json',
    children: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Darf ich Trails fahren, die nicht in dieser Karte stehen?', acceptedAnswer: { '@type': 'Answer', text: 'Ja, in vielen Regionen ist das möglich. Bitte informiere dich immer bei lokalen Behörden oder Forstämtern.' } },
        { '@type': 'Question', name: 'Was macht einen Trail offiziell?', acceptedAnswer: { '@type': 'Answer', text: 'Ein offizieller Trail wurde behördlich geplant, genehmigt und gebaut und wird von einer zuständigen Organisation gepflegt.' } },
        { '@type': 'Question', name: 'Warum fehlen manche Bikeparks oder Trails?', acceptedAnswer: { '@type': 'Answer', text: 'Trailradar ist ein Community-Projekt. Neue Spots werden laufend ergänzt.' } },
        { '@type': 'Question', name: 'Kann ich selbst Trails melden?', acceptedAnswer: { '@type': 'Answer', text: 'Ja. Trails können auf der Karte eingetragen oder über Instagram bzw. E-Mail gemeldet werden.' } },
      ],
    }),
  }],
})
</script>

<style scoped>
.faq-nav {
  background: #f6f9fc;
  padding: 1em 1.2em;
  border-radius: 12px;
  margin-bottom: 2em;
  border: 1px solid #e2e8f0;
}

.faq-nav h2 {
  margin-top: 0;
  margin-bottom: 0.6em;
  font-size: 1rem;
  color: var(--color-primary);
}

.faq-nav ul {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.faq-nav li { margin: 0.4em 0; }

.faq-nav a {
  color: var(--color-primary);
  font-weight: 600;
}

.faq-item + .faq-item { margin-top: 2em; }

.faq-item h3 {
  font-size: 1.15em;
  margin-bottom: 0.3em;
  color: var(--color-primary);
  scroll-margin-top: 90px;
}
</style>
