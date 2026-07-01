<template>
  <header class="app-header">
    <div class="header-inner">
      <NuxtLink to="/" class="header-brand">
        <img :src="'/assets/logo.webp'" alt="Trailradar" class="header-logo" />
        <span class="header-name">Trailradar</span>
      </NuxtLink>

      <div class="header-right">
        <NuxtLink to="/map" class="header-map-link">Zur Karte →</NuxtLink>

        <ClientOnly>
          <template v-if="!authStore.isLoggedIn">
            <button class="btn-login" @click="mapStore.authModalOpen = true">Anmelden</button>
          </template>
          <template v-else>
            <div class="header-user" ref="userMenuEl">
              <button class="header-avatar-btn" @click.stop="toggleDropdown" aria-label="Profil-Menü">
                <div class="header-avatar">
                  <img v-if="authStore.avatarUrl" :src="authStore.avatarUrl" alt="Avatar" />
                  <span v-else class="avatar-fallback" />
                </div>
              </button>
              <div v-if="dropdownOpen" class="header-dropdown" @click.stop>
                <div class="dropdown-name">{{ authStore.nickname }}</div>
                <div class="divider" />
                <button @click="goTo('/profile')">Profil</button>
                <button v-if="authStore.isAdmin || authStore.isTrailcrew" @click="goTo('/spotmanager')">Spot Manager</button>
                <div class="divider" />
                <button class="danger" @click="handleLogout">Abmelden</button>
              </div>
            </div>
          </template>
          <AuthModal />
        </ClientOnly>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const mapStore = useMapStore()
const router = useRouter()
const dropdownOpen = ref(false)
const userMenuEl = ref<HTMLElement | null>(null)

function toggleDropdown() { dropdownOpen.value = !dropdownOpen.value }

function goTo(path: string) {
  dropdownOpen.value = false
  router.push(path)
}

async function handleLogout() {
  dropdownOpen.value = false
  await authStore.signOut()
}

onMounted(() => {
  document.addEventListener('click', (e) => {
    if (!userMenuEl.value?.contains(e.target as Node)) dropdownOpen.value = false
  })
})
</script>

<style scoped>
.app-header {
  background: var(--color-page-bg-light, #16181a);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0.7rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
}
.header-logo { width: 32px; height: 32px; border-radius: 6px; }
.header-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: #e0e0e0;
  letter-spacing: 0.02em;
}
.header-brand:hover .header-name { color: #fff; text-decoration: none; }

.header-right {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.header-map-link {
  font-size: 0.82rem;
  font-weight: 600;
  color: #58c27d;
  text-decoration: none;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  transition: background 0.15s;
}
.header-map-link:hover { background: rgba(88,194,125,0.1); text-decoration: none; }

.btn-login {
  background: #2b6cb0;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 1rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.btn-login:hover { background: #3182ce; }

/* Avatar button */
.header-user { position: relative; }
.header-avatar-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.1);
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition: border-color 0.15s;
}
.header-avatar-btn:hover { border-color: rgba(255,255,255,0.5); }
.header-avatar {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1f2937, #374151);
}
.header-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-fallback {
  display: block; width: 100%; height: 100%; position: relative;
}
.avatar-fallback::before {
  content: ""; position: absolute;
  top: 22%; left: 50%; width: 38%; height: 38%;
  background: rgba(255,255,255,.8); border-radius: 50%;
  transform: translateX(-50%);
}
.avatar-fallback::after {
  content: ""; position: absolute;
  bottom: 12%; left: 50%; width: 70%; height: 42%;
  background: rgba(255,255,255,.8); border-radius: 50% 50% 20% 20%;
  transform: translateX(-50%);
}

/* Dropdown */
.header-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 180px;
  background: #fff;
  border-radius: 12px;
  padding: 0.3rem 0;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  animation: fadeIn .15s ease;
  z-index: 200;
}
.dropdown-name {
  padding: 0.5rem 1rem 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #111;
}
.divider { height: 1px; background: #e5e7eb; margin: 0.3rem 0; }
.header-dropdown button {
  width: 100%; padding: 0.45rem 1rem;
  background: none; border: none; text-align: left;
  font-size: 0.82rem; font-weight: 500; color: #111; cursor: pointer;
}
.header-dropdown button:hover { background: #f1f5f9; }
.header-dropdown button.danger { color: #b91c1c; }
.header-dropdown button.danger:hover { background: #fee2e2; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
