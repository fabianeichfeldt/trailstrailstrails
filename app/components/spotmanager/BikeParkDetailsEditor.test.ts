import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { BikeParkDetailsRow, SpotRow } from '~/spot_manager/Api'

vi.mock('~/spot_manager/Api', () => ({
  upsertBikeParkDetails: vi.fn(async (row: BikeParkDetailsRow) => row),
  setSpotWebsite: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./SpotInvitationCodes.vue', () => ({
  default: { props: ['spotId'], template: '<div class="inv-stub" />' },
}))

import { upsertBikeParkDetails, setSpotWebsite } from '~/spot_manager/Api'
import BikeParkDetailsEditor from './BikeParkDetailsEditor.vue'

const spot: SpotRow = { id: 'p1', name: 'Park', type: 'bikepark', url: 'https://old.example' }
const details: BikeParkDetailsRow = {
  id: 'p1', status: 'open', opening_hours: 'Mo-Fr 9-17', trail_description: 'Schöner Park', last_update: '2026-01-01T00:00:00Z',
}

function mountEditor(d: BikeParkDetailsRow | null = details, s: SpotRow = spot) {
  return mount(BikeParkDetailsEditor, { props: { spot: s, details: d, jwt: 'jwt' } })
}
const save = (w: ReturnType<typeof mountEditor>) => w.get('.sm-btn-primary').trigger('click')

describe('BikeParkDetailsEditor', () => {
  beforeEach(() => { vi.mocked(upsertBikeParkDetails).mockClear(); vi.mocked(setSpotWebsite).mockClear() })

  it('renders only the bikepark fields', () => {
    const w = mountEditor()
    const text = w.text()
    expect(text).toContain('Offen')
    expect(text).toContain('Gesperrt')
    expect(text).toContain('Öffnungszeiten')
    expect(text).toContain('Beschreibung')
    expect(w.find('.inv-stub').exists()).toBe(true)
    expect((w.get('input[type=url]').element as HTMLInputElement).value).toBe('https://old.example')
    for (const bad of ['Regen', 'Nacht', 'Saison', 'Zugang', 'Nutzungsregeln', 'Betroffene Trails']) {
      expect(text).not.toContain(bad)
    }
  })

  it('selects neither status for legacy unknown or missing details', () => {
    expect(mountEditor({ ...details, status: 'unknown' }).findAll('.sd-status-card.active')).toHaveLength(0)
    expect(mountEditor(null).findAll('.sd-status-card.active')).toHaveLength(0)
  })

  it('saves the exact payload and emits saved', async () => {
    const w = mountEditor()
    const closed = w.findAll('.sd-status-card').find(c => c.text().includes('Gesperrt'))!
    await closed.trigger('click')
    await w.get('.bp-hours').setValue('  Sa 10-16 ')
    await save(w)
    await flushPromises()
    const row = vi.mocked(upsertBikeParkDetails).mock.calls[0]![0]
    expect(row).toMatchObject({ id: 'p1', status: 'closed', opening_hours: 'Sa 10-16', trail_description: 'Schöner Park' })
    expect(Date.parse(row.last_update)).toBeGreaterThan(Date.parse('2026-01-02'))
    expect(vi.mocked(upsertBikeParkDetails).mock.calls[0]![1]).toBe('jwt')
    expect(w.emitted('saved')).toHaveLength(1)
    expect(setSpotWebsite).not.toHaveBeenCalled()
  })

  it('calls the website RPC only when changed, with the normalised value', async () => {
    const w = mountEditor()
    await w.get('input[type=url]').setValue('  https://new.example ')
    await save(w)
    await flushPromises()
    expect(setSpotWebsite).toHaveBeenCalledWith('p1', 'https://new.example', 'jwt')
  })

  it('blocks save on an invalid URL with an inline message', async () => {
    const w = mountEditor()
    await w.get('input[type=url]').setValue('ftp://x')
    expect(w.find('.sm-error').exists()).toBe(true)
    await save(w)
    await flushPromises()
    expect(upsertBikeParkDetails).not.toHaveBeenCalled()
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('blocks a description over 2000 characters', async () => {
    const w = mountEditor()
    await w.get('textarea').setValue('x'.repeat(2001))
    await save(w)
    await flushPromises()
    expect(upsertBikeParkDetails).not.toHaveBeenCalled()
    expect(w.text()).toContain('2000')
  })

  it('emits cancel', async () => {
    const w = mountEditor()
    await w.get('.sm-btn-secondary').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
