// GPX bulk import: files → pending cards (previewed on the map) → uploaded trails.
// Pure TS; the caller passes a ref-like holder so its template stays reactive.
import { DIFF_COLOR, processGpx, rewriteGpxHeader, type ProcessedGpx } from './GpxProcessor'
import { uploadGpx, upsertTrail, type GpxTrailRow } from './Api'
import type { MapViewLike } from './MapView'
import type { ImbaColor } from '../types/MtbTypes'

export interface PendingImport {
  key: string
  filename: string
  processed: ProcessedGpx
  name: string
  difficulty: ImbaColor
  direction: string
}

interface Box<T> { value: T }

export interface ImportQueueDeps {
  pending: Box<PendingImport[]>
  map: () => MapViewLike | null
  getToken: () => Promise<string>
}

const baseName = (filename: string) => filename.replace(/\.gpx$/i, '')

export function createImportQueue({ pending, map, getToken }: ImportQueueDeps) {
  function clear() {
    pending.value.forEach(p => map()?.removeLayer(p.key))
    pending.value = []
  }

  async function addFiles(files: Array<Pick<File, 'name' | 'text'>>) {
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.gpx')) continue
      const processed = await processGpx(await file.text(), await getToken())
      if (!processed) continue
      const key = `pending-${crypto.randomUUID()}`
      pending.value.push({
        key, filename: file.name, processed,
        name: processed.suggestedName || baseName(file.name),
        difficulty: 'blue',
        direction: 'one-way-down',
      })
      map()?.addPendingPolyline(key, processed.gpxPoints, DIFF_COLOR['blue'])
    }
    if (pending.value.length > 0) map()?.fitAll()
  }

  function recolor(i: number) {
    const p = pending.value[i]
    if (p) map()?.updatePendingColor(p.key, DIFF_COLOR[p.difficulty])
  }

  function remove(i: number) {
    const p = pending.value[i]
    if (!p) return
    map()?.removeLayer(p.key)
    pending.value.splice(i, 1)
  }

  /** Uploads every pending card as a new trail of `spotId`, appended to `trails`. Returns per-card errors. */
  async function upload(spotId: string, trails: Box<GpxTrailRow[]>): Promise<string[]> {
    const errors: string[] = []
    const jwt = await getToken()
    for (const p of pending.value) {
      try {
        const name = p.name.trim() || baseName(p.filename)
        const gpx_url = await uploadGpx(spotId, 'trails', `${name}.gpx`, rewriteGpxHeader(p.processed.gpxContent, name), jwt)
        const newTrail = await upsertTrail({ spot_id: spotId, name, difficulty: p.difficulty, direction: p.direction,
          distance_km: p.processed.distance_km, elevation_gain: p.processed.elevation_gain,
          elevation_loss: p.processed.elevation_loss, gpx_points: p.processed.gpxPoints, gpx_url,
          sort_order: trails.value.length }, jwt)
        trails.value.push(newTrail)
        map()?.removeLayer(p.key)
        map()?.addTrailPolyline(newTrail)
      } catch (e: any) {
        errors.push(`${p.name}: ${e.message}`)
      }
    }
    pending.value = []
    return errors
  }

  return { clear, addFiles, recolor, remove, upload }
}
