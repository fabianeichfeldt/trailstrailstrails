<template>
  <section v-if="loading" class="content-section spot-detail-weather">
    <div class="section-label">Trail-Zustand</div>
    <div class="card wx wx-skeleton" data-testid="weather-skeleton">
      <div class="wx-top">
        <div class="wx-badge sk" />
        <div class="wx-verdict">
          <div class="sk sk-line sk-line-head" />
          <div class="sk sk-line sk-line-body" />
        </div>
      </div>
    </div>
  </section>

  <section v-else-if="condition.level !== 'unknown'" class="content-section spot-detail-weather">
    <div class="section-label">Trail-Zustand</div>

    <div class="card wx" :class="style.cls" data-testid="weather-card">
      <div class="wx-top">
        <div class="wx-badge">{{ badge }}</div>
        <div class="wx-verdict">
          <strong>{{ condition.headline }}</strong>
          <span>{{ condition.detail }}</span>
        </div>
        <div class="wx-now">
          <div class="wx-now-icon">{{ currentIcon }}</div>
          <div class="wx-now-temp">{{ Math.round(weather!.current.temperature) }}°</div>
          <div class="wx-now-meta">
            gefühlt {{ Math.round(weather!.current.apparentTemperature) }}° ·
            {{ Math.round(weather!.current.windKmh) }} km/h
          </div>
        </div>
      </div>

      <div v-if="showStrip" class="wx-strip">
        <div
          v-for="day in strip"
          :key="day.date"
          class="wx-day"
          :class="{ today: day.isToday }"
        >
          <div class="wx-day-label">{{ day.label }}</div>
          <div class="wx-day-icon">{{ day.icon }}</div>
          <div class="wx-bar-track">
            <div class="wx-bar" :class="day.barClass" :style="{ height: `${day.barHeight}px` }" />
          </div>
          <div class="wx-day-mm">{{ day.mm }}</div>
        </div>
      </div>

      <div v-if="condition.level === 'wet'" class="wx-care">
        <span class="wx-care-icon" aria-hidden="true">🌱</span>
        <span>
          <b>Trails schonen:</b> Bei diesem Zustand hinterlässt jede Fahrt Rillen, die die
          Trailcrew von Hand reparieren muss. Lieber auf Schotter ausweichen oder zwei Tage warten.
        </span>
      </div>

      <div class="wx-foot">
        <span>{{ footNote }}</span>
        <span>
          Wetter:
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Trail } from '~/types/Trail'
import type { SpotWeather, ConditionLevel } from '~/types/Weather'
import { computeTrailCondition, conditionModeFor } from '~/utils/trailCondition'
import { weatherCodeIcon } from '~/utils/weatherCodes'

// Weather arrives as a prop rather than being fetched here: the status banner
// needs the same payload, and one page-level fetch beats two components
// racing for the same cache entry. See app/composables/useSpotWeather.ts for
// why the fetch has to stay client-only.
const props = defineProps<{
  trail: Trail
  weather: SpotWeather | null
  loading?: boolean
}>()

const condition = computed(() =>
  computeTrailCondition(props.weather, conditionModeFor(props.trail)),
)

const LEVEL_STYLE: Record<ConditionLevel, { cls: string; badge: string }> = {
  dusty:   { cls: 'v-dust',  badge: '🏜️' },
  prime:   { cls: 'v-prime', badge: '🤙' },
  damp:    { cls: 'v-damp',  badge: '💧' },
  wet:     { cls: 'v-wet',   badge: '🛑' },
  raining: { cls: 'v-damp',  badge: '☔' },
  snow:    { cls: 'v-snow',  badge: '❄️' },
  // A sealed surface gets no verdict colour — the badge just mirrors the sky.
  hard:    { cls: 'v-plain', badge: '' },
  unknown: { cls: '',        badge: '' },
}

const style = computed(() => LEVEL_STYLE[condition.value.level])
const currentIcon = computed(() => weatherCodeIcon(props.weather?.current.weatherCode))
const badge = computed(() => style.value.badge || currentIcon.value)

// The evidence strip only backs up a soil verdict. When it is raining, snowing
// or the surface is asphalt, the headline does not rest on the last five days,
// so showing them would be decoration rather than evidence.
const BALANCE_LEVELS: ConditionLevel[] = ['dusty', 'prime', 'damp', 'wet']
const showStrip = computed(() => BALANCE_LEVELS.includes(condition.value.level))

const footNote = computed(() =>
  condition.value.level === 'hard'
    ? ''
    : 'Berechnet aus Niederschlag & Verdunstung · keine Trailcrew-Angabe',
)

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/** Square-root scale: without it 0,8 mm next to 13,4 mm is an invisible sliver. */
function barHeight(mm: number): number {
  if (mm <= 0) return 3
  return Math.max(4, Math.min(44, Math.round(Math.sqrt(Math.min(mm, 14) / 14) * 44)))
}

