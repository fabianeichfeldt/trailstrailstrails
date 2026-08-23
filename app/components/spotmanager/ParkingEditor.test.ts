import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ParkingRow } from '~/spot_manager/Api'

vi.mock('~/spot_manager/Api', () => ({ upsertParking: vi.fn().mockResolvedValue({}) }))

import { upsertParking } from '~/spot_manager/Api'
import ParkingEditor from './ParkingEditor.vue'

function mountEditor(lot: ParkingRow | null) {
  return mount(ParkingEditor, {
    props: { lot, spotId: 's1', jwt: 'jwt', mapView: null },
  })
}

describe('ParkingEditor', () => {
  it('clicking a suggestion chip adds a pre-filled entry and hides that chip', async () => {
    const wrapper = mountEditor(null)
    expect(wrapper.findAll('.parking-info-row')).toHaveLength(0)

    const chip = wrapper.findAll('.parking-suggestion-chip').find(c => c.text().includes('Kosten'))!
    await chip.trigger('click')

    const rows = wrapper.findAll('.parking-info-row')
    expect(rows).toHaveLength(1)
    expect((rows[0]!.find('input').element as HTMLInputElement).value).toBe('Kosten: ')
    expect(wrapper.findAll('.parking-suggestion-chip').some(c => c.text().includes('Kosten'))).toBe(false)
  })

  it('"+ Eigener Eintrag" adds a blank, freely-editable entry', async () => {
    const wrapper = mountEditor(null)
    await wrapper.get('.parking-suggestion-custom').trigger('click')

    const rows = wrapper.findAll('.parking-info-row')
    expect(rows).toHaveLength(1)
    expect((rows[0]!.find('input').element as HTMLInputElement).value).toBe('')
  })

  it('removing an entry drops it from the list', async () => {
    const wrapper = mountEditor(null)
    await wrapper.get('.parking-suggestion-custom').trigger('click')
    await wrapper.get('.parking-suggestion-custom').trigger('click')
    expect(wrapper.findAll('.parking-info-row')).toHaveLength(2)

    await wrapper.findAll('.parking-info-remove')[0]!.trigger('click')
    expect(wrapper.findAll('.parking-info-row')).toHaveLength(1)
  })

  it('save() trims entries and drops blank ones before calling upsertParking', async () => {
    const lot: ParkingRow = { id: 'p1', spot_id: 's1', name: 'Talstation', lat: 47.7, lng: 11.7, info: [] }
    const wrapper = mountEditor(lot)

    await wrapper.get('.parking-suggestion-custom').trigger('click')
    await wrapper.get('.parking-info-input').setValue('  Nur tagsüber  ')
    await wrapper.get('.parking-suggestion-custom').trigger('click') // second, blank entry stays empty

    await wrapper.get('.sm-btn-primary').trigger('click')

    expect(upsertParking).toHaveBeenCalledWith(
      expect.objectContaining({ info: ['Nur tagsüber'] }),
      'jwt',
    )
  })

  it('pre-fills the info list from an existing lot when editing', () => {
    const lot: ParkingRow = { id: 'p1', spot_id: 's1', name: 'Talstation', lat: 47.7, lng: 11.7, info: ['Kosten: kostenlos'] }
    const wrapper = mountEditor(lot)
    expect(wrapper.findAll('.parking-info-row')).toHaveLength(1)
    expect((wrapper.get('.parking-info-input').element as HTMLInputElement).value).toBe('Kosten: kostenlos')
  })
})
