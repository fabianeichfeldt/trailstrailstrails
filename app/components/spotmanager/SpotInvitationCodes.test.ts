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

const future = new Date(Date.now() + 86400000).toISOString()

beforeEach(() => {
  vi.mocked(listInvitationCodes).mockReset()
  vi.mocked(createInvitationCode).mockReset()
})

describe('SpotInvitationCodes', () => {
  it('lists codes with used/open badges', async () => {
    vi.mocked(listInvitationCodes).mockResolvedValue([
      { code: 'AAAAAA', expires_at: future, used_by: null },
      { code: 'BBBBBB', expires_at: future, used_by: 'someone' },
    ])
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
    vi.mocked(listInvitationCodes).mockResolvedValueOnce([])
    vi.mocked(createInvitationCode).mockResolvedValue('NEWCDE')
    vi.mocked(listInvitationCodes).mockResolvedValueOnce([{ code: 'NEWCDE', expires_at: future, used_by: null }])
    const w = mount(SpotInvitationCodes, { props: { spotId: 's1' } })
    await flushPromises()
    await w.get('.sd-add-rule-btn').trigger('click')
    await flushPromises()
    expect(createInvitationCode).toHaveBeenCalledWith('s1', 'u1', 'jwt')
    expect(w.get('.inv-code-chip').text()).toBe('NEWCDE')
    expect(w.findAll('.inv-row')).toHaveLength(1)
  })

  it('surfaces a creation error', async () => {
    vi.mocked(listInvitationCodes).mockResolvedValue([])
    vi.mocked(createInvitationCode).mockRejectedValue(new Error('boom'))
    const alertSpy = vi.fn()
    vi.stubGlobal('alert', alertSpy)
    const w = mount(SpotInvitationCodes, { props: { spotId: 's1' } })
    await flushPromises()
    await w.get('.sd-add-rule-btn').trigger('click')
    await flushPromises()
    expect(alertSpy).toHaveBeenCalledWith('Fehler: boom')
  })

  it('reloads when the spot changes', async () => {
    vi.mocked(listInvitationCodes).mockResolvedValue([])
    const w = mount(SpotInvitationCodes, { props: { spotId: 's1' } })
    await flushPromises()
    await w.setProps({ spotId: 's2' })
    await flushPromises()
    expect(listInvitationCodes).toHaveBeenLastCalledWith('s2', 'jwt')
  })
})
