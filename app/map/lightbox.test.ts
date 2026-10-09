import { describe, it, expect } from 'vitest'
import { bindPhotoLightbox } from './lightbox'

function carousel(photos: { src: string; copyright?: string }[]) {
  const container = document.createElement('div')
  container.innerHTML = photos.map(p => `
    <div class="photo-wrap">
      <img src="${p.src}" />
      ${p.copyright ? `<span class="photo-copyright">© ${p.copyright}</span>` : ''}
      <div class="photo-meta"><span class="photo-uploader">von Alice</span><span class="photo-date">1. Jan. 2024</span></div>
    </div>`).join('')
  document.body.appendChild(container)
  return container
}

function open(container: HTMLElement, i: number) {
  container.querySelectorAll<HTMLElement>('.photo-wrap')[i]!.click()
  return document.querySelector<HTMLElement>('.lbx-copyright')!
}

describe('bindPhotoLightbox — copyright', () => {
  it('overlays the photo copyright in the fullscreen view', () => {
    const c = carousel([{ src: 'https://x/1.jpg', copyright: 'Max Muster' }])
    bindPhotoLightbox(c)

    const credit = open(c, 0)
    expect(credit.textContent).toBe('© Max Muster')
    expect(credit.hidden).toBe(false)
  })

  it('hides the overlay for a photo without copyright', () => {
    const c = carousel([{ src: 'https://x/1.jpg', copyright: 'Max' }, { src: 'https://x/2.jpg' }])
    bindPhotoLightbox(c)

    expect(open(c, 0).hidden).toBe(false)
    expect(open(c, 1).hidden).toBe(true)
  })
})
