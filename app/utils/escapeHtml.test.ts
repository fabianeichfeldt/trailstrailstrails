import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escapeHtml'

describe('escapeHtml', () => {
  it('escapes all five reserved HTML characters', () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`))
      .toBe('&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;')
  })

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Trail war heute top in Schuss!')).toBe('Trail war heute top in Schuss!')
  })
})
