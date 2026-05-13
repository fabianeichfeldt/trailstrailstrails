<template>
  <div>
    <PageHero>
      <h1>Aus Leidenschaft gebaut.<br>Für die MTB-Community.</h1>
      <p>Warum ich Trailradar betreibe – und warum es von uns allen lebt.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section class="split">
        <img src="/assets/aletsch.webp" alt="MTB Stoneman Glaciera - Aletsch Gletscher" />
        <div>
          <p class="lead">Ich bin Fabian, lebe in Bayreuth und fahre Mountainbike aus Leidenschaft –
            schon seit meiner Kindheit.</p>
          <p>Wie bei vielen begann alles ziemlich unspektakulär: mit einem günstigen Baumarkt-Fahrrad.
            Aber genau dort hat es angefangen – draußen sein, Trails suchen, Grenzen austesten.</p>
          <p>Mein erstes „richtiges" Mountainbike, ein komplett starres Scott Hardtail, habe ich mir selbst
            gekauft. Zwei Wochen Sommerferienjob, das ganze Ersparte auf den Tisch gelegt – ein prägender Moment.</p>
        </div>
      </section>

      <section class="split">
        <div>
          <h2>Vom Rennsport zur bewussten Leidenschaft</h2>
          <p>In den folgenden Jahren wurde das Fahren intensiver. Ich bin zahlreiche Mountainbike- und
            Rennradrennen gefahren – von Cross-Country über Marathon bis hin zur Transalp.</p>
          <p>Ein Crash im Jahr 2016 bedeutete dann einen abrupten Einschnitt.</p>
          <p>Heute fahre ich deutlich weniger als „früher". Aber die Leidenschaft ist geblieben.
            Vielleicht sogar bewusster als zuvor.</p>
        </div>
        <img src="/assets/singen_marathon.webp" alt="MTB Rennen / Singen" />
      </section>

      <section>
        <blockquote>
          Wie schön wäre es, wenn das bei uns auch so funktionieren würde.
        </blockquote>
        <p>Diese Frage hat sich bei mir während einer längeren Zeit in Kanada festgesetzt. Egal ob an der Ost-
          oder Westküste – überall gibt es Communities, die ihre Trails pflegen, weiterentwickeln und
          verantwortungsvoll nutzen.</p>
      </section>

      <section class="split">
        <img src="/assets/trailbau.webp" alt="Trailbau Ehrenamt" />
        <div>
          <h2>Trailradar – nicht von irgendwem, sondern aus der Community</h2>
          <p>Seitdem ist viel passiert. In ganz Deutschland entstehen immer mehr offiziell angelegte
            Mountainbike-Trails – in Zusammenarbeit mit Kommunen, Vereinen, Forst und Behörden.</p>
          <p>Trailradar ist aus genau diesem Gedanken heraus entstanden: legale, gepflegte Trails sichtbar
            zu machen und das Engagement dahinter zu würdigen.</p>
          <p>Ich selbst bin Teil dieser Community. Hier in Bayreuth packe ich unter anderem bei den
            Bärenleite Trails mit an.</p>
        </div>
      </section>
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
  title: 'Über Trailradar – Aus der Community, für die Community',
  description: 'Warum Trailradar existiert: persönliche MTB-Geschichte, Community-Gedanke und legale Trails sichtbar machen.',
  ogUrl: 'https://trailradar.org/about',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/about' }],
})
</script>

<style scoped>
section { margin-bottom: 2em; }

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
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

blockquote {
  border-left: 4px solid var(--color-page-accent);
  padding-left: 1.5rem;
  margin: 3rem 0;
  font-style: italic;
  color: #555;
}

@media (max-width: 900px) {
  .split { grid-template-columns: 1fr; }
}
</style>
