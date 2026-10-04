import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const useHead = vi.fn()
vi.stubGlobal('useHead', useHead)
vi.stubGlobal('useSeoMeta', vi.fn())

import KontaktPage from './kontakt.vue'

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  PageHero: { template: '<div><slot /></div>' },
}
const mountPage = () => mount(KontaktPage, { global: { stubs } })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

async function fill(w: ReturnType<typeof mountPage>, v: { name?: string; email?: string; message?: string }) {
  if (v.name !== undefined) await w.get('[data-testid="contact-name"]').setValue(v.name)
  if (v.email !== undefined) await w.get('[data-testid="contact-email"]').setValue(v.email)
  if (v.message !== undefined) await w.get('[data-testid="contact-message"]').setValue(v.message)
}

describe('/kontakt', () => {
  it('has the page title, a back link to the map and a privacy link', () => {
    const w = mountPage()
    expect(w.get('h1').text()).toBe('Kontakt')
    expect(w.find('a.back-link').attributes('href')).toBe('/map')
    expect(w.findAll('a').map(a => a.attributes('href'))).toContain('/privacy')
  })

  it('sends the message and shows a thank-you instead of the form', async () => {
    const w = mountPage()
    await fill(w, { name: 'Rita', email: 'rita@example.com', message: 'Hallo, eine Frage zum Trail.' })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      name: 'Rita', email: 'rita@example.com', message: 'Hallo, eine Frage zum Trail.', website: '',
    })
    expect(w.find('form').exists()).toBe(false)
    expect(w.get('[data-testid="contact-sent"]').text()).toContain('Danke')
  })

  it('does not send a too short message and says why', async () => {
    const w = mountPage()
    await fill(w, { email: 'rita@example.com', message: 'kurz' })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.get('[role="alert"]').text()).toContain('mindestens 10 Zeichen')
  })

  it('shows the server-side field error', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid', field: 'email' }), { status: 400 }))
    const w = mountPage()
    await fill(w, { email: 'rita@example', message: 'Hallo, eine Frage zum Trail.' })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('E-Mail-Adresse')
    expect(w.find('form').exists()).toBe(true)
  })

  it('keeps the text and offers the e-mail address when sending fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    const w = mountPage()
    await fill(w, { email: 'rita@example.com', message: 'Hallo, eine Frage zum Trail.' })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('webmaster@trailradar.org')
    expect((w.get('[data-testid="contact-message"]').element as HTMLTextAreaElement).value).toBe('Hallo, eine Frage zum Trail.')
  })

  it('hides the honeypot from people and assistive tech', () => {
    const hp = mountPage().get('input[name="website"]')
    expect(hp.attributes('tabindex')).toBe('-1')
    expect(hp.attributes('autocomplete')).toBe('off')
    expect(hp.element.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
