<template>
  <section v-if="statusMeta" class="spot-detail-status content-section">
    <div class="spot-status-banner" :class="statusMeta.cls">
      <div class="ssb-info">
        <span class="ssb-dot"></span>
        <div class="ssb-labels">
          <strong>{{ statusMeta.label }}</strong>
          <span v-if="statusHint" class="ssb-hint">{{ statusHint }}</span>
        </div>
      </div>
      <div v-if="accessBadge" class="ssb-row">
        <span v-if="accessBadge.kind === 'paid'" class="ssb-access ssb-access-paid"><i class="fas fa-coins"></i> {{ accessBadge.label }}</span>
        <span v-else-if="accessBadge.kind === 'membership'" class="ssb-access ssb-access-membership"><i class="fas fa-id-card"></i> {{ accessBadge.label }}</span>
        <a v-else class="ssb-donate-cta" :href="accessBadge.url" target="_blank" rel="noopener noreferrer"><i class="fas fa-heart"></i> Kostenlos · Spenden willkommen</a>
      </div>
      <div v-if="rainHint" class="ssb-row ssb-row-rain">
        <span class="ssb-rain">
          <i class="fas fa-cloud-rain"></i> {{ rainHint }}
          <!-- Visually separated from the rule itself: the rule is the
               trailcrew's statement, this part is our arithmetic. -->
          <span v-if="rainRuleStatus" class="ssb-rain-calc" data-testid="rain-rule-status">
            {{ rainRuleStatus }}
          </span>
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TrailDetails } from '~/types/TrailDetails'
import type { TrailConditionResponse } from '~/types/Weather'
import {
  computeEffectiveStatus,
  STATUS_META,
  ACCESS_META,
} from '~/utils/spotStatusBanner'

// The trail's open/closed/limited state, shown directly under the headline
// (SpotDetailHero) rather than buried inside the description card — split
// out of the former monolithic SpotDetailInfo.vue as its own section so the
// page can place Photos/Touren/Trails/Map between it and the description.
const props = defineProps<{ details: TrailDetails; condition?: TrailConditionResponse | null }>()

const effectiveStatus = computed(() => (props.details?.status ? computeEffectiveStatus(props.details) : null))
const statusMeta = computed(() => (effectiveStatus.value ? STATUS_META[effectiveStatus.value.status] : null))
const isClosedOrLimited = computed(() => effectiveStatus.value?.status === 'closed' || effectiveStatus.value?.status === 'limited')

const statusHint = computed(() => {
  if (!isClosedOrLimited.value || !effectiveStatus.value || !props.details) return ''
  let hint = effectiveStatus.value.reason || props.details.status_hint || ''
  if (!hint && props.details.status_until) {
    const d = new Date(props.details.status_until)
    hint = `Gesperrt bis ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }
  return hint
})

const accessBadge = computed(() => {
  if (!props.details) return null
  const accessType = props.details.access_type
  if (accessType === 'paid') return { kind: 'paid' as const, label: ACCESS_META.paid.label }
  if (accessType === 'membership') return { kind: 'membership' as const, label: ACCESS_META.membership.label }
  if (props.details.donation_url) return { kind: 'donate' as const, url: props.details.donation_url }
  return null
})

const rainHint = computed(() => {
  if (!props.details || effectiveStatus.value?.status === 'closed') return ''
  if (props.details.rain_policy === 'during') return 'Geschlossen bei Regen'
  if (props.details.rain_policy === 'after') return `Geschlossen ${props.details.rain_closed_hours ?? 24}h nach Regen`
  return ''
})

/**
 * Answers the rain rule instead of only stating it: "gesperrt 24h nach Regen"
 * is useless on its own, "letzter Regen vor 31 h" finishes the sentence. The
 * numbers come from the view-model's `rainRule`, computed server-side from the
 * same data as the verdict, so banner and card cannot disagree.
 *
 * Strictly advisory — this never touches `effectiveStatus` or the banner's
 * colour. The official open/closed state belongs to the trailcrew, who carry
 * real-world accountability for it; a weather model does not get to overrule
 * them. All this does is apply the rule they themselves recorded.
 */
const rainRuleStatus = computed(() => {
  if (!rainHint.value || !props.condition) return ''

  if (props.details.rain_policy === 'during') {
    return props.condition.rainRule.raining
      ? 'es regnet gerade'
      : 'aktuell kein Regen'
  }

  if (props.details.rain_policy === 'after') {
    const hours = props.condition.rainRule.hoursSinceRain
    if (hours === null) return 'seit Tagen kein Regen'
    const closedFor = props.details.rain_closed_hours ?? 24
    return hours < closedFor
      ? `Regen vor ${hours} h — Regel greift`
      : `letzter Regen vor ${hours} h`
  }

  return ''
})
</script>

<style scoped>
.spot-detail-status {
  margin-top: -0.4em;
}

/* Pill, so the calculated half reads as an annotation on the trailcrew's
   rule rather than as part of the rule itself. */
.ssb-rain-calc {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: #e6f0fa;
  color: #2b6cb0;
  font-weight: 700;
  font-size: 10px;
  white-space: nowrap;
}
</style>
