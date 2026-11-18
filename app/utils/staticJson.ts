// One in-flight/settled promise per URL per session: spot-to-spot navigation
// must not re-download and re-parse the big build-time JSON files. Failures
// are dropped so the next call retries.
const cache = new Map<string, Promise<unknown>>()

export function fetchStaticJsonOnce<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined
  if (!p) {
    p = $fetch<T>(url)
    cache.set(url, p)
    p.catch(() => { if (cache.get(url) === p) cache.delete(url) })
  }
  return p
}

export function resetStaticJsonCache() {
  cache.clear()
}
