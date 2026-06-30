<template>
  <div class="embed-editor">
    <div class="sm-form-header">
      <button class="sm-btn-back" @click="emit('cancel')">
        <i class="fas fa-arrow-left" />
      </button>
      <h3>{{ isNew ? 'Token erstellen' : 'Token bearbeiten' }}</h3>
    </div>

    <div class="embed-editor-body">
      <!-- Name -->
      <label class="embed-field-label">
        Name
        <input v-model="form.name" type="text" class="sd-input" placeholder="z.B. Alpenverein Widget" maxlength="80" />
      </label>

      <!-- Active toggle -->
      <label class="embed-toggle-row">
        <input v-model="form.is_active" type="checkbox" />
        <span>Aktiv (deaktivieren sperrt alle Embeds mit diesem Token)</span>
      </label>

      <!-- Allowed hosts -->
      <div class="embed-field-label">
        Erlaubte Domains
        <div class="embed-host-input-row">
          <input
            v-model="hostInput"
            type="text"
            class="sd-input"
            placeholder="z.B. deutscheralpenverein.de"
            @keydown.enter.prevent="addHost"
            @keydown.comma.prevent="addHost"
          />
          <button class="sm-btn-secondary embed-host-add-btn" @click="addHost">
            <i class="fas fa-plus" />
          </button>
        </div>
        <div class="embed-host-chips">
          <span v-for="h in form.allowed_hosts" :key="h" class="embed-host-chip">
            {{ h }}
            <button class="embed-chip-remove" @click="removeHost(h)">
              <i class="fas fa-times" />
            </button>
          </span>
          <span v-if="form.allowed_hosts.length === 0" class="embed-host-empty">
            Noch keine Domains — ohne Domains funktioniert der Embed nirgends.
          </span>
        </div>
        <p class="embed-field-hint">
          Nur der Hostname, ohne Protokoll. <code>localhost</code> ist gültig für lokale Tests.
        </p>
      </div>

      <!-- Trail picker -->
      <div class="embed-field-label">
        Trails zuordnen
        <input v-model="search" type="text" class="sd-input embed-search" placeholder="Trails suchen…" />
      </div>

      <div v-if="pickerLoading" class="sm-center-msg">Lade Trails…</div>
      <div v-else class="embed-trail-groups">
        <div v-for="group in filteredGroups" :key="group.type" class="embed-trail-group">
          <div class="embed-group-header">
            <span class="embed-type-badge" :class="`type-${group.type}`">{{ TYPE_LABEL[group.type] }}</span>
            <span class="embed-group-count">{{ selectedInGroup(group.type) }}/{{ group.trails.length }}</span>
          </div>
          <div class="embed-trail-list">
            <label v-for="t in group.trails" :key="t.id" class="sm-check-label">
              <input
                type="checkbox"
                :value="t.id"
                :checked="selectedIds.has(t.id)"
                @change="toggleTrail(t)"
              />
              {{ t.name }}
            </label>
          </div>
        </div>
        <p v-if="filteredGroups.length === 0" class="sm-empty">Keine Trails gefunden.</p>
      </div>
    </div>

    <div class="sm-form-actions embed-editor-footer">
      <p v-if="saveError" class="sm-error embed-save-error">{{ saveError }}</p>
      <button class="sm-btn-secondary" @click="emit('cancel')">Abbrechen</button>
      <button class="sm-btn-primary" :disabled="busy || !form.name.trim()" @click="save">
        <i class="fas fa-save" /> Speichern
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmbedTokenRow, TrailPickerRow } from '~/spot_manager/Api'
import {
  createEmbedToken,
  updateEmbedToken,
  getEmbedTokenTrails,
  setEmbedTokenTrails,
  getAllTrailsForPicker,
} from '~/spot_manager/Api'

const TYPE_LABEL: Record<string, string> = {
  trail:    'Trails',
  bikepark: 'Bikeparks',
  dirtpark: 'Dirtparks',
}

const props = defineProps<{
  token: EmbedTokenRow | null   // null = create mode
  jwt: string
}>()

const emit = defineEmits<{
  cancel: []
  saved:  []
}>()

const isNew = computed(() => !props.token)

// Form state
const form = reactive({
  name:          props.token?.name          ?? '',
  is_active:     props.token?.is_active     ?? true,
  allowed_hosts: [...(props.token?.allowed_hosts ?? [])],
})

