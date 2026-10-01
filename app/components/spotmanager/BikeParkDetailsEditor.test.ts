import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { BikeParkDetailsRow, SpotRow } from '~/spot_manager/Api'

vi.mock('~/spot_manager/Api', () => ({
  upsertBikeParkDetails: vi.fn(async (row: BikeParkDetailsRow) => row),
  setSpotWebsite: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./SpotInvitationCodes.vue', () => ({
  default: { template: '<div class="inv-stub" />' },
}))

import { upsertBikeParkDetails, setSpotWebsite } from '~/spot_manager/Api'
import BikeParkDetailsEditor from './BikeParkDetailsEditor.vue'

const spot: SpotRow = { id: 'p1', name: 'Park', type: 'bikepark', url: 'https://old.example' }
const details: BikeParkDetailsRow = {
  id: 'p1', status: 'open', opening_hours: 'Mo-So 9-17', trail_description: 'Schöner Park', last_update: null,
}

function mountEditor(d: BikeParkDetailsRow | null = details, s: SpotRow = spot) {
  return mount(BikeParkDetailsEditor, { props: { spot: s, details: d, jwt: 'jwt' } })
}
const save = (w: ReturnType<typeof mountEditor>) => w.get('[data-test="save"]').trigger('click')

beforeEach(() => vi.clearAllMocks())

describe('BikeParkDetailsEditor', () => {
  it('renders only the bikepark fields', () => {
    const w = mountEditor()
    const labels = w.findAll('.sd-status-card').map(b => b.text())
    expect(labels).toEqual(['Offen', 'Gesperrt'])
    expect(w.find('textarea[data-test="hours"]').exists()).toBe(true)
    expect(w.find('textarea[data-test="description"]').exists()).toBe(true)
    expect(w.find('input[type="url"]').exists()).toBe(true)
    expect(w.find('.inv-stub').exists()).toBe(true)
    const text = w.text()
    for (const t of ['Regen', 'Nacht', 'Saison', 'Zugang', 'Regeln', 'Betroffene']) expect(text).not.toContain(t)
  })

  it.each(['unknown', null] as const)('legacy status %s selects nothing', (status) => {
    const w = mountEditor({ ...details, status })
    expect(w.findAll('.sd-status-card.active')).toHaveLength(0)
  })

  it('saves the row and emits saved; website RPC not called when unchanged', async () => {
    const w = mountEditor()
    await w.findAll('.sd-status-card')[1]!.trigger('click')
    await w.get('textarea[data-test="hours"]').setValue('  Sa 10-16 ')
    await save(w)
    await flushPromises()
    expect(upsertBikeParkDetails).toHaveBeenCalledTimes(1)
    const [row, jwt] = vi.mocked(upsertBikeParkDetails).mock.calls[0]!
    expect(jwt).toBe('jwt')
    expect(row).toMatchObject({ id: 'p1', status: 'closed', opening_hours: 'Sa 10-16', trail_description: 'Schöner Park' })
    expect(setSpotWebsite).not.toHaveBeenCalled()
    expect(w.emitted('saved')?.[0]?.[0]).toMatchObject({ id: 'p1', status: 'closed' })
  })

  it('calls setSpotWebsite with the normalised value when changed', async () => {
    const w = mountEditor()
    await w.get('input[type="url"]').setValue('  https://new.example/x  ')
    await save(w)
    await flushPromises()
    expect(setSpotWebsite).toHaveBeenCalledWith('p1', 'https://new.example/x', 'jwt')
  })

  it('an invalid website blocks save with an inline message', async () => {
    const w = mountEditor()
    await w.get('input[type="url"]').setValue('example.com')
    await save(w)
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('http')
    expect(upsertBikeParkDetails).not.toHaveBeenCalled()
    expect(setSpotWebsite).not.toHaveBeenCalled()
  })

  it('a description over 2000 chars blocks save', async () => {
    const w = mountEditor()
    await w.get('textarea[data-test="description"]').setValue('x'.repeat(2001))
    await save(w)
    await flushPromises()
    expect(upsertBikeParkDetails).not.toHaveBeenCalled()
    expect(w.text()).toContain('2000')
  })

  it('cancel emits cancel', async () => {
    const w = mountEditor()
    await w.get('[data-test="cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
