import experimentsConfig from '~/analytics/experiments.json'
import { activeExperiment, assignVariant, variantTag, type Assignment } from '~/analytics/experiments'
import { injectUmamiScript } from '~/analytics/umami'

export default defineNuxtPlugin(() => {
  const websiteId = useRuntimeConfig().public.umamiWebsiteId as string
  if (!websiteId) return

  const assignment = assignVariant(activeExperiment(experimentsConfig))
  useState<Assignment | null>('experimentAssignment').value = assignment
  injectUmamiScript(document, websiteId, variantTag(assignment))
})
