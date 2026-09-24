<template>
  <section class="content-section spot-detail-weather">
    <div class="section-label">{{ FEATURES.trail_condition.label }}</div>

    <div class="card wx wx-locked" data-testid="weather-locked">
      <div class="wx-top">
        <div class="wx-badge" aria-hidden="true">🔒</div>
        <div class="wx-verdict">
          <strong>Bodenprognose für diesen Spot</strong>
          <!-- No purchase button on purpose: there is no billing flow to send
               anyone to yet, and a dead "Upgrade" link is worse than none. -->
          <span>
            Wie fahrbar ist der Boden heute, und wie sieht die kommende Woche aus?
            Die Prognose gehört zu {{ plan }}.
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FEATURES, minPlanName } from '~/entitlements/features'

// Derived from the registry rather than typed here, so moving the feature to
// another tier changes this card with it.
const plan = minPlanName('trail_condition')
</script>

<style scoped>
.spot-detail-weather .card {
  padding: 0.9em 1em 0.75em;
}

.wx-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.wx-badge {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  line-height: 1;
  background: #f2f4f7;
}

.wx-verdict {
  min-width: 0;
  flex: 1;
}
.wx-verdict strong {
  display: block;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.25;
  color: #1a2035;
}
.wx-verdict span {
  display: block;
  font-size: 12.5px;
  color: #4a5568;
  line-height: 1.45;
  margin-top: 3px;
}

/* Quieter than a verdict card: it is an invitation, not a result. */
.wx-locked {
  border-style: dashed;
}
</style>
