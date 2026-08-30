<template>
  <section id="beschreibung" class="content-section card spot-detail-description">
    <h2>Beschreibung</h2>

    <!-- Spotcheck badge -->
    <div v-if="trail?.spotcheck && trail.spotcheck.trim() !== ''" class="popup-section">
      <a :href="trail.spotcheck" target="_blank" class="spotcheck-badge">
        <i class="fa-solid fa-circle-check"></i> Trailradar Spotcheck
      </a>
    </div>

    <!-- Dirtpark badges -->
    <div v-if="trail && isDirtPark(trail)" class="popup-section">
      <div class="multi-select">
        <label class="multi-option">
          <input type="checkbox" :checked="trail.pumptrack" disabled />
          <span class="multi-btn">{{ trail.pumptrack ? '✅' : '❌' }} Pumptrack</span>
        </label>
        <label class="multi-option">
          <input type="checkbox" :checked="trail.dirtpark" disabled />
          <span class="multi-btn">{{ trail.dirtpark ? '✅' : '❌' }} Dirtpark</span>
        </label>
      </div>
    </div>

    <!-- Opening hours -->
    <div v-if="details.opening_hours" class="spot-detail-block">
      <h4>⏰ Öffnungszeiten / Fahrverbote</h4>
      <p>{{ details.opening_hours }}</p>
    </div>

    <!-- General description -->
    <div v-if="details.trail_description && details.trail_description.length > 0" class="spot-detail-block">
      <h4>📜 Allgemeine Infos</h4>
      <p>{{ details.trail_description }}</p>
    </div>

    <!-- Feedback -->
    <div class="popup-feedback">
      <span class="feedback-label">Sind diese Infos hilfreich?</span>
      <div class="feedback-actions">
        <div class="feedback-buttons">
          <button ref="upBtn" class="thumb-btn up" title="Ja, hilfreich" @click="onUpvote">
            <i class="fa-solid fa-thumbs-up"></i>
          </button>
          <button ref="downBtn" class="thumb-btn down" title="Nein" @click="onDownvote">
            <i class="fa-solid fa-thumbs-down"></i>
          </button>
        </div>
        <button class="report-error-link" title="Fehler melden" @click="onReportError">
          <i class="fa-solid fa-flag"></i> Fehler melden
        </button>
      </div>
    </div>
    <p class="popup-feedback-date">Zuletzt aktualisiert: {{ formatDate(details.last_update) }} - generiert mit KI</p>
  </section>
</template>

<script setup lang="ts">
import '~/map/detail_popup/details_popup.css'
import { upVote, downVote } from '~/utils/feedback'
import { showToast } from '~/utils/toast'
import { formatDate } from '~/utils/formatDate'
import { isDirtPark, type Trail } from '~/types/Trail'
import type { TrailDetails } from '~/types/TrailDetails'

// General trail info (opening hours, description, spotcheck/dirtpark
// badges) plus the helpfulness-feedback block — the remainder of the
// former monolithic SpotDetailInfo.vue after photos, the status banner, the
// rules list and the video moved out into their own top-level sections.
// Keeps id="beschreibung" since SpotDetailNav's "Info" link and the
// trails-detail-page e2e spec both target it.
const props = defineProps<{ trail: Trail; details: TrailDetails }>()

const mapStore = useMapStore()

const upBtn = ref<HTMLButtonElement | null>(null)
const downBtn = ref<HTMLButtonElement | null>(null)

async function onUpvote() {
  if (!upBtn.value) return
  await upVote(props.trail.id, upBtn.value)
  showToast('Danke für dein Feedback! 🙏', 'success')
}

async function onDownvote() {
  if (!downBtn.value) return
  await downVote(props.trail.id, downBtn.value)
  showToast('Danke für dein Feedback! 🙏', 'success')
}

function onReportError() {
  mapStore.reportModalOpen = true
  mapStore.reportModalTrailId = props.trail.id
  mapStore.reportModalTrailName = props.trail.name
}
</script>

<style scoped>
.spot-detail-block {
  margin: 1.2em 0;
}
.spot-detail-block h4 {
  font-size: 0.85em;
  color: #1a2035;
  margin: 0 0 0.4em;
}
.spot-detail-block p {
  color: #4a5568;
  font-size: 0.9em;
  line-height: 1.7;
  margin: 0 0 0.4em;
}

.popup-feedback {
  margin-top: 1.4em;
  padding-top: 1em;
  border-top: 1px solid #e4e9f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6em;
}
.feedback-label {
  font-size: 0.85em;
  color: #4a5568;
}
.feedback-actions {
  display: flex;
  align-items: center;
  gap: 0.8em;
}
.feedback-buttons {
  display: flex;
  gap: 0.3em;
}
.thumb-btn {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e4e9f0;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  color: #4a5568;
  transition: background 0.15s, color 0.15s;
}
.thumb-btn:hover { background: #f0faf5; }
.thumb-btn.selected { background: #2a9d5c; color: #fff; border-color: #2a9d5c; }
.report-error-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  min-height: 44px;
  background: none;
  border: none;
  color: #8a96a8;
  font-size: 0.82em;
  cursor: pointer;
}
.report-error-link:hover { color: #c53030; }
.popup-feedback-date {
  margin-top: 0.8em;
  font-size: 0.75em;
  color: #a0aec0;
}
</style>
