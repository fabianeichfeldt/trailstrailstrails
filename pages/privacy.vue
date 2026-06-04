<template>
  <div>
    <PageHero>
      <h1>Datenschutz & Impressum</h1>
      <p>Transparenz über Datenverarbeitung und rechtliche Angaben zu Trailradar.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section id="privacy">
        <h2>Verantwortlicher</h2>
        <p>
          Verantwortlicher im Sinne der DSGVO:<br>
          Fabian Eichfeldt<br>
          Margeretenweg 10<br>
          95447 Bayreuth<br>
          E-Mail: <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>
        </p>

        <h2>Allgemeine Hinweise zur Datenverarbeitung</h2>
        <p>Der Schutz Ihrer personenbezogenen Daten ist uns ein wichtiges Anliegen.
          Wir verarbeiten personenbezogene Daten ausschließlich im Einklang mit der DSGVO sowie den geltenden nationalen
          Datenschutzgesetzen. Personenbezogene Daten werden nur verarbeitet, soweit dies technisch erforderlich ist oder
          Sie ausdrücklich eingewilligt haben.</p>

        <h2>Hosting & Infrastruktur</h2>
        <p>
          <strong>Website-Hosting:</strong>
          Diese Website wird statisch über GitHub Pages bereitgestellt (GitHub, Inc., USA).
          Es werden dabei keine eigenen Serverlogs von uns ausgewertet.<br>
          <strong>Proxy & Sicherheit:</strong>
          Zur Absicherung gegen Angriffe und Missbrauch nutzen wir Cloudflare, Inc.
          Cloudflare kann technisch notwendige Cookies setzen (z.B. <code>__cf_bm, CF_VERIFIED_DEVICE_*</code>),
          die ausschließlich der Sicherheit und Bot-Erkennung dienen.
          Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
        </p>

        <h2>Authentifizierung & Benutzerkonten (Supabase Auth)</h2>
        <p>
          Für Registrierung und Anmeldung verwenden wir Supabase Auth (Supabase Inc., San Francisco, USA;
          EU-Datenverarbeitung über Supabase Germany). Supabase agiert als Auftragsverarbeiter gemäß Art. 28 DSGVO.
        </p>
        <p><strong>Verarbeitete Daten:</strong></p>
        <ul>
          <li>E-Mail-Adresse</li>
          <li>Interne Benutzer-ID</li>
          <li>Zeitpunkt der Registrierung und letzter Login</li>
          <li>Technisch notwendige IP-Adresse beim Login</li>
          <li>Sitzungs- und Sicherheitsdaten (JWT, Tokens)</li>
        </ul>
        <p>
          <strong>Datenstandort:</strong>
          Alle Daten werden ausschließlich in <strong>Frankfurt am Main (Deutschland / EU)</strong> gespeichert.
        </p>

        <h2>Datensparsamkeit & Speicherdauer</h2>
        <ul>
          <li>Benutzerkonten können jederzeit gelöscht werden</li>
          <li>Nach Löschung werden personenbezogene Daten unverzüglich gelöscht</li>
          <li>Backup-Daten werden automatisiert überschrieben</li>
        </ul>

        <h2>Cookies</h2>
        <p>Wir verwenden keine eigenen Cookies zu Analyse- oder Marketingzwecken. Technisch notwendige Cookies können
          durch folgende Dienste gesetzt werden:</p>
        <ul>
          <li>Cloudflare (Sicherheitscookies)</li>
          <li>Supabase (Session-Management)</li>
        </ul>
        <p>Diese Cookies sind erforderlich und nicht einwilligungspflichtig (§ 25 Abs. 2 TTDSG).</p>

        <h2>Weitergabe von Daten</h2>
        <p>Eine Weitergabe personenbezogener Daten erfolgt nicht, außer an technisch notwendige Auftragsverarbeiter
          (Supabase, Cloudflare) oder wenn wir gesetzlich dazu verpflichtet sind.</p>

        <h2>Eingebettete YouTube-Videos</h2>
        <p>
          Auf unserer Website können Videos der Plattform YouTube eingebunden sein.
          Zum Schutz Ihrer Daten verwenden wir eine 2-Klick-Lösung: YouTube-Videos werden nicht direkt geladen.
          Erst wenn Sie auf „Video laden" klicken, wird eine Verbindung zu YouTube hergestellt.
          Weitere Informationen:
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>.
        </p>

        <h2>Deine Rechte</h2>
        <p>Du kannst jederzeit Auskunft, Berichtigung oder Löschung deiner Daten verlangen.
          Schreibe dazu an <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>.</p>
      </section>

      <section id="impressum">
        <h2>Impressum</h2>
        <p>
          <strong>Verantwortlich für den Inhalt:</strong><br>
          Fabian Eichfeldt<br>
          Margeretenweg 10<br>
          95447 Bayreuth<br>
          <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>
        </p>
      </section>

      <NuxtLink to="/" class="back-link">← Zurück zur Startseite</NuxtLink>
    </main>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Datenschutz & Impressum | Trailradar',
  ogTitle: 'Datenschutz & Impressum | Trailradar',
  ogType: 'article',
  ogUrl: 'https://trailradar.org/privacy',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/privacy' }],
})
</script>

<style scoped>
section + section { margin-top: 1.5em; }

:deep(.container h2) {
  font-size: 1.05em;
  color: var(--color-primary);
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.4em;
  margin-top: 1.8em;
}

:deep(.container h2:first-of-type) { margin-top: 0; }

code {
  background: #f1f1f1;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.85em;
  color: #333;
}
</style>
