import { describe, it, expect } from 'vitest'
import { isValidEmail } from './isValidEmail'

describe('isValidEmail', () => {
  it('accepts a plain valid address', () => {
    expect(isValidEmail('jamie@example.com')).toBe(true)
  })

  it('accepts an address with a subdomain and plus tag', () => {
    expect(isValidEmail('jamie+beta@mail.example.co.uk')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('rejects a string with no @', () => {
    expect(isValidEmail('jamie.example.com')).toBe(false)
  })

  it('rejects a string with no domain', () => {
    expect(isValidEmail('jamie@')).toBe(false)
  })

  it('rejects a string with no top-level domain', () => {
    expect(isValidEmail('jamie@example')).toBe(false)
  })

  it('rejects a string containing spaces', () => {
    expect(isValidEmail('jamie @example.com')).toBe(false)
  })
})
