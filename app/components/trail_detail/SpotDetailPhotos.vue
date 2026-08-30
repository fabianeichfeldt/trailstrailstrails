<template>
  <section class="content-section spot-detail-photos">
    <div v-if="details.photos.length === 0" class="photo-container no-photos-visual">
      <img src="/assets/hero-mobile.webp" alt="" class="no-photos-bg" />
      <div class="no-photos-overlay">
        <p class="no-photos-text"><strong>Leider gibt es noch keine Fotos zu diesem Spot.</strong><br>Sei der Erste und lade ein Foto hoch.</p>
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
  </section>
</template>

<script setup lang="ts">
import '~/css/photo_caroussel.css'
import '~/map/detail_popup/details_popup.css'
import { showToast } from '~/utils/toast'
import { bindPhotoLightbox } from '~/map/lightbox'
import type { Trail } from '~/types/Trail'
import type { TrailDetails } from '~/types/TrailDetails'

// Split out of the former monolithic SpotDetailInfo.vue: photos are now
// their own top-level page section, positioned right under the hero/status
// (before Touren/Trails/Map), per the drastic-redesign request. When there
// are no photos yet, shows a desaturated sample image with an overlay CTA
// instead of a bare icon — keeps the section from looking empty/broken and
// nudges the first upload.
const props = defineProps<{ trail: Trail; details: TrailDetails }>()
const emit = defineEmits<{ uploaded: [] }>()

const authStore = useAuthStore()
const mapStore = useMapStore()

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
  if (props.details.photos.length < 2) return
  carouselTimer = setInterval(() => {
    activePhoto.value = (activePhoto.value + 1) % props.details.photos.length
  }, 4000)
}

async function initPhotoUi(photos: TrailDetails['photos']) {
  startCarousel()
  if (!photos || photos.length === 0) return
  await nextTick()
  if (photosContainer.value) bindPhotoLightbox(photosContainer.value)
}

// onMounted (not an immediate watcher) so this never runs during SSR —
// setInterval/DOM binding would throw there. Runs once on first client
// paint so the baked-in photos already get a working carousel/lightbox
// immediately, without waiting for refreshDetails() to resolve.
onMounted(() => initPhotoUi(props.details.photos))

watch(() => props.details.photos, async (photos) => {
  activePhoto.value = 0
  await initPhotoUi(photos)
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
  if (!file) return

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
    await authStore.uploadTrailPhoto(file, props.trail.id)
    showToast('✅ Upload erfolgreich!')
    emit('uploaded')
  } catch (err) {
    console.error(err)
    alert('Upload fehlgeschlagen 😢')
  }
}
</script>

<style scoped>
.spot-detail-photos {
  margin-left: -1em;
  margin-right: -1em;
}

.no-photos-visual {
  background: #111;
}

.no-photos-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1) brightness(0.55);
}

.no-photos-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1em;
  padding: 2em;
  text-align: center;
  background: linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.6));
}

.no-photos-text {
  color: #fff;
  font-size: 0.95em;
  line-height: 1.5;
  margin: 0;
  text-shadow: 0 1px 6px rgba(0,0,0,0.5);
}

@media (min-width: 600px) {
  .spot-detail-photos {
    margin-left: 0;
    margin-right: 0;
  }
  .photo-container {
    border-radius: 14px;
  }
}
</style>