const hostInput   = ref('')
const search      = ref('')
const busy        = ref(false)
const saveError   = ref<string | null>(null)
const pickerLoading = ref(false)

// Trail picker state
const allTrails   = ref<TrailPickerRow[]>([])
const selectedIds = ref(new Set<string>())
const selectedMap = new Map<string, TrailPickerRow>()

onMounted(async () => {
  pickerLoading.value = true
  try {
    allTrails.value = await getAllTrailsForPicker(props.jwt)
    allTrails.value.forEach(t => selectedMap.set(t.id, t))

    if (props.token) {
      const linked = await getEmbedTokenTrails(props.token.id, props.jwt)
      selectedIds.value = new Set(linked.map(l => l.trail_id))
    }
  } finally {
    pickerLoading.value = false
  }
})

// Group trails for display
const groups = computed(() => {
  const byType = new Map<string, TrailPickerRow[]>()
  for (const t of allTrails.value) {
    if (!byType.has(t.type)) byType.set(t.type, [])
    byType.get(t.type)!.push(t)
  }
  return Array.from(byType.entries()).map(([type, trails]) => ({ type, trails }))
})

const filteredGroups = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map(g => ({ ...g, trails: g.trails.filter(t => t.name.toLowerCase().includes(q)) }))
    .filter(g => g.trails.length > 0)
})

function selectedInGroup(type: string): number {
  return allTrails.value.filter(t => t.type === type && selectedIds.value.has(t.id)).length
}

function toggleTrail(t: TrailPickerRow) {
  const next = new Set(selectedIds.value)
  if (next.has(t.id)) next.delete(t.id)
  else next.add(t.id)
  selectedIds.value = next
}

function addHost() {
  const h = hostInput.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (h && !form.allowed_hosts.includes(h)) form.allowed_hosts.push(h)
  hostInput.value = ''
}

function removeHost(h: string) {
  form.allowed_hosts = form.allowed_hosts.filter(x => x !== h)
}

async function save() {
  saveError.value = null
  busy.value = true
  try {
    let tokenId: string
    if (isNew.value) {
      const created = await createEmbedToken(
        { name: form.name.trim(), allowed_hosts: form.allowed_hosts },
        props.jwt,
      )
      tokenId = created.id
    } else {
      await updateEmbedToken(
        props.token!.id,
        { name: form.name.trim(), allowed_hosts: form.allowed_hosts, is_active: form.is_active },
        props.jwt,
      )
      tokenId = props.token!.id
    }

    const trailRows = Array.from(selectedIds.value).map(id => {
      const trail = selectedMap.get(id)!
      return { trail_id: id, trail_type: trail.type }
    })
    await setEmbedTokenTrails(tokenId, trailRows, props.jwt)

    emit('saved')
  } catch (e: any) {
    saveError.value = e.message ?? 'Speichern fehlgeschlagen.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.embed-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.embed-editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.embed-field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.embed-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #444;
  font-weight: normal;
  cursor: pointer;
}

.embed-host-input-row {
  display: flex;
  gap: 6px;
}

.embed-host-add-btn {
  flex-shrink: 0;
  padding: 6px 12px;
}

.embed-host-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
}

.embed-host-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 20px;
  font-family: monospace;
}

.embed-chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: #0369a1;
  padding: 0;
  line-height: 1;
  font-size: 10px;
  opacity: 0.7;
}
.embed-chip-remove:hover { opacity: 1; }

.embed-host-empty {
  font-size: 12px;
  color: #e97316;
  font-weight: normal;
  text-transform: none;
  letter-spacing: 0;
}

.embed-field-hint {
  font-size: 11px;
  color: #9ca3af;
  font-weight: normal;
  text-transform: none;
  letter-spacing: 0;
}

.embed-field-hint code {
  background: #f3f4f6;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}

.embed-search {
  margin-bottom: 4px;
}

.embed-trail-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.embed-trail-group {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.embed-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
}

.embed-type-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 20px;
}

.type-trail    { background: #d1fae5; color: #065f46; }
.type-bikepark { background: #dbeafe; color: #1e40af; }
.type-dirtpark { background: #fef3c7; color: #92400e; }

.embed-group-count {
  font-size: 11px;
  color: #6b7280;
}

.embed-trail-list {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.embed-editor-footer {
  border-top: 1px solid #e5e7eb;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}

.embed-save-error {
  font-size: 12px;
}
</style>
