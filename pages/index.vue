<template>
  <div class="landing">

    <!-- Hero -->
    <section class="hero">
      <div class="hero-overlay" />
      <div class="hero-content">
        <img src="/assets/logo.webp" alt="Trailradar Logo" class="hero-logo" />
        <div class="hero-text">
          <h1>Alle offiziellen MTB Trails. Legal. Community getrieben und übersichtlich auf der Karte.</h1>
          <p class="hero-sub">Bock auf coole MTB-Trails? Hier findest du alle offiziell gebauten Trails auf einer Karte.</p>
        </div>
      </div>
    </section>

    <!-- Map teaser -->
    <section class="map-teaser-section">
      <NuxtLink to="/map" class="map-teaser-link" aria-label="Zur interaktiven Karte">
        <div class="map-teaser">
          <!-- Fake browser chrome -->
          <div class="map-chrome">
            <div class="chrome-dots">
              <span /><span /><span />
            </div>
            <div class="chrome-bar">trailradar.org/map</div>
          </div>
          <!-- Map preview using OSM tiles as background -->
          <div class="map-preview">
            <!-- Fake UI overlays -->
            <div class="fake-searchbar">🔍 Trails, Parks, Orte …</div>
            <!-- Colored marker blobs mimicking real markers -->
            <div class="marker marker-blue" style="top:28%;left:44%" />
            <div class="marker marker-blue" style="top:18%;left:26%" />
            <div class="marker marker-green" style="top:38%;left:58%" />
            <div class="marker marker-green" style="top:55%;left:37%" />
            <div class="marker marker-pink" style="top:45%;left:22%" />
            <div class="marker marker-blue" style="top:62%;left:50%" />
            <div class="marker marker-cluster" style="top:35%;left:17%">3</div>
            <div class="marker marker-cluster" style="top:68%;left:32%">2</div>
            <!-- CTA overlay -->
            <div class="map-cta-overlay">
              <span class="map-cta-btn">Zur Karte →</span>
            </div>
          </div>
        </div>
      </NuxtLink>
    </section>

    <!-- Features -->
    <section class="features container">
      <div class="feature-card">
        <span class="feature-icon">🗺️</span>
        <h2>Interaktive Karte</h2>
        <p>Alle offiziell genehmigten Trails auf einem Blick. Filtere nach Trails, Bikeparks und Pumptracks.</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">✅</span>
        <h2>Nur legale Trails</h2>
        <p>Trailradar listet ausschließlich Strecken, die offiziell genehmigt oder geduldet sind.</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">📍</span>
        <h2>Immer aktuell</h2>
        <p>Die Community trägt neue Spots ein und meldet Änderungen – so bleibt die Karte aktuell.</p>
      </div>
    </section>

    <!-- Community -->
    <section class="community-section container">
      <h2>Trailradar Community 💪</h2>
      <p>
        Wir haben schon <strong>430+ Einträge</strong> in 13 Ländern!<br>
        Die aktivsten Trailradar Mitglieder:
      </p>
      <div class="leaderboard-mini">
        <div class="leaderboard-entry gold">🥇 @maik.ri.00 <span>44 Einträge</span></div>
        <div class="leaderboard-entry silver">🥈 StelioKontos <span>35 Einträge</span></div>
        <div class="leaderboard-entry silver">🥈 Florian <span>35 Einträge</span></div>
        <div class="leaderboard-entry bronze">🥉 cbtp <span>21 Einträge</span></div>
        <div class="leaderboard-entry">💪 alexlechner <span>9 Einträge</span></div>
        <div class="leaderboard-entry">💪 Poacher-79 <span>8 Einträge</span></div>
        <div class="leaderboard-entry">💪 VLKR <span>7 Einträge</span></div>
        <div class="leaderboard-entry">💪 Magster <span>7 Einträge</span></div>
      </div>
      <NuxtLink to="/map" class="btn-community">Trails entdecken →</NuxtLink>
    </section>

    <!-- SEO text -->
    <section class="seo-text container">
      <h2>Entdecke offizielle MTB Trails in deiner Nähe</h2>
      <p>
        Mountainbiken boomt – doch wirklich <strong>offizielle und genehmigte MTB-Trails</strong> zu finden, ist oft schwierig.
        Genau hier setzt <strong>Trailradar</strong> an: die zentrale Plattform für legal anerkannte Mountainbike-Projekte in
        Deutschland und mittlerweile auch in Österreich, der Schweiz und anderen Ländern.
      </p>
      <p>
        Auf Trailradar findest du ausschließlich behördlich genehmigte <strong>Mountainbike Trails</strong>, <strong>Bikeparks</strong>,
        <strong>Trailcenter</strong>, Pumptracks und Dirtparks übersichtlich auf einer Karte.
      </p>
      <hr>
      <h2>Warum offizielle Mountain Bike Trails wichtig sind</h2>
      <ul>
        <li>Rechtssicherheit für Fahrerinnen und Fahrer</li>
        <li>Schutz von Natur &amp; Wildtieren durch gelenkte Nutzung</li>
        <li>Wartung &amp; Pflege durch Vereine oder Betreiber</li>
        <li>Höhere Sicherheit dank gewarteter Strecken</li>
      </ul>
      <hr>
      <h2>Finde Trails in deiner Region</h2>
      <p class="region-links">
        <NuxtLink to="/trails/pfalz">MTB Trails Pfalz</NuxtLink>,
        <NuxtLink to="/trails/schwarzwald">Trails Schwarzwald</NuxtLink>,
        <NuxtLink to="/trails/allgaeu">Trails Allgäu</NuxtLink>,
        <NuxtLink to="/trails/odenwald">Trails Odenwald</NuxtLink>,
        <NuxtLink to="/trails/fraenkische-schweiz">Trails Fränkische Schweiz</NuxtLink>,
        <NuxtLink to="/trails/schwaebische-alb">Trails Schwäbische Alb</NuxtLink>,
        <NuxtLink to="/trails/oberpfalz">Trails Oberpfalz</NuxtLink>,
        <NuxtLink to="/trails/taunus">Trails Taunus</NuxtLink>,
        <NuxtLink to="/trails/rhoen">Trails Rhön</NuxtLink>,
        <NuxtLink to="/trails/berlin">Trails Berlin</NuxtLink>,
        <NuxtLink to="/trails/muenchen">Trails München</NuxtLink>,
        <NuxtLink to="/trails/nuernberg">Trails Nürnberg</NuxtLink>,
        <NuxtLink to="/trails/frankfurt">Trails Frankfurt</NuxtLink>,
        <NuxtLink to="/trails/bayerischerwald">Trails Bayerischer Wald</NuxtLink>,
        <NuxtLink to="/trails/innsbruck">Trails Innsbruck</NuxtLink>,
        <NuxtLink to="/trails/salzburg">Trails Salzburg</NuxtLink>,
        <NuxtLink to="/trails/wien">Trails Wien</NuxtLink>
        und viele mehr.
      </p>
    </section>

  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Trailradar – Offizielle MTB-Trails in Deutschland',
  description: 'Trailradar gibt dir den besten Überblick über alle legal gebauten, offiziellen MTB Trails in Deutschland – übersichtlich auf der Karte.',
  ogUrl: 'https://trailradar.org/',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
  ogType: 'website',
  ogImage: 'https://trailradar.org/assets/spotchecks/fuerth.webp',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/' }],
})
</script>

