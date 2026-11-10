export const UMAMI_SCRIPT_SRC = 'https://stats.eichfeldt.de/script.js'

export function injectUmamiScript(doc: Document, websiteId: string, tag: string | null) {
  const s = doc.createElement('script')
  s.defer = true
  s.src = UMAMI_SCRIPT_SRC
  s.setAttribute('data-website-id', websiteId)
  s.setAttribute('data-do-not-track', 'true')
  if (tag) s.setAttribute('data-tag', tag)
  doc.head.appendChild(s)
  return s
}
