<template>
  <Teleport to="body">
    <div v-if="conflict" class="nearby-modal">
      <div class="nearby-box">
        <p>In der Nähe liegt bereits <strong>{{ conflict.trail.name }}</strong>. Trotzdem eintragen?</p>
        <div class="nearby-actions">
          <button @click="cancel">Abbrechen</button>
          <button class="primary" @click="proceed">Trotzdem</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  conflict: { trail: any; resolve: (proceed: boolean) => void } | null
}>()

function proceed() { props.conflict?.resolve(true) }
function cancel() { props.conflict?.resolve(false) }
</script>

<style scoped>
.nearby-modal {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 99999;
  display: flex; justify-content: center; align-items: center;
}
.nearby-box {
  background: white; padding: 1.2rem; border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.25);
  max-width: 300px; font-size: 0.9rem; text-align: center;
}
.nearby-actions {
  display: flex; justify-content: space-between;
  margin-top: 1rem; gap: 0.5rem;
}
.nearby-actions button {
  flex: 1; padding: 0.4rem; border-radius: 8px; border: none; cursor: pointer;
}
.nearby-actions .primary { background: #2b6cb0; color: white; }
</style>
