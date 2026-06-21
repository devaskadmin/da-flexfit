<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE } from '@/config/env'
import MessageHeader from '@/components/messages/MessageHeader.vue'
import MessageReply from '@/components/messages/MessageReply.vue'

const route = useRoute()

const loading = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const conversation = ref(null)
const messages = ref([])
const usersById = ref({})
const currentUserId = ref(null)
const replyText = ref('')

const conversationId = computed(() => Number(route.params.conversationId || 0))

const resolveDisplayName = (user) => {
  if (!user) return 'Unknown User'

  const firstName = String(user.FirstName || user.firstName || '').trim()
  const lastName = String(user.LastName || user.lastName || '').trim()
  const fullName = `${firstName} ${lastName}`.trim()

  if (fullName) return fullName
  if (user.username) return String(user.username).trim()

  return `User ${user.id}`
}

const findParticipantName = (userId) => {
  const user = usersById.value[userId]
  if (user) return resolveDisplayName(user)

  const participant = (conversation.value?.participants || []).find((item) => Number(item.userId) === Number(userId))
  if (!participant) return `User ${userId}`

  if (participant.role) {
    const normalizedRole = String(participant.role).toLowerCase()
    if (normalizedRole === 'admin') return 'Administrator'
    if (normalizedRole === 'trainer') return 'Trainer'
  }

  return `User ${userId}`
}

const senderLabel = computed(() => {
  const participants = Array.isArray(conversation.value?.participants) ? conversation.value.participants : []
  const others = participants.filter((participant) => Number(participant.userId) !== Number(currentUserId.value))

  if (others.length === 0) return 'Conversation'
  return others.map((participant) => findParticipantName(participant.userId)).join(', ')
})

const conversationSubject = computed(() => {
  const explicit = messages.value.find((item) => String(item.subject || '').trim())
  return String(explicit?.subject || '').trim() || 'No subject'
})

const mappedMessages = computed(() => {
  return messages.value.map((item) => ({
    ...item,
    senderName: findParticipantName(item.senderId),
    isOutgoing: Number(item.senderId) === Number(currentUserId.value),
    createdDisplay: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
  }))
})

const loadSession = async () => {
  const response = await fetch(`${API_BASE}/api/session`, {
    credentials: 'include',
    headers: { 'Cache-Control': 'no-cache' },
  })

  if (!response.ok) return

  const data = await response.json()
  currentUserId.value = Number(data?.user?.id || 0) || null
}

const loadUsers = async () => {
  const response = await fetch(`${API_BASE}/api/users`, {
    credentials: 'include',
  })

  if (!response.ok) return

  const data = await response.json()
  if (!Array.isArray(data)) return

  const map = {}
  data.forEach((item) => {
    if (!item?.id) return
    map[item.id] = item
  })
  usersById.value = map
}

const loadConversation = async () => {
  if (!conversationId.value) {
    errorMessage.value = 'Invalid conversation ID.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`${API_BASE}/api/messages/${conversationId.value}?limit=200`, {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to load conversation.')
    }

    const data = await response.json()
    conversation.value = data?.conversation || null
    messages.value = Array.isArray(data?.items) ? data.items : []
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to load conversation.'
    messages.value = []
  } finally {
    loading.value = false
  }
}

const sendReply = async () => {
  const content = String(replyText.value || '').trim()
  if (!content || !conversationId.value) return

  sending.value = true
  try {
    const response = await fetch(`${API_BASE}/api/messages/send`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: conversationId.value,
        subject: conversationSubject.value,
        messageBody: content,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send reply.')
    }

    replyText.value = ''
    await loadConversation()
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to send reply.'
  } finally {
    sending.value = false
  }
}

const initialize = async () => {
  await Promise.all([loadSession(), loadUsers()])
  await loadConversation()
}

onMounted(initialize)
</script>

<template>
  <div class="conversation-page">
    <MessageHeader
      :title="senderLabel"
      :subtitle="`Subject: ${conversationSubject}`"
      :show-back="true"
    />

    <p v-if="errorMessage" class="state-message text-danger">{{ errorMessage }}</p>

    <section class="panel panel-bg thread-panel">
      <div class="panel-body thread-list-wrap">
        <p v-if="loading" class="state-message">Loading conversation...</p>

        <div v-else class="thread-list">
          <article
            v-for="item in mappedMessages"
            :key="item.id"
            class="message-thread-card"
            :class="item.isOutgoing ? 'outgoing' : 'incoming'"
          >
            <div class="message-top">
              <strong>{{ item.senderName }}</strong>
              <span>{{ item.createdDisplay }}</span>
            </div>
            <p class="message-subject" v-if="item.subject">Subject: {{ item.subject }}</p>
            <p class="message-body">{{ item.messageBody }}</p>
          </article>
        </div>
      </div>
    </section>

    <MessageReply v-model="replyText" :loading="sending" @send="sendReply" />
  </div>
</template>

<style scoped>
.conversation-page {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.thread-panel {
  border: 1px solid var(--border-color);
}

.thread-list-wrap {
  min-width: 0;
}

.thread-list {
  display: grid;
  gap: 10px;
}

.message-thread-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  background: var(--main-color);
  max-width: 100%;
}

.message-thread-card.incoming {
  border-left: 4px solid #334155;
}

.message-thread-card.outgoing {
  border-left: 4px solid #2563eb;
}

.message-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--text-color-secondary);
  font-size: 0.82rem;
}

.message-subject {
  margin: 8px 0 4px;
  font-weight: 700;
  color: var(--text-color);
}

.message-body {
  margin: 0;
  color: var(--text-color);
  white-space: pre-line;
}

.state-message {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  background: var(--main-color);
}
</style>
