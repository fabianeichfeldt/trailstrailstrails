<template>
  <div>
    <PageHero>
      <h1>Trailradar lebt von der Community.</h1>
      <p>Aus der Community. Für die Community. Und mit deiner Unterstützung.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section class="section">
        <p class="lead">
          Trailradar ist kein Konzernprojekt. Kein Startup mit Investoren.
          Sondern ein Herzensprojekt – entstanden aus der Leidenschaft fürs Mountainbiken.
        </p>
        <p>
          Damit legale Trails sichtbar werden. Damit Engagement gewürdigt wird.
          Und damit wir als Community zeigen können, dass moderner Trailbau und Verantwortung zusammengehören.
        </p>
        <h2>Wie du Trailradar unterstützen kannst</h2>
      </section>

      <section class="section split">
        <div>
          <h2>1. Neue Trails eintragen</h2>
          <p>Die größte Unterstützung ist ganz einfach: Trage fehlende Trails ein oder aktualisiere
            bestehende Informationen.</p>
          <p>Jede neue Strecke macht Trailradar wertvoller für die gesamte MTB-Community.</p>
        </div>
        <img :src="'/assets/trailbau.webp'" alt="Trailbau Community" />
      </section>

      <section class="section">
        <h2>2. Fehler melden & Inhalte verbessern</h2>
        <p>Ein falscher Name, eine geänderte Streckenführung oder ein neuer Zustand? Sag Bescheid.
          Trailradar soll aktuell und zuverlässig bleiben.</p>
      </section>

      <section class="section">
        <h2>3. Trailradar teilen</h2>
        <p>Wenn dir Trailradar gefällt, teile es in deiner WhatsApp-Gruppe, in deinem Verein,
          auf Instagram oder im Forum.</p>
      </section>

      <section class="section split">
        <img :src="'/assets/sticker.webp'" alt="Trailradar Sticker" />
        <div>
          <h2>4. Sticker für die Community</h2>
          <p>Mittlerweile gibt es Trailradar-Aufkleber. Für dein Bike, dein Auto oder die Werkstattwand.</p>
          <p>Gegen eine kleine Spende schicke ich dir gerne welche zu.
            <a href="mailto:webmaster@trailradar.org">Schreib mir einfach.</a></p>
        </div>
      </section>

      <section class="section support-box">
        <h3>5. Kaffee für die nächste Nachtsession ☕</h3>
        <p>Trailradar entsteht oft spät abends – nach der Arbeit, nach dem Ride. Wenn du das Projekt
          direkt unterstützen möchtest, kannst du mir gerne ein kleines Dankeschön per PayPal dalassen.</p>
        <a href="https://paypal.me/Trailradar" target="_blank" rel="noopener noreferrer" class="paypal-button">
          Mit PayPal unterstützen
        </a>
      </section>
    </main>

    <footer class="cta">
      <h2>Gemeinsam für legale Trails</h2>
      <p>Trailradar wächst nicht neben der Community – sondern mit ihr.
        Danke, dass du Teil davon bist.</p>
      <p style="margin-top:2rem;"><strong>Happy Trails.</strong></p>
    </footer>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Support – Aus der Community, für die Community',
  description: 'Unterstütze Trailradar – durch neue Trail-Einträge, Feedback, Teilen oder eine kleine Spende.',
  ogUrl: 'https://trailradar.org/support',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/support' }],
})
</script>

<style scoped>
.section { margin-bottom: 3em; }

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

.support-box {
  background: #f5f5f5;
  padding: 2rem;
  border-radius: 20px;
}

.support-box h3 { margin-top: 0; }

.paypal-button {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.9rem 1.6rem;
  background: var(--color-page-accent);
  color: #000;
  font-weight: 600;
  border-radius: 999px;
  text-decoration: none;
}

@media (max-width: 900px) {
  .split { grid-template-columns: 1fr; }
}
</style>
