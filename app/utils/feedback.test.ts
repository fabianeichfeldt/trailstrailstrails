import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { upVote, downVote } from './feedback'
import { showToast } from './toast'

vi.mock('./toast', () => ({ showToast: vi.fn() }))

function buildButtons(): { up: HTMLElement; down: HTMLElement } {
  document.body.innerHTML = `
    <div class="trail">
      <div class="feedback-buttons">
        <button class="up">up</button>
        <button class="down">down</button>
      </div>
    </div>`
  return {
    up: document.querySelector('.up') as HTMLElement,
    down: document.querySelector('.down') as HTMLElement,
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('upVote', () => {
  it('marks the up button selected and sends an upvote', async () => {
    const { up, down } = buildButtons()
    await upVote('trail-1', up)
    expect(up.classList.contains('selected')).toBe(true)
    expect(down.classList.contains('selected')).toBe(false)
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ trail_id: 'trail-1', up: true })
  })

  it('replaces a previous downvote selection', async () => {
    const { up, down } = buildButtons()
    down.classList.add('selected')
    await upVote('trail-1', up)
    expect(down.classList.contains('selected')).toBe(false)
    expect(up.classList.contains('selected')).toBe(true)
  })

  it('does nothing when the button is outside a feedback group', async () => {
    document.body.innerHTML = '<button id="loose">x</button>'
    const loose = document.getElementById('loose') as HTMLElement
    await upVote('trail-1', loose)
    expect(fetch).not.toHaveBeenCalled()
    expect(loose.classList.contains('selected')).toBe(false)
  })

  it('does nothing when the group lacks its up or down button', async () => {
    document.body.innerHTML = '<div class="feedback-buttons"><button class="up">u</button></div>'
    const up = document.querySelector('.up') as HTMLElement
    await upVote('trail-1', up)
    expect(fetch).not.toHaveBeenCalled()
    expect(up.classList.contains('selected')).toBe(false)
  })
})

describe('downVote', () => {
  it('marks the down button selected and sends a downvote', async () => {
    const { up, down } = buildButtons()
    up.classList.add('selected')
    await downVote('trail-2', down)
    expect(down.classList.contains('selected')).toBe(true)
    expect(up.classList.contains('selected')).toBe(false)
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ trail_id: 'trail-2', up: false })
  })
})

describe('failed vote', () => {
  beforeEach(() => {
    vi.mocked(showToast).mockClear()
  })

  it('restores the previous selection and shows an error when the server rejects the vote', async () => {
    const { up, down } = buildButtons()
    down.classList.add('selected')
    vi.mocked(fetch).mockResolvedValueOnce(new Response('boom', { status: 500 }))
    await upVote('trail-1', up)
    expect(up.classList.contains('selected')).toBe(false)
    expect(down.classList.contains('selected')).toBe(true)
    expect(showToast).toHaveBeenCalledWith('Feedback konnte nicht gesendet werden', 'error')
  })

  it('clears the selection when nothing was selected before the failed vote', async () => {
    const { up, down } = buildButtons()
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await downVote('trail-2', down)
    expect(up.classList.contains('selected')).toBe(false)
    expect(down.classList.contains('selected')).toBe(false)
    expect(showToast).toHaveBeenCalledWith('Feedback konnte nicht gesendet werden', 'error')
  })

  it('shows no error when the vote succeeds', async () => {
    const { up } = buildButtons()
    await upVote('trail-1', up)
    expect(up.classList.contains('selected')).toBe(true)
    expect(showToast).not.toHaveBeenCalled()
  })
})
