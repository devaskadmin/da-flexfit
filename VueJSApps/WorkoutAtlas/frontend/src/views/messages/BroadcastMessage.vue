<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/env'
import MessageHeader from '@/components/messages/MessageHeader.vue'

const router = useRouter()

// ── State ─────────────────────────────────────────────────────────────────────
const loading          = ref(false)
const sending          = ref(false)
const permissionsLoaded = ref(false)
const errorMessage     = ref('')
const successMessage   = ref('')

const senderRole  = ref('')
const recipients  = ref([])          // { id, displayName, firstName, lastName, username, role, tier, lastActive }
const selectedIds = ref(new Set())
const activeFilter = ref('all')      // 'all' | 'active' | 'premium' | 'inactive'

const subject     = ref('')
const messageBody = ref('')

const showConfirmModal  = ref(false)
const broadcastHistory  = ref([])
const historyLoading    = ref(false)
const historyTotal      = ref(0)

// ── Computed ──────────────────────────────────────────────────────────────────
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const filteredRecipients = computed(() => {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
  switch (activeFilter.value) {
    case 'premium':  return recipients.value.filter((r) => r.tier >= 2)
    case 'active':   return recipients.value.filter((r) => r.lastActive && r.lastActive >= cutoff)
    case 'inactive': return recipients.value.filter((r) => !r.lastActive || r.lastActive < cutoff)
    default:         return recipients.value
  }
})

const selectedCount = computed(() => selectedIds.value.size)

const allFilteredSelected = computed(() =>
  filteredRecipients.value.length > 0 &&
  filteredRecipients.value.every((r) => selectedIds.value.has(r.id))
)

const someFilteredSelected = computed(() =>
  !allFilteredSelected.value &&
  filteredRecipients.value.some((r) => selectedIds.value.has(r.id))
)

const canSend = computed(() =>
  selectedCount.value > 0 &&
  subject.value.trim().length > 0 &&
  messageBody.value.trim().length > 0 &&
  !sending.value
)

