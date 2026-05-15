<template>
  <div class="landing">

    <!-- Hero -->
    <section class="hero">
      <div class="hero-overlay" />
      <div class="hero-content">
        <img src="/assets/logo.webp" alt="Trailradar Logo" class="hero-logo" />
        <div class="hero-text">
          <h1>Alle offiziellen MTB Trails. Legal. Community-getrieben. Auf der Karte.</h1>
          <p class="hero-sub">Bock auf coole MTB-Trails? Hier findest du alle offiziell gebauten Trails auf einen Blick.</p>
          <NuxtLink to="/support" class="hero-support">❤️ Support Trailradar</NuxtLink>
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
    <section class="features-section">
      <div class="features-grid inner">
      <div class="feature-card">
        <div class="feature-icon">
          <IconMap />
        </div>
        <h2>Interaktive Karte</h2>
        <p>Alle offiziell genehmigten Trails auf einem Blick. Filtere nach Trails, Bikeparks und Pumptracks.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <IconShieldCheck />
        </div>
        <h2>Nur offizielle Trails</h2>
        <p>Trailradar listet ausschließlich Strecken, die offiziell genehmigt sind – kein Graubereich.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <IconUsers />
        </div>
        <h2>Community-getrieben</h2>
        <p>Die Community trägt neue Spots ein und meldet Änderungen – so bleibt die Karte immer aktuell.</p>
      </div>
      </div>
    </section>

    <!-- Quick nav -->
    <section class="quicknav-section">
      <div class="inner">
        <h2 class="section-heading">Mehr auf Trailradar</h2>
        <div class="quicknav-grid">
          <NuxtLink to="/articles" class="qn-card">
            <div class="qn-icon">
              <IconMessageSquare />
            </div>
            <span class="qn-label">Trailgespräche</span>
            <span class="qn-sub">Blog & Berichte</span>
          </NuxtLink>

          <NuxtLink to="/faq" class="qn-card">
            <div class="qn-icon">
              <IconHelpCircle />
            </div>
            <span class="qn-label">FAQ</span>
            <span class="qn-sub">Häufige Fragen</span>
          </NuxtLink>

          <NuxtLink to="/about" class="qn-card">
            <div class="qn-icon">
              <IconUser />
            </div>
            <span class="qn-label">Über mich</span>
            <span class="qn-sub">Das Projekt</span>
          </NuxtLink>

          <NuxtLink to="/support" class="qn-card qn-highlight">
            <div class="qn-icon">
              <IconHeart />
            </div>
            <span class="qn-label">Unterstützen</span>
            <span class="qn-sub">Trailradar fördern</span>
          </NuxtLink>

          <NuxtLink to="/business" class="qn-card">
            <div class="qn-icon">
              <IconBriefcase />
            </div>
            <span class="qn-label">Kooperationen</span>
            <span class="qn-sub">Für Unternehmen</span>
          </NuxtLink>

          <NuxtLink to="/privacy" class="qn-card">
            <div class="qn-icon">
              <IconShield />
            </div>
            <span class="qn-label">Datenschutz</span>
            <span class="qn-sub">& Impressum</span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- News feed -->
    <section class="news-outer">
      <div class="inner">
        <h2 class="section-heading">Zuletzt passiert</h2>
        <div class="news-grid">
          <a
            v-for="item in activity"
            :key="`${item.type}-${item.trailId}`"
            :href="`/map?trail=${item.trailId}`"
            class="news-card"
          >
            <div class="news-card-top">
              <span class="news-tag" :class="`tag--${item.type}`">
                {{ item.type === 'spot' ? 'Neuer Spot' : item.type === 'photo' ? 'Foto' : 'GPX-Track' }}
              </span>
              <span class="news-date">{{ formatDate(item.created_at) }}</span>
            </div>
            <h3 class="news-title">{{ item.name }}</h3>
            <span class="news-read">
              {{ item.type === 'spot' ? 'Auf der Karte ansehen →' : item.type === 'photo' ? 'Foto ansehen →' : 'Track ansehen →' }}
            </span>
          </a>
        </div>
      </div>
    </section>

    <!-- Community -->
    <section class="community-outer">
    <div class="community-section inner">
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
    </div>
    </section>

    <!-- SEO text -->
    <section class="seo-outer">
    <div class="seo-text inner">
      <h2>Entdecke offizielle MTB Trails in deiner Nähe</h2>
      <p>
        Mountainbiken boomt – doch wirklich <strong>offizielle und genehmigte MTB-Trails</strong> zu finden ist oft schwierig.
        Viele Trails, die online kursieren, befinden sich in einem Graubereich oder sind schlicht illegal.
        Genau hier setzt <strong>Trailradar</strong> an: die zentrale Plattform für legal anerkannte Mountainbike-Projekte
        in Deutschland, Österreich, der Schweiz und darüber hinaus.
      </p>
      <p>
        Auf Trailradar findest du ausschließlich behördlich genehmigte <strong>Mountainbike Trails</strong>, <strong>Bikeparks</strong>,
        <strong>Trailcenter</strong>, Pumptracks und Dirtparks – übersichtlich auf einer Karte.
      </p>
      <hr>
      <h2>Warum offizielle Mountain Bike Trails wichtig sind</h2>
      <p>Viele Regionen investieren inzwischen viel Energie in den Bau legaler Trails. Offizielle Strecken bieten:</p>
      <ul>
        <li>Rechtssicherheit für Fahrerinnen und Fahrer</li>
        <li>Schutz von Natur &amp; Wildtieren durch gelenkte Nutzung</li>
        <li>Wartung &amp; Pflege durch Vereine oder Betreiber</li>
        <li>Höhere Sicherheit dank gewarteter Strecken</li>
      </ul>
      <p>
        Viele legale Trails werden von Vereinen oder ehrenamtlichen Crews betrieben.
        <strong>Unser Ziel ist es, die Arbeit der Trailbauer:innen sichtbar zu machen und legale Angebote zu stärken.</strong>
      </p>
      <hr>
      <h2>Was bedeutet "offiziell"?</h2>
      <p>
        Ein Trail gilt bei Trailradar als offiziell, wenn er behördlich genehmigt oder durch eine Gemeinde,
        einen Verein oder einen Natursportverband offiziell ausgewiesen wurde. Wildcats oder inoffizielle Trails
        werden nicht gelistet – das schützt sowohl Fahrer als auch die Natur.
      </p>
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
        <NuxtLink to="/trails/hamburg">Trails Hamburg</NuxtLink>,
        <NuxtLink to="/trails/muenchen">Trails München</NuxtLink>,
        <NuxtLink to="/trails/koeln">Trails Köln</NuxtLink>,
        <NuxtLink to="/trails/stuttgart">Trails Stuttgart</NuxtLink>,
        <NuxtLink to="/trails/duesseldorf">Trails Düsseldorf</NuxtLink>,
        <NuxtLink to="/trails/leipzig">Trails Leipzig</NuxtLink>,
        <NuxtLink to="/trails/dortmund">Trails Dortmund</NuxtLink>,
        <NuxtLink to="/trails/essen">Trails Essen</NuxtLink>,
        <NuxtLink to="/trails/nuernberg">Trails Nürnberg</NuxtLink>,
        <NuxtLink to="/trails/augsburg">Trails Augsburg</NuxtLink>,
        <NuxtLink to="/trails/regensburg">Trails Regensburg</NuxtLink>,
        <NuxtLink to="/trails/karlsruhe">Trails Karlsruhe</NuxtLink>,
        <NuxtLink to="/trails/mannheim">Trails Mannheim</NuxtLink>,
        <NuxtLink to="/trails/freiburg">Trails Freiburg</NuxtLink>,
        <NuxtLink to="/trails/heidelberg">Trails Heidelberg</NuxtLink>,
        <NuxtLink to="/trails/frankfurt">Trails Frankfurt</NuxtLink>,
        <NuxtLink to="/trails/wiesbaden">Trails Wiesbaden</NuxtLink>,
        <NuxtLink to="/trails/kassel">Trails Kassel</NuxtLink>,
        <NuxtLink to="/trails/darmstadt">Trails Darmstadt</NuxtLink>,
        <NuxtLink to="/trails/saarbruecken">Trails Saarbrücken</NuxtLink>,
        <NuxtLink to="/trails/bayerischerwald">Trails Bayerischer Wald</NuxtLink>,
        <NuxtLink to="/trails/innsbruck">Trails Innsbruck</NuxtLink>,
        <NuxtLink to="/trails/salzburg">Trails Salzburg</NuxtLink>,
        <NuxtLink to="/trails/wien">Trails Wien</NuxtLink>,
        <NuxtLink to="/trails/graz">Trails Graz</NuxtLink>,
        <NuxtLink to="/trails/tirol">Trails Tirol</NuxtLink>,
        <NuxtLink to="/trails/vorarlberg">Trails Vorarlberg</NuxtLink>,
        <NuxtLink to="/trails/kaernten">Trails Kärnten</NuxtLink>,
        <NuxtLink to="/trails/schweiz">Trails Schweiz</NuxtLink>,
        <NuxtLink to="/trails/oesterreich">Trails Österreich</NuxtLink>,
        <NuxtLink to="/trails/tschechien">Trails Tschechien</NuxtLink>
        und viele mehr.
      </p>
    </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import IconMap from '~/assets/icons/map.svg'
