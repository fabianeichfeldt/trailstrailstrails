<template>
  <Transition name="banner" @after-leave="onAfterLeave">
    <div
      v-if="visible"
      class="pwa-banner"
      role="dialog"
      aria-label="App installieren"
    >
      <div class="pwa-header">
        <div class="pwa-handle" />
        <button class="pwa-close" @click="handleDismiss" aria-label="Schließen">✕</button>
      </div>

      <div class="pwa-body">
        <p class="pwa-title">🚵 Karte immer griffbereit am Trailhead</p>
        <p class="pwa-text">Ein Tipp vom Homescreen - kein Browser, kein Tippen, direkt die Karte.</p>

        <!-- Android/Chrome layout -->
        <template v-if="!isIos">
          <div class="pwa-pills">
            <span class="pwa-pill">📡 Kein Netz nötig</span>
            <span class="pwa-pill">⚡ Sofort offen</span>
            <span class="pwa-pill">🗺️ Vollbild-Karte</span>
          </div>
          <button class="pwa-cta" @click="install">Jetzt installieren</button>
          <button class="pwa-dismiss" @click="handleDismiss">Nicht jetzt</button>
        </template>

        <!-- iOS layout -->
        <template v-else>
          <ol class="pwa-ios-steps">
            <li>
              Tippe auf das Teilen-Symbol
              <IconShare class="pwa-share-icon" aria-hidden="true" />
              (Teilen)
            </li>
            <li>Wähle „Zum Home-Bildschirm"</li>
          </ol>
          <button class="pwa-dismiss pwa-dismiss--ios" @click="handleDismiss">Schließen</button>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePwaInstall } from '~/composables/usePwaInstall'
import IconShare from '~/assets/icons/share.svg'

const { show, isIos, install, dismiss } = usePwaInstall()

// Local `visible` drives the CSS transition.
// When `show` becomes true → show immediately.
// When dismiss is called → we animate out first, then hide.
const visible = ref(false)
const animatingOut = ref(false)

watch(show, (newVal) => {
  if (newVal) {
    visible.value = true
  }
})

function handleDismiss() {
  // Start exit animation
  animatingOut.value = true
  visible.value = false
  // dismiss() writes localStorage; show is set false by dismiss()
  dismiss()
}

function onAfterLeave() {
  animatingOut.value = false
}
</script>

<style scoped>
.pwa-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  background: #16181a;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 20px 20px 0 0;
  z-index: 2000;
  padding: 6px 16px 24px;
  box-sizing: border-box;
}

/* Transition: slide up on enter, slide down on leave */
.banner-enter-from {
  transform: translateY(100%);
}
.banner-enter-active {
  transition: transform 320ms ease-out;
}
.banner-enter-to {
  transform: translateY(0);
}
.banner-leave-from {
  transform: translateY(0);
}
.banner-leave-active {
  transition: transform 320ms ease-out;
}
.banner-leave-to {
  transform: translateY(100%);
}

/* Header row: handle bar + close button */
.pwa-header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 14px;
  padding-top: 8px;
}

.pwa-handle {
  width: 36px;
  height: 4px;
  background: #333;
  border-radius: 2px;
}

.pwa-close {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c8d4;
  font-size: 0.75rem;
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
}
.pwa-close:hover {
  background: rgba(255,255,255,0.16);
  color: #fff;
}

.pwa-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pwa-title {
  margin: 0;
  color: #f0f0f0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.4;
}

.pwa-text {
  margin: 0;
  color: #8a9aaa;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Perk pills */
.pwa-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pwa-pill {
  background: rgba(88, 194, 125, 0.12);
  color: #58c27d;
  border: 1px solid rgba(88, 194, 125, 0.25);
  border-radius: 99px;
  padding: 4px 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

/* CTA button */
.pwa-cta {
  display: block;
  width: 100%;
  background: #58c27d;
  color: #0e0f10;
  border: none;
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  text-align: center;
  transition: opacity 0.15s;
}
.pwa-cta:hover {
  opacity: 0.9;
}
.pwa-cta:active {
  opacity: 0.8;
}

/* Dismiss button */
.pwa-dismiss {
  display: block;
  width: 100%;
  background: none;
  border: none;
  color: #8a9aaa;
  font-size: 0.85rem;
  text-align: center;
  cursor: pointer;
  padding: 6px 0;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.pwa-dismiss:hover {
  color: #c0c8d4;
}
.pwa-dismiss--ios {
  margin-top: 4px;
}

/* iOS steps */
.pwa-ios-steps {
  margin: 0;
  padding-left: 1.2rem;
  color: #8a9aaa;
  font-size: 0.9rem;
  line-height: 1.8;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pwa-ios-steps li {
  display: flex;
  align-items: center;
  gap: 6px;
  list-style: decimal;
}

.pwa-share-icon {
  width: 18px;
  height: 18px;
  color: #58c27d;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
