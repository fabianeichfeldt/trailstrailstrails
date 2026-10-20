// SpotManager navigation: one tree of views. Going back and the breadcrumbs are
// both derived from it, so they can't disagree about where a view sits.

export type View =
  | 'selector' | 'list' | 'import' | 'edit-trail' | 'edit-tour' | 'details' | 'park-details'
  | 'embed-list' | 'embed-edit' | 'segment-upload' | 'segment-editor' | 'parking-list' | 'parking-edit'

export interface CrumbContext {
  spotName: string
  editingEmbedToken: boolean   // embed-edit: existing token vs. new one
  editingParking: boolean      // parking-edit: existing lot vs. new one
}

interface ViewNode {
  parent: View | null
  label: (c: CrumbContext) => string
}

const fixed = (s: string) => () => s

export const VIEW_TREE: Record<View, ViewNode> = {
  'selector':       { parent: null,           label: fixed('Spot Manager') },
  'embed-list':     { parent: 'selector',     label: fixed('Embed-Tokens') },
  'embed-edit':     { parent: 'embed-list',   label: c => c.editingEmbedToken ? 'Token bearbeiten' : 'Token erstellen' },
  'list':           { parent: 'selector',     label: c => c.spotName },
  'import':         { parent: 'list',         label: fixed('GPX importieren') },
  'edit-trail':     { parent: 'list',         label: fixed('Trail bearbeiten') },
  'edit-tour':      { parent: 'list',         label: fixed('Tour bearbeiten') },
  'details':        { parent: 'list',         label: fixed('Spot-Details') },
  'park-details':   { parent: 'list',         label: fixed('Spot-Details') },
  // The editor is step 2 of the upload, but backing out of either abandons the tour.
  'segment-upload': { parent: 'list',         label: fixed('Tour hochladen') },
  'segment-editor': { parent: 'list',         label: fixed('Segmente definieren') },
  'parking-list':   { parent: 'list',         label: fixed('Parkplätze') },
  'parking-edit':   { parent: 'parking-list', label: c => c.editingParking ? 'Parkplatz bearbeiten' : 'Parkplatz erstellen' },
}

/** Root → `view`, inclusive. */
export function viewPath(view: View): View[] {
  const path: View[] = []
  for (let v: View | null = view; v; v = VIEW_TREE[v].parent) path.unshift(v)
  return path
}

export interface Crumb {
  view: View
  label: string
  current: boolean
}

export function breadcrumbsFor(view: View, ctx: CrumbContext): Crumb[] {
  return viewPath(view).map(v => ({ view: v, label: VIEW_TREE[v].label(ctx), current: v === view }))
}

export interface ViewNavOptions {
  get: () => View
  set: (v: View) => void
  /** Runs when leaving a view upwards (map layers, pending imports, editor state). */
  cleanup?: Partial<Record<View, () => void>>
  /** Runs after arriving at a view by going back (e.g. re-fetch a list). */
  reenter?: Partial<Record<View, () => void>>
}

export function createViewNav({ get, set, cleanup = {}, reenter = {} }: ViewNavOptions) {
  function stepBack() {
    const from = get()
    const to = VIEW_TREE[from].parent
    if (!to) return
    cleanup[from]?.()
    set(to)
    reenter[to]?.()
  }

  // Breadcrumb jump: replays stepBack() so every level's cleanup runs exactly as with the back arrow.
  function goTo(target: View) {
    if (!viewPath(get()).includes(target)) return
    while (get() !== target) stepBack()
  }

  return { stepBack, goTo }
}
