<template>
  <div class="user-menu">
    <!-- Logged out: login + signup buttons -->
    <template v-if="!authStore.isLoggedIn">
      <button class="auth-login-btn" @click="mapStore.authModalOpen = true">Anmelden</button>
      <span class="auth-signup-btn" @click="openSignUp">Registrieren</span>
    </template>

    <!-- Logged in: avatar button + dropdown -->
    <template v-else>
      <button class="user-avatar-btn" @click.stop="toggleDropdown" aria-label="Profil-Menü öffnen">
        <div class="user-avatar">
          <img v-if="authStore.avatarUrl" :src="authStore.avatarUrl" alt="User Avatar" />
          <span v-else class="avatar-fallback" aria-hidden="true"></span>
        </div>
      </button>

      <div v-if="dropdownOpen" class="user-dropdown" @click.stop>
        <div class="user-dropdown-header">
          <div class="user-nickname">{{ authStore.nickname }}</div>
        </div>
        <div class="divider"></div>
        <button @click="goToProfile">Profil</button>
        <button v-if="authStore.isAdmin || authStore.isTrailcrew" @click="goToSpotManager">
          Spot Manager
        </button>
        <div class="divider"></div>
        <button class="danger" @click="handleLogout">Abmelden</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const mapStore = useMapStore()
const router = useRouter()

const dropdownOpen = ref(false)

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function openSignUp() {
  mapStore.authModalOpen = true
}

function goToProfile() {
  dropdownOpen.value = false
  router.push('/profile')
}

function goToSpotManager() {
  dropdownOpen.value = false
  router.push('/spotmanager')
}

async function handleLogout() {
  dropdownOpen.value = false
  await authStore.signOut()
}

onMounted(() => {
  document.addEventListener('click', () => { dropdownOpen.value = false })
})

onUnmounted(() => {
  document.removeEventListener('click', () => { dropdownOpen.value = false })
})
</script>

<style scoped>
.user-menu {
  position: absolute;
  top: 0.8em;
  right: 1em;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3em;
  z-index: 20;
}

.auth-login-btn {
  background: #d6730d;
  color: #111;
  border: none;
  border-radius: 9px;
  padding: 0.45em 0.9em;
  font-size: 0.75em;
  font-weight: 600;
  cursor: pointer;
}

.auth-login-btn:hover { background: #ea8f3d; }

.auth-signup-btn {
  font-size: 0.65em;
  color: #e7dbc7;
  text-decoration: underline;
  cursor: pointer;
}

@media (max-width: 800px) {
  .auth-signup-btn { font-size: 0.5em; }
  .user-menu { top: 0.3em; right: 0.3em; }
  .auth-login-btn { padding: 0.3em; font-size: 0.5em; }
}

.user-avatar-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  padding: 0;
  border: none;
  background: rgba(255,255,255,.85);
  backdrop-filter: blur(4px);
  box-shadow: 0 4px 12px rgba(0,0,0,.25);
  cursor: pointer;
  transition: transform .15s;
}

.user-avatar-btn:hover { transform: scale(1.04); }

.user-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2937, #374151);
  box-shadow: 0 4px 10px rgba(0,0,0,.25);
  border: 1px solid rgba(255,255,255,.2);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  position: relative;
  width: 100%;
  height: 100%;
}

.avatar-fallback::before {
  content: "";
  position: absolute;
  top: 22%;
  left: 50%;
  width: 38%;
  height: 38%;
  background: rgba(255,255,255,.85);
  border-radius: 50%;
  transform: translateX(-50%);
}

.avatar-fallback::after {
  content: "";
  position: absolute;
  bottom: 12%;
  left: 50%;
  width: 70%;
  height: 42%;
  background: rgba(255,255,255,.85);
  border-radius: 50% 50% 20% 20%;
  transform: translateX(-50%);
}

.user-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 200px;
  background: white;
  border-radius: 16px;
  padding: 0.3em 0;
  box-shadow: 0 20px 40px rgba(0,0,0,.2);
  animation: dropdownFade .2s ease;
}

.user-dropdown-header {
  padding: 0.5em 1em;
}

.user-nickname {
  font-size: 0.85em;
  font-weight: 600;
  color: #111827;
}

.user-dropdown .divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0.4em 0;
}

.user-dropdown button {
  width: 100%;
  padding: 0.5em 1em;
  background: none;
  border: none;
  text-align: left;
  font-size: 0.85em;
  font-weight: 500;
  color: #111827;
  cursor: pointer;
}

.user-dropdown button:hover { background: #f1f5f9; }
.user-dropdown button.danger { color: #b91c1c; }
.user-dropdown button.danger:hover { background: #fee2e2; }

@keyframes dropdownFade {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
