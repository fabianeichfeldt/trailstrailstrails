<template>
  <div>
    <PageHero>
      <h1>Impressum</h1>
      <p>Angaben zum Anbieter von Trailradar.org.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          Fabian Eichfeldt<br>
          Trailradar<br>
          Margeretenweg 10<br>
          95447 Bayreuth<br>
          Deutschland
        </p>
      </section>

      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail: <SupportEmail /><br>
          Kontaktformular: <NuxtLink to="/kontakt">trailradar.org/kontakt</NuxtLink>
        </p>
      </section>

      <section>
        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>Fabian Eichfeldt, Anschrift wie oben.</p>
      </section>

      <section>
        <h2>Zahlungsabwicklung</h2>
        <p>
          Verkäufer des Supporter-Abos ist unser Zahlungsdienstleister Creem (Armitage Labs OÜ, Rotermanni 14,
          10111 Tallinn, Estland) als sogenannter Merchant of Record. Details findest du in den
          <NuxtLink to="/terms">Nutzungsbedingungen</NuxtLink>.
        </p>
      </section>

      <section>
        <h2>Verbraucherstreitbeilegung</h2>
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <section>
        <h2>Datenschutz</h2>
        <p>Wie wir mit deinen Daten umgehen, steht in der <NuxtLink to="/privacy">Datenschutzerklärung</NuxtLink>.</p>
      </section>

      <NuxtLink to="/" class="back-link">← Zurück zur Startseite</NuxtLink>
    </main>
  </div>
</template>

<script setup lang="ts">
import SupportEmail from '~/components/SupportEmail.vue'
useSeoMeta({
  title: 'Impressum',
  ogTitle: 'Impressum | Trailradar',
  ogUrl: 'https://trailradar.org/impressum',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/impressum' }],
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
</style>
