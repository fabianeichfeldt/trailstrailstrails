<template>
  <div>
    <PageHero>
      <h1>Was ist ein offiziell gebauter MTB-Trail?</h1>
      <p>Warum diese Karte nicht jeden befahrbaren Trail zeigt – sondern nur offiziell gebaute MTB-Strecken.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <p class="intro">
        In Deutschland, Schweiz, Österreich und allen anderen Nachbarländern existieren tausende Wege,
        die man als Mountainbiker befahren kann und oft auch befahren darf. Das heißt aber NICHT, dass
        dies automatisch ein offiziell gebauter und gepflegter Mountainbike-Trail ist.
      </p>

      <p>
        <strong>Unsere Karte zeigt nicht „alles was legal befahrbar ist".</strong><br>
        Unsere Karte zeigt bewusst nur MTB-Strecken, die als Infrastruktur geplant, gebaut und offiziell
        unterstützt wurden.
      </p>

      <h2>Was heißt „offiziell" hier konkret?</h2>
      <p>Ein Trail ist für diese Karte „offiziell", wenn mindestens eines davon zutrifft:</p>
      <ul>
        <li>er wurde genehmigt geplant und gebaut</li>
        <li>er wird von einem Verein, Projekt oder Unternehmen aktiv gepflegt oder betrieben</li>
        <li>es gibt kommunale / behördliche Abstimmung (z.B. Gemeinde / Forst / Tourismus)</li>
      </ul>

      <p>Dieses Kriterium ist wichtig, weil:</p>
      <ul>
        <li>die Veröffentlichung ist unkritisch</li>
        <li>solche Trails sind nachhaltig angelegt</li>
        <li>Konfliktpotenzial zu Wanderern und Naturschutz ist reduziert</li>
        <li>Pflege, Rettung, Haftung und Kommunikation sind geregelt</li>
      </ul>

      <h2>Was diese Karte zeigen will</h2>
      <ul>
        <li>Mountainbiken findet an vielen Orten bereits organisiert statt</li>
        <li>Behörden arbeiten vielerorts Hand in Hand mit der MTB Community</li>
        <li>Vorbilder für Regionen wo die Kommunikation mit Behörden noch nicht so gut funktioniert</li>
      </ul>

      <h2>„Legal" und „offiziell" sind nicht das gleiche Wort</h2>
      <p>Juristisch können viele Wege befahrbar sein. Aber „offizieller MTB-Trail" meint:</p>
      <p>
        <strong>Ein Weg, der als MTB-Strecke existiert, weil Menschen sich die Mühe gemacht haben,
          ihn zu planen, mit Behörden abzustimmen, aufzubauen und zu pflegen.</strong>
      </p>
      <p>
        Diese Plattform soll genau diese aufgebauten Projekte sichtbar machen – und dadurch weitere ermöglichen.
      </p>

      <h2>FAQ – Häufige Fragen</h2>

      <div class="faq-item">
        <h3>Darf ich Trails fahren, die nicht in dieser Karte stehen?</h3>
        <p>Ja, in vielen Gebieten ist das möglich! Bitte informiere dich auf offiziellen Seiten der Kommune
          und der Forstbehörden zu den jeweiligen Regelungen vor Ort.</p>
      </div>

      <div class="faq-item">
        <h3>Was macht einen Trail offiziell?</h3>
        <p>Ein offizieller Trail im Sinne von Trailradar wurde in Abstimmung mit Behörden geplant und gebaut
          und wird von einer zuständigen Organisation gepflegt.</p>
      </div>

      <div class="faq-item">
        <h3>Warum finde ich hier nicht alle offiziellen Bikeparks oder MTB-Trails?</h3>
        <p>Dieses Projekt wird von der Community getragen. Wenn du weitere Trails kennst, trage sie gerne
          ein oder melde dich via
          <a href="https://www.instagram.com/trailradar.germany/" target="_blank" rel="noopener">@trailradar.germany</a>
          oder per Mail: <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>.</p>
      </div>

      <div class="faq-item">
        <h3>Kann ich selbst Trails melden?</h3>
        <p>Absolut – und das ist erwünscht! Trag sie direkt auf der Karte ein oder melde dich via
          <a href="https://www.instagram.com/trailradar.germany/" target="_blank" rel="noopener">@trailradar.germany</a>
          oder per Mail: <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>.</p>
      </div>

      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>
    </main>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Offiziell gebaute MTB Trails – das meint diese Karte | Trailradar',
  description: 'Trailradar zeigt nicht jeden befahrbaren Trail – sondern nur offiziell gebaute und abgestimmte MTB-Strecken.',
  ogTitle: 'Was ist ein offiziell gebauter MTB-Trail?',
  ogDescription: 'Wir zeigen MTB Trails die offiziell geplant, genehmigt oder betrieben werden.',
  ogType: 'article',
  ogUrl: 'https://trailradar.org/legal',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/legal' }],
  script: [{
    type: 'application/ld+json',
    children: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Darf ich Trails fahren, die nicht in dieser Karte stehen?', acceptedAnswer: { '@type': 'Answer', text: 'Ja, in vielen Gebieten ist das möglich. Bitte informiere dich auf offiziellen Seiten der Kommune und der Forstbehörde.' } },
        { '@type': 'Question', name: 'Was macht einen Trail offiziell?', acceptedAnswer: { '@type': 'Answer', text: 'Ein offizieller Trail im Sinne von Trailradar wurde in Abstimmung mit Behörden geplant und gebaut und wird von einer zuständigen Organisation gepflegt.' } },
        { '@type': 'Question', name: 'Kann ich selbst Trails melden?', acceptedAnswer: { '@type': 'Answer', text: 'Ja. Trails können direkt auf der Karte eingetragen oder über Instagram oder E-Mail gemeldet werden.' } },
      ],
    }),
  }],
})
</script>

<style scoped>
.intro {
  font-size: 1em;
  font-weight: 500;
  margin-bottom: 1em;
}

.faq-item + .faq-item { margin-top: 1.5em; }

.faq-item h3 {
  font-size: 1.1em;
  margin-bottom: 0.3em;
  color: var(--color-primary);
}
</style>
