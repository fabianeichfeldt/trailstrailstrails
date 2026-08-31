<template>
  <section v-if="details.videos.length" id="video" class="content-section card spot-detail-video">
    <h2>Video</h2>
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
  </section>
</template>

<script setup lang="ts">
import '~/map/detail_popup/yt.css'
import type { TrailDetails } from '~/types/TrailDetails'

// Split out of the former monolithic SpotDetailInfo.vue as its own
// top-level section, placed last on the page per the drastic-redesign order
// ("... then video if available").
const props = defineProps<{ details: TrailDetails }>()

const videoLoaded = ref(false)
watch(() => props.details.videos, () => { videoLoaded.value = false })
const videoCreatorLabel = computed(() => props.details.videos[0]?.creator.split('/').pop() ?? '')
</script>
