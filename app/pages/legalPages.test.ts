import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const useHead = vi.fn()
vi.stubGlobal('useHead', useHead)
vi.stubGlobal('useSeoMeta', vi.fn())

import ImpressumPage from './impressum.vue'
import PrivacyPage from './privacy.vue'
import TermsPage from './terms.vue'

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  PageHero: { template: '<div><slot /></div>' },
}
const mountPage = (page: object) => mount(page, { global: { stubs } })
const hrefs = (w: ReturnType<typeof mountPage>) => w.findAll('a').map(a => a.attributes('href'))

describe('/impressum', () => {
  it('names the provider with address and contact, under § 5 DDG', () => {
    const text = mountPage(ImpressumPage).text()
    expect(text).toContain('§ 5 DDG')
    expect(text).toContain('Fabian Eichfeldt')
    expect(text).toContain('95447 Bayreuth')
    expect(text).toContain('webmaster@trailradar.org')
  })

  it('offers the contact form as second contact channel', () => {
    const w = mountPage(ImpressumPage)
    expect(hrefs(w)).toContain('/kontakt')
  })

  it('has a back link to the map and its own canonical url', () => {
    useHead.mockClear()
    const w = mountPage(ImpressumPage)
    expect(w.find('a.back-link').attributes('href')).toBe('/map')
    expect(JSON.stringify(useHead.mock.calls)).toContain('https://trailradar.org/impressum')
  })
})

describe('/privacy', () => {
  it('is the privacy policy only — the imprint lives on /impressum', () => {
    const w = mountPage(PrivacyPage)
    expect(w.get('h1').text()).toBe('Datenschutzerklärung')
    expect(w.findAll('h2').map(h => h.text())).not.toContain('Impressum')
    expect(hrefs(w)).toContain('/impressum')
  })

  it('covers the Supporter subscription: Creem as controller, Resend as processor, the cancel form', () => {
    const text = mountPage(PrivacyPage).text()
    expect(text).toContain('Armitage Labs OÜ')
    expect(text).toContain('Resend')
    expect(text).toContain('Verträge hier kündigen')
  })

  it('covers the contact form, which is live already (not part of the pre-launch note)', () => {
    const w = mountPage(PrivacyPage)
    const section = w.findAll('h2').find(h => h.text().includes('Kontaktformular'))
    expect(section).toBeTruthy()
    expect(hrefs(w)).toContain('/kontakt')
    expect(w.text()).toMatch(/Kontaktformular[\s\S]*Resend/)
  })

  it('lists every data-subject right incl. the complaint to the Bavarian authority', () => {
    const text = mountPage(PrivacyPage).text()
    for (const right of ['Auskunft', 'Berichtigung', 'Löschung', 'Einschränkung', 'Datenübertragbarkeit', 'Widerspruch', 'Beschwerde']) {
      expect(text).toContain(right)
    }
    expect(text).toContain('Bayerisches Landesamt für Datenschutzaufsicht')
  })
})

describe('/terms', () => {
  it('has a Supporter section with Creem as seller and the cancel page', () => {
    const w = mountPage(TermsPage)
    expect(w.text()).toContain('Supporter-Abo')
    expect(w.text()).toContain('Armitage Labs OÜ')
    expect(hrefs(w)).toContain('/kuendigen')
    expect(hrefs(w)).toContain('/impressum')
  })

  it('yearly plan continues monthly and is cancellable monthly after the first year (§ 309 Nr. 9 BGB)', () => {
    const text = mountPage(TermsPage).text()
    expect(text).toMatch(/Nach Ablauf des ersten Jahres läuft das Jahres-Abo auf unbestimmte Zeit monatlich weiter/)
  })

  it('promises the 14-day money-back and the e-mail cancel confirmation', () => {
    const text = mountPage(TermsPage).text()
    expect(text).toContain('14 Tage')
    expect(text).toContain('per E-Mail')
  })

  it('does not exclude liability for intent, gross negligence or injury', () => {
    const text = mountPage(TermsPage).text()
    expect(text).toContain('Vorsatz und grobe Fahrlässigkeit')
    expect(text).toContain('Leben, Körper oder Gesundheit')
  })
})
