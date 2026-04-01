<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const notifications = ref([])
const activeFilter = ref('all')

const unreadCount = computed(() => notifications.value.filter((item) => !item.isRead).length)
const filteredNotifications = computed(() => {
  if (activeFilter.value === 'unread') {
    return notifications.value.filter((item) => !item.isRead)
  }
  return notifications.value
})

const fetchNotifications = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`${API_BASE}/api/notifications?limit=100`, {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to load notifications.')
    }

    const data = await response.json()
    notifications.value = Array.isArray(data?.items) ? data.items : []
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to load notifications.'
  } finally {
    loading.value = false
  }
}

const markAsRead = async (notificationId) => {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to mark notification as read.')
    }

    notifications.value = notifications.value.map((item) =>
      item.id === notificationId
        ? {
            ...item,
            isRead: true,
            readAt: item.readAt || new Date().toISOString(),
          }
        : item
    )
  } catch {
    // Silent fail; user can retry.
  }
}

const markAllAsRead = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
      method: 'PATCH',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to mark all as read.')
    }

    const now = new Date().toISOString()
    notifications.value = notifications.value.map((item) => ({
      ...item,
      isRead: true,
      readAt: item.readAt || now,
    }))
  } catch {
    // Silent fail; user can retry.
  }
}

const openNotification = async (notification) => {
  if (!notification.isRead) {
    await markAsRead(notification.id)
  }

  if (!notification.actionUrl) return

  if (/^https?:\/\//i.test(notification.actionUrl)) {
    window.open(notification.actionUrl, '_blank')
    return
  }

  router.push(notification.actionUrl)
}

const formatDateTime = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

onMounted(fetchNotifications)
</script>

<template>
  <div class="notifications-page">
    <div class="dashboard-breadcrumb ff-page-header mb-25">
      <h2>Notifications</h2>
      <div class="dashboard-filter d-flex align-items-center gap-2">
        <span class="header-meta">Unread: {{ unreadCount }}</span>
        <button type="button" class="btn btn-sm btn-light" @click="markAllAsRead" :disabled="unreadCount === 0">
          Mark all read
        </button>
      </div>
    </div>

    <section class="panel panel-bg notifications-panel">
      <div class="panel-header notifications-head">
        <div class="filter-group">
          <button type="button" class="btn btn-sm" :class="activeFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'" @click="activeFilter = 'all'">
            All
          </button>
          <button type="button" class="btn btn-sm" :class="activeFilter === 'unread' ? 'btn-primary' : 'btn-outline-primary'" @click="activeFilter = 'unread'">
            Unread
          </button>
        </div>

        <button type="button" class="btn btn-sm btn-outline-secondary" @click="fetchNotifications" :disabled="loading">
          Refresh
        </button>
      </div>

      <div class="panel-body">
        <p v-if="loading" class="state-message">Loading notifications...</p>
        <p v-else-if="errorMessage" class="state-message text-danger">{{ errorMessage }}</p>
        <p v-else-if="filteredNotifications.length === 0" class="state-message">No notifications found.</p>

        <ul v-else class="notifications-list">
          <li
            v-for="item in filteredNotifications"
            :key="item.id"
            class="notification-item"
            :class="{ unread: !item.isRead, clickable: !!item.actionUrl }"
            @click="openNotification(item)"
          >
            <div class="notification-title-row">
              <h5>{{ item.title }}</h5>
              <span v-if="!item.isRead" class="badge bg-primary">New</span>
            </div>
            <p class="notification-message">{{ item.message }}</p>
            <div class="notification-meta">
              <span class="type-pill">{{ item.type }}</span>
              <span>{{ formatDateTime(item.createdAt) }}</span>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.notifications-page {
  display: grid;
  gap: 12px;
}

.header-meta {
  color: #ffffff;
  font-weight: 600;
}

.notifications-panel {
  border: 1px solid var(--border-color);
}

.notifications-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  gap: 8px;
}

.state-message {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
}

.notifications-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.notification-item {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  background: var(--main-color);
}

.notification-item.unread {
  border-left: 4px solid #2563eb;
}

.notification-item.clickable {
  cursor: pointer;
}

.notification-item.clickable:hover {
  background: rgba(37, 99, 235, 0.08);
}

.notification-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.notification-title-row h5 {
  margin: 0;
  color: var(--text-color);
}

.notification-message {
  margin: 6px 0;
  color: var(--text-color-secondary);
}

.notification-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-color-secondary);
  font-size: 0.82rem;
  flex-wrap: wrap;
}

.type-pill {
  text-transform: capitalize;
  font-weight: 700;
}
</style>
