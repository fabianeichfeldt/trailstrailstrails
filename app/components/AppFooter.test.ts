import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppFooter from './AppFooter.vue'

describe('AppFooter', () => {
  it('links "Verträge hier kündigen" to /kuendigen', () => {
    const w = mount(AppFooter, {
      global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    })
    const link = w.findAll('a').find(a => a.text() === 'Verträge hier kündigen')
    expect(link?.attributes('href')).toBe('/kuendigen')
  })

  it.each([
    ['Preise', '/plans'],
    ['Kontakt', '/kontakt'],
    ['Impressum', '/impressum'],
    ['Datenschutz', '/privacy'],
    ['AGB', '/terms'],
  ])('links "%s" to %s', (label, href) => {
    const w = mount(AppFooter, {
      global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    })
    const link = w.findAll('a').find(a => a.text() === label)
    expect(link?.attributes('href')).toBe(href)
  })

  // Creem requires a visible support e-mail; Cloudflare would otherwise serve "[email protected]" to non-JS readers.
  it('shows the support e-mail, opted out of Cloudflare obfuscation', () => {
    const w = mount(AppFooter, {
      global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    })
    expect(w.text()).toContain('webmaster@trailradar.org')
    expect(w.html()).toContain('<!--email_off--><a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a><!--email_on-->')
  })
})
