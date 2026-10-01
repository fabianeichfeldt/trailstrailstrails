import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('~/communication/invitations', () => ({
  listInvitationCodes: vi.fn(),
  createInvitationCode: vi.fn(),
}))
vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ getToken: async () => 'jwt', getUserId: async () => 'u1' }),
}))

import { listInvitationCodes, createInvitationCode } from '~/communication/invitations'
import SpotInvitationCodes from './SpotInvitationCodes.vue'

const open = { code: 'AAAAAA', expires_at: '2026-10-08T00:00:00Z', used_by: null }
const used = { code: 'BBBBBB', expires_at: '2026-10-08T00:00:00Z', used_by: 'u2' }

describe('SpotInvitationCodes', () => {
  beforeEach(() => {
    vi.mocked(listInvitationCodes).mockReset()
    vi.mocked(createInvitationCode).mockReset()
    vi.stubGlobal('alert', vi.fn())
  })

  it('lists codes with used/open badges', async () => {
    vi.mocked(listInvitationCodes).mockResolvedValue([open, used])
    const w = mount(SpotInvitationCodes, { props: { spotId: 's1' } })
    await flushPromises()
    expect(listInvitationCodes).toHaveBeenCalledWith('s1', 'jwt')
    const rows = w.findAll('.inv-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('.inv-badge').text()).toBe('offen')
    expect(rows[1]!.find('.inv-badge').text()).toBe('verwendet')
    expect(rows[1]!.classes()).toContain('inv-row--used')
  })

  it('"Code erstellen" creates, reloads and shows the new code', async () => {
    vi.mocked(listInvitationCodes).mockResolvedValueOnce([]).mockResolvedValueOnce([open])
    vi.mocked(createInvitationCode).mockResolvedValue('AAAAAA')
    const w = mount(SpotInvitationCodes, { props: { spotId: 's1' } })
    await flushPromises()
    await w.get('button').trigger('click')
    await flushPromises()
    expect(createInvitationCode).toHaveBeenCalledWith('s1', 'u1', 'jwt')
    expect(w.get('.inv-code-chip').text()).toBe('AAAAAA')
    expect(w.findAll('.inv-row')).toHaveLength(1)
  })

  it('surfaces an error from creation', async () => {
    vi.mocked(listInvitationCodes).mockResolvedValue([])
    vi.mocked(createInvitationCode).mockRejectedValue(new Error('403 nope'))
    const w = mount(SpotInvitationCodes, { props: { spotId: 's1' } })
    await flushPromises()
    await w.get('button').trigger('click')
    await flushPromises()
    expect(alert).toHaveBeenCalledWith('Fehler: 403 nope')
    expect(w.find('.inv-code-chip').exists()).toBe(false)
  })
})
