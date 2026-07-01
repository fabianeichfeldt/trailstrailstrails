<template>
  <!-- Overlay -->
  <div data-testid="drawer-overlay" class="drawer-overlay" :class="{ active: mapStore.drawerOpen }" @click="mapStore.drawerOpen = false" />

  <!-- Burger button — hidden while drawer is open -->
  <button v-show="!mapStore.drawerOpen" data-testid="burger-btn" class="burger-btn" @click="mapStore.drawerOpen = true" aria-label="Menü öffnen">☰</button>

  <!-- Drawer -->
  <div data-testid="drawer" class="drawer" :class="{ open: mapStore.drawerOpen }">
    <div class="drawer-header">
      <NuxtLink to="/" class="drawer-brand" @click="mapStore.drawerOpen = false">
        <img :src="'/assets/logo.webp'" alt="Trailradar" class="drawer-logo" />
        <span class="drawer-brand-name">Trailradar</span>
      </NuxtLink>
      <button data-testid="drawer-close" class="drawer-close" @click="mapStore.drawerOpen = false" aria-label="Menü schließen">✕</button>
    </div>

    <!-- Filter box -->
    <div class="filter-box">
      <div class="filter-title">Anzeigen</div>

      <label class="filter-item" v-for="f in filters" :key="f.key">
        <span class="filter-dot" :style="{ background: f.color }" />
        <span class="filter-label">{{ f.label }}</span>
        <input type="checkbox" :data-filter="f.filter" v-model="filtersStore[f.key]" @change="mapStore.drawerOpen = false" />
        <span class="filter-toggle" />
      </label>

      <label class="filter-item" style="margin-top:0.4em">
        <span class="filter-label" style="font-size:0.75em">Gruppierung</span>
        <input data-testid="cluster-toggle" type="checkbox" v-model="filtersStore.useCluster" />
        <span class="filter-toggle" />
      </label>
    </div>

    <!-- Auth (mobile only — desktop uses the UserAvatar overlay) -->
    <div class="drawer-auth">
      <template v-if="!authStore.isLoggedIn">
        <button class="drawer-login-btn" @click="openLogin">Anmelden / Registrieren</button>
      </template>
      <template v-else>
        <div class="drawer-user-info">
          <span class="drawer-user-name">{{ authStore.nickname }}</span>
        </div>
        <button class="drawer-logout-btn" @click="handleLogout">Abmelden</button>
      </template>
    </div>

    <!-- Back to main page -->
    <NuxtLink to="/" class="home-link" @click="mapStore.drawerOpen = false">
      ← Zur Startseite
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
const mapStore = useMapStore()
const filtersStore = useFiltersStore()
const authStore = useAuthStore()

function openLogin() {
  mapStore.drawerOpen = false
  mapStore.authModalOpen = true
}

async function handleLogout() {
  mapStore.drawerOpen = false
  await authStore.signOut()
}

const filters = [
  { key: 'showTrails' as const, filter: 'trail', label: 'Trails', color: 'var(--color-trail)' },
  { key: 'showBikeparks' as const, filter: 'bikepark', label: 'Bikeparks', color: 'var(--color-bikepark)' },
  { key: 'showDirtparks' as const, filter: 'dirtpark', label: 'Dirtparks', color: 'var(--color-dirtpark)' },
  { key: 'showPumptracks' as const, filter: 'pumptrack', label: 'Pumptracks', color: 'var(--color-dirtpark)' },
]
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 1200;
}
.drawer-overlay.active { opacity: 1; pointer-events: all; }

/* Burger — top-left */
.burger-btn {
  position: absolute;
  top: 0.75em;
  left: 0.75em;
  z-index: 1100;
  background: rgba(255,255,255,0.95);
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 0.4em;
  font-size: 1.1em;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}
.burger-btn:hover { background: white; }

@media (max-width: 600px) {
  /* Align burger vertically inside the mobile top bar (62px tall) */
  .burger-btn {
    top: 9px;
    box-shadow: none;
    background: #f0f0f0;
  }
  .burger-btn:hover { background: #e0e0e0; }
}


.drawer {
  position: fixed;
  top: 0;
  left: -320px;
  width: 320px;
  height: 100%;
  background: #fff;
  box-shadow: 2px 0 12px rgba(0,0,0,0.18);
  z-index: 1210;
  display: flex;
  flex-direction: column;
  transition: left 0.3s ease;
  overflow-y: auto;
}
.drawer.open { left: 0; }

@media (max-width: 480px) {
  .drawer { width: 100%; left: -100%; }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75em 1em;
  border-bottom: 1px solid #eee;
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 0.5em;
  text-decoration: none;
}
.drawer-logo { width: 32px; height: 32px; }
.drawer-brand-name {
  font-weight: 700;
  font-size: 0.95em;
  color: #1a3a5c;
  letter-spacing: 0.02em;
}

.drawer-close {
  background: none;
  border: none;
  font-size: 1.1em;
  cursor: pointer;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.3em;
  color: #666;
}
.drawer-close:hover { background: #f5f5f5; color: #333; }

.filter-box {
  background: rgba(255,255,255,0.9);
  padding: 1em;
  margin: 0.8em;
  border-radius: 0.6em;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  font-size: 0.85em;
}
.filter-title { font-size: 0.85em; font-weight: 600; color: #333; margin-bottom: 0.6em; }

.filter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fafafa;
  padding: 0.75em 0.8em;
  border-radius: 0.4em;
  margin-bottom: 0.5em;
  cursor: pointer;
  gap: 0.7em;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  transition: background 0.2s;
  min-height: 44px;
}
.filter-item:hover { background: #fff; }

.filter-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 3px rgba(0,0,0,0.2); }
.filter-label { flex-grow: 1; font-size: 0.85em; color: #333; }
.filter-item input { display: none; }

.filter-toggle {
  position: relative; width: 36px; height: 20px;
  background: #ccc; border-radius: 20px; transition: background 0.3s; flex-shrink: 0;
}
.filter-toggle::before {
  content: ""; position: absolute;
  width: 16px; height: 16px; top: 2px; left: 2px;
  background: white; border-radius: 50%; transition: transform 0.3s;
}
.filter-item input:checked + .filter-toggle { background: #2b6cb0; }
.filter-item input:checked + .filter-toggle::before { transform: translateX(16px); }

.drawer-auth {
  margin: 0 0.8em 0.6em;
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}
.drawer-login-btn {
  width: 100%;
  background: #2b6cb0;
  color: white;
  border: none;
  border-radius: 0.6em;
  padding: 0.75em 1em;
  font-size: 0.85em;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  transition: background 0.15s;
}
.drawer-login-btn:hover { background: #3182ce; }
.drawer-user-info {
  padding: 0.4em 0.2em;
}
.drawer-user-name {
  font-size: 0.82em;
  font-weight: 600;
  color: #333;
}
.drawer-logout-btn {
  width: 100%;
  background: #f5f5f5;
  color: #b91c1c;
  border: none;
  border-radius: 0.6em;
  padding: 0.75em 1em;
  font-size: 0.85em;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  text-align: left;
  transition: background 0.15s;
}
.drawer-logout-btn:hover { background: #fee2e2; }

.home-link {
  display: flex;
  align-items: center;
  margin: 0 0.8em 1em;
  padding: 0.85em 1em;
  background: #f0f7ff;
  border: 1px solid #bee3f8;
  border-radius: 0.6em;
  color: #2b6cb0;
  font-size: 0.85em;
  font-weight: 600;
  text-decoration: none;
  min-height: 44px;
  transition: background 0.15s;
}
.home-link:hover { background: #e0efff; }
</style>
