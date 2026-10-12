import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { SpotRow, ParkDetailsRow } from '~/spot_manager/Api'

vi.mock('~/spot_manager/Api', () => ({
  upsertParkDetails: vi.fn(async (_table: string, row: unknown) => row),
  setSpotWebsite: vi.fn().mockResolvedValue(undefined),
  setDirtParkKind: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('~/communication/invitations', () => ({
  listInvitationCodes: vi.fn().mockResolvedValue([]),
  createInvitationCode: vi.fn(),
}))
vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ getToken: async () => 'jwt', getUserId: async () => 'u1' }),
}))

import { upsertParkDetails, setSpotWebsite, setDirtParkKind } from '~/spot_manager/Api'
import ParkDetailsEditor from './ParkDetailsEditor.vue'

const spot = { id: 'p1', name: 'Park', type: 'bikepark', url: 'https://old.de' } as SpotRow
const details: ParkDetailsRow = { id: 'p1', status: 'open', opening_hours: 'Mo-So 9-17', trail_description: 'Hallo' }

function mountEditor(d: ParkDetailsRow | null = details, s: SpotRow = spot) {
  return mount(ParkDetailsEditor, {
    props: { spot: s, details: d, jwt: 'jwt' },
    global: { stubs: { SpotInvitationCodes: { props: ['spotId'], template: '<div class="inv-stub">{{ spotId }}</div>' } } },
  })
}
const save = async (w: ReturnType<typeof mountEditor>) => {
  await w.get('.sm-btn-primary').trigger('click')
  await flushPromises()
}

beforeEach(() => vi.clearAllMocks())

describe('ParkDetailsEditor', () => {
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
    const w = mount(ParkDetailsEditor, { props: { spot, details, jwt: 'jwt' } })
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
    expect(upsertParkDetails).toHaveBeenCalledWith('bike_park_details',
      { id: 'p1', status: 'closed', opening_hours: 'Mo-So 9-17', trail_description: 'Hallo' }, 'jwt')
  })

  it('keeps the original legacy status when untouched and nulls empty strings', async () => {
    const w = mountEditor({ id: 'p1', status: 'limited', opening_hours: '  ', trail_description: '' })
    await save(w)
    expect(upsertParkDetails).toHaveBeenCalledWith('bike_park_details',
      { id: 'p1', status: 'limited', opening_hours: null, trail_description: null }, 'jwt')
  })

  it('handles a park without a details row', async () => {
    const w = mountEditor(null, { ...spot, url: null })
    await save(w)
    expect(upsertParkDetails).toHaveBeenCalledWith('bike_park_details',
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
    expect(w.emitted('saved')![0]![1]).toEqual({ url: 'https://new.de' })
    expect((w.emitted('saved')![0]![0] as ParkDetailsRow).id).toBe('p1')
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
    expect(upsertParkDetails).not.toHaveBeenCalled()
    expect(w.find('.sd-field-error').exists()).toBe(true)
  })

  it('blocks save when the description exceeds 2000 chars', async () => {
    const w = mountEditor({ ...details, trail_description: 'x'.repeat(2001) })
    await save(w)
    expect(upsertParkDetails).not.toHaveBeenCalled()
    expect(w.text()).toContain('2000')
  })

  it('shows an inline error and does not emit when the save fails', async () => {
    vi.mocked(upsertParkDetails).mockRejectedValueOnce(new Error('boom'))
    const w = mountEditor()
    await save(w)
    expect(w.find('.sm-error').text()).toContain('boom')
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('bikeparks have no pumptrack / dirt-jump choice', () => {
    expect(mountEditor().find('[data-testid="park-kind"]').exists()).toBe(false)
  })

  it('emits cancel', async () => {
    const w = mountEditor()
    await w.findAll('.sm-btn-secondary')[0]!.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})

describe('ParkDetailsEditor for a dirtpark', () => {
  const dirt = { id: 'd1', name: 'Dirt', type: 'dirtpark', url: '', pumptrack: true, dirtpark: false } as SpotRow
  const mountDirt = (s: SpotRow = dirt) => mountEditor({ ...details, id: s.id }, s)
  const kindCard = (w: ReturnType<typeof mountEditor>, label: string) =>
    w.get('[data-testid="park-kind"]').findAll('button').find(b => b.text() === label)!

  it('shows the pumptrack / dirt-jump choice preselected from the spot', () => {
    const w = mountDirt()
    expect(kindCard(w, 'Pumptrack').attributes('aria-pressed')).toBe('true')
    expect(kindCard(w, 'Dirt-Jumps').attributes('aria-pressed')).toBe('false')
  })

  it('saves details to dirt_park_details and skips the kind RPC when unchanged', async () => {
    const w = mountDirt()
    await save(w)
    expect(upsertParkDetails).toHaveBeenCalledWith('dirt_park_details', expect.objectContaining({ id: 'd1' }), 'jwt')
    expect(setDirtParkKind).not.toHaveBeenCalled()
  })

  it('allows both kinds and writes them via the RPC, then emits them', async () => {
    const w = mountDirt()
    await kindCard(w, 'Dirt-Jumps').trigger('click')
    await save(w)
    expect(setDirtParkKind).toHaveBeenCalledWith('d1', { pumptrack: true, dirtpark: true }, 'jwt')
    expect(w.emitted('saved')![0]![1]).toEqual({ url: '', pumptrack: true, dirtpark: true })
  })

  it('switches from pumptrack to dirt-jumps', async () => {
    const w = mountDirt()
    await kindCard(w, 'Dirt-Jumps').trigger('click')
    await kindCard(w, 'Pumptrack').trigger('click')
    await save(w)
    expect(setDirtParkKind).toHaveBeenCalledWith('d1', { pumptrack: false, dirtpark: true }, 'jwt')
  })

  it('blocks save when neither kind is picked', async () => {
    const w = mountDirt()
    await kindCard(w, 'Pumptrack').trigger('click')
    await save(w)
    expect(upsertParkDetails).not.toHaveBeenCalled()
    expect(setDirtParkKind).not.toHaveBeenCalled()
    expect(w.get('[data-testid="park-kind"]').text()).toContain('Mindestens')
  })

  it('a legacy dirtpark with no flags set starts with nothing selected', () => {
    const w = mountDirt({ ...dirt, pumptrack: null, dirtpark: null })
    expect(w.get('[data-testid="park-kind"]').findAll('[aria-pressed="true"]')).toHaveLength(0)
  })
})
