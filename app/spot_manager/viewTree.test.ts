import { describe, it, expect, vi } from 'vitest'
import { VIEW_TREE, breadcrumbsFor, createViewNav, viewPath, type View } from './viewTree'

const CTX = { spotName: 'Isartrails', editingEmbedToken: false, editingParking: true }

function nav(start: View, extra: Partial<Parameters<typeof createViewNav>[0]> = {}) {
  let view: View = start
  const n = createViewNav({ get: () => view, set: v => { view = v }, ...extra })
  return { ...n, current: () => view }
}

describe('view tree', () => {
  it('every view reaches the selector', () => {
    for (const v of Object.keys(VIEW_TREE) as View[]) expect(viewPath(v)[0]).toBe('selector')
  })

  it('breadcrumbs: ancestors are links, the current view is not', () => {
    expect(breadcrumbsFor('parking-edit', CTX)).toEqual([
      { view: 'selector', label: 'Spot Manager', current: false },
      { view: 'list', label: 'Isartrails', current: false },
      { view: 'parking-list', label: 'Parkplätze', current: false },
      { view: 'parking-edit', label: 'Parkplatz bearbeiten', current: true },
    ])
    expect(breadcrumbsFor('selector', CTX)).toEqual([{ view: 'selector', label: 'Spot Manager', current: true }])
  })

  it('embed tokens sit beside the spots, not under a spot', () => {
    expect(breadcrumbsFor('embed-edit', CTX).map(c => c.label)).toEqual(['Spot Manager', 'Embed-Tokens', 'Token erstellen'])
  })

  it('segment editor backs out to the spot, not to the upload step', () => {
    const n = nav('segment-editor')
    n.stepBack()
    expect(n.current()).toBe('list')
  })

  it('back arrow walks the same path the breadcrumbs show', () => {
    for (const v of Object.keys(VIEW_TREE) as View[]) {
      const n = nav(v)
      const walked: View[] = [v]
      while (n.current() !== 'selector') { n.stepBack(); walked.unshift(n.current()) }
      expect(walked).toEqual(breadcrumbsFor(v, CTX).map(c => c.view))
    }
  })

  it('stepBack runs the left view’s cleanup, then the parent’s reenter', () => {
    const calls: string[] = []
    const n = nav('parking-edit', {
      cleanup: { 'parking-edit': () => calls.push('cleanup parking-edit') },
      reenter: { 'parking-list': () => calls.push('reload parking-list') },
    })
    n.stepBack()
    expect(n.current()).toBe('parking-list')
    expect(calls).toEqual(['cleanup parking-edit', 'reload parking-list'])
  })

  it('breadcrumb jump runs every level’s cleanup on the way up', () => {
    const leaveList = vi.fn()
    const leaveImport = vi.fn()
    const n = nav('import', { cleanup: { list: leaveList, import: leaveImport } })
    n.goTo('selector')
    expect(n.current()).toBe('selector')
    expect(leaveImport).toHaveBeenCalledOnce()
    expect(leaveList).toHaveBeenCalledOnce()
  })

  it('goTo ignores a target that is not an ancestor', () => {
    const n = nav('import')
    n.goTo('embed-list')
    expect(n.current()).toBe('import')
  })

  it('stepBack at the root does nothing', () => {
    const n = nav('selector')
    n.stepBack()
    expect(n.current()).toBe('selector')
  })
})