function barClass(mm: number): string {
  if (mm < 0.2) return ''
  if (mm < 2) return 'w1'
  if (mm < 8) return 'w2'
  return 'w3'
}

function formatMm(mm: number): string {
  if (mm < 0.05) return '0 mm'
  const rounded = mm.toFixed(1)
  return (rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded).replace('.', ',')
}

const strip = computed(() => {
  const days = props.weather?.days ?? []
  return days.map((day, i) => {
    const isToday = i === days.length - 1
    // Parsed at noon UTC so the weekday can't slip a day on either side of
    // the date line.
    const weekday = WEEKDAYS[new Date(`${day.date}T12:00:00Z`).getUTCDay()] ?? ''
    return {
      date: day.date,
      isToday,
      label: isToday ? 'Heute' : weekday,
      icon: weatherCodeIcon(day.weatherCode),
      mm: formatMm(day.precipitationMm),
      barHeight: barHeight(day.precipitationMm),
      barClass: barClass(day.precipitationMm),
    }
  })
})
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

.wx-now {
  flex: 0 0 auto;
  text-align: right;
  padding-left: 10px;
  border-left: 1px solid #e4e9f0;
}
.wx-now-icon { font-size: 17px; }
.wx-now-temp { font-size: 19px; font-weight: 700; line-height: 1; }
.wx-now-meta { font-size: 11px; color: #4a5568; margin-top: 3px; white-space: nowrap; }

/* ── Evidence strip ── */
.wx-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #e4e9f0;
}

.wx-day { text-align: center; position: relative; }
.wx-day-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #8a96a8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.wx-day-icon { font-size: 14px; margin: 3px 0 4px; line-height: 1; }

.wx-bar-track {
  height: 44px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.wx-bar {
  width: 16px;
  border-radius: 4px 4px 2px 2px;
  background: #cfd8e3;
}
.wx-bar.w1 { background: #90cdf4; }
.wx-bar.w2 { background: #4299e1; }
.wx-bar.w3 { background: #2b6cb0; }

.wx-day-mm {
  font-size: 10.5px;
  color: #4a5568;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}

/* Today is marked by label colour and an accent rule, deliberately not by a
   background box — a box changes the column's height and shifts the bar
   baseline out of line with the other five. */
.wx-day.today .wx-day-label,
.wx-day.today .wx-day-mm { color: #1a2035; font-weight: 700; }
.wx-day.today::after {
  content: "";
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: -4px;
  height: 2px;
  border-radius: 2px;
  background: #1a2035;
}

/* ── Trail-care nudge ── */
.wx-care {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  margin-top: 12px;
  padding: 8px 10px;
  background: #fff1f1;
  border: 1px solid #fed7d7;
  border-radius: 9px;
  font-size: 11.5px;
  color: #822727;
  line-height: 1.45;
}
.wx-care-icon { font-size: 14px; line-height: 1; }

.wx-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 10.5px;
  color: #9aa5b4;
}
.wx-foot a { color: #9aa5b4; text-decoration: underline; }

/* ── Verdict variants ── */
.v-dust  .wx-badge { background: #fefcbf; }
.v-dust  .wx-verdict strong { color: #744210; }
.v-prime { border-color: #bbf7d0; }
.v-prime .wx-badge { background: #f0faf5; }
.v-prime .wx-verdict strong { color: #276749; }
.v-damp  .wx-badge { background: #ebf4ff; }
.v-damp  .wx-verdict strong { color: #1a365d; }
.v-snow  .wx-badge { background: #eef4fb; }
.v-snow  .wx-verdict strong { color: #1a365d; }
.v-wet   { border-color: #fed7d7; }
.v-wet   .wx-badge { background: #fff1f1; }
.v-wet   .wx-verdict strong { color: #822727; }

/* ── Skeleton (what SSR renders; the real value arrives on the client) ── */
.sk {
  background: linear-gradient(90deg, #eef1f5 25%, #e4e9f0 37%, #eef1f5 63%);
  border-radius: 6px;
}
.sk-line { height: 12px; }
.sk-line-head { width: 38%; margin-top: 4px; }
.sk-line-body { width: 80%; margin-top: 9px; }

/* ── Mobile ── */
@media (max-width: 599px) {
  .wx-top { flex-direction: column; gap: 10px; }
  .wx-badge-row { display: flex; gap: 11px; align-items: flex-start; width: 100%; }
  .wx-verdict strong { font-size: 16px; }

  /* Current conditions drop below the verdict and become a full-width strip,
     so the six evidence columns keep the entire card width at 360px. */
  .wx-now {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    padding: 7px 10px;
    border-left: none;
    background: #f7f9fc;
    border-radius: 9px;
  }
  .wx-now-temp { font-size: 15px; }
  .wx-now-meta { white-space: normal; margin-top: 0; }
  .wx-bar { width: 13px; }
  .wx-day-mm { font-size: 10px; }
}
</style>
