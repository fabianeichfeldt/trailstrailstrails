import { describe, it, expect, vi, afterEach } from 'vitest'
import { listInvitationCodes, createInvitationCode } from './invitations'

const BASE_URL = 'https://test.supabase.co'
const REST_URL = `${BASE_URL}/rest/v1`

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(body === undefined ? '' : JSON.stringify(body), { status }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('listInvitationCodes', () => {
  it('queries the invitation codes of one spot with the user token', async () => {
    const fetch = vi.fn().mockReturnValue(respond(200, []))
    vi.stubGlobal('fetch', fetch)
    await listInvitationCodes('spot/1', 'tok-abc')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(
      `${REST_URL}/invitation_codes?spot_id=eq.${encodeURIComponent('spot/1')}&select=code,expires_at,used_by&order=created_at.desc`,
    )
    expect(init.headers.Authorization).toBe('Bearer tok-abc')
  })

  it('returns the rows from the server', async () => {
    const rows = [{ code: 'ABC234', expires_at: '2026-11-14T00:00:00Z', used_by: null }]
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(200, rows)))
    await expect(listInvitationCodes('s', 't')).resolves.toEqual(rows)
  })

  it('throws with the status and body on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(403, { message: 'denied' })))
    await expect(listInvitationCodes('s', 't')).rejects.toThrow(/^403 .*denied/)
  })
})

describe('createInvitationCode', () => {
  it('generates a 6-char code from the unambiguous alphabet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(201)))
    const code = await createInvitationCode('spot-1', 'user-1', 'tok')
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('maps random numbers onto the alphabet', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(201)))
    await expect(createInvitationCode('s', 'u', 't')).resolves.toBe('AAAAAA')
  })

  it('POSTs the code with spot, creator and a 7 day expiry', async () => {
    const now = new Date('2026-11-07T10:00:00Z').getTime()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetch = vi.fn().mockReturnValue(respond(201))
    vi.stubGlobal('fetch', fetch)
    await createInvitationCode('spot-9', 'user-7', 'tok-xyz')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${REST_URL}/invitation_codes`)
    expect(init.method).toBe('POST')
    expect(init.headers.Prefer).toBe('return=minimal')
    expect(init.headers.Authorization).toBe('Bearer tok-xyz')
    expect(JSON.parse(init.body)).toEqual({
      code: 'AAAAAA',
      spot_id: 'spot-9',
      created_by: 'user-7',
      expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
  })

  it('throws when the insert is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(400, { message: 'bad' })))
    await expect(createInvitationCode('s', 'u', 't')).rejects.toThrow(/^400 /)
  })
})
