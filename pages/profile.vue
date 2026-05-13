<template>
  <div>
    <PageHero>
      <h1>Mein Profil</h1>
      <p>Deine Einstellungen und Beiträge zur Community.</p>
    </PageHero>

    <main class="container">
      <NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>

      <div v-if="!authStore.isLoggedIn" class="not-logged-in">
        <p>Du musst angemeldet sein, um dein Profil zu sehen.</p>
        <button class="btn-primary" @click="mapStore.authModalOpen = true">Anmelden</button>
      </div>

      <div v-else class="profile-layout">

        <!-- Avatar + name -->
        <div class="profile-header">
          <div class="profile-avatar">
            <img
              :src="authStore.avatarUrl || '/assets/avatar-placeholder.webp'"
              alt="Profilbild"
              id="profile-avatar-img"
            />
            <button class="avatar-edit" @click="avatarInput?.click()" aria-label="Profilbild ändern">
              <i class="fa-solid fa-camera"></i>
            </button>
            <input ref="avatarInput" type="file" accept="image/*" class="visually-hidden" @change="onAvatarSelected" />
          </div>
          <div class="profile-meta">
            <h2 class="profile-name">{{ authStore.nickname }}</h2>
            <p class="profile-sub">Trailradar-Mitglied</p>
          </div>
        </div>

        <!-- Profile form -->
        <section class="profile-section">
          <h3 class="section-title">Profil bearbeiten</h3>
          <form id="profile-form" class="profile-form" @submit.prevent="onSave">
            <div class="field">
              <label>Nickname</label>
              <input v-model="nicknameInput" type="text" required minlength="3" />
            </div>
            <div class="field">
              <label>E-Mail</label>
              <input :value="user?.email" type="email" readonly />
            </div>
            <div class="profile-actions">
              <button type="submit" class="btn-primary" :class="{ loading: saving }">Speichern</button>
            </div>
          </form>
        </section>

        <!-- Password change -->
        <section class="profile-section">
          <h3 class="section-title">Passwort ändern</h3>
          <div v-if="pwError" class="auth-error">{{ pwError }}</div>
          <form id="password-form" class="profile-form" @submit.prevent="onUpdatePassword">
            <div class="field">
              <label>Aktuelles Passwort</label>
              <div class="password-field">
                <input v-model="oldPw" :type="showOld ? 'text' : 'password'" required />
                <button type="button" class="toggle-password" @click="showOld = !showOld">
                  <i :class="showOld ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                </button>
              </div>
            </div>
            <div class="field">
              <label>Neues Passwort</label>
              <div class="password-field">
                <input v-model="newPw" :type="showNew ? 'text' : 'password'" required minlength="8" />
                <button type="button" class="toggle-password" @click="showNew = !showNew">
                  <i :class="showNew ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                </button>
              </div>
            </div>
            <div class="field">
              <label>Neues Passwort wiederholen</label>
              <div class="password-field">
                <input v-model="newPwRepeat" :type="showNewRepeat ? 'text' : 'password'" required minlength="8" />
                <button type="button" class="toggle-password" @click="showNewRepeat = !showNewRepeat">
                  <i :class="showNewRepeat ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                </button>
              </div>
            </div>
            <div class="profile-actions">
              <button type="submit" class="btn-primary" :class="{ loading: savingPw }">Passwort ändern</button>
            </div>
          </form>
        </section>

        <!-- Contributions -->
        <section class="profile-section">
          <h3 class="section-title">Meine Beiträge</h3>
          <div class="contribution-grid">
            <div class="contribution-card">
              <h4>Eingetragene Trails & Parks</h4>
              <ul v-if="createdTrails.length" class="contribution-list">
                <li v-for="trail in createdTrails" :key="trail.id">
                  <span class="contribution-title">{{ trail.name }}</span>
                  <span class="contribution-meta">erstellt am {{ formatDate(trail.created_at) }}</span>
                </li>
              </ul>
              <p v-else class="empty-hint">Noch keine Trails eingetragen</p>
            </div>

            <div class="contribution-card">
              <h4>Favoriten</h4>
              <ul v-if="favoriteTrails.length" class="contribution-list">
                <li v-for="trail in favoriteTrails" :key="trail.id">
                  <span class="contribution-title">⭐ {{ trail.name }}</span>
                </li>
              </ul>
              <p v-else class="empty-hint">Noch keine Favoriten</p>
            </div>
          </div>
        </section>

        <!-- Photos -->
        <section v-if="photos.length" class="profile-section">
          <h3 class="section-title">Hochgeladene Fotos</h3>
          <div class="photo-grid">
            <div v-for="photo in photos" :key="photo.url" class="photo-card">
              <img :src="photo.url" :alt="photo.trailName" />
              <div class="photo-meta">
                <span>{{ photo.trailName }}</span>
                <span>{{ formatDate(photo.created_at) }}</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>

    <AuthModal />
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Mein Profil | Trailradar',
  robots: 'noindex',
})

const authStore = useAuthStore()
const mapStore = useMapStore()
const client = useSupabaseClient()
const user = useSupabaseUser()