import IconShieldCheck from '~/assets/icons/shield-check.svg'
import IconUsers from '~/assets/icons/users.svg'
import IconMessageSquare from '~/assets/icons/message-square.svg'
import IconHelpCircle from '~/assets/icons/help-circle.svg'
import IconUser from '~/assets/icons/user.svg'
import IconHeart from '~/assets/icons/heart.svg'
import IconBriefcase from '~/assets/icons/briefcase.svg'
import IconShield from '~/assets/icons/shield.svg'

const { data: activity } = await useAsyncData('activity', () =>
  $fetch<{ type: 'spot' | 'photo' | 'gpx'; trailId: string; name: string; created_at: string }[]>('/api/activity'),
  { default: () => [] },
)

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
  min-height: 260px;
  border-radius: 0 0 14px 14px;
  background: url('/assets/hero-mobile.webp') center/cover no-repeat, #121212;
}
@media (min-width: 800px) {
  .hero { background-image: url('/assets/hero-desktop.webp'); min-height: 300px; }
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.38) 100%);
}
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 1.2rem;
  padding: 1.6rem 1.5rem;
  color: white;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}
.hero-logo {
  height: clamp(80px, 16vw, 140px);
  width: auto;
  flex-shrink: 0;
  border-radius: 0.5em;
  box-shadow: var(--shadow-logo, 2px 2px 15px rgb(225, 193, 146));
}
.hero-text h1 {
  font-size: clamp(1rem, 2.8vw, 1.4rem);
  font-weight: 800;
  text-shadow: 0 2px 8px rgba(0,0,0,0.7);
  margin: 0 0 0.5rem;
  letter-spacing: -0.01em;
  line-height: 1.25;
}
.hero-sub {
  font-size: 0.85rem;
  opacity: 0.9;
  margin: 0 0 0.9rem;
  line-height: 1.5;
}
.hero-support {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.35);
  color: white;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.45em 1em;
  border-radius: 20px;
  text-decoration: none;
  backdrop-filter: blur(4px);
  transition: background 0.2s, border-color 0.2s;
}
.hero-support:hover {
  background: rgba(255,255,255,0.25);
  border-color: rgba(255,255,255,0.55);
  text-decoration: none;
}

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
    url('https://tile.openstreetmap.org/6/33/21.png') -120px -80px / 512px 512px no-repeat,
    url('https://tile.openstreetmap.org/6/34/21.png') 392px -80px / 512px 512px no-repeat,
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
.features-section {
  background: #f4f6f9;
  padding: 2.8rem 1rem 2.2rem;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.2rem;
}
.feature-card {
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 14px;
  padding: 1.8rem 1.4rem;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 18px rgba(0,0,0,0.1);
}
.feature-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 1rem;
  background: rgba(42,157,92,0.1);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2a9d5c;
}
.feature-icon svg { width: 26px; height: 26px; }
.feature-card h2 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #1a2035;
}
.feature-card p { font-size: 0.83rem; color: #5a6478; line-height: 1.55; margin: 0; }

/* ── Quick nav ── */
.quicknav-section {
  background: #eef1f7;
  padding: 2.5rem 1rem;
}
.section-heading {
  font-size: 0.78rem;
  font-weight: 700;
  color: #8a96a8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 1.2rem;
}
.quicknav-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.9rem;
}
@media (max-width: 600px) {
  .quicknav-grid { grid-template-columns: repeat(2, 1fr); }
}
.qn-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.2rem 0.8rem 1rem;
  background: #fff;
  border: 1px solid #e4e9f0;
  border-top: 3px solid #2a9d5c;
  border-radius: 12px;
  text-decoration: none;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
  text-align: center;
  position: relative;
  cursor: pointer;
}
.qn-card::after {
  content: '→';
  position: absolute;
  bottom: 0.6rem;
  right: 0.75rem;
  font-size: 0.75rem;
  color: #2a9d5c;
  opacity: 0.55;
  transition: opacity 0.18s, transform 0.18s;
}
.qn-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 14px rgba(0,0,0,0.1);
  background: #f2fbf6;
  text-decoration: none;
}
.qn-card:hover::after {
  opacity: 1;
  transform: translateX(3px);
}
.qn-highlight {
  border-top-color: #dc5050;
}
.qn-highlight .qn-icon { background: rgba(220,80,80,0.08); color: #dc5050; }
.qn-highlight::after { color: #dc5050; }
.qn-icon {
  width: 42px;
  height: 42px;
  background: rgba(42,157,92,0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2a9d5c;
  flex-shrink: 0;
}
.qn-icon svg { width: 20px; height: 20px; }
.qn-label {
  font-size: 0.83rem;
  font-weight: 700;
  color: #1a2035;
  line-height: 1.2;
}
.qn-sub {
  font-size: 0.72rem;
  color: #8a96a8;
  line-height: 1.2;
}

/* ── Community ── */
.community-outer {
  background: #f4f6f9;
  padding: 0 1rem 2rem;
}
.community-section {
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 14px;
  padding: 1.8rem 1.4rem;
  text-align: center;
  max-width: 620px;
  margin: 0 auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.community-section h2 {
  color: #2a9d5c;
  font-size: 1.05rem;
  margin-top: 0;
  margin-bottom: 0.6rem;
}
.community-section p { font-size: 0.84rem; color: #5a6478; line-height: 1.55; margin: 0 0 0.3rem; }
.community-section strong { color: #1a2035; }
.leaderboard-mini { display: flex; flex-direction: column; gap: 0.35rem; margin: 1rem 0; }
.leaderboard-entry {
  display: flex; justify-content: space-between;
  background: #f8f9fb;
  padding: 0.45em 0.7em;
  border-radius: 8px;
  font-size: 0.8rem;
  color: #444;
}
.leaderboard-entry.gold   { background: linear-gradient(90deg,#fff9e0,#fff4c2); color: #7a6000; }
.leaderboard-entry.silver { background: linear-gradient(90deg,#f5f5f5,#ebebeb); color: #555; }
.leaderboard-entry.bronze { background: linear-gradient(90deg,#fdf0e0,#f9e4c4); color: #7a4a10; }
.leaderboard-entry span { font-weight: 500; color: #888; }
.btn-community {
  display: inline-block;
  background: #2a9d5c;
  color: #fff;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0.65rem 1.6rem;
  border-radius: 8px;
  text-decoration: none;
  margin-top: 0.6rem;
  transition: background 0.2s;
}
.btn-community:hover { background: #239052; text-decoration: none; }

/* ── SEO text ── */
.seo-outer {
  background: #f4f6f9;
  padding: 0 1rem 2rem;
}
.seo-text {
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 14px;
  padding: 1.8rem 1.8rem;
  font-size: 0.88rem;
  color: #4a5568;
  line-height: 1.65;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.seo-text h2 { font-size: 1rem; color: #1a2035; margin-top: 1.4rem; margin-bottom: 0.6rem; }
.seo-text h2:first-child { margin-top: 0; }
.seo-text p { margin: 0 0 0.8rem; }
.seo-text strong { color: #1a2035; }
.seo-text ul { padding-left: 1.4rem; margin: 0.5rem 0 0.8rem; }
.seo-text li { margin-bottom: 0.3em; }
.seo-text hr { border: none; border-top: 1px solid #e8ecf2; margin: 1.4rem 0; }
.region-links { font-size: 0.8rem; line-height: 1.8; }
.region-links a { color: #2a9d5c; text-decoration: none; }
.region-links a:hover { text-decoration: underline; color: #1e7a46; }

/* ── News & Articles ── */
.news-outer {
  background: #f4f6f9;
  padding: 2.5rem 1rem 2rem;
}
.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}
.news-card {
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 12px;
  padding: 1.2rem 1.2rem 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.18s, transform 0.18s;
}
.news-card:hover {
  box-shadow: 0 5px 16px rgba(0,0,0,0.1);
  transform: translateY(-2px);
  text-decoration: none;
}
.news-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.news-tag {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2em 0.55em;
  border-radius: 4px;
}
.tag--spot  { background: #dcfce7; color: #166534; }
.tag--photo { background: #dbeafe; color: #1e40af; }
.tag--gpx   { background: #fef9c3; color: #854d0e; }
.news-date {
  font-size: 0.72rem;
  color: #9aa;
}
.news-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a2035;
  line-height: 1.3;
  margin: 0;
}
.news-text {
  font-size: 0.8rem;
  color: #5a6478;
  line-height: 1.5;
  margin: 0;
  flex-grow: 1;
}
.news-read {
  font-size: 0.78rem;
  font-weight: 700;
  color: #2a9d5c;
  margin-top: 0.2rem;
}

/* ── Inner centering wrapper (avoids default layout .container overrides) ── */
.inner {
  max-width: 860px;
  margin-left: auto;
  margin-right: auto;
}
</style>
