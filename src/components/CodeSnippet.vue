<template>
  <div class="code-snippet">
    <button type="button" class="code-copy-btn" :class="{ copied }" @click="onCopy">
      {{ copied ? '✓ Kopiert' : 'Kopieren' }}
    </button>
    <pre class="code-block"><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { copyToClipboard } from '~/utils/clipboard'

const props = defineProps<{
  code: string
}>()

const copied = ref(false)

async function onCopy() {
  const ok = await copyToClipboard(props.code)
  if (!ok) return
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped>
.code-snippet {
  position: relative;
  background: var(--color-page-bg-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.code-block {
  margin: 0;
  padding: 1.4rem 1.2rem;
  overflow-x: auto;
  color: #e6e9ee;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.85rem;
  line-height: 1.6;
}

.code-copy-btn {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  min-height: 44px;
  padding: 0.5rem 1rem;
  background: var(--color-page-accent);
  color: #0e0f10;
  font-weight: 700;
  font-size: 0.78rem;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.code-copy-btn:hover { opacity: 0.85; }
.code-copy-btn.copied { background: #2a9d5c; color: #fff; }

@media (max-width: 600px) {
  .code-block { padding: 3.4rem 0.9rem 1.1rem; font-size: 0.78rem; }
  .code-copy-btn { top: 0.5rem; right: 0.5rem; left: 0.5rem; width: calc(100% - 1rem); }
}
</style>
