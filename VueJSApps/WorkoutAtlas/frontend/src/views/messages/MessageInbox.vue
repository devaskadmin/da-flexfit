<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE } from '@/config/env'

const route = useRoute()
const router = useRouter()

// ─── State ────────────────────────────────────────────────────────────────────
const loading = ref(false)
const errorMessage = ref('')
const conversations = ref([])
const usersById = ref({})
const currentUserId = ref(null)
const canSend = ref(true)
const permissionsLoaded = ref(false)

const selectedId = ref(null)
const conversationLoading = ref(false)
const conversationError = ref('')
const activeConversation = ref(null)
const activeMessages = ref([])

const replyText = ref('')
const replySending = ref(false)
const replyError = ref('')

const mobileShowConversation = ref(false)
const threadContainer = ref(null)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const formatDateTime = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const resolveDisplayName = (user) => {
  if (!user) return 'Unknown User'
  const first = String(user.FirstName || user.firstName || '').trim()
  const last = String(user.LastName || user.lastName || '').trim()
  const full = `${first} ${last}`.trim()
  if (full) return full
  if (user.username) return String(user.username).trim()
  return `User ${user.id}`
}

const resolveParticipantName = (userId) => {
  const user = usersById.value[userId]
  if (user) return resolveDisplayName(user)
  const participant = (activeConversation.value?.participants || []).find(
    (p) => Number(p.userId) === Number(userId),
  )
  const role = String(participant?.role || '').toLowerCase()
  if (role === 'admin' || role === 'administrator') return 'Administrator'
  if (role === 'trainer') return 'Trainer'
  return `User ${userId}`
}

const extractSenderName = (conversation) => {
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : []
  const other = participants.find((p) => Number(p?.userId) !== Number(currentUserId.value))
  if (!other) return 'Trainer'
  const user = usersById.value[other.userId]
  if (user) return resolveDisplayName(user)
  const role = String(other.role || '').toLowerCase()
  if (role === 'admin' || role === 'administrator') return 'Administrator'
  if (role === 'trainer') return 'Trainer'
  return `User ${other.userId}`
}

const getInitial = (name) => String(name || '?')[0].toUpperCase()

// ─── Computed ─────────────────────────────────────────────────────────────────
const inboxItems = computed(() =>
  conversations.value.map((c) => ({
    id: Number(c.id),
    senderName: extractSenderName(c),
    subject: String(c?.lastMessage?.subject || '').trim() || 'No subject',
    preview: String(c?.lastMessage?.messageBodyPreview || '').trim() || '',
    displayDate: formatDate(c?.lastMessage?.createdAt || c?.updatedAt),
    isUnread: Number(c?.unreadCount || 0) > 0,
    isSelected: Number(c.id) === Number(selectedId.value),
  })),
)

const unreadTotal = computed(() =>
  conversations.value.reduce((sum, c) => sum + Number(c?.unreadCount || 0), 0),
)

const activeParticipantLabel = computed(() => {
  const participants = Array.isArray(activeConversation.value?.participants)
    ? activeConversation.value.participants
    : []
  const others = participants.filter((p) => Number(p?.userId) !== Number(currentUserId.value))
  if (!others.length) return 'Conversation'
  return others.map((p) => resolveParticipantName(p.userId)).join(', ')
})

const activeSubject = computed(() => {
  const first = activeMessages.value.find((m) => String(m.subject || '').trim())
  return String(first?.subject || '').trim() || 'No subject'
})

const mappedActiveMessages = computed(() =>
  activeMessages.value.map((m) => ({
    ...m,
    senderName: resolveParticipantName(m.senderId),
    isOutgoing: Number(m.senderId) === Number(currentUserId.value),
    displayTime: formatDateTime(m.createdAt),
  })),
)

// ─── API Calls ────────────────────────────────────────────────────────────────
const loadPermissions = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/messages/recipients`, { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    canSend.value = data?.canSend !== false
  } catch {
    canSend.value = true // fail open; backend enforces
  } finally {
    permissionsLoaded.value = true
  }
}

const loadSession = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/session`, {
      credentials: 'include',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return
    const data = await res.json()
    currentUserId.value = Number(data?.user?.id || 0) || null
  } catch {}
}

