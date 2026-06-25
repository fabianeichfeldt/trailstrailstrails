<template>
  <div>
    <PageHero>
      <h1>Nutzungsbedingungen</h1>
      <p>Regeln für die Nutzung der Trailradar-Plattform und ihrer Funktionen.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <h2>1. Geltungsbereich</h2>
      <p>Diese Nutzungsbedingungen regeln die Nutzung der Website <strong>Trailradar.org</strong> sowie aller
        dazugehörigen Funktionen, insbesondere das Anlegen von Benutzerkonten und das Einstellen von Inhalten.</p>
      <p>Mit der Registrierung und Nutzung der Plattform erklärst Du Dich mit diesen Nutzungsbedingungen einverstanden.</p>

      <h2>2. Ziel der Plattform</h2>
      <p>Trailradar ist ein Community-Projekt zur Sammlung und Darstellung offiziell genehmigter
        Mountainbike-Trails, Bikeparks, Pumptracks und ähnlicher Anlagen.</p>

      <h2>3. Benutzerkonto</h2>
      <ul>
        <li>Du darfst nur ein Benutzerkonto anlegen.</li>
        <li>Deine Zugangsdaten musst Du vertraulich behandeln.</li>
        <li>Eine Weitergabe Deines Kontos an Dritte ist nicht erlaubt.</li>
        <li>Bei Missbrauch oder Verstößen behalten wir uns vor, Konten zu sperren oder zu löschen.</li>
      </ul>

      <h2>4. Inhalte und Uploads</h2>
      <p>Du darfst Inhalte nur einstellen, wenn Du über die erforderlichen Rechte verfügst, keine Rechte Dritter
        verletzt werden und die Inhalte sachlich korrekt sind.</p>
      <p>Mit dem Upload räumst Du Trailradar ein einfaches, unentgeltliches, zeitlich und räumlich unbegrenztes
        Nutzungsrecht ein, die Inhalte auf der Plattform darzustellen.</p>

      <h2>5. Verhaltensregeln</h2>
      <p>Auf Trailradar legen wir Wert auf einen respektvollen Umgang. Untersagt sind insbesondere:</p>
      <ul>
        <li>Beleidigungen, Diskriminierung, Hassrede oder Hetze,</li>
        <li>Belästigung, Drohungen oder Mobbing,</li>
        <li>das Verbreiten rechtswidriger Inhalte,</li>
        <li>Spam, Werbung oder automatisierte Inhalte.</li>
      </ul>

      <h2>6. Verbot automatisierter Zugriffe (Scraping)</h2>
      <p>Automatisierte Zugriffe auf die Plattform sind ohne ausdrückliche Genehmigung nicht erlaubt. Untersagt sind:</p>
      <ul>
        <li>systematisches Auslesen von Inhalten,</li>
        <li>Umgehung technischer Schutzmaßnahmen,</li>
        <li>massenhafte Abfrage von Daten.</li>
      </ul>

      <h2>7. Moderation und Entfernung von Inhalten</h2>
      <p>Wir behalten uns vor, Inhalte zu prüfen, zu ändern oder zu entfernen, wenn diese gegen gesetzliche
        Vorgaben oder diese Nutzungsbedingungen verstoßen.</p>

      <h2>8. Haftung</h2>
      <p>Die bereitgestellten Inhalte werden von der Community erstellt. Für deren Richtigkeit, Vollständigkeit
        und Aktualität übernehmen wir keine Gewähr. Die Nutzung erfolgt auf eigene Verantwortung.</p>

      <h2>9. Verfügbarkeit</h2>
      <p>Ein Anspruch auf dauerhafte Verfügbarkeit der Plattform besteht nicht.</p>

      <h2>10. Änderungen der Nutzungsbedingungen</h2>
      <p>Wir behalten uns vor, diese Nutzungsbedingungen aus rechtlichen, technischen oder betrieblichen
        Gründen anzupassen. Die jeweils aktuelle Version ist auf der Website abrufbar.</p>

      <h2>11. Anwendbares Recht</h2>
      <p>Es gilt das Recht der Bundesrepublik Deutschland.</p>

      <NuxtLink to="/" class="back-link">← Zurück zur Startseite</NuxtLink>
    </main>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Nutzungsbedingungen',
  ogUrl: 'https://trailradar.org/terms',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/terms' }],
})
</script>
