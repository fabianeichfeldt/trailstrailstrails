import experimentsConfig from '~/analytics/experiments.json'
import { activeExperiment, assignVariant, variantTag, type Assignment } from '~/analytics/experiments'
import { injectUmamiScript } from '~/analytics/umami'
import { markRouteChange } from '~/analytics/spotView'
import { startHeartbeat } from '~/analytics/heartbeat'
import { track } from '~/analytics/track'

export default defineNuxtPlugin(() => {
  const websiteId = useRuntimeConfig().public.umamiWebsiteId as string
  if (!websiteId) return
  // /embed/* runs in an iframe (region page, third-party sites): the host page already counts the visit.
  if (window.location.pathname.startsWith('/embed/')) return

  const assignment = assignVariant(activeExperiment(experimentsConfig))
  useState<Assignment | null>('experimentAssignment').value = assignment
  injectUmamiScript(document, websiteId, variantTag(assignment))
  useRouter().afterEach(markRouteChange)
  startHeartbeat(() => track('active'))
})
