import { describe, it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SupportEmail from './SupportEmail.vue'

describe('SupportEmail', () => {
  // Cloudflare only skips obfuscation if the email_off markers reach the prerendered HTML.
  it('keeps the email_off markers in the server-rendered HTML', async () => {
    const html = await renderToString(createSSRApp(SupportEmail))
    expect(html).toContain('<!--email_off--><a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a><!--email_on-->')
  })
})
