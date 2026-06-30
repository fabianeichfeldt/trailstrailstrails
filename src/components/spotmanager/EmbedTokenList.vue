<template>
  <div class="embed-list">
    <div class="sm-section-header">
      <h3>Embed-Tokens <span class="sm-count">{{ tokens.length }}</span></h3>
      <button class="sm-btn-add" @click="emit('create')">
        <i class="fas fa-plus" /> Token
      </button>
    </div>

    <p v-if="loading" class="sm-center-msg">Lade…</p>
    <p v-else-if="error" class="sm-center-msg sm-error">{{ error }}</p>

    <div v-else-if="tokens.length === 0" class="sm-empty">
      Noch keine Tokens. Erstelle einen, um die Karte auf externen Websites einzubetten.
    </div>

    <div v-else class="embed-token-cards">
      <div v-for="t in tokens" :key="t.id" class="embed-token-card">
        <div class="embed-token-card-top">
          <div class="embed-token-info">
            <strong class="embed-token-name">{{ t.name }}</strong>
            <span class="embed-token-string" :title="t.token">{{ t.token.slice(0, 16) }}…</span>
          </div>
          <div class="embed-token-badges">
            <span class="embed-badge" :class="t.is_active ? 'badge-active' : 'badge-inactive'">
              {{ t.is_active ? 'Aktiv' : 'Inaktiv' }}
            </span>
          </div>
        </div>

        <div class="embed-token-meta">
          <span><i class="fas fa-globe" /> {{ t.allowed_hosts.length }} Domain(s)</span>
          <span><i class="fas fa-map-marker-alt" /> {{ trailCount(t.id) }} Trail(s)</span>
        </div>

        <div class="embed-token-actions">
          <button class="sm-btn-icon" title="Snippet kopieren" @click="copySnippet(t)">
            <i class="fas fa-copy" />
          </button>
          <button class="sm-btn-icon" title="Bearbeiten" @click="emit('edit', t)">
            <i class="fas fa-pen" />
          </button>
          <button class="sm-btn-icon sm-btn-danger" title="Löschen" @click="emit('delete', t)">
            <i class="fas fa-trash" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="copied" class="embed-copy-toast">
      <i class="fas fa-check" /> Snippet kopiert
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmbedTokenRow } from '~/spot_manager/Api'

const props = defineProps<{
  tokens: EmbedTokenRow[]
  trailCounts: Map<string, number>
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  create: []
  edit:   [token: EmbedTokenRow]
  delete: [token: EmbedTokenRow]
}>()

const copied = ref(false)

function trailCount(tokenId: string): number {
  return props.trailCounts.get(tokenId) ?? 0
}

function copySnippet(t: EmbedTokenRow) {
  const snippet =
    `<div id="trailradar-embed" style="height:500px"></div>\n` +
    `<script src="https://trailradar.org/embed.js"><\/script>\n` +
    `<script>\n` +
    `  TrailRadar.mount({\n` +
    `    token: '${t.token}',\n` +
    `    center: [47.8, 13.0],\n` +
    `    zoom: 12,\n` +
    `  });\n` +
    `<\/script>`

  navigator.clipboard.writeText(snippet).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  })
}
</script>

<style scoped>
.embed-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.embed-token-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.embed-token-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.embed-token-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.embed-token-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.embed-token-name {
  font-size: 14px;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.embed-token-string {
  font-size: 11px;
  color: #888;
  font-family: monospace;
}

.embed-token-badges {
  flex-shrink: 0;
}

.embed-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge-active   { background: #d1fae5; color: #065f46; }
.badge-inactive { background: #fee2e2; color: #991b1b; }

.embed-token-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
}

.embed-token-meta i {
  margin-right: 4px;
  color: #9ca3af;
}

.embed-token-actions {
  display: flex;
  gap: 6px;
}

.embed-copy-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #1b4332;
  color: #fff;
  font-size: 13px;
  padding: 8px 18px;
  border-radius: 8px;
  pointer-events: none;
  z-index: 9999;
}
</style>
