import { hoistSeoTags } from '../utils/hoistSeoTags'

// See server/utils/hoistSeoTags.ts for why this exists. render:html fires
// for every prerendered page during `nuxt generate`, so the reordered head
// is baked into the static output.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.head = hoistSeoTags(html.head)
  })
})
