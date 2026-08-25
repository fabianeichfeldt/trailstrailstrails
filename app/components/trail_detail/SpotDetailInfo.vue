<template>
  <section id="beschreibung" class="content-section card spot-detail-info">
    <h2>Beschreibung</h2>

    <template v-if="details">
      <!-- Status banner -->
      <div v-if="statusMeta" class="spot-status-banner" :class="statusMeta.cls">
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
        <div v-if="rainHint" class="ssb-row">
          <span class="ssb-rain"><i class="fas fa-cloud-rain"></i> {{ rainHint }}</span>
        </div>
      </div>

      <!-- Photos -->
      <div v-if="details.photos.length === 0" class="no-photos">
        <div class="no-photo-inner">
          <div class="no-photo-icon">📷</div>
          <p><strong>Noch keine Fotos</strong><br>Hilf der Community und lade das erste Foto hoch.</p>
          <button v-if="authStore.isLoggedIn" class="photo-upload-btn" @click="triggerUpload">➕ Foto hochladen</button>
          <span v-else class="photo-login-link" @click="mapStore.authModalOpen = true">Einloggen zum Hochladen</span>
        </div>
      </div>
      <div v-else class="photo-container" ref="photosContainer">
        <div class="photo-carousel">
          <div
            v-for="(p, i) in details.photos"
            :key="p.id"
            class="photo-wrap"
            :class="{ active: i === activePhoto }"
            :style="{ '--img': `url('${p.url}')` }"
          >
            <img alt="offizieller MTB Trail" :src="p.url" :class="{ active: i === activePhoto }" />
            <div class="photo-meta">
              <span class="photo-uploader">von {{ p.profiles?.display_name || '' }}</span>
              <span class="photo-date">{{ formatPhotoDate(p.created_at) }}</span>
            </div>
          </div>
        </div>
        <button v-if="authStore.isLoggedIn" class="photo-fab" title="Foto hinzufügen" @click="triggerUpload">➕</button>
        <div class="carousel-dots">
          <span v-for="(p, i) in details.photos" :key="p.id" class="dot" :class="{ active: i === activePhoto }"></span>
        </div>
      </div>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChosen" />

      <!-- Video -->
      <template v-if="details.videos.length">
        <br />
        <div class="yt-2click">
          <div v-if="!videoLoaded" class="yt-thumb">
            <div class="yt-overlay">
              <p class="yt-text">
                Dieses Video wird von YouTube bereitgestellt.<br />
                Durch das Laden können personenbezogene Daten an Google übermittelt werden.<br />
                <a :href="details.videos[0].creator" class="yt-text"><i class="fa-brands fa-youtube"></i>&nbsp;{{ videoCreatorLabel }}</a>
              </p>
              <button class="yt-load-btn" @click="videoLoaded = true">▶ Video laden</button>
            </div>
          </div>
          <iframe
            v-else
            :src="details.videos[0].url"
            loading="lazy"
            style="aspect-ratio: 16 / 9; width: 100%; border: none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          />
        </div>
      </template>

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

      <!-- Rules -->
      <div v-if="details.rules && details.rules.length > 0" class="spot-detail-block">
        <h4>📜 Nutzungsregeln</h4>
        <p v-for="(r, i) in details.rules" :key="i">{{ r }}</p>
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
    </template>
  </section>
</template>

<script setup lang="ts">
import '~/map/detail_popup/details_popup.css'
import '~/css/photo_caroussel.css'
import '~/map/detail_popup/yt.css'
import { getTrailDetails } from '~/communication/trails'
import { upVote, downVote } from '~/utils/feedback'
import { showToast } from '~/utils/toast'
import { formatDate } from '~/utils/formatDate'
import { bindPhotoLightbox } from '~/map/lightbox'
import { isDirtPark, type Trail } from '~/types/Trail'
import type { TrailDetails } from '~/types/TrailDetails'
import {
  computeEffectiveStatus,
  STATUS_META,
  ACCESS_META,
} from '~/utils/spotStatusBanner'

// Converted from the legacy raw-HTML renderTrailDetails()/bindPopupEvents()
// string-templating pattern (app/map/detail_popup/detailsPopup.ts +
// app/map/detail_popup/logic.ts) into a proper Vue component, as required
// by the spot-detail-real-pages rework. Comments are a separate page
// section (<SpotPanelComments> mounted by the page itself) rather than
// injected into this component's markup — the page triggers
// store.loadComments() directly, this component only owns the like-button
// state (isLiked/likeVisible) alongside the rest of trail_details.
//
// `trail` identifies the spot directly via props rather than reading
// store.currentItem — this component's own live refresh must not depend on
// the page having already called store.load() by the time this mounts:
// Vue mounts bottom-up (a child's onMounted fires *before* its parent's),
// so a store write made in the *page's* onMounted would race this
// component's onMounted if this read the spot identity from the store
// instead of its own prop.
//
// `baked` seeds `details` from the SSG-prerendered payload
// (app/utils/bakedTrailDetails.ts) so description/rules/photos/opening-hours
// render immediately — SEO-safe, no loading flash — per the spec's data
// fetching strategy ("SSG base content ... stays prerendered ... no change
// needed, good for SEO"). onMounted() below then kicks off a live
// getTrailDetails() refresh — onMounted never fires during SSR/prerender
// (see CLAUDE.md's "No live Nitro server in production"), so this is
// inherently client-only with no extra guard needed — for the genuinely
// dynamic bits that aren't in the static payload at all: status_hint
// freshness and likes. A failed refresh is logged and otherwise ignored —
// the baked content already on screen stays visible rather than being
// replaced by an error state.
const props = defineProps<{ trail: Trail; baked: TrailDetails }>()

