import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { SpotRow, BikeParkDetailsRow } from '~/spot_manager/Api'

vi.mock('~/spot_manager/Api', () => ({
  upsertBikeParkDetails: vi.fn(async (row: unknown) => row),
  setSpotWebsite: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('~/communication/invitations', () => ({
  listInvitationCodes: vi.fn().mockResolvedValue([]),
  createInvitationCode: vi.fn(),
}))
vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ getToken: async () => 'jwt', getUserId: async () => 'u1' }),
}))

import { upsertBikeParkDetails, setSpotWebsite } from '~/spot_manager/Api'
import BikeParkDetailsEditor from './BikeParkDetailsEditor.vue'

const spot = { id: 'p1', name: 'Park', type: 'bikepark', url: 'https://old.de' } as SpotRow
const details: BikeParkDetailsRow = { id: 'p1', status: 'open', opening_hours: 'Mo-So 9-17', trail_description: 'Hallo' }

function mountEditor(d: BikeParkDetailsRow | null = details, s: SpotRow = spot) {
  return mount(BikeParkDetailsEditor, {
    props: { spot: s, details: d, jwt: 'jwt' },
    global: { stubs: { SpotInvitationCodes: { props: ['spotId'], template: '<div class="inv-stub">{{ spotId }}</div>' } } },
  })
}
const save = async (w: ReturnType<typeof mountEditor>) => {
  await w.get('.sm-btn-primary').trigger('click')
  await flushPromises()
}

beforeEach(() => vi.clearAllMocks())

describe('BikeParkDetailsEditor', () => {
  it('renders park fields and no trail-only sections', () => {
    const w = mountEditor()
    const text = w.text()
    for (const t of ['Offen', 'Gesperrt', 'Öffnungszeiten', 'Beschreibung', 'Website']) expect(text).toContain(t)
    expect(w.get('.inv-stub').text()).toBe('p1')
    for (const t of ['Regensperre', 'Nachtsperrung', 'Saison', 'Zugang', 'Nutzungsregeln', 'Betroffene Trails', 'Eingeschränkt']) {
      expect(text).not.toContain(t)
    }
  })

  it('shows the invitation-codes heading exactly once', async () => {
    const w = mount(BikeParkDetailsEditor, { props: { spot, details, jwt: 'jwt' } })
    await flushPromises()
    expect(w.text().match(/Einladungscodes/g)).toHaveLength(1)
  })

  it.each(['unknown', 'limited', null] as const)('legacy status %s selects neither option', (status) => {
    const w = mountEditor({ ...details, status })
    expect(w.findAll('.sd-status-card.active')).toHaveLength(0)
  })

  it('saves the picked status with the exact payload', async () => {
    const w = mountEditor()
    await w.findAll('.sd-status-card').find(b => b.text() === 'Gesperrt')!.trigger('click')
    await save(w)
    expect(upsertBikeParkDetails).toHaveBeenCalledWith(
      { id: 'p1', status: 'closed', opening_hours: 'Mo-So 9-17', trail_description: 'Hallo' }, 'jwt')
  })

  it('keeps the original legacy status when untouched and nulls empty strings', async () => {
    const w = mountEditor({ id: 'p1', status: 'limited', opening_hours: '  ', trail_description: '' })
    await save(w)
    expect(upsertBikeParkDetails).toHaveBeenCalledWith(
      { id: 'p1', status: 'limited', opening_hours: null, trail_description: null }, 'jwt')
  })

  it('handles a park without a details row', async () => {
    const w = mountEditor(null, { ...spot, url: null })
    await save(w)
    expect(upsertBikeParkDetails).toHaveBeenCalledWith(
      { id: 'p1', status: null, opening_hours: null, trail_description: null }, 'jwt')
    expect(setSpotWebsite).not.toHaveBeenCalled()
  })

  it('does not call the website RPC when the url is unchanged', async () => {
    const w = mountEditor()
    await save(w)
    expect(setSpotWebsite).not.toHaveBeenCalled()
  })

  it('calls the website RPC with the normalised url when changed, then emits saved', async () => {
    const w = mountEditor()
    await w.get('input[type="url"]').setValue('  https://new.de  ')
    await save(w)
    expect(setSpotWebsite).toHaveBeenCalledWith('p1', 'https://new.de', 'jwt')
    expect(w.emitted('saved')![0]![1]).toBe('https://new.de')
    expect((w.emitted('saved')![0]![0] as BikeParkDetailsRow).id).toBe('p1')
  })

  it('clearing the website sends an empty string', async () => {
    const w = mountEditor()
    await w.get('input[type="url"]').setValue('')
    await save(w)
    expect(setSpotWebsite).toHaveBeenCalledWith('p1', '', 'jwt')
  })

  it('blocks save on an invalid url with an inline message', async () => {
    const w = mountEditor()
    await w.get('input[type="url"]').setValue('example.com')
    await save(w)
    expect(upsertBikeParkDetails).not.toHaveBeenCalled()
    expect(w.find('.sd-field-error').exists()).toBe(true)
  })

  it('blocks save when the description exceeds 2000 chars', async () => {
    const w = mountEditor({ ...details, trail_description: 'x'.repeat(2001) })
    await save(w)
    expect(upsertBikeParkDetails).not.toHaveBeenCalled()
    expect(w.text()).toContain('2000')
  })

  it('shows an inline error and does not emit when the save fails', async () => {
    vi.mocked(upsertBikeParkDetails).mockRejectedValueOnce(new Error('boom'))
    const w = mountEditor()
    await save(w)
    expect(w.find('.sm-error').text()).toContain('boom')
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('emits cancel', async () => {
    const w = mountEditor()
    await w.findAll('.sm-btn-secondary')[0]!.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