<style scoped>
/* ── Hero ── */
.hero {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  min-height: 220px;
  border-radius: 0 0 14px 14px;
  background: url('/assets/hero-mobile.webp') center/cover no-repeat, #121212;
}
@media (min-width: 800px) {
  .hero { background-image: url('/assets/hero-desktop.webp'); }
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.4));
  backdrop-filter: brightness(0.8);
}
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem 1.5rem;
  color: white;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}
.hero-logo { width: 54px; height: 54px; flex-shrink: 0; }
.hero-text h1 {
  font-size: clamp(1rem, 2.5vw, 1.3rem);
  font-weight: 700;
  text-shadow: 0 2px 6px rgba(0,0,0,0.6);
  margin: 0 0 0.4rem;
}
.hero-sub { font-size: 0.82rem; opacity: 0.88; margin: 0; }

/* ── Map teaser ── */
.map-teaser-section {
  padding: 2.5rem 1rem;
  background: var(--color-page-bg, #0e0f10);
  display: flex;
  justify-content: center;
}
.map-teaser-link {
  display: block;
  max-width: 780px;
  width: 100%;
  text-decoration: none;
}
.map-teaser {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.55);
  transition: transform 0.2s, box-shadow 0.2s;
}
.map-teaser-link:hover .map-teaser {
  transform: translateY(-4px);
  box-shadow: 0 14px 50px rgba(0,0,0,0.65);
}

