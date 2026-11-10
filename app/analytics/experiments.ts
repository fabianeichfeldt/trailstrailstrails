export interface Experiment {
  id: string
  variants: string[]
}
export interface ExperimentsConfig {
  active: string | null
  experiments: Experiment[]
}
export interface Assignment {
  experimentId: string
  variant: string
}

export function activeExperiment(config: ExperimentsConfig): Experiment | null {
  if (!config.active) return null
  return config.experiments.find(e => e.id === config.active) ?? null
}

/** Uniform pick, in memory only — never persisted (consent-free, § 25 TDDDG). */
export function assignVariant(experiment: Experiment | null, random: () => number = Math.random): Assignment | null {
  if (!experiment || !experiment.variants.length) return null
  const i = Math.min(Math.floor(random() * experiment.variants.length), experiment.variants.length - 1)
  return { experimentId: experiment.id, variant: experiment.variants[i]! }
}

export function variantTag(assignment: Assignment | null): string | null {
  return assignment ? `${assignment.experimentId}:${assignment.variant}` : null
}
