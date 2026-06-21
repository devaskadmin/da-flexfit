<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/env'
import MessageHeader from '@/components/messages/MessageHeader.vue'

const router = useRouter()

const loading = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const recipients = ref([])
const canSend = ref(true)
const premiumRequired = ref(false)
const permissionsLoaded = ref(false)

const recipientUserId = ref('')
const subject = ref('')
const messageBody = ref('')

const loadRecipients = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const res = await fetch(`${API_BASE}/api/messages/recipients`, {
      credentials: 'include',
    })

    if (!res.ok) {
      throw new Error('Failed to load recipients.')
    }

    const data = await res.json()
    canSend.value = data?.canSend !== false
    premiumRequired.value = data?.premiumRequired === true
    recipients.value = Array.isArray(data?.recipients) ? data.recipients : []
  } catch (err) {
    errorMessage.value = err?.message || 'Failed to load recipients.'
    recipients.value = []
  } finally {
    loading.value = false
    permissionsLoaded.value = true
  }
}

const sendMessage = async () => {
  const recipientId = Number(recipientUserId.value || 0)
  const safeSubject = String(subject.value || '').trim()
  const safeBody = String(messageBody.value || '').trim()

  if (!recipientId || !safeBody) {
    errorMessage.value = 'Recipient and message are required.'
    return
  }

  sending.value = true
  errorMessage.value = ''

  try {
    const res = await fetch(`${API_BASE}/api/messages/send`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientUserId: recipientId,
        subject: safeSubject,
        messageBody: safeBody,
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      if (res.status === 403) {
        throw new Error(errData?.error || 'You do not have permission to send this message.')
      }
      throw new Error(errData?.error || 'Failed to send message.')
    }

    const data = await res.json()
    const createdConversationId = Number(data?.conversationId || 0)

    if (createdConversationId > 0) {
      router.push({ name: 'messages_conversation', params: { conversationId: createdConversationId } })
      return
    }

    router.push({ name: 'messages_inbox' })
  } catch (err) {
    errorMessage.value = err?.message || 'Failed to send message.'
  } finally {
    sending.value = false
  }
}

const cancelCompose = () => {
  router.push({ name: 'messages_inbox' })
}

onMounted(loadRecipients)
</script>

<template>
  <div class="compose-page">
    <MessageHeader title="Compose Message" subtitle="Send a new message" :show-back="true" />

    <section class="panel panel-bg compose-panel">
      <div class="panel-body compose-form">

        <!-- Premium restriction: free members cannot compose -->
        <div v-if="permissionsLoaded && !canSend" class="premium-lock">
          <i class="fa-solid fa-lock"></i>
          <div class="premium-lock-text">
            <strong>Premium Required</strong>
            <p>Messaging is available with a Premium membership. Upgrade to send messages to your trainer or administrator.</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="cancelCompose">
            Go Back
          </button>
        </div>

        <template v-else>
          <p v-if="errorMessage" class="state-message text-danger">{{ errorMessage }}</p>

          <div class="form-group">
            <label class="form-label" for="recipientField">Recipient</label>
            <select id="recipientField" class="form-control" v-model="recipientUserId" :disabled="loading || sending">
              <option value="">Select recipient</option>
              <option v-for="r in recipients" :key="r.id" :value="String(r.id)">
                {{ r.displayName }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="subjectField">Subject</label>
            <input
              id="subjectField"
              type="text"
              class="form-control"
              maxlength="255"
              placeholder="Subject"
              v-model="subject"
              :disabled="sending"
            >
          </div>

          <div class="form-group">
            <label class="form-label" for="messageField">Message</label>
            <textarea
              id="messageField"
              rows="8"
              class="form-control"
              placeholder="Write your message"
              v-model="messageBody"
              :disabled="sending"
            ></textarea>
          </div>

          <div class="actions">
            <button type="button" class="btn btn-primary btn-sm" :disabled="sending || loading" @click="sendMessage">
              {{ sending ? 'Sending...' : 'Send' }}
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="sending" @click="cancelCompose">
              Cancel
            </button>
          </div>
        </template>

      </div>
    </section>
  </div>
</template>

<style scoped>
.compose-page {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.compose-panel {
  border: 1px solid var(--border-color);
}

.compose-form {
  display: grid;
  gap: 12px;
}

.form-group {
  display: grid;
  gap: 6px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.state-message {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  background: var(--main-color);
}

.premium-lock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 20px;
  text-align: center;
  color: #92400e;
  background: #fef3c7;
  border-radius: 10px;
  border: 1px solid #fde68a;
}

.premium-lock i {
  font-size: 2.5rem;
  opacity: 0.7;
}

.premium-lock-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.premium-lock-text p {
  margin: 0;
  font-size: 0.875rem;
  color: #78350f;
}
</style>
            class="form-control"
            maxlength="255"
            placeholder="Subject"
            v-model="subject"
            :disabled="sending"
          >
        </div>

        <div class="form-group">
          <label class="form-label" for="messageField">Message</label>
          <textarea
            id="messageField"
            rows="8"
            class="form-control"
            placeholder="Write your message"
            v-model="messageBody"
            :disabled="sending"
          ></textarea>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-primary btn-sm" :disabled="sending || loading" @click="sendMessage">
            {{ sending ? 'Sending...' : 'Send' }}
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="sending" @click="cancelCompose">
            Cancel
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.compose-page {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.compose-panel {
  border: 1px solid var(--border-color);
}

.compose-form {
  display: grid;
  gap: 12px;
}

.form-group {
  display: grid;
  gap: 6px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.state-message {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  background: var(--main-color);
}
</style>