const nicknameInput = ref(authStore.nickname)
const oldPw = ref('')
const newPw = ref('')
const newPwRepeat = ref('')
const showOld = ref(false)
const showNew = ref(false)
const showNewRepeat = ref(false)
const saving = ref(false)
const savingPw = ref(false)
const pwError = ref('')

const avatarInput = ref<HTMLInputElement | null>(null)

interface BaseTrail { id: string; name: string; created_at: string }
interface PhotoItem { url: string; created_at: string; trailName: string; trailID: string }

const createdTrails = ref<BaseTrail[]>([])
const favoriteTrails = ref<BaseTrail[]>([])
const photos = ref<PhotoItem[]>([])

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function loadContributions() {
  if (!user.value) return
  const uid = user.value.id

  const [trailsRes, parksRes, dirtRes, favRes, photosRes] = await Promise.all([
    client.from('trails').select('id, name, created_at').eq('creator_id', uid),
    client.from('parks').select('id, name, created_at').eq('creator_id', uid),
    client.from('dirt_parks').select('id, name, created_at').eq('creator_id', uid),
    client.from('trail_favorites').select('trails(id, name, created_at)').eq('user_id', uid),
    client.from('trail_photos').select('url, created_at, trail_id, trails(name)').eq('creator', uid),
  ])

  createdTrails.value = [
    ...(trailsRes.data ?? []),
    ...(parksRes.data ?? []),
    ...(dirtRes.data ?? []),
  ] as BaseTrail[]

  favoriteTrails.value = ((favRes.data ?? []) as { trails: BaseTrail }[]).map(r => r.trails)

  photos.value = ((photosRes.data ?? []) as { url: string; created_at: string; trail_id: string; trails: { name: string } }[])
    .map(p => ({ url: p.url, created_at: p.created_at, trailName: p.trails.name, trailID: p.trail_id }))
}

watch(user, (u) => {
  if (u) {
    nicknameInput.value = authStore.nickname
    loadContributions()
  }
}, { immediate: true })

async function onAvatarSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const url = await authStore.uploadAvatar(file)
  await authStore.updateProfile({ avatar_url: url })
}

async function onSave() {
  saving.value = true
  try {
    await authStore.updateProfile({ name: nicknameInput.value })
  } finally {
    saving.value = false
  }
}

async function onUpdatePassword() {
  pwError.value = ''
  if (newPw.value !== newPwRepeat.value) {
    pwError.value = 'Passwörter stimmen nicht überein.'
    return
  }
  savingPw.value = true
  try {
    await authStore.signIn(user.value?.email ?? '', oldPw.value)
    await authStore.updatePassword(oldPw.value, newPw.value)
    oldPw.value = ''
    newPw.value = ''
    newPwRepeat.value = ''
  } catch {
    pwError.value = 'Falsches aktuelles Passwort.'
  } finally {
    savingPw.value = false
  }
}
</script>

<style scoped>
.not-logged-in {
  text-align: center;
  padding: 3rem 0;
}

.profile-layout {
  max-width: 680px;
  margin: 0 auto;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.4em;
  gap: 0.5em;
}

.profile-meta { text-align: center; }

.profile-name { font-size: 1.1em; margin: 0; }
.profile-sub { font-size: 0.8em; color: #777; margin: 0; }

.profile-avatar {
  position: relative;
  width: 120px;
  height: 120px;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,.3);
}

.avatar-edit {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.8em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-edit:hover { background: var(--color-primary-hover); }

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.profile-section {
  margin-top: 1.4em;
  padding-top: 1em;
  border-top: 1px solid #e5e5e5;
}

.section-title {
  font-size: 0.9em;
  font-weight: 600;
  margin-bottom: 0.8em;
  color: #333;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 0.7em;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
}

.field label {
  font-size: 0.75em;
  color: #555;
}

.field input {
  padding: 0.45em 0.5em;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 0.9em;
}

.field input[readonly] { background: #f2f2f2; }

.password-field {
  position: relative;
  display: flex;
  align-items: center;
}

.password-field input { width: 100%; padding-right: 3rem; box-sizing: border-box; }

.toggle-password {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #888;
  font-size: 0.9em;
  padding: 0.2rem;
}

.toggle-password:hover { color: var(--color-primary); }

.profile-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.4em;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-size: 0.85em;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover { background: var(--color-primary-hover); }
.btn-primary.loading { opacity: 0.6; pointer-events: none; }

.auth-error {
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.85rem;
  margin-bottom: 0.8rem;
}

.contribution-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8em;
}

@media (max-width: 600px) {
  .contribution-grid { grid-template-columns: 1fr; }
}

.contribution-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.8em;
}

.contribution-card h4 {
  font-size: 0.75em;
  margin: 0 0 0.5em;
  color: #444;
}

.contribution-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}

.contribution-title {
  display: block;
  font-size: 0.8em;
  font-weight: 500;
}

.contribution-meta {
  display: block;
  font-size: 0.7em;
  color: #777;
}

.empty-hint { font-size: 0.8em; color: #888; margin: 0; }

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.8em;
}

.photo-card {
  border-radius: 10px;
  overflow: hidden;
  background: #f5f5f5;
}

.photo-card img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.photo-meta {
  padding: 0.4em 0.5em;
  display: flex;
  flex-direction: column;
  gap: 0.1em;
  font-size: 0.7em;
  color: #555;
}
</style>
