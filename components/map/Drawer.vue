<template>
  <!-- Overlay -->
  <div class="drawer-overlay" :class="{ active: mapStore.drawerOpen }" @click="mapStore.drawerOpen = false" />

  <!-- Burger button -->
  <button class="burger-btn" @click="mapStore.drawerOpen = true" aria-label="Menü öffnen">☰</button>

  <!-- Drawer -->
  <div class="drawer" :class="{ open: mapStore.drawerOpen }">
    <div class="drawer-header">
      <NuxtLink to="/map" @click="mapStore.drawerOpen = false">
        <img src="/assets/logo.webp" alt="Trailradar" class="drawer-logo" />
      </NuxtLink>
      <button class="drawer-close" @click="mapStore.drawerOpen = false" aria-label="Menü schließen">✕</button>
    </div>

    <!-- Filter box -->
    <div class="filter-box">
      <div class="filter-title">Anzeigen</div>

      <label class="filter-item" v-for="f in filters" :key="f.key">
        <span class="filter-dot" :style="{ background: f.color }" />
        <span class="filter-label">{{ f.label }}</span>
        <input type="checkbox" v-model="filtersStore[f.key]" @change="mapStore.drawerOpen = false" />
        <span class="filter-toggle" />
      </label>

      <div class="filter-item" style="margin-top:0.4em">
        <span class="filter-label" style="font-size:0.75em">Clustering</span>
        <input type="checkbox" v-model="filtersStore.useCluster" />
        <span class="filter-toggle" />
      </div>
    </div>

    <!-- Nav links -->
    <ul class="drawer-menu">
      <li v-for="link in navLinks" :key="link.to">
        <NuxtLink :to="link.to" @click="mapStore.drawerOpen = false">
          <span class="menu-icon">{{ link.icon }}</span>
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const mapStore = useMapStore()
const filtersStore = useFiltersStore()

const filters = [
  { key: 'showTrails' as const, label: 'Trails', color: 'var(--color-trail)' },
  { key: 'showBikeparks' as const, label: 'Bikeparks', color: 'var(--color-bikepark)' },
  { key: 'showDirtparks' as const, label: 'Dirtparks', color: 'var(--color-dirtpark)' },
  { key: 'showPumptracks' as const, label: 'Pumptracks', color: 'var(--color-dirtpark)' },
]

const navLinks = [
  { to: '/about', icon: '🙋', label: 'Über Trailradar' },
  { to: '/support', icon: '💚', label: 'Unterstützen' },
  { to: '/articles', icon: '📝', label: 'Artikel' },
  { to: '/faq', icon: '❓', label: 'FAQ' },
  { to: '/business', icon: '🤝', label: 'Kooperationen' },
  { to: '/legal', icon: '⚖️', label: 'Impressum' },
  { to: '/privacy', icon: '🔒', label: 'Datenschutz' },
  { to: '/terms', icon: '📋', label: 'Nutzungsbedingungen' },
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
  z-index: 1090;
}
.drawer-overlay.active { opacity: 1; pointer-events: all; }

.burger-btn {
  position: absolute;
  top: 1em;
  left: 1em;
  z-index: 1100;
  background: rgba(255,255,255,0.9);
  border: none;
  padding: 0.1em 0.3em;
  border-radius: 0.3em;
  font-size: 0.9em;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.burger-btn:hover { background: white; }

.drawer {
  position: fixed;
  top: 0;
  left: -350px;
  width: 350px;
  height: 100%;
  background: #fff;
  box-shadow: 2px 0 8px rgba(0,0,0,0.2);
  z-index: 1099;
  display: flex;
  flex-direction: column;
  transition: left 0.3s ease;
  overflow-y: auto;
}
.drawer.open { left: 0; }

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3em;
  border-bottom: 1px solid #eee;
}
.drawer-logo { width: 36px; height: 36px; }
.drawer-close { background: none; border: none; font-size: 1em; cursor: pointer; }

.filter-box {
  background: rgba(255,255,255,0.9);
  padding: 1em;
  margin: 0.8em;
  border-radius: 0.6em;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  font-size: 0.75em;
}
.filter-title { font-size: 0.9em; font-weight: 600; color: #333; margin-bottom: 0.6em; }

.filter-item {
  display: flex; align-items: center; justify-content: space-between;
  background: #fafafa; padding: 0.6em 0.7em; border-radius: 0.4em;
  margin-bottom: 0.5em; cursor: pointer; gap: 0.7em;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08); transition: background 0.2s;
}
.filter-item:hover { background: #fff; }

.filter-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 3px rgba(0,0,0,0.2); }
.filter-label { flex-grow: 1; font-size: 0.75em; color: #333; }
.filter-item input { display: none; }

.filter-toggle {
  position: relative; width: 32px; height: 18px;
  background: #ccc; border-radius: 20px; transition: background 0.3s;
}
.filter-toggle::before {
  content: ""; position: absolute;
  width: 14px; height: 14px; top: 2px; left: 2px;
  background: white; border-radius: 50%; transition: transform 0.3s;
}
.filter-item input:checked + .filter-toggle { background: #0077cc; }
.filter-item input:checked + .filter-toggle::before { transform: translateX(14px); }

.drawer-menu {
  list-style: none; padding: 0.8em 0 0.1em 0.5em; margin: 0;
}
.drawer-menu li { margin-bottom: 1em; }
.drawer-menu a {
  display: flex; align-items: center; gap: 0.6em;
  padding: 0.2em 0.9em; background: linear-gradient(135deg, #fafafa, #f1f1f1);
  border-radius: 0.6em; color: #333; font-size: 0.72em; font-weight: 500;
  text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,0.12); margin-right: 1em;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
}
.drawer-menu a:hover { transform: translateX(3px); background: white; box-shadow: 0 2px 6px rgba(0,0,0,0.2); color: #0077cc; }
.menu-icon { font-size: 1.2em; line-height: 0; }
</style>
