import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppFooter from './AppFooter.vue'

describe('AppFooter', () => {
  it.each([
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
})
