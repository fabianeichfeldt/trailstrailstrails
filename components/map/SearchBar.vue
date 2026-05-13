<template>
  <div class="search-wrapper" :class="{ open: isOpen }">
    <div class="search-input-row">
      <span class="search-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
      <input
        ref="inputEl"
        v-model="query"
        type="search"
        class="search_input"
        placeholder="Trails, Parks, Orte …"
        @input="onInput"
        @keydown="onKeydown"
      />
      <button v-if="query" class="search-clear" @click="clear">✕</button>
    </div>

    <div v-if="results.length" class="search-results visible">
      <template v-for="group in results" :key="group.label">
        <div class="search-result-separator">{{ group.label }}</div>
        <div
          v-for="item in group.items"
          :key="item.key"
          class="search-result-item"
          :class="{ highlighted: flatResults[selectedIndex]?.key === item.key }"
          @click="select(item)"
          @mouseenter="selectedIndex = flatResults.findIndex(r => r.key === item.key)"
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

  <!-- Mobile toggle -->
  <button id="search-toggle" class="search-toggle-btn" @click="open" aria-label="Suche öffnen">
    <i class="fa-solid fa-magnifying-glass"></i>
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  openTrail: [id: string]
  flyTo: [lat: number, lon: number]
}>()

const trailsStore = useTrailsStore()

interface ResultItem {
  key: string
  icon: string
  name: string
  sub: string
  trailId?: string
  lat?: number
  lon?: number
}
interface ResultGroup { label: string; items: ResultItem[] }

const query = ref('')
const results = ref<ResultGroup[]>([])
const noResults = ref(false)
const isOpen = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const selectedIndex = ref(-1)
let debounceTimer: ReturnType<typeof setTimeout>
let currentQuery = ''

const flatResults = computed(() => results.value.flatMap(g => g.items))

watch(results, () => { selectedIndex.value = -1 })

const TYPE_ICON: Record<string, string> = { trail: '🚵️', bikepark: '🚵', dirtpark: '🚵' }
const TYPE_LABEL: Record<string, string> = { trail: 'Trail', bikepark: 'Bikepark', dirtpark: 'Dirtpark / Pumptrack' }

function trailScore(name: string, q: string): number {
  const n = name.toLowerCase(); const qq = q.toLowerCase()
  if (n === qq) return 100
  if (n.startsWith(qq)) return 80
  if (n.includes(qq)) return 60
  if (n.split(/\s+/).some(w => w.startsWith(qq))) return 40
  return 0
}

async function searchPlaces(q: string) {
  const base = `https://nominatim.openstreetmap.org/search?format=json&accept-language=de&limit=5&q=${encodeURIComponent(q)}`
  try {
    const dach = await fetch(`${base}&countrycodes=de,at,ch`).then(r => r.ok ? r.json() : [])
    if (dach.length) return dach
    return await fetch(base).then(r => r.ok ? r.json() : [])
  } catch { return [] }
}

async function runSearch(q: string) {
  currentQuery = q
  const all = [...trailsStore.trails, ...trailsStore.bikeparks, ...trailsStore.dirtparks]
  const matched = all
    .map(t => ({ t, score: trailScore(t.name, q) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(x => x.t)

  const groups: ResultGroup[] = []
  if (matched.length) {
    groups.push({
      label: 'Trails & Parks',
      items: matched.map(t => ({
        key: t.id,
        icon: TYPE_ICON[(t as any).type] ?? '📍',
        name: t.name,
        sub: TYPE_LABEL[(t as any).type] ?? '',
        trailId: t.id,
      })),
    })
  }
  results.value = groups
  noResults.value = false

  const places = await searchPlaces(q)
  if (currentQuery !== q) return

  if (places.length) {
    const parts = (d: string) => { const p = d.split(', '); return { name: p[0], sub: p.slice(1, 3).join(', ') } }
    groups.push({
      label: 'Orte & Regionen',
      items: places.map((p: any, i: number) => {
        const { name, sub } = parts(p.display_name)
        return { key: `place-${i}`, icon: '📍', name, sub, lat: parseFloat(p.lat), lon: parseFloat(p.lon) }
      }),
    })
  }
  results.value = [...groups]
  noResults.value = results.value.length === 0
}

function onInput() {
  clearTimeout(debounceTimer)
  if (query.value.length < 2) { results.value = []; noResults.value = false; return }
  debounceTimer = setTimeout(() => runSearch(query.value.trim()), 250)
}

function onKeydown(e: KeyboardEvent) {
  const total = flatResults.value.length
  if (e.key === 'Escape') { close(); return }
  if (!total) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = selectedIndex.value < total - 1 ? selectedIndex.value + 1 : 0
    scrollSelected()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : total - 1
    scrollSelected()
  } else if (e.key === 'Enter' && selectedIndex.value >= 0) {
    e.preventDefault()
    select(flatResults.value[selectedIndex.value])
  }
}

function scrollSelected() {
  nextTick(() => {
    const el = document.querySelector('.search-result-item.highlighted') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function select(item: ResultItem) {
  if (item.trailId) emit('openTrail', item.trailId)
  else if (item.lat !== undefined) emit('flyTo', item.lat!, item.lon!)
  clear()
}

function clear() {
  query.value = ''; results.value = []; noResults.value = false
}

function open() { isOpen.value = true; nextTick(() => inputEl.value?.focus()) }
function close() { isOpen.value = false; query.value = ''; results.value = [] }

onMounted(() => {
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.search-wrapper, #search-toggle')) {
      if (window.matchMedia('(max-width: 600px)').matches) close()
      else { results.value = []; noResults.value = false }
    }
  })
})
</script>

<style scoped>
.search-toggle-btn {
  display: none; /* never shown — mobile uses inline search bar */
}

.search-wrapper {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  width: min(380px, calc(100vw - 100px));
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
  /* Inline search bar — sits in the white mobile top bar */
  .search-wrapper {
    top: 9px;
    left: 64px;   /* 12px margin + 44px burger + 8px gap */
    right: 60px;  /* 44px avatar + 8px gap + 8px margin */
    transform: none;
    width: auto;
    z-index: 1100;
  }

  .search-input-row {
    border-radius: 8px;
    height: 44px;
  }

  .search_input {
    font-size: 14px;
  }

  .search-results {
    border-radius: 8px;
    left: 0; right: 0;
    /* Expand to full width so results are readable */
    margin-left: -52px;
    margin-right: 0;
    width: auto;
  }
}
</style>