const loadUsers = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/users`, { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    if (!Array.isArray(data)) return
    const map = {}
    data.forEach((u) => { if (u?.id) map[u.id] = u })
    usersById.value = map
  } catch {}
}

const loadConversations = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/messages?limit=100`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to load conversations.')
    const data = await res.json()
    conversations.value = Array.isArray(data?.items) ? data.items : []
  } catch (err) {
    errorMessage.value = err?.message || 'Failed to load conversations.'
    conversations.value = []
  } finally {
    loading.value = false
  }
}

const scrollToBottom = async () => {
  await nextTick()
  const el = threadContainer.value
  if (el) el.scrollTop = el.scrollHeight
}

const loadConversationContent = async (conversationId) => {
  conversationLoading.value = true
  conversationError.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/messages/${conversationId}?limit=200`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to load conversation.')
    const data = await res.json()
    activeConversation.value = data?.conversation || null
    activeMessages.value = Array.isArray(data?.items) ? data.items : []
    // Clear local unread count for this conversation
    const idx = conversations.value.findIndex((c) => Number(c.id) === Number(conversationId))
    if (idx !== -1) {
      conversations.value[idx] = { ...conversations.value[idx], unreadCount: 0 }
    }
    await scrollToBottom()
  } catch (err) {
    conversationError.value = err?.message || 'Failed to load conversation.'
    activeConversation.value = null
    activeMessages.value = []
  } finally {
    conversationLoading.value = false
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────
const selectConversation = async (item) => {
  const id = Number(item.id)
  if (id === Number(selectedId.value)) return
  selectedId.value = id
  mobileShowConversation.value = true
  replyText.value = ''
  replyError.value = ''
  if (Number(route.params.conversationId || 0) !== id) {
    router.replace({ name: 'messages_conversation', params: { conversationId: id } })
  }
  await loadConversationContent(id)
}

const backToList = () => {
  mobileShowConversation.value = false
}

const sendReply = async () => {
  const content = String(replyText.value || '').trim()
  if (!content || !selectedId.value) return
  replySending.value = true
  replyError.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/messages/send`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selectedId.value,
        subject: activeSubject.value,
        messageBody: content,
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData?.error || 'Failed to send reply.')
    }
    replyText.value = ''
    await loadConversationContent(selectedId.value)
  } catch (err) {
    replyError.value = err?.message || 'Failed to send reply.'
  } finally {
    replySending.value = false
  }
}

const goCompose = () => {
  router.push({ name: 'messages_compose' })
}

// Handle URL-driven conversation selection (browser back/forward, deep links)
watch(
  () => route.params.conversationId,
  async (newId) => {
    const id = Number(newId || 0)
    if (id > 0 && id !== Number(selectedId.value)) {
      selectedId.value = id
      mobileShowConversation.value = true
      await loadConversationContent(id)
    }
  },
)

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadSession(), loadUsers(), loadPermissions()])
  await loadConversations()
  const urlId = Number(route.params.conversationId || 0)
  if (urlId > 0) {
    selectedId.value = urlId
    mobileShowConversation.value = true
    await loadConversationContent(urlId)
  }
})
</script>

