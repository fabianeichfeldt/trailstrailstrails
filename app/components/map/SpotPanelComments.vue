<template>
  <div class="comments-header" @click="toggleExpanded">
    <span class="comments-count">💬 {{ countLabel }}</span>
    <span class="comments-toggle-icon">{{ store.commentsExpanded ? '▲' : '▼' }}</span>
  </div>

  <template v-if="store.commentsExpanded">
    <div v-if="store.comments.length" class="comments-list">
      <div v-for="c in store.comments" :key="c.id" class="comment-row" :data-comment-id="c.id">
        <div class="comment-meta">
          <span class="comment-author">{{ c.profiles?.display_name || 'Anonym' }}</span>
          <span class="comment-date">{{ formatDate(c.created_at) }}</span>
        </div>
        <p class="comment-text">{{ c.comment_text }}</p>
        <div class="comment-actions">
          <button class="comment-reply-btn" @click="reply(c)">Antworten</button>
          <button
            v-if="canDelete(c)"
            class="comment-delete-btn"
            aria-label="Kommentar löschen"
            @click="remove(c.id)"
          >
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
    <p v-else class="spot-empty">Noch keine Kommentare. Sei der Erste!</p>

    <button v-if="store.commentsHasMore" class="comments-load-more" @click="loadMore">
      Ältere Kommentare laden
    </button>

    <div v-if="authStore.isLoggedIn" class="comments-write-box">
      <textarea
        ref="textareaEl"
        v-model="text"
        class="comments-input"
        maxlength="500"
        placeholder="Kommentar schreiben…"
      ></textarea>
      <div class="comments-write-footer">
        <span class="comments-char-count">{{ text.length }} / 500</span>
        <button class="comments-post-btn" :disabled="postDisabled" @click="submit">Senden</button>
      </div>
      <div class="comments-error" :class="{ hidden: !error }">{{ error }}</div>
    </div>
    <div v-else class="comments-login-prompt">
      <span class="comments-login-link" @click="login">Einloggen zum Kommentieren</span>
    </div>
  </template>
</template>

<script setup lang="ts">
import { confirmDialog } from '~/map/confirmDialog'
import { showToast } from '~/utils/toast'
import { formatDate } from '~/utils/formatDate'
import type { Comment } from '~/types/Comment'
import type { IAuthService } from '~/auth/auth_service'

// Mounted by SpotPanelInfoTab.vue into #spot-comments-section, which
// decides when to fetch (loadComments()) since it already builds the auth
// snapshot loadComments() needs.
const store = useSpotPanelStore()
const authStore = useAuthStore()
const mapStore = useMapStore()

const text = ref('')
const posting = ref(false)
const error = ref('')
const textareaEl = ref<HTMLTextAreaElement | null>(null)

const postDisabled = computed(() => posting.value || text.value.length === 0 || text.value.length > 500)

const countLabel = computed(() => {
  const count = store.comments.length
  const suffix = store.commentsHasMore ? '+' : ''
  const noun = count === 1 && !store.commentsHasMore ? 'Kommentar' : 'Kommentare'
  return `${count}${suffix} ${noun}`
})

function canDelete(c: Comment): boolean {
  return c.user_id === store.commentsCurrentUserId || store.commentsCanModerate
}

function toggleExpanded() {
  store.toggleCommentsExpanded()
}

async function loadMore() {
  await store.loadMoreComments()
}

function reply(c: Comment) {
  const author = c.profiles?.display_name || 'Anonym'
  text.value = `@${author} ${text.value}`.trimStart()
  nextTick(() => textareaEl.value?.focus())
}

// Minimal IAuthService adapter — postComment()/deleteComment()
// (communication/comments.ts) only ever call authService.getUser().
function authServiceAdapter(): IAuthService {
  return {
    loggedIn: authStore.isLoggedIn,
    async getUser() {
      return {
        id: authStore.userId,
        email: '',
        nickname: authStore.nickname,
        accessToken: await authStore.getToken(),
        avatarUrl: authStore.avatarUrl,
        avatarHTML: '',
        isAdmin: authStore.isAdmin,
        isTrailcrew: authStore.isTrailcrew,
      }
    },
  } as IAuthService
}

async function submit() {
  const trimmed = text.value.trim()
  if (!trimmed) return
  error.value = ''
  posting.value = true
  try {
    await store.postComment(trimmed, authServiceAdapter())
    text.value = ''
  } catch (err) {
    console.error('Failed to post comment:', err)
    error.value = err instanceof Error ? err.message : 'Kommentar konnte nicht gesendet werden.'
  } finally {
    posting.value = false
  }
}

async function remove(id: number) {
  const confirmed = await confirmDialog('Kommentar wirklich löschen?')
  if (!confirmed) return
  try {
    await store.deleteComment(id, authServiceAdapter())
  } catch (err) {
    console.error('Failed to delete comment:', err)
    showToast('Löschen fehlgeschlagen 😢')
  }
}

function login() {
  mapStore.authModalOpen = true
}
</script>
