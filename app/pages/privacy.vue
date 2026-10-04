<template>
  <div>
    <PageHero>
      <h1>Datenschutzerklärung</h1>
      <p>Welche Daten Trailradar verarbeitet, wofür und welche Rechte du hast.</p>
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
          E-Mail: <SupportEmail /><br>
          Weitere Angaben zum Anbieter findest du im <NuxtLink to="/impressum">Impressum</NuxtLink>.
        </p>

        <h2>Allgemeine Hinweise</h2>
        <p>Wir verarbeiten personenbezogene Daten im Einklang mit der DSGVO und den geltenden deutschen
          Datenschutzgesetzen – nur soweit es für den Betrieb von Trailradar nötig ist, für einen Vertrag mit dir
          erforderlich ist, wir ein berechtigtes Interesse haben oder du eingewilligt hast. Wir nutzen kein Tracking
          und keine Werbung.</p>

        <h2>Hosting & Infrastruktur</h2>
        <p>
          <strong>Website-Hosting:</strong>
          Diese Website wird statisch über GitHub Pages bereitgestellt (GitHub, Inc., USA).
          Beim Aufruf verarbeitet GitHub technisch notwendig deine IP-Adresse; wir selbst werten keine Serverlogs aus.<br>
          <strong>Proxy & Sicherheit:</strong>
          Zur Absicherung gegen Angriffe und Missbrauch nutzen wir Cloudflare, Inc.
          Cloudflare kann technisch notwendige Cookies setzen (z.B. <code>__cf_bm, CF_VERIFIED_DEVICE_*</code>),
          die ausschließlich der Sicherheit und Bot-Erkennung dienen.<br>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer und stabiler Betrieb). Soweit dabei Daten in die USA
          übermittelt werden, stützt sich die Übermittlung auf das EU-US Data Privacy Framework bzw.
          EU-Standardvertragsklauseln.
        </p>

        <h2>Benutzerkonto & Inhalte (Supabase)</h2>
        <p>
          Für Registrierung, Anmeldung und die Speicherung deiner Inhalte (z.B. Fotos, Kommentare, Likes, eingetragene
          Spots) nutzen wir Supabase (Supabase Inc., USA; Datenverarbeitung in der EU). Supabase ist unser
          Auftragsverarbeiter nach Art. 28 DSGVO.
        </p>
        <ul>
          <li>E-Mail-Adresse, Spitzname und interne Benutzer-ID</li>
          <li>Zeitpunkt der Registrierung und des letzten Logins</li>
          <li>Technisch notwendige IP-Adresse beim Login</li>
          <li>Sitzungs- und Sicherheitsdaten (JWT, Tokens)</li>
          <li>Von dir hochgeladene Inhalte</li>
        </ul>
        <p>
          <strong>Datenstandort:</strong> Frankfurt am Main (Deutschland / EU).<br>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag gemäß unseren
          <NuxtLink to="/terms">Nutzungsbedingungen</NuxtLink>).
        </p>

        <h2>Kontaktformular</h2>
        <p>
          Wenn du uns über das <NuxtLink to="/kontakt">Kontaktformular</NuxtLink> schreibst, verarbeiten wir deine
          E-Mail-Adresse, deinen Namen (falls angegeben) und deine Nachricht, um dir zu antworten. Die Nachricht wird
          uns per E-Mail über Resend (siehe unten) zugestellt; auf der Website selbst speichern wir sie nicht.
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO, soweit deine Anfrage einen Vertrag betrifft, sonst
          Art. 6 Abs. 1 lit. f DSGVO (Beantwortung von Anfragen). Wir löschen die Nachricht, sobald deine Anfrage
          erledigt ist und keine Aufbewahrungspflicht besteht.
        </p>

        <h2>Supporter-Abo & Zahlung (Creem)</h2>
        <p>
          Das Supporter-Abo verkauft unser Zahlungsdienstleister Creem (Armitage Labs OÜ, Rotermanni 14,
          10111 Tallinn, Estland) als sogenannter Merchant of Record. Beim Kauf leiten wir dich zur Bestellseite
          von Creem weiter und übergeben dabei deine E-Mail-Adresse und deine interne Benutzer-ID, damit das Abo
          deinem Konto zugeordnet werden kann. Creem verarbeitet die Bestell- und Zahlungsdaten (z.B. Name,
          Rechnungsanschrift, Zahlungsmittel, Steuerangaben) als eigener Verantwortlicher; es gilt die
          <a href="https://www.creem.io/privacy" target="_blank" rel="noopener">Datenschutzerklärung von Creem</a>.
        </p>
        <p>
          Von Creem erhalten wir nur, was wir für die Freischaltung und Verwaltung deines Abos brauchen:
          Abo- und Kunden-Kennung, Status, Laufzeit, die bei Creem verwendete E-Mail-Adresse sowie Zeitpunkte von
          Zahlung, Kündigung und Erstattung. Vollständige Zahlungsdaten erhalten wir nicht.
        </p>
        <p>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag). Wir speichern diese Daten für die Dauer des Abos und
          danach bis zum Ablauf der Verjährungsfrist für Ansprüche aus dem Vertrag (drei Jahre zum Jahresende);
          gesetzliche Aufbewahrungspflichten bleiben unberührt.
        </p>

        <h2>Kündigung über „Verträge hier kündigen“</h2>
        <p>
          Wenn du ein Abo über die Seite <NuxtLink to="/kuendigen">Verträge hier kündigen</NuxtLink> kündigst,
          speichern wir deinen Namen, deine E-Mail-Adresse, den Zeitpunkt des Eingangs und – nur zum Schutz vor
          Missbrauch – einen nicht umkehrbaren, täglich wechselnden Hash deiner IP-Adresse. Damit ordnen wir die
          Kündigung zu, bestätigen dir ihren Eingang und können ihn später nachweisen.
        </p>
        <p>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b und c DSGVO (Vertrag, § 312k BGB); für den Missbrauchsschutz
          Art. 6 Abs. 1 lit. f DSGVO. Speicherdauer: drei Jahre zum Jahresende.
        </p>

        <h2>E-Mail-Versand (Resend)</h2>
        <p>
          Nachrichten aus dem Kontaktformular und Bestätigungen zu deinem Abo,
          insbesondere die Eingangsbestätigung deiner Kündigung, versenden wir über Resend (Resend, Inc., USA). Dabei
          verarbeitet Resend die beteiligten E-Mail-Adressen und den Inhalt der Nachricht. Resend ist unser
          Auftragsverarbeiter nach Art. 28 DSGVO; die Übermittlung in die USA erfolgt auf Grundlage von
          EU-Standardvertragsklauseln. Rechtsgrundlage: Art. 6 Abs. 1 lit. b, c und f DSGVO.
        </p>

        <h2>Trail-Zustand</h2>
        <p>
          Für die Funktion „Trail-Zustand“ fragen unsere Server Wetterdaten zur Position des jeweiligen Spots ab
          (Open-Meteo). Dabei werden keine personenbezogenen Daten von dir übermittelt.
        </p>

        <h2>Cookies & lokaler Speicher</h2>
        <p>Wir verwenden keine Cookies zu Analyse- oder Marketingzwecken. Technisch notwendige Cookies setzen:</p>
        <ul>
          <li>Cloudflare (Sicherheitscookies)</li>
          <li>Supabase (Anmeldung / Sitzung)</li>
        </ul>
        <p>Außerdem speichert die App Daten im lokalen Speicher deines Browsers (z.B. Einstellungen und
          zwischengespeicherte Kartendaten für die Offline-Nutzung). Diese Speicherung ist für die von dir gewünschte
          Funktion unbedingt erforderlich und nicht einwilligungspflichtig (§ 25 Abs. 2 TDDDG).</p>

        <h2>Eingebettete YouTube-Videos</h2>
        <p>
          Auf unserer Website können Videos der Plattform YouTube eingebunden sein. Wir verwenden eine 2-Klick-Lösung:
          Videos werden nicht direkt geladen. Erst wenn du auf „Video laden“ klickst, wird eine Verbindung zu YouTube
          hergestellt (Rechtsgrundlage: deine Einwilligung, Art. 6 Abs. 1 lit. a DSGVO).
          Weitere Informationen:
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>.
        </p>

        <h2>Empfänger</h2>
        <p>Wir geben personenbezogene Daten nur an die oben genannten Dienste weiter (GitHub, Cloudflare, Supabase,
          Creem, Resend, ggf. YouTube) oder wenn wir gesetzlich dazu verpflichtet sind.</p>

        <h2>Speicherdauer & Löschung</h2>
        <ul>
          <li>Dein Benutzerkonto kannst du jederzeit löschen. Ein laufendes Abo musst du vorher kündigen.</li>
          <li>Nach der Löschung entfernen wir deine Kontodaten unverzüglich, soweit keine der oben genannten
            Aufbewahrungsfristen gilt.</li>
          <li>Backups werden automatisiert überschrieben.</li>
        </ul>

        <h2>Deine Rechte</h2>
        <p>Du hast das Recht auf</p>
        <ul>
          <li>Auskunft über deine gespeicherten Daten (Art. 15 DSGVO),</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO),</li>
          <li>Löschung (Art. 17 DSGVO),</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO),</li>
          <li>Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO),</li>
          <li>Widerruf einer Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
        </ul>
        <p>Schreibe dazu an <SupportEmail />.</p>
        <p>
          Außerdem hast du das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO), z.B. bei
          der für uns zuständigen: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18,
          91522 Ansbach.
        </p>

        <p class="stand">Stand: Oktober 2026</p>
      </section>

      <NuxtLink to="/" class="back-link">← Zurück zur Startseite</NuxtLink>
    </main>
  </div>
</template>

<script setup lang="ts">
import SupportEmail from '~/components/SupportEmail.vue'
useSeoMeta({
  title: 'Datenschutzerklärung',
  ogTitle: 'Datenschutzerklärung | Trailradar',
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
.stand { margin-top: 2em; font-size: 0.85em; color: #666; }
code {
  background: #f1f1f1;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.85em;
  color: #333;
}
</style>
