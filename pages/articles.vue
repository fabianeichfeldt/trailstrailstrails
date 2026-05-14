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
        <NuxtLink to="/trailradar-vs-trailforks" class="article-card">
          <span class="tag">Vergleich</span>
          <h2>TrailRadar vs. Trailforks – Welche MTB-App liefert bessere Trails in Deutschland?</h2>
          <p>Trailforks hat mehr Trails weltweit – aber warum TrailRadar für Deutschland die besseren Daten
            liefert und was das für deine Tourenplanung bedeutet.</p>
          <span class="read-link">Artikel lesen →</span>
        </NuxtLink>

        <NuxtLink to="/trailradar-vs-komoot" class="article-card">
          <span class="tag">Vergleich</span>
          <h2>TrailRadar vs. Komoot – Wer schickt dich besser auf die Trails?</h2>
          <p>Komoot plant Routen. Aber wenn es um maximalen MTB-Fahrspaß geht, stößt es schnell an
            Grenzen – unklare Trailzustände, falscher Schwierigkeitsgrad und öfter mal ein Brombeerstrauch.</p>
          <span class="read-link">Artikel lesen →</span>
        </NuxtLink>
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
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: box-shadow 0.2s, transform 0.15s, border-color 0.2s;
  text-decoration: none;
  cursor: pointer;
  border: 1.5px solid #e0e0e0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.article-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  border-color: var(--color-primary);
}

.article-card:active {
  transform: scale(0.98);
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
  padding-bottom: 1rem;
}

.read-link {
  display: block;
  margin: 0.25rem -1.5rem 0;
  padding: 0.65rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-primary);
  background: #f0f6ff;
  border-top: 1px solid #dbeafe;
  transition: background 0.15s, color 0.15s;
}

.article-card:hover .read-link {
  background: var(--color-primary);
  color: #fff;
  border-top-color: var(--color-primary);
}
</style>
