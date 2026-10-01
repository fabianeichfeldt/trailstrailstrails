import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { SpotRow, BikeParkDetailsRow } from '~/spot_manager/Api'

vi.mock('~/spot_manager/Api', () => ({
  upsertBikeParkDetails: vi.fn().mockResolvedValue({}),
  setSpotWebsite: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./SpotInvitationCodes.vue', () => ({ default: { template: '<div class="inv-stub" />' } }))

import { upsertBikeParkDetails, setSpotWebsite } from '~/spot_manager/Api'
import BikeParkDetailsEditor from './BikeParkDetailsEditor.vue'

const spot: SpotRow = { id: 'p1', name: 'Park', type: 'bikepark', url: 'https://old.de' } as SpotRow

function mountEditor(details: Partial<BikeParkDetailsRow> | null = null) {
  return mount(BikeParkDetailsEditor, {
    props: { spot, details: details as BikeParkDetailsRow | null, jwt: 'jwt' },
  })
}
const statusCards = (w: ReturnType<typeof mountEditor>) => w.findAll('.sd-status-card')

beforeEach(() => vi.clearAllMocks())

describe('BikeParkDetailsEditor', () => {
  it('renders only bikepark fields', () => {
    const w = mountEditor()
    expect(statusCards(w).map(c => c.text())).toEqual(['Offen', 'Gesperrt'])
    expect(w.find('textarea.bp-hours').exists()).toBe(true)
    expect(w.find('textarea.bp-description').exists()).toBe(true)
    expect(w.find('input.bp-website').exists()).toBe(true)
    expect(w.find('.inv-stub').exists()).toBe(true)
    const text = w.text()
    for (const forbidden of ['Regen', 'Nacht', 'Saison', 'Zugang', 'Regeln', 'Betroffene Trails']) {
      expect(text).not.toContain(forbidden)
    }
  })

  it('legacy unknown status selects neither option', () => {
    expect(statusCards(mountEditor({ status: 'unknown' })).some(c => c.classes('active'))).toBe(false)
    expect(statusCards(mountEditor({ status: null })).some(c => c.classes('active'))).toBe(false)
  })

  it('saves the exact payload with status_hint null and skips unchanged website', async () => {
    const w = mountEditor({ status: 'open', opening_hours: 'old', trail_description: 'd', status_hint: 'legacy' } as any)
    await statusCards(w)[1]!.trigger('click')
    await w.get('textarea.bp-hours').setValue('Mo-So 9-17')
    await w.get('.sm-btn-primary').trigger('click')
    await flushPromises()
    const row = vi.mocked(upsertBikeParkDetails).mock.calls[0]![0] as any
    expect(row).toMatchObject({ id: 'p1', status: 'closed', opening_hours: 'Mo-So 9-17', trail_description: 'd' })
    expect(row.last_update).toBeTruthy()
    expect(setSpotWebsite).not.toHaveBeenCalled()
    expect(w.emitted('saved')).toBeTruthy()
  })

  it('calls the website RPC with the normalised value only when changed', async () => {
    const w = mountEditor({ status: 'open' })
    await w.get('input.bp-website').setValue('  https://new.de  ')
    await w.get('.sm-btn-primary').trigger('click')
    await flushPromises()
    expect(setSpotWebsite).toHaveBeenCalledWith('p1', 'https://new.de', 'jwt')
  })

  it('blocks save on an invalid url with an inline message', async () => {
    const w = mountEditor({ status: 'open' })
    await w.get('input.bp-website').setValue('javascript:alert(1)')
    await w.get('.sm-btn-primary').trigger('click')
    await flushPromises()
    expect(upsertBikeParkDetails).not.toHaveBeenCalled()
    expect(w.find('.sm-error').exists()).toBe(true)
  })

  it('blocks a description over 2000 chars', async () => {
    const w = mountEditor({ status: 'open' })
    await w.get('textarea.bp-description').setValue('x'.repeat(2001))
    await w.get('.sm-btn-primary').trigger('click')
    await flushPromises()
    expect(upsertBikeParkDetails).not.toHaveBeenCalled()
  })
})
