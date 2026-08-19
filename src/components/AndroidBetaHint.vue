<template>
  <Transition name="banner">
    <div v-if="show" class="beta-hint" role="dialog" aria-label="Android Beta">
      <p class="beta-text">📱 Die Trailradar-App für Android kommt – werde Beta-Tester.</p>
      <NuxtLink to="/android-beta" class="beta-cta" @click="dismiss">Eintragen</NuxtLink>
      <button class="beta-close" @click="dismiss" aria-label="Schließen">✕</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAndroidBetaHint } from '~/composables/useAndroidBetaHint'

const { show, dismiss } = useAndroidBetaHint()
</script>

<style scoped>
.beta-hint {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1900;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #16181a;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.banner-enter-from,
.banner-leave-to {
  transform: translateY(100%);
}
.banner-enter-active,
.banner-leave-active {
  transition: transform 320ms ease-out;
}

.beta-text {
  flex: 1;
  margin: 0;
  color: #f0f0f0;
  font-size: 0.85rem;
  line-height: 1.4;
}

.beta-cta {
  flex-shrink: 0;
  background: #58c27d;
  color: #0e0f10;
  padding: 8px 14px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.8rem;
  white-space: nowrap;
  text-decoration: none;
}

.beta-close {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c8d4;
  font-size: 0.7rem;
  cursor: pointer;
  line-height: 1;
}
</style>
