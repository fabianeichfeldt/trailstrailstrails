import { describe, it, expect, vi, afterEach } from 'vitest'
import { submitFeedback } from './feedback'

const BASE_URL = 'https://test.supabase.co'

afterEach(() => vi.unstubAllGlobals())

describe('submitFeedback', () => {
  it('POSTs an upvote to the trail-details-feedback function', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await submitFeedback('trail-1', true)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/functions/v1/trail-details-feedback`)
    expect(init.method).toBe('POST')
    expect(init.headers.apikey).toBeTruthy()
    expect(JSON.parse(init.body)).toEqual({ trail_id: 'trail-1', up: true })
  })

  it('sends a downvote as up: false', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await submitFeedback('trail-2', false)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ trail_id: 'trail-2', up: false })
  })
})
