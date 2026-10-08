import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SoilRadarIntro from './SoilRadarIntro.vue'

const mountIntro = (show: boolean) => mount(SoilRadarIntro, { props: { show }, global: { stubs: { transition: false } } })

describe('SoilRadarIntro', () => {
  it('pitches the radar with the "where to ride today" hook', () => {
    const w = mountIntro(true)
    expect(w.get('[data-testid="soil-intro"]').text()).toContain("Wo fährt's sich heute am besten?")
    expect(w.text()).toMatch(/Regen, Wetter und Bodenart/)
  })

  it('renders nothing when hidden', () => {
    expect(mountIntro(false).find('[data-testid="soil-intro"]').exists()).toBe(false)
  })

  it('emits try from the CTA and dismiss from close and Escape', async () => {
    const w = mountIntro(true)
    await w.get('[data-testid="soil-intro-try"]').trigger('click')
    await w.get('[data-testid="soil-intro-close"]').trigger('click')
    await w.get('[data-testid="soil-intro"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('try')).toHaveLength(1)
    expect(w.emitted('dismiss')).toHaveLength(2)
  })
})