/* Browser chrome bar */
.map-chrome {
  background: #2a2a2a;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
}
.chrome-dots { display: flex; gap: 5px; }
.chrome-dots span {
  width: 11px; height: 11px; border-radius: 50%;
  background: #555;
}
.chrome-dots span:nth-child(1) { background: #ff5f57; }
.chrome-dots span:nth-child(2) { background: #febc2e; }
.chrome-dots span:nth-child(3) { background: #28c840; }
.chrome-bar {
  flex: 1; background: #3a3a3a; border-radius: 5px;
  font-size: 0.7rem; color: #aaa; padding: 3px 10px; text-align: center;
}

/* Map preview area */
.map-preview {
  position: relative;
  height: 340px;
  background:
    /* OSM tile centered on Germany ~zoom 6 */
    url('https://tile.openstreetmap.org/6/33/21.png') -120px -80px / 512px 512px,
    url('https://tile.openstreetmap.org/6/34/21.png') 392px -80px / 512px 512px,
    url('https://tile.openstreetmap.org/6/33/22.png') -120px 432px / 512px 512px,
    url('https://tile.openstreetmap.org/6/34/22.png') 392px 432px / 512px 512px,
    #e8f0e8;
  overflow: hidden;
}

/* Fake search bar overlay */
.fake-searchbar {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 0.78rem;
  color: #999;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  white-space: nowrap;
  z-index: 2;
}

/* Markers */
.marker {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.marker::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  top: 5px;
  left: 5px;
}
.marker-blue { background: var(--color-trail, #3b82f6); }
.marker-green { background: var(--color-bikepark, #10b981); }
.marker-pink { background: #b91094; }
.marker-cluster {
  border-radius: 50%;
  transform: none;
  width: 26px;
  height: 26px;
  background: #10b981;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}
.marker-cluster::after { display: none; }

/* CTA overlay */
.map-cta-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 3;
}
.map-teaser-link:hover .map-cta-overlay { background: rgba(0,0,0,0.18); }
.map-cta-btn {
  background: #00b347;
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.8rem 2.2rem;
  border-radius: 10px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.35);
  pointer-events: none;
}

/* ── Features ── */
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.2rem;
  padding-top: 3rem;
  padding-bottom: 2rem;
}
.feature-card {
  background: rgba(255,255,255,0.9);
  border-radius: 12px;
  padding: 1.6rem 1.2rem;
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0,0,0,0.1));
  text-align: center;
}
.feature-icon { font-size: 2rem; display: block; margin-bottom: 0.7rem; }
.feature-card h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; }
.feature-card p { font-size: 0.85rem; color: #555; line-height: 1.5; margin: 0; }

/* ── Community ── */
.community-section {
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(3px);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  padding: 1.5rem 1.2rem;
  text-align: center;
  margin-bottom: 2rem;
  max-width: 620px !important;
}
.community-section h2 { color: #2b6cb0; font-size: 1rem; margin-top: 0; }
.community-section p { font-size: 0.82rem; color: #555; line-height: 1.5; }
.leaderboard-mini { display: flex; flex-direction: column; gap: 0.35rem; margin: 1rem 0; }
.leaderboard-entry {
  display: flex; justify-content: space-between;
  background: #f9fafb; padding: 0.4em 0.6em;
  border-radius: 8px; font-size: 0.78rem;
}
.leaderboard-entry.gold   { background: linear-gradient(90deg,#fff7cc,#fff2a8); }
.leaderboard-entry.silver { background: linear-gradient(90deg,#f7f7f7,#e9e9e9); }
.leaderboard-entry.bronze { background: linear-gradient(90deg,#f9e2c3,#f7d2a8); }
.leaderboard-entry span { font-weight: 500; color: #555; }
.btn-community {
  display: inline-block;
  background: #2b6cb0; color: white;
  font-weight: 600; font-size: 0.85rem;
  padding: 0.6rem 1.4rem;
  border-radius: 8px;
  text-decoration: none;
  margin-top: 0.5rem;
}
.btn-community:hover { background: #3182ce; }

/* ── SEO text ── */
.seo-text {
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(3px);
  border-radius: 12px;
  padding: 1.5rem 1.5rem;
  margin-bottom: 2rem;
  font-size: 0.88rem;
  color: #444;
  line-height: 1.6;
}
.seo-text h2 { font-size: 1rem; color: #0e1a2b; margin-top: 1.2rem; }
.seo-text h2:first-child { margin-top: 0; }
.seo-text ul { padding-left: 1.3rem; margin: 0.5rem 0; }
.seo-text hr { border: none; border-top: 1px solid #eee; margin: 1.2rem 0; }
.region-links { font-size: 0.8rem; }
.region-links a { color: var(--color-link, #0077cc); text-decoration: none; }
.region-links a:hover { text-decoration: underline; }
</style>
