<template>
  <div>
    <PageHero>
      <h1>Trailgespräche</h1>
      <p>Meinungen, Vergleiche und Einblicke aus der MTB-Community in Deutschland.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <p class="intro">Gedanken, die einem auf dem Bike kommen.</p>

      <div class="articles-grid">
        <div class="article-card">
          <span class="tag">Vergleich</span>
          <h2>TrailRadar vs. Trailforks – Welche MTB-App liefert bessere Trails in Deutschland?</h2>
          <p>Trailforks hat mehr Trails weltweit – aber warum TrailRadar für Deutschland die besseren Daten
            liefert und was das für deine Tourenplanung bedeutet.</p>
          <a href="/trailradar-vs-trailforks" class="read-link">Artikel lesen →</a>
        </div>

        <div class="article-card">
          <span class="tag">Vergleich</span>
          <h2>TrailRadar vs. Komoot – Wer schickt dich besser auf die Trails?</h2>
          <p>Komoot plant Routen. Aber wenn es um maximalen MTB-Fahrspaß geht, stößt es schnell an
            Grenzen – unklare Trailzustände, falscher Schwierigkeitsgrad und öfter mal ein Brombeerstrauch.</p>
          <a href="/trailradar-vs-komoot" class="read-link">Artikel lesen →</a>
        </div>
      </div>
    </main>

    <footer class="cta">
      <h2>Fehlt ein Thema?</h2>
      <p>Wenn du ein Thema vermisst oder eine Frage hast, die einen eigenen Artikel verdient – meld dich.</p>
      <p style="margin-top:1rem;">
        <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Trailgespräche – TrailRadar',
  description: 'Meinungen, Vergleiche und Einblicke aus der MTB-Community in Deutschland.',
  ogUrl: 'https://trailradar.org/articles',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/articles' }],
})
</script>

<style scoped>
.intro {
  color: #444;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.article-card {
  background: #f5f5f5;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: box-shadow 0.15s;
}

.article-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.tag {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #2a9d2a;
  background: #e8f7ec;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  align-self: flex-start;
}

.article-card h2 {
  font-size: 1.1rem;
  margin: 0;
  color: #111;
  line-height: 1.35;
}

.article-card p {
  font-size: 0.9rem;
  color: #555;
  margin: 0;
  flex-grow: 1;
}

.read-link {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-primary);
  align-self: flex-start;
}

.read-link:hover { color: #1a4a80; }
</style>
