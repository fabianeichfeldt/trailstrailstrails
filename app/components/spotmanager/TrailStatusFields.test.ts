import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrailStatusFields from './TrailStatusFields.vue'

function mountFields(props: { closedFrom: string | null; closedTo: string | null; hint: string | null; spotName?: string }) {
  return mount(TrailStatusFields, { props: { spotName: 'Testspot', ...props } })
}

function vonInput(wrapper: ReturnType<typeof mountFields>) {
  return wrapper.findAll('input[type="datetime-local"]')[0]!
}
function bisInput(wrapper: ReturnType<typeof mountFields>) {
  return wrapper.findAll('input[type="datetime-local"]')[1]!
}

describe('TrailStatusFields', () => {
  it('"Jetzt" fills Von with the current local datetime and emits update:closedFrom', async () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: null })
    await wrapper.get('button.trail-status-btn').trigger('click') // first .trail-status-btn = Jetzt

    const value = (vonInput(wrapper).element as HTMLInputElement).value
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    const emitted = wrapper.emitted('update:closedFrom')
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1]![0]).not.toBeNull()
  })

  it('"Morgen" fills Bis with 23:59 of the next day once Von is set', async () => {
    const wrapper = mountFields({ closedFrom: '2026-08-02T09:00:00.000Z', closedTo: null, hint: null })
    const buttons = wrapper.findAll('button.trail-status-btn')
    await buttons[1]!.trigger('click') // second .trail-status-btn = Morgen

    const value = (bisInput(wrapper).element as HTMLInputElement).value
    expect(value).toMatch(/T23:59$/)
    const emitted = wrapper.emitted('update:closedTo')
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1]![0]).not.toBeNull()
  })

  it('Bis is disabled when Von is empty and enabled once Von has a value', async () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: null })
    expect((bisInput(wrapper).element as HTMLInputElement).disabled).toBe(true)

    await vonInput(wrapper).setValue('2026-08-02T09:00')
    expect((bisInput(wrapper).element as HTMLInputElement).disabled).toBe(false)
  })

  it('clearing Von also clears Bis', async () => {
    const wrapper = mountFields({ closedFrom: '2026-08-02T09:00:00.000Z', closedTo: '2026-08-03T23:59:00.000Z', hint: null })
    expect((bisInput(wrapper).element as HTMLInputElement).value).not.toBe('')

    await vonInput(wrapper).setValue('')

    expect((bisInput(wrapper).element as HTMLInputElement).value).toBe('')
    expect((bisInput(wrapper).element as HTMLInputElement).disabled).toBe(true)
    const emittedTo = wrapper.emitted('update:closedTo')
    expect(emittedTo![emittedTo!.length - 1]![0]).toBeNull()
  })

  it('"Sperrung aufheben" clears both Von and Bis', async () => {
    const wrapper = mountFields({ closedFrom: '2026-08-02T09:00:00.000Z', closedTo: '2026-08-03T23:59:00.000Z', hint: null })
    await wrapper.get('.trail-status-clear-btn').trigger('click')

    expect((vonInput(wrapper).element as HTMLInputElement).value).toBe('')
    expect((bisInput(wrapper).element as HTMLInputElement).value).toBe('')
    const emittedFrom = wrapper.emitted('update:closedFrom')
    const emittedTo = wrapper.emitted('update:closedTo')
    expect(emittedFrom![emittedFrom!.length - 1]![0]).toBeNull()
    expect(emittedTo![emittedTo!.length - 1]![0]).toBeNull()
  })

  it('"Sperrung aufheben" is only shown once Von or Bis is set', () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: null })
    expect(wrapper.find('.trail-status-clear-btn').exists()).toBe(false)
  })

  it('helper text is shown only when Von is set and Bis is empty', async () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: null })
    expect(wrapper.find('.trail-status-hint').exists()).toBe(false)

    await vonInput(wrapper).setValue('2026-08-02T09:00')
    expect(wrapper.find('.trail-status-hint').exists()).toBe(true)

    await bisInput(wrapper).setValue('2026-08-03T23:59')
    expect(wrapper.find('.trail-status-hint').exists()).toBe(false)
  })

  it('hint counter reflects the current length and the textarea respects the 300-char cap', () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: 'Nach Regen rutschig' })
    expect(wrapper.get('.trail-status-char-hint').text()).toBe('19/300')
    expect(wrapper.get('textarea').attributes('maxlength')).toBe('300')
  })

  it('typing a hint emits update:hint trimmed, and clearing it emits null', async () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: null })
    await wrapper.get('textarea').setValue('  Vorsicht Wurzeln  ')
    let emitted = wrapper.emitted('update:hint')
    expect(emitted![emitted!.length - 1]![0]).toBe('Vorsicht Wurzeln')

    await wrapper.get('textarea').setValue('')
    emitted = wrapper.emitted('update:hint')
    expect(emitted![emitted!.length - 1]![0]).toBeNull()
  })

  it('pre-fills Von/Bis/Hinweis from ISO props when editing an existing closure', () => {
    const wrapper = mountFields({ closedFrom: '2026-08-02T09:00:00.000Z', closedTo: '2026-08-03T23:59:00.000Z', hint: 'Bauarbeiten' })
    expect((vonInput(wrapper).element as HTMLInputElement).value).not.toBe('')
    expect((bisInput(wrapper).element as HTMLInputElement).value).not.toBe('')
    expect(wrapper.get('textarea').element.value).toBe('Bauarbeiten')
  })

  it('explains upfront that setting Von closes the trail', () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: null })
    expect(wrapper.get('.trail-status-section-title').text()).toBe('Sperrzeitraum')
    expect(wrapper.text()).toContain('gilt der Trail für Fahrer als gesperrt')
  })

  it('preview shows the open placeholder when nothing is set', () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: null })
    expect(wrapper.find('.trail-status-preview-open').exists()).toBe(true)
    expect(wrapper.find('.trail-status-info').exists()).toBe(false)
  })

  it('preview shows the closed card, matching the map/spot-panel styling, once Von is in the past', () => {
    const wrapper = mountFields({ closedFrom: '2020-01-01T09:00:00.000Z', closedTo: null, hint: null })
    const card = wrapper.get('.trail-status-info')
    expect(card.classes()).toContain('trail-status-info-closed')
    expect(card.get('.trail-status-info-title').text()).toBe('Aktuell gesperrt')
    expect(card.get('.trail-status-info-date').text()).toMatch(/^seit /)
    expect(card.get('.trail-status-info-attribution').text()).toBe('Hinweis von Trailcrew Testspot')
  })

  it('preview shows the "closing soon" card once Von is in the future', () => {
    const wrapper = mountFields({ closedFrom: '2099-01-01T09:00:00.000Z', closedTo: null, hint: null })
    const card = wrapper.get('.trail-status-info')
    expect(card.classes()).toContain('trail-status-info-closing')
    expect(card.get('.trail-status-info-title').text()).toBe('Bald gesperrt')
  })

  it('preview shows the "Hinweis" card when only a hint is set, live as the user types', async () => {
    const wrapper = mountFields({ closedFrom: null, closedTo: null, hint: null })
    expect(wrapper.find('.trail-status-info').exists()).toBe(false)

    await wrapper.get('textarea').setValue('Nach Regen rutschig')
    const card = wrapper.get('.trail-status-info')
    expect(card.classes()).toContain('trail-status-info-closing')
    expect(card.get('.trail-status-info-title').text()).toBe('Hinweis')
    expect(card.get('.trail-status-info-hint').text()).toBe('Nach Regen rutschig')
  })
})
