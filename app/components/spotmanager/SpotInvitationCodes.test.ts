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

const used = { code: 'AAAAAA', expires_at: '2026-10-08T00:00:00Z', used_by: 'x' }
const open = { code: 'BBBBBB', expires_at: '2026-10-08T00:00:00Z', used_by: null }

async function mountIt(spotId = 's1') {
  const wrapper = mount(SpotInvitationCodes, { props: { spotId } })
  await flushPromises()
  return wrapper
}

describe('SpotInvitationCodes', () => {
  beforeEach(() => {
    list.mockReset()
    create.mockReset()
    list.mockResolvedValue([used, open])
  })

  it('lists codes with verwendet/offen badges on mount', async () => {
    const wrapper = await mountIt()
    expect(list).toHaveBeenCalledWith('s1', 'jwt')
    const rows = wrapper.findAll('.inv-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.classes()).toContain('inv-row--used')
    expect(rows[0]!.find('.inv-badge').text()).toBe('verwendet')
    expect(rows[1]!.classes()).not.toContain('inv-row--used')
    expect(rows[1]!.find('.inv-badge').text()).toBe('offen')
  })

  it('"Code erstellen" creates, reloads and shows the new code', async () => {
    create.mockResolvedValue('NEWCOD')
    const wrapper = await mountIt()
    list.mockResolvedValue([{ code: 'NEWCOD', expires_at: '2026-10-08T00:00:00Z', used_by: null }, used, open])

    await wrapper.get('button.sd-add-rule-btn').trigger('click')
    await flushPromises()

    expect(create).toHaveBeenCalledWith('s1', 'u1', 'jwt')
    expect(wrapper.get('.inv-code-chip').text()).toBe('NEWCOD')
    expect(wrapper.findAll('.inv-row')).toHaveLength(3)
  })

  it('surfaces a creation error via alert', async () => {
    const alertSpy = vi.fn()
    vi.stubGlobal('alert', alertSpy)
    create.mockRejectedValue(new Error('boom'))
    const wrapper = await mountIt()

    await wrapper.get('button.sd-add-rule-btn').trigger('click')
    await flushPromises()

    expect(alertSpy).toHaveBeenCalledWith('Fehler: boom')
    expect(wrapper.find('.inv-code-chip').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('reloads and clears the new code when spotId changes', async () => {
    create.mockResolvedValue('NEWCOD')
    const wrapper = await mountIt('s1')
    await wrapper.get('button.sd-add-rule-btn').trigger('click')
    await flushPromises()
    expect(wrapper.find('.inv-code-chip').exists()).toBe(true)

    await wrapper.setProps({ spotId: 's2' })
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith('s2', 'jwt')
    expect(wrapper.find('.inv-code-chip').exists()).toBe(false)
  })
})
