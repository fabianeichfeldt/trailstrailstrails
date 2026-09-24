<template>
  <div class="search-wrapper" :class="`search-wrapper--${variant}`">
    <div class="search-input-row">
      <span class="search-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
      <input
        ref="inputEl"
        v-model="query"
        data-testid="search-input"
        type="search"
        class="search_input"
        placeholder="Trails, Parks, Orte …"
        @focus="onFocus"
        @input="onInput"
        @keydown="onKeydown"
      />
      <button v-if="query" data-testid="search-clear" class="search-clear" @click="clear">✕</button>
    </div>

    <div v-if="results.length || noResults" data-testid="search-results" class="search-results visible">
      <template v-for="group in results" :key="group.label">
        <div class="search-result-separator">{{ group.label }}</div>
        <div
          v-for="item in group.items"
          :key="item.key"
          class="search-result-item"
          :class="{ highlighted: highlightedItem?.key === item.key }"
          @click="select(item)"
          @mouseenter="highlight(item)"
        >
          <span class="search-result-icon">{{ item.icon }}</span>
          <div class="search-result-text">
            <div class="search-result-name">{{ item.name }}</div>
            <div class="search-result-sub">{{ item.sub }}</div>
          </div>
        </div>
      </template>
      <div v-if="noResults" class="search-result-item">
        <div class="search-result-text">
          <div class="search-result-name" style="color:#aaa">Keine Ergebnisse</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSpotSearch, type SpotSearchItem } from '~/composables/useSpotSearch'

// Presentational only. All search behaviour lives in useSpotSearch(); where a
// picked result takes the user is the host's business (map.vue drives the
// Leaflet camera, MapTeaser.vue routes to /map) — hence emit-only.
withDefaults(defineProps<{
  /**
   * Positioning only. 'map' floats the bar over the Leaflet canvas, 'teaser'
   * pins it to the top center of the landing page's map teaser. Everything
   * else — the input row and the whole results dropdown — is shared, which is
   * what keeps the two optically identical.
   */
  variant?: 'map' | 'teaser'
}>(), { variant: 'map' })

const emit = defineEmits<{
  openTrail: [id: string]
  flyTo: [lat: number, lon: number]
}>()

const {
  query, results, noResults, highlightedItem,
  onInput, onFocus, highlight, highlightNext, highlightPrev, clear, clearResults,
} = useSpotSearch()

const inputEl = ref<HTMLInputElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { clear(); return }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightNext()
    scrollSelected()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightPrev()
    scrollSelected()
  } else if (e.key === 'Enter' && highlightedItem.value) {
    e.preventDefault()
    select(highlightedItem.value)
  }
}

function scrollSelected() {
  nextTick(() => {
    const el = document.querySelector('.search-result-item.highlighted') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function select(item: SpotSearchItem) {
  if (item.trailId) emit('openTrail', item.trailId)
  else if (item.lat !== undefined) emit('flyTo', item.lat, item.lon!)
  clear()
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as Element | null
  if (target?.closest?.('.search-wrapper')) return
  // On mobile the bar is the whole top chrome, so tapping away should reset it
  // completely; on desktop only the dropdown is dismissed.
  if (window.matchMedia('(max-width: 600px)').matches) clear()
  else clearResults()
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<style scoped>
.search-wrapper {
  position: absolute;
}

/* ── Variant: floating over the map canvas ── */
.search-wrapper--map {
  top: calc(12px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  width: min(380px, calc(100vw - 100px));
}

/* ── Variant: pinned to the landing page's map teaser ──
   Measured against .map-teaser-wrap, and above .map-cta-overlay (z-index 3)
   so the dropdown stays clickable. */
.search-wrapper--teaser {
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  width: min(380px, calc(100% - 28px));
}

.search-input-row {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  overflow: hidden;
}

.search-icon { padding: 0 10px 0 13px; color: #888; font-size: 15px; pointer-events: none; }

.search_input {
  border: none;
  outline: none;
  padding: 10px 4px;
  font-size: 15px;
  flex: 1;
  background: transparent;
  color: #222;
  min-width: 0;
}

.search_input::placeholder { color: #aaa; }
.search_input::-webkit-search-cancel-button { display: none; }

.search-clear {
  background: none; border: none; color: #aaa;
  font-size: 18px; cursor: pointer; padding: 0 12px; line-height: 1;
}

.search-results {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  margin-top: 6px;
  overflow: hidden;
}

.search-result-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer;
  border-bottom: 1px solid #f0f0f0; transition: background 0.12s;
}
.search-result-item:last-child { border-bottom: none; }
.search-result-item:hover { background: #f5f9ff; }
.search-result-item.highlighted { background: #e8f2ff; }

.search-result-icon { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
.search-result-text { flex: 1; min-width: 0; }
.search-result-name { font-size: 14px; font-weight: 600; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-result-sub { font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.search-result-separator {
  font-size: 10px; font-weight: 700; color: #aaa; text-transform: uppercase;
  letter-spacing: 0.06em; padding: 6px 14px 4px; background: #f8f8f8;
}

@media (max-width: 600px) {
  /* Appearance — shared by both variants. A 44px row is the touch target, and
     14px type keeps the teaser bar identical to the map's. */
  .search-input-row {
    border-radius: 8px;
    height: 44px;
  }

  .search_input {
    font-size: 14px;
  }

  .search-results {
    border-radius: 8px;
  }

  /* Positioning — map only: the inline bar sits in the dark mobile top bar,
     squeezed between the burger and the avatar. */
  .search-wrapper--map {
    top: calc(9px + env(safe-area-inset-top));
    left: 64px;   /* 12px margin + 44px burger + 8px gap */
    right: 60px;  /* 44px avatar + 8px gap + 8px margin */
    transform: none;
    width: auto;
    z-index: 1100;
  }

  .search-wrapper--map .search-results {
    left: 0; right: 0;
    /* Expand to full width so results are readable */
    margin-left: -52px;
    margin-right: 0;
    width: auto;
  }
}
</style>
