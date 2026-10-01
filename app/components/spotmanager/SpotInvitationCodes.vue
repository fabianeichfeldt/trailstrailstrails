<template>
  <div class="sd-section">
    <div class="sd-section-label"><i class="fas fa-key" /> Einladungscodes (Trailcrew)</div>
    <div v-if="newInvitationCode" class="inv-new-code">
      <span class="inv-code-chip">{{ newInvitationCode }}</span>
      <span class="inv-code-meta">Gültig 7 Tage · einmalig verwendbar</span>
    </div>
    <div v-if="invitationCodes.length" class="inv-list">
      <div v-for="c in invitationCodes" :key="c.code" class="inv-row" :class="{ 'inv-row--used': c.used_by }">
        <span class="inv-code">{{ c.code }}</span>
        <span class="inv-expires">bis {{ formatInvDate(c.expires_at) }}</span>
        <span class="inv-badge">{{ c.used_by ? 'verwendet' : 'offen' }}</span>
      </div>
    </div>
    <button class="sd-add-rule-btn" :disabled="invitationCodeGenerating" @click="generateInvCode">
      <i class="fas fa-plus" /> Code erstellen
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { listInvitationCodes, createInvitationCode } from '~/communication/invitations'
import type { InvCode } from '~/communication/invitations'

const props = defineProps<{ spotId: string }>()
const authStore = useAuthStore()

const invitationCodes = ref<InvCode[]>([])
const invitationCodeGenerating = ref(false)
const newInvitationCode = ref<string | null>(null)

function formatInvDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

async function loadInvCodes() {
  try {
    invitationCodes.value = await listInvitationCodes(props.spotId, await authStore.getToken())
  } catch {
    invitationCodes.value = []
  }
}

async function generateInvCode() {
  invitationCodeGenerating.value = true
  newInvitationCode.value = null
  try {
    const [createdBy, token] = await Promise.all([authStore.getUserId(), authStore.getToken()])
    newInvitationCode.value = await createInvitationCode(props.spotId, createdBy, token)
    await loadInvCodes()
  } catch (e: any) {
    alert(`Fehler: ${e.message}`)
  } finally {
    invitationCodeGenerating.value = false
  }
}

watch(() => props.spotId, () => {
  newInvitationCode.value = null
  loadInvCodes()
}, { immediate: true })
</script>

<style scoped>
/* .sd-section*, .sd-add-rule-btn duplicated from SpotManagerApp (its scoped styles don't reach child internals) */
.sd-section { padding: 14px 0; border-bottom: 1px solid #f0f0f0; display: flex; flex-direction: column; gap: 10px; }
.sd-section:last-of-type { border-bottom: none; }
.sd-section-label { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #888; }
.sd-add-rule-btn {
  display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
  color: #0077cc; background: #f0f6ff; border: 1px dashed #a0c8f0; border-radius: 8px;
  padding: 9px 14px; cursor: pointer; width: 100%; justify-content: center;
}
.sd-add-rule-btn:hover { background: #daeeff; border-color: #0077cc; }

.inv-new-code {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  background: #f0f9eb; border: 1px solid #b7e1a0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px;
}
.inv-code-chip {
  font-family: monospace; font-size: 22px; font-weight: 700; letter-spacing: .2em; color: #2d6a1f;
}
.inv-code-meta { font-size: 11px; color: #5a8a4a; }
.inv-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.inv-row {
  display: flex; align-items: center; gap: 10px; padding: 6px 10px;
  border-radius: 6px; background: #f8f8f8; font-size: 12px;
}
.inv-row--used { opacity: .5; }
.inv-code { font-family: monospace; font-weight: 700; letter-spacing: .1em; color: #333; flex: 0 0 auto; }
.inv-expires { color: #888; flex: 1; }
.inv-badge {
  font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px;
  background: #e0f0e0; color: #2d6a1f;
}
.inv-row--used .inv-badge { background: #eee; color: #999; }
</style>