const filterCounts = computed(() => {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
  return {
    all:      recipients.value.length,
    premium:  recipients.value.filter((r) => r.tier >= 2).length,
    active:   recipients.value.filter((r) => r.lastActive && r.lastActive >= cutoff).length,
    inactive: recipients.value.filter((r) => !r.lastActive || r.lastActive < cutoff).length,
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const diffDays = Math.floor((Date.now() - d) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7)  return `${diffDays} days ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '—' }
}

const getInitial = (r) =>
  (r.firstName?.[0] || r.username?.[0] || '?').toUpperCase()

// ── Data loading ──────────────────────────────────────────────────────────────
const loadRecipients = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/messages/broadcast/recipients`, {
      credentials: 'include',
    })
    if (res.status === 403) {
      router.replace('/messages')
      return
    }
    if (!res.ok) throw new Error('Failed to load recipients.')
    const data = await res.json()
    senderRole.value = data.senderRole || ''
    recipients.value = Array.isArray(data.recipients) ? data.recipients : []
  } catch (err) {
    errorMessage.value = err?.message || 'Failed to load recipients.'
  } finally {
    loading.value = false
    permissionsLoaded.value = true
  }
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/messages/broadcast/history?limit=15`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    broadcastHistory.value = Array.isArray(data.items) ? data.items : []
    historyTotal.value = Number(data.total || 0)
  } catch {
    broadcastHistory.value = []
  } finally {
    historyLoading.value = false
  }
}

onMounted(() => {
  loadRecipients()
  loadHistory()
})

// ── Selection ─────────────────────────────────────────────────────────────────
const toggleRecipient = (id) => {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

const toggleAllFiltered = () => {
  const s = new Set(selectedIds.value)
  if (allFilteredSelected.value) {
    filteredRecipients.value.forEach((r) => s.delete(r.id))
  } else {
    filteredRecipients.value.forEach((r) => s.add(r.id))
  }
  selectedIds.value = s
}

const clearSelection = () => {
  selectedIds.value = new Set()
}

// ── Send flow ─────────────────────────────────────────────────────────────────
const openConfirmModal = () => {
  if (!canSend.value) return
  errorMessage.value = ''
  showConfirmModal.value = true
}

const cancelConfirm = () => {
  showConfirmModal.value = false
}

const sendBroadcast = async () => {
  showConfirmModal.value = false
  sending.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const res = await fetch(`${API_BASE}/api/messages/broadcast`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject:      subject.value.trim(),
        messageBody:  messageBody.value.trim(),
        recipientIds: [...selectedIds.value],
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to send broadcast.')

    successMessage.value =
      `Broadcast sent to ${data.sent} recipient${data.sent !== 1 ? 's' : ''}.` +
      (data.failed > 0 ? ` (${data.failed} failed)` : '')

    // Reset form
    subject.value     = ''
    messageBody.value = ''
    selectedIds.value = new Set()

    // Reload history
    loadHistory()
  } catch (err) {
    errorMessage.value = err?.message || 'Failed to send broadcast.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="app-page-shell">
  <div class="app-page-canvas app-inner-shell bc-page">

    <MessageHeader />

    <!-- Page header ──────────────────────────────────────────────────────── -->
    <div class="bc-page-header ff-page-header app-header-gradient">
      <div>
        <h2 class="bc-page-title">Broadcast Message</h2>
        <p class="bc-page-sub">Send an individual message to multiple users at once</p>
      </div>
      <button class="bc-back-btn" @click="router.push('/messages')">
        <i class="fa-solid fa-arrow-left"></i> Back to Inbox
      </button>
    </div>

    <!-- Alerts ───────────────────────────────────────────────────────────── -->
    <div v-if="errorMessage"   class="alert alert-danger  bc-alert">{{ errorMessage }}</div>
    <div v-if="successMessage" class="alert alert-success bc-alert">{{ successMessage }}</div>

    <!-- Loading ──────────────────────────────────────────────────────────── -->
    <div v-if="!permissionsLoaded" class="bc-loading">
      <i class="fa-solid fa-spinner fa-spin"></i> Loading recipients…
    </div>

    <!-- Main layout ──────────────────────────────────────────────────────── -->
    <div v-if="permissionsLoaded" class="bc-layout">

      <!-- LEFT – Recipient selection ─────────────────────────────────────── -->
      <div class="bc-recipients panel-bg">

        <div class="bc-panel-head">
          <h4 class="bc-panel-title">
            <i class="fa-solid fa-users"></i> Recipients
          </h4>
          <div class="bc-badge" :class="selectedCount > 0 ? 'bc-badge-active' : ''">
            {{ selectedCount }} selected
          </div>
        </div>

        <!-- Filters ────────────────────────────────────────────────────── -->
        <div class="bc-filters">
          <button
            v-for="f in [
              { key: 'all',      label: 'All Clients' },
              { key: 'active',   label: 'Active'      },
              { key: 'premium',  label: 'Premium'     },
              { key: 'inactive', label: 'Inactive'    },
            ]"
            :key="f.key"
            class="bc-filter-btn"
            :class="{ active: activeFilter === f.key }"
            @click="activeFilter = f.key"
          >
            {{ f.label }}
            <span class="bc-filter-count">{{ filterCounts[f.key] }}</span>
          </button>
        </div>

        <!-- Select all / clear ──────────────────────────────────────────── -->
        <div class="bc-select-all-row">
          <label class="bc-check-label">
            <input
              type="checkbox"
              :checked="allFilteredSelected"
              :indeterminate="someFilteredSelected"
              @change="toggleAllFiltered"
            />
            <span>
              {{ allFilteredSelected ? 'Deselect All' : 'Select All' }}
              ({{ filteredRecipients.length }})
            </span>
          </label>
          <button v-if="selectedCount > 0" class="bc-clear-btn" @click="clearSelection">
            <i class="fa-solid fa-xmark"></i> Clear
          </button>
        </div>

        <!-- Recipient list ──────────────────────────────────────────────── -->
        <div class="bc-recipient-list">
          <div v-if="loading" class="bc-list-empty">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading…
          </div>
          <div v-else-if="filteredRecipients.length === 0" class="bc-list-empty">
            No recipients match this filter.
          </div>
          <label
            v-for="r in filteredRecipients"
            :key="r.id"
            class="bc-recipient-row"
            :class="{ selected: selectedIds.has(r.id) }"
          >
            <input
              type="checkbox"
              :checked="selectedIds.has(r.id)"
              @change="toggleRecipient(r.id)"
            />
            <div class="bc-avatar">{{ getInitial(r) }}</div>
            <div class="bc-recipient-info">
              <span class="bc-recipient-name">{{ r.displayName }}</span>
              <span class="bc-recipient-meta">
                <span v-if="r.tier >= 2" class="bc-tag-premium">Premium</span>
                <span class="bc-tag-role">{{ r.role }}</span>
              </span>
            </div>
          </label>
        </div>
      </div>

      <!-- RIGHT – Compose + History ──────────────────────────────────────── -->
      <div class="bc-right">

        <!-- Compose card ─────────────────────────────────────────────────── -->
        <div class="bc-card panel-bg">
          <div class="bc-panel-head">
            <h4 class="bc-panel-title">
              <i class="fa-solid fa-pen-to-square"></i> Compose
            </h4>
            <div v-if="selectedCount > 0" class="bc-sending-to">
              Sending to <strong>{{ selectedCount }}</strong> recipient{{ selectedCount !== 1 ? 's' : '' }}
            </div>
          </div>

          <div class="bc-field">
            <label class="bc-label">Subject</label>
            <input
              v-model="subject"
              type="text"
              class="form-control"
              placeholder="Enter message subject…"
              maxlength="255"
            />
          </div>

          <div class="bc-field">
            <label class="bc-label">Message</label>
            <textarea
              v-model="messageBody"
              class="form-control bc-textarea"
              placeholder="Type your message here…"
              rows="7"
            ></textarea>
          </div>

          <div class="bc-actions">
            <button class="bc-btn-cancel" @click="router.push('/messages')">
              <i class="fa-solid fa-xmark"></i> Cancel
            </button>
            <button
              class="bc-btn-send"
              :disabled="!canSend"
              @click="openConfirmModal"
            >
              <i v-if="sending" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-paper-plane"></i>
              {{ sending ? 'Sending…' : `Send to ${selectedCount || '–'} Recipient${selectedCount !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>

        <!-- Broadcast history ────────────────────────────────────────────── -->
        <div class="bc-card panel-bg">
          <div class="bc-panel-head">
            <h4 class="bc-panel-title">
              <i class="fa-solid fa-clock-rotate-left"></i> Broadcast History
            </h4>
            <span v-if="historyTotal > 0" class="bc-history-total">{{ historyTotal }} total</span>
          </div>

          <div v-if="historyLoading" class="bc-history-empty">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading history…
          </div>
          <div v-else-if="broadcastHistory.length === 0" class="bc-history-empty">
            No broadcasts sent yet.
          </div>
          <div v-else class="bc-history-list">
            <div v-for="item in broadcastHistory" :key="item.id" class="bc-history-row">
              <div class="bc-history-icon">
                <i class="fa-solid fa-broadcast-tower"></i>
              </div>
              <div class="bc-history-info">
                <div class="bc-history-subject">{{ item.subject }}</div>
                <div class="bc-history-meta">
                  {{ item.sender.displayName }}
                  &middot;
                  {{ item.recipientCount }} recipient{{ item.recipientCount !== 1 ? 's' : '' }}
                  &middot;
                  {{ formatDate(item.createdAt) }}
                </div>
              </div>
              <span
                class="bc-status-badge"
                :class="`bc-status-${item.status}`"
              >{{ item.status }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Confirmation modal ────────────────────────────────────────────────── -->
    <div
      v-if="showConfirmModal"
      class="bc-modal-overlay"
      @click.self="cancelConfirm"
    >
      <div class="bc-modal panel-bg">
        <div class="bc-modal-icon-row">
          <div class="bc-modal-icon-circle">
            <i class="fa-solid fa-paper-plane"></i>
          </div>
        </div>
        <h4 class="bc-modal-title">Confirm Broadcast</h4>
        <p class="bc-modal-body">
          You are about to send this message to
          <strong>{{ selectedCount }} user{{ selectedCount !== 1 ? 's' : '' }}</strong>.
          Each recipient will receive a separate, private conversation.
        </p>
        <div class="bc-modal-preview">
          <div class="bc-preview-label">Subject</div>
          <div class="bc-preview-value">{{ subject }}</div>
        </div>
        <div class="bc-modal-actions">
          <button class="bc-btn-cancel" @click="cancelConfirm">
            <i class="fa-solid fa-xmark"></i> Cancel
          </button>
          <button class="bc-btn-send" @click="sendBroadcast">
            <i class="fa-solid fa-paper-plane"></i> Confirm &amp; Send
          </button>
        </div>
      </div>
    </div>

  </div>
  </div>
</template>

<style scoped>
/* ── Layout ───────────────────────────────────────────────────────────────── */
.bc-page {
  color: var(--text-color);
}
.bc-page-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px;
  border: 1.5px solid rgba(148,163,184,.44);
  padding: 14px 18px; margin-bottom: 16px;
}
.bc-page-title  { font-size: 1.45rem; font-weight: 700; margin: 0; color: #ffffff; }
.bc-page-sub    { font-size: .83rem; opacity: .92; margin: 3px 0 0; color: #cbd5e1; font-weight: 500; }
.bc-back-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px; border-radius: 8px; border: 1.5px solid rgba(148,163,184,.35);
  background: transparent; color: var(--text-color); font-size: .85rem;
  cursor: pointer; transition: background .15s, border-color .15s;
}
.bc-back-btn:hover { background: rgba(255,255,255,.06); border-color: rgba(148,163,184,.6); }

.bc-alert { margin-bottom: 14px; }

.bc-loading {
  display: flex; align-items: center; gap: 10px;
  padding: 40px; justify-content: center;
  font-size: .9rem; color: var(--text-color-secondary);
}

.bc-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 18px;
  align-items: flex-start;
}

/* ── Shared panel head ────────────────────────────────────────────────────── */
.bc-panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding-bottom: 14px; margin-bottom: 16px;
  border-bottom: 1.5px solid rgba(148,163,184,.24);
}
.bc-panel-title {
  font-size: .92rem; font-weight: 700; color: var(--text-color);
  margin: 0; display: flex; align-items: center; gap: 8px;
}
.bc-panel-title i { color: #2081e2; }
.bc-badge {
  font-size: .72rem; font-weight: 700; padding: 3px 10px;
  border-radius: 20px; background: rgba(148,163,184,.15);
  color: var(--text-color-secondary);
}
.bc-badge.bc-badge-active { background: rgba(32,129,226,.18); color: #60a5fa; }

/* ── Recipients panel ─────────────────────────────────────────────────────── */
.bc-recipients {
  border-radius: 14px;
  padding: 20px;
  border: 1.5px solid rgba(148,163,184,.32);
  max-height: calc(100vh - 240px);
  display: flex; flex-direction: column; gap: 0;
  overflow: hidden;
}

.bc-filters {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px;
}
.bc-filter-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 20px; border: 1.5px solid rgba(148,163,184,.28);
  background: transparent; color: var(--text-color); font-size: .78rem;
  cursor: pointer; transition: all .15s;
}
.bc-filter-btn:hover        { border-color: rgba(32,129,226,.5); color: #60a5fa; }
.bc-filter-btn.active       { background: rgba(32,129,226,.18); border-color: rgba(32,129,226,.5); color: #60a5fa; }
.bc-filter-count {
  background: rgba(255,255,255,.12); border-radius: 10px;
  padding: 1px 6px; font-size: .72rem; font-weight: 700;
}
.bc-filter-btn.active .bc-filter-count { background: rgba(32,129,226,.25); }

.bc-select-all-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; margin-bottom: 6px;
  border-radius: 8px; background: rgba(255,255,255,.03);
  border: 1px solid rgba(148,163,184,.15);
}
.bc-check-label {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: .82rem; color: var(--text-color); cursor: pointer;
}
.bc-clear-btn {
  background: transparent; border: none;
  font-size: .76rem; color: var(--text-color-secondary);
  cursor: pointer; display: flex; align-items: center; gap: 5px;
  transition: color .15s;
}
.bc-clear-btn:hover { color: #f87171; }

.bc-recipient-list {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 3px;
  padding-right: 4px;
}
.bc-recipient-list::-webkit-scrollbar { width: 5px; }
.bc-recipient-list::-webkit-scrollbar-thumb { background: rgba(148,163,184,.25); border-radius: 3px; }

.bc-list-empty {
  text-align: center; padding: 30px 10px;
  color: var(--text-color-secondary); font-size: .83rem;
}

.bc-recipient-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 9px; cursor: pointer;
  border: 1.5px solid transparent;
  transition: background .12s, border-color .12s;
}
.bc-recipient-row:hover   { background: rgba(255,255,255,.04); border-color: rgba(148,163,184,.2); }
.bc-recipient-row.selected{ background: rgba(32,129,226,.1);  border-color: rgba(32,129,226,.3); }

.bc-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #2081e2 0%, #7c3aed 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: .8rem; font-weight: 700; color: #fff;
}
.bc-recipient-info  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.bc-recipient-name  { font-size: .83rem; font-weight: 600; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bc-recipient-meta  { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

.bc-tag-premium {
  font-size: .65rem; font-weight: 700; padding: 1px 6px; border-radius: 10px;
  background: linear-gradient(90deg, #f59e0b, #f97316); color: #fff;
}
.bc-tag-role {
  font-size: .65rem; font-weight: 600; padding: 1px 6px; border-radius: 10px;
  background: rgba(148,163,184,.15); color: var(--text-color-secondary);
  text-transform: capitalize;
}

/* ── Right column ─────────────────────────────────────────────────────────── */
.bc-right {
  display: flex; flex-direction: column; gap: 18px;
}
.bc-card {
  border-radius: 14px; padding: 22px 24px;
  border: 1.5px solid rgba(148,163,184,.32);
}

.bc-sending-to {
  font-size: .8rem; color: var(--text-color-secondary);
}
.bc-sending-to strong { color: #60a5fa; }

.bc-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.bc-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--text-color-secondary);
}
.bc-textarea { resize: vertical; min-height: 140px; }

.bc-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 4px;
}

.bc-btn-cancel {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 10px 18px; border-radius: 8px;
  border: 1.5px solid rgba(148,163,184,.35);
  background: transparent; color: var(--text-color);
  font-size: .85rem; cursor: pointer; transition: all .15s;
}
.bc-btn-cancel:hover { background: rgba(255,255,255,.05); }

.bc-btn-send {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 22px; border-radius: 8px; border: none;
  background: #2081e2; color: #fff;
  font-size: .88rem; font-weight: 600; cursor: pointer;
  transition: background .15s;
}
.bc-btn-send:hover    { background: #176bbf; }
.bc-btn-send:disabled { background: rgba(32,129,226,.4); cursor: not-allowed; }

/* ── History ──────────────────────────────────────────────────────────────── */
.bc-history-total {
  font-size: .75rem; color: var(--text-color-secondary);
}
.bc-history-empty {
  text-align: center; padding: 24px 10px;
  color: var(--text-color-secondary); font-size: .83rem;
}
.bc-history-list  { display: flex; flex-direction: column; gap: 4px; }
.bc-history-row {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 12px; border-radius: 9px;
  border: 1px solid rgba(148,163,184,.18);
  transition: background .12s;
}
.bc-history-row:hover { background: rgba(255,255,255,.03); }
.bc-history-icon {
  width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
  background: rgba(32,129,226,.15); color: #2081e2;
  display: flex; align-items: center; justify-content: center;
  font-size: .85rem;
}
.bc-history-info    { flex: 1; min-width: 0; }
.bc-history-subject { font-size: .85rem; font-weight: 600; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bc-history-meta    { font-size: .73rem; color: var(--text-color-secondary); margin-top: 2px; }

.bc-status-badge {
  font-size: .68rem; font-weight: 700; padding: 3px 9px;
  border-radius: 20px; flex-shrink: 0; text-transform: capitalize;
}
.bc-status-sent    { background: rgba(22,163,74,.18);  color: #4ade80; }
.bc-status-partial { background: rgba(245,158,11,.18); color: #fbbf24; }
.bc-status-failed  { background: rgba(239,68,68,.18);  color: #f87171; }

/* ── Confirmation modal ──────────────────────────────────────────────────── */
.bc-modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.bc-modal {
  width: 100%; max-width: 440px; border-radius: 16px; padding: 30px 28px;
  border: 1.5px solid rgba(148,163,184,.35);
}
.bc-modal-icon-row {
  display: flex; justify-content: center; margin-bottom: 16px;
}
.bc-modal-icon-circle {
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(32,129,226,.2); color: #60a5fa;
  display: flex; align-items: center; justify-content: center; font-size: 1.2rem;
}
.bc-modal-title {
  text-align: center; font-size: 1.1rem; font-weight: 700;
  margin: 0 0 12px; color: var(--text-color);
}
.bc-modal-body {
  text-align: center; font-size: .88rem;
  color: var(--text-color-secondary); line-height: 1.6; margin: 0 0 18px;
}
.bc-modal-body strong { color: var(--text-color); }

.bc-modal-preview {
  background: rgba(255,255,255,.05); border: 1px solid rgba(148,163,184,.2);
  border-radius: 8px; padding: 12px 14px; margin-bottom: 22px;
}
.bc-preview-label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-color-secondary); margin-bottom: 4px; }
.bc-preview-value { font-size: .88rem; font-weight: 500; color: var(--text-color); }

.bc-modal-actions {
  display: flex; gap: 10px; justify-content: flex-end;
}

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .bc-layout {
    grid-template-columns: 1fr;
  }
  .bc-recipients {
    max-height: 380px;
  }
}
@media (max-width: 600px) {
  .bc-page-header { flex-direction: column; align-items: flex-start; }
  .bc-actions { flex-direction: column; }
  .bc-btn-cancel, .bc-btn-send { width: 100%; justify-content: center; }
  .bc-modal-actions { flex-direction: column-reverse; }
  .bc-btn-cancel, .bc-modal-actions .bc-btn-send { width: 100%; justify-content: center; }
}
</style>