<template>
  <div class="messaging-workspace">
    <div class="workspace-split" :class="{ 'mobile-convo-active': mobileShowConversation }">

      <!-- ── LEFT: Conversation List ─────────────────────────────── -->
      <div class="workspace-left">
        <div class="left-header">
          <span class="left-title">
            <i class="fa-light fa-messages"></i>
            Messages
            <span v-if="unreadTotal > 0" class="unread-badge">{{ unreadTotal }}</span>
          </span>
          <button
            type="button"
            class="btn btn-sm btn-primary compose-btn"
            :disabled="!canSend || !permissionsLoaded"
            :title="canSend ? 'Compose new message' : 'Premium required to compose messages'"
            @click="goCompose"
          >
            <i class="fa-light fa-pen-to-square"></i>
            Compose
          </button>
        </div>

        <div v-if="permissionsLoaded && !canSend" class="premium-notice">
          <i class="fa-solid fa-lock"></i>
          <span>Messaging requires <strong>Premium</strong> membership.</span>
        </div>

        <div class="convo-list">
          <p v-if="loading" class="state-msg">
            <i class="fa-light fa-spinner fa-spin"></i> Loading...
          </p>
          <p v-else-if="errorMessage" class="state-msg text-danger">{{ errorMessage }}</p>

          <div v-else-if="!inboxItems.length" class="empty-inbox">
            <i class="fa-light fa-inbox"></i>
            <p>No conversations yet.</p>
            <button
              v-if="canSend && permissionsLoaded"
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="goCompose"
            >
              Start a conversation
            </button>
          </div>

          <button
            v-for="item in inboxItems"
            :key="item.id"
            type="button"
            class="convo-item"
            :class="{ 'is-selected': item.isSelected, 'is-unread': item.isUnread }"
            @click="selectConversation(item)"
          >
            <div class="convo-avatar" :class="{ 'avatar-unread': item.isUnread }">
              {{ getInitial(item.senderName) }}
            </div>
            <div class="convo-info">
              <div class="convo-row-top">
                <span class="convo-sender">{{ item.senderName }}</span>
                <span class="convo-date">{{ item.displayDate }}</span>
              </div>
              <div class="convo-subject">{{ item.subject }}</div>
              <div class="convo-preview">{{ item.preview }}</div>
            </div>
            <div v-if="item.isUnread" class="unread-dot"></div>
          </button>
        </div>
      </div>

      <!-- ── RIGHT: Conversation Thread ─────────────────────────── -->
      <div class="workspace-right">
        <button
          v-if="mobileShowConversation"
          type="button"
          class="btn-back-mobile"
          @click="backToList"
        >
          <i class="fa-solid fa-arrow-left"></i> Back to Messages
        </button>

        <!-- Loading -->
        <div v-if="conversationLoading" class="right-placeholder">
          <i class="fa-light fa-spinner fa-spin"></i>
          <p>Loading conversation...</p>
        </div>

        <!-- Error -->
        <div v-else-if="conversationError" class="right-placeholder">
          <i class="fa-light fa-triangle-exclamation"></i>
          <p class="text-danger">{{ conversationError }}</p>
        </div>

        <!-- Active conversation -->
        <template v-else-if="selectedId && activeConversation">
          <div class="thread-header">
            <div class="thread-header-info">
              <strong>{{ activeParticipantLabel }}</strong>
              <small>{{ activeSubject }}</small>
            </div>
          </div>

          <div class="thread-list" ref="threadContainer">
            <article
              v-for="msg in mappedActiveMessages"
              :key="msg.id"
              class="message-bubble"
              :class="msg.isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'"
            >
              <div class="bubble-meta">
                <span class="bubble-sender">{{ msg.senderName }}</span>
                <span class="bubble-time">{{ msg.displayTime }}</span>
              </div>
              <p class="bubble-body">{{ msg.messageBody }}</p>
            </article>
          </div>

          <div class="reply-area">
            <div v-if="!canSend" class="reply-lock">
              <i class="fa-solid fa-lock"></i>
              <span>Premium membership required to send messages.</span>
            </div>
            <template v-else>
              <textarea
                v-model="replyText"
                class="reply-input"
                placeholder="Write a reply..."
                :disabled="replySending"
                rows="3"
              ></textarea>
              <div class="reply-footer">
                <p v-if="replyError" class="reply-error text-danger">{{ replyError }}</p>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  :disabled="!replyText.trim() || replySending"
                  @click="sendReply"
                >
                  <i class="fa-light fa-paper-plane"></i>
                  {{ replySending ? 'Sending...' : 'Send Reply' }}
                </button>
              </div>
            </template>
          </div>
        </template>

        <!-- Empty state: no conversation selected -->
        <div v-else class="right-placeholder">
          <i class="fa-light fa-comments"></i>
          <p>Select a conversation to begin reading.</p>
          <button
            v-if="canSend && permissionsLoaded"
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="goCompose"
          >
            <i class="fa-light fa-pen-to-square"></i>
            Compose a Message
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ─── Workspace Layout ──────────────────────────────────────────────────────── */
.messaging-workspace {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  min-height: 500px;
}

.workspace-split {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  background: var(--main-color);
}

/* ─── Left Panel ────────────────────────────────────────────────────────────── */
.workspace-left {
  width: 35%;
  min-width: 240px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.left-title {
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-color);
}

.unread-badge {
  background: #2563eb;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.compose-btn {
  flex-shrink: 0;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 5px;
}

.compose-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.premium-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.8rem;
  border-bottom: 1px solid #fde68a;
  flex-shrink: 0;
}

