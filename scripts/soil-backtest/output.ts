/**
 * Where a backtest run's results go. The point is that a run must never replace
 * an earlier one: the forecast endpoint's 92-day window slides, so summer 2026
 * cannot be reproduced once autumn is in — an overwritten results file would be
 * gone for good. Pure string handling, no I/O.
 */

/**
 * `results_<from>_<to>_<layer>_<UTC timestamp>.json`.
 *
 * The period says what the numbers rest on, the timestamp keeps two runs of the
 * same period apart, and both sort chronologically so a directory listing reads
 * as a history.
 */
export function resultFileName(opts: { from: string; to: string; layer: string; at: Date }): string {
  const stamp = opts.at.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return `results_${opts.from}_${opts.to}_${opts.layer}_${stamp}.json`
}

/**
 * The path itself if it is free; otherwise `name-2.ext`, `name-3.ext`, … — the
 * first one that is. An explicit `--out` pointing at an existing file gets the
 * same treatment, so no way of running the script destroys a result.
 */
export function nonClobberingPath(path: string, exists: (path: string) => boolean): string {
  if (!exists(path)) return path
  const slash = path.lastIndexOf('/')
  const dot = path.lastIndexOf('.')
  const hasExtension = dot > slash + 1
  const base = hasExtension ? path.slice(0, dot) : path
  const extension = hasExtension ? path.slice(dot) : ''
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}${extension}`
    if (!exists(candidate)) return candidate
  }
}
