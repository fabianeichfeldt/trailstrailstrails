import { describe, it, expect } from 'vitest'
import { confirmDialog } from './confirmDialog'

describe('confirmDialog', () => {
  it('shows the given message and opens the overlay', () => {
    confirmDialog('Sicher?')
    const overlay = document.querySelector('.confirm-dialog')!
    expect(overlay.classList.contains('confirm-dialog--open')).toBe(true)
    expect(overlay.querySelector('.confirm-dialog-message')!.textContent).toBe('Sicher?')
  })

  it('uses a custom confirm label when given', () => {
    confirmDialog('Sicher?', 'Ja, löschen')
    expect(document.querySelector('.confirm-dialog-confirm')!.textContent).toBe('Ja, löschen')
  })

  it('resolves true and closes when the confirm button is clicked', async () => {
    const promise = confirmDialog('Löschen?')
    document.querySelector<HTMLButtonElement>('.confirm-dialog-confirm')!.click()
    await expect(promise).resolves.toBe(true)
    expect(document.querySelector('.confirm-dialog')!.classList.contains('confirm-dialog--open')).toBe(false)
  })

  it('resolves false when the cancel button is clicked', async () => {
    const promise = confirmDialog('Löschen?')
    document.querySelector<HTMLButtonElement>('.confirm-dialog-cancel')!.click()
    await expect(promise).resolves.toBe(false)
  })

  it('resolves false when the backdrop is clicked', async () => {
    const promise = confirmDialog('Löschen?')
    document.querySelector<HTMLButtonElement>('.confirm-dialog-backdrop')!.click()
    await expect(promise).resolves.toBe(false)
  })

  it('resolves false on Escape', async () => {
    const promise = confirmDialog('Löschen?')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(promise).resolves.toBe(false)
  })
})