const store = useSpotPanelStore()
const authStore = useAuthStore()
const mapStore = useMapStore()
const supabaseUser = useSupabaseUser()

const details = ref<TrailDetails>(props.baked)
const trail = computed<Trail>(() => props.trail)

async function currentUser() {
  return {
    id: supabaseUser.value?.id ?? '',
    accessToken: await authStore.getToken(),
  }
}

async function updateLikeButton(d: TrailDetails) {
  try {
    const user = await currentUser()
    store.isLiked = !!user.id && !!d.likes?.find(l => l.user_id === user.id)
  } catch {
    store.isLiked = false
  }
  store.likeVisible = true
}

async function refresh() {
  const item = props.trail
  const id = item.id
  try {
    const d = await getTrailDetails(item)
    if (props.trail.id !== id) return // spot moved on while the fetch was in flight
    await updateLikeButton(d)
    details.value = d
    activePhoto.value = 0
  } catch (e) {
    console.warn('Failed to refresh live trail details, keeping prerendered content:', e)
  }
}

onMounted(() => refresh())

// Client-side navigation to a different spot's page reuses this component
// instance (same route, different param) — reseed from the new baked
// payload and kick off a fresh live refresh for it.
watch(
  () => props.trail.id,
  (id, oldId) => {
    if (!id || id === oldId) return
    details.value = props.baked
    refresh()
  },
)

// ── Status banner ────────────────────────────────────────────────────────
const effectiveStatus = computed(() => (details.value?.status ? computeEffectiveStatus(details.value) : null))
const statusMeta = computed(() => (effectiveStatus.value ? STATUS_META[effectiveStatus.value.status] : null))
const isClosedOrLimited = computed(() => effectiveStatus.value?.status === 'closed' || effectiveStatus.value?.status === 'limited')

const statusHint = computed(() => {
  if (!isClosedOrLimited.value || !effectiveStatus.value || !details.value) return ''
  let hint = effectiveStatus.value.reason || details.value.status_hint || ''
  if (!hint && details.value.status_until) {
    const d = new Date(details.value.status_until)
    hint = `Gesperrt bis ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }
  return hint
})

const accessBadge = computed(() => {
  if (!details.value) return null
  const accessType = details.value.access_type
  if (accessType === 'paid') return { kind: 'paid' as const, label: ACCESS_META.paid.label }
  if (accessType === 'membership') return { kind: 'membership' as const, label: ACCESS_META.membership.label }
  if (details.value.donation_url) return { kind: 'donate' as const, url: details.value.donation_url }
  return null
})

const rainHint = computed(() => {
  if (!details.value || effectiveStatus.value?.status === 'closed') return ''
  if (details.value.rain_policy === 'during') return 'Geschlossen bei Regen'
  if (details.value.rain_policy === 'after') return `Geschlossen ${details.value.rain_closed_hours ?? 24}h nach Regen`
  return ''
})

// ── Photos ────────────────────────────────────────────────────────────────
const activePhoto = ref(0)
const photosContainer = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let carouselTimer: ReturnType<typeof setInterval> | null = null

function formatPhotoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })
}

function stopCarousel() {
  if (carouselTimer) clearInterval(carouselTimer)
  carouselTimer = null
}

function startCarousel() {
  stopCarousel()
  if (!details.value || details.value.photos.length < 2) return
  carouselTimer = setInterval(() => {
    activePhoto.value = (activePhoto.value + 1) % (details.value?.photos.length ?? 1)
  }, 4000)
}

watch(() => details.value?.photos, async (photos) => {
  startCarousel()
  if (!photos || photos.length === 0) return
  await nextTick()
  if (photosContainer.value) bindPhotoLightbox(photosContainer.value)
}, { deep: false })

onUnmounted(() => stopCarousel())

const MAX_FILE_SIZE_MB = 8
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function triggerUpload() {
  fileInput.value?.click()
}

async function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !trail.value) return

  if (!ALLOWED_TYPES.includes(file.type)) {
    alert('Bitte lade nur JPG, PNG oder WebP hoch.')
    return
  }
  const sizeMB = file.size / 1024 / 1024
  if (sizeMB > MAX_FILE_SIZE_MB) {
    alert(`Datei ist zu groß (max ${MAX_FILE_SIZE_MB} MB).`)
    return
  }

  try {
    showToast('📤 Upload läuft...')
    await authStore.uploadTrailPhoto(file, trail.value.id)
    showToast('✅ Upload erfolgreich!')
    await refresh()
  } catch (err) {
    console.error(err)
    alert('Upload fehlgeschlagen 😢')
  }
}

// ── Video ─────────────────────────────────────────────────────────────────
const videoLoaded = ref(false)
watch(() => details.value?.videos, () => { videoLoaded.value = false })
const videoCreatorLabel = computed(() => details.value?.videos[0]?.creator.split('/').pop() ?? '')

// ── Feedback ──────────────────────────────────────────────────────────────
const upBtn = ref<HTMLButtonElement | null>(null)
const downBtn = ref<HTMLButtonElement | null>(null)

async function onUpvote() {
  if (!trail.value || !upBtn.value) return
  await upVote(trail.value.id, upBtn.value)
  showToast('Danke für dein Feedback! 🙏', 'success')
}

async function onDownvote() {
  if (!trail.value || !downBtn.value) return
  await downVote(trail.value.id, downBtn.value)
  showToast('Danke für dein Feedback! 🙏', 'success')
}

function onReportError() {
  if (!trail.value) return
  mapStore.reportModalOpen = true
  mapStore.reportModalTrailId = trail.value.id
  mapStore.reportModalTrailName = trail.value.name
}
</script>

<style scoped>
.spot-detail-info :deep(.spot-status-banner) {
  margin-bottom: 1.2em;
}

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
