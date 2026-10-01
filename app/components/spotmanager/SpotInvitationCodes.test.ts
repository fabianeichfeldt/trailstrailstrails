import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('~/communication/invitations', () => ({
  listInvitationCodes: vi.fn(),
  createInvitationCode: vi.fn(),
}))
vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    getToken: vi.fn().mockResolvedValue('jwt'),
    getUserId: vi.fn().mockResolvedValue('u1'),
  }),
}))

import { listInvitationCodes, createInvitationCode } from '~/communication/invitations'
import SpotInvitationCodes from './SpotInvitationCodes.vue'

const list = vi.mocked(listInvitationCodes)
const create = vi.mocked(createInvitationCode)

async function mountIt() {
  const wrapper = mount(SpotInvitationCodes, { props: { spotId: 's1' } })
  await flushPromises()
  return wrapper
}

describe('SpotInvitationCodes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('lists codes with verwendet/offen badges', async () => {
    list.mockResolvedValue([
      { code: 'AAAAAA', expires_at: '2026-10-08T00:00:00Z', used_by: null },
      { code: 'BBBBBB', expires_at: '2026-10-08T00:00:00Z', used_by: 'u2' },
    ])
    const w = await mountIt()
    expect(list).toHaveBeenCalledWith('s1', 'jwt')
    const rows = w.findAll('.inv-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('.inv-badge').text()).toBe('offen')
    expect(rows[1]!.find('.inv-badge').text()).toBe('verwendet')
    expect(rows[1]!.classes()).toContain('inv-row--used')
  })

  it('"Code erstellen" creates, reloads and shows the new code', async () => {
    list.mockResolvedValueOnce([])
    create.mockResolvedValue('NEWCOD')
    list.mockResolvedValueOnce([{ code: 'NEWCOD', expires_at: '2026-10-08T00:00:00Z', used_by: null }])
    const w = await mountIt()
    await w.get('.sd-add-rule-btn').trigger('click')
    await flushPromises()
    expect(create).toHaveBeenCalledWith('s1', 'u1', 'jwt')
    expect(list).toHaveBeenCalledTimes(2)
    expect(w.get('.inv-code-chip').text()).toBe('NEWCOD')
    expect(w.findAll('.inv-row')).toHaveLength(1)
  })

  it('surfaces an error via alert', async () => {
    list.mockResolvedValue([])
    create.mockRejectedValue(new Error('boom'))
    const alertSpy = vi.fn()
    vi.stubGlobal('alert', alertSpy)
    const w = await mountIt()
    await w.get('.sd-add-rule-btn').trigger('click')
    await flushPromises()
    expect(alertSpy).toHaveBeenCalledWith('Fehler: boom')
    expect(w.find('.inv-code-chip').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('falls back to an empty list when loading fails', async () => {
    list.mockRejectedValue(new Error('x'))
    const w = await mountIt()
    expect(w.findAll('.inv-row')).toHaveLength(0)
  })
})