.convo-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.state-msg {
  padding: 20px;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  text-align: center;
}

.empty-inbox {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--text-color-secondary);
  text-align: center;
}

.empty-inbox i {
  font-size: 2.5rem;
  opacity: 0.4;
}

.empty-inbox p {
  font-size: 0.9rem;
  margin: 0;
}

/* ─── Conversation List Item ────────────────────────────────────────────────── */
.convo-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
}

.convo-item:hover {
  background: rgba(37, 99, 235, 0.05);
}

.convo-item.is-selected {
  background: rgba(37, 99, 235, 0.08);
  border-left: 3px solid #2563eb;
}

.convo-item.is-unread .convo-sender,
.convo-item.is-unread .convo-subject {
  font-weight: 700;
  color: var(--text-color);
}

.convo-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #334155;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.convo-avatar.avatar-unread {
  background: #2563eb;
}

.convo-info {
  flex: 1;
  min-width: 0;
}

.convo-row-top {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: baseline;
}

.convo-sender {
  font-size: 0.875rem;
  color: var(--text-color);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.convo-date {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.convo-subject {
  font-size: 0.82rem;
  color: var(--text-color);
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.convo-preview {
  font-size: 0.78rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2563eb;
  flex-shrink: 0;
  margin-top: 6px;
}

/* ─── Right Panel ───────────────────────────────────────────────────────────── */
.workspace-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.btn-back-mobile {
  display: none;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  color: #2563eb;
  font-size: 0.85rem;
  cursor: pointer;
  width: 100%;
  text-align: left;
}

.right-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-color-secondary);
  padding: 40px 20px;
  text-align: center;
}

.right-placeholder i {
  font-size: 3rem;
  opacity: 0.35;
}

.right-placeholder p {
  font-size: 0.9rem;
  margin: 0;
}

/* ─── Thread ────────────────────────────────────────────────────────────────── */
.thread-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.thread-header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.thread-header-info strong {
  font-size: 0.95rem;
  color: var(--text-color);
}

.thread-header-info small {
  font-size: 0.78rem;
  color: var(--text-color-secondary);
}

.thread-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message-bubble {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 14px;
  max-width: 80%;
  word-wrap: break-word;
}

.bubble-incoming {
  align-self: flex-start;
  border-left: 3px solid #334155;
}

.bubble-outgoing {
  align-self: flex-end;
  border-left: 3px solid #2563eb;
}

.bubble-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.bubble-sender {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.bubble-time {
  font-size: 0.72rem;
  color: var(--text-color-secondary);
}

.bubble-body {
  font-size: 0.875rem;
  color: var(--text-color);
  margin: 0;
  white-space: pre-wrap;
}

/* ─── Reply Area ────────────────────────────────────────────────────────────── */
.reply-area {
  border-top: 1px solid var(--border-color);
  padding: 12px 16px;
  flex-shrink: 0;
}

.reply-lock {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #92400e;
  background: #fef3c7;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
}

.reply-input {
  width: 100%;
  resize: none;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.875rem;
  color: var(--text-color);
  background: var(--main-color);
  margin-bottom: 8px;
  outline: none;
  box-sizing: border-box;
}

.reply-input:focus {
  border-color: #2563eb;
}

.reply-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.reply-error {
  font-size: 0.82rem;
  margin: 0;
  flex: 1;
}

/* ─── Mobile ────────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .messaging-workspace {
    height: calc(100vh - 80px);
  }

  .workspace-split {
    position: relative;
  }

  .workspace-left {
    width: 100%;
    max-width: 100%;
    position: absolute;
    inset: 0;
    z-index: 1;
    border-right: none;
    background: var(--main-color);
    border-radius: 12px;
    transition: opacity 0.15s;
  }

  .workspace-right {
    width: 100%;
    position: absolute;
    inset: 0;
    z-index: 0;
    opacity: 0;
    pointer-events: none;
    background: var(--main-color);
    border-radius: 12px;
    transition: opacity 0.15s;
  }

  .mobile-convo-active .workspace-left {
    z-index: 0;
    opacity: 0;
    pointer-events: none;
  }

  .mobile-convo-active .workspace-right {
    z-index: 1;
    opacity: 1;
    pointer-events: auto;
  }

  .btn-back-mobile {
    display: flex;
  }

  .message-bubble {
    max-width: 95%;
  }
}
</style>