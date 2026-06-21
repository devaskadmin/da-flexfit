<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/env'
import NotificationList from '@/components/notifications/NotificationList.vue'

const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const notifications = ref([])
const activeFilter = ref('all')
const currentPage = ref(1)
const pageSize = 50
const totalCount = ref(0)

const unreadCount = computed(() => notifications.value.filter((item) => !item.isRead).length)

const filteredNotifications = computed(() => {
  if (activeFilter.value === 'unread') {
    return notifications.value.filter((item) => !item.isRead)
  }
  return notifications.value
})

const hasMore = computed(() => {
  return totalCount.value > currentPage.value * pageSize
})

const formatDateTime = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

const fetchNotifications = async (reset = true) => {
  if (reset) {
    currentPage.value = 1
    notifications.value = []
  }

  loading.value = true
  errorMessage.value = ''

  const offset = (currentPage.value - 1) * pageSize
  const unreadOnly = activeFilter.value === 'unread'

  try {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
      ...(unreadOnly ? { unreadOnly: 'true' } : {}),
    })

    const response = await fetch(`${API_BASE}/api/notifications?${params}`, {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to load notifications.')
    }

    const data = await response.json()
    const items = Array.isArray(data?.items) ? data.items : []
    totalCount.value = Number(data?.total || 0)

    notifications.value = reset ? items : [...notifications.value, ...items]
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to load notifications.'
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  currentPage.value += 1
  await fetchNotifications(false)
}

const setFilter = (filter) => {
  activeFilter.value = filter
  fetchNotifications()
}

const markAsRead = async (notificationId) => {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/read`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    })

    if (!response.ok) return

    notifications.value = notifications.value.map((item) =>
      item.id === notificationId
        ? { ...item, isRead: true, readAt: item.readAt || new Date().toISOString() }
        : item
    )
  } catch {
    // silent
  }
}

const markAllAsRead = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/read`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    })

    if (!response.ok) return

    const now = new Date().toISOString()
    notifications.value = notifications.value.map((item) => ({
      ...item,
      isRead: true,
      readAt: item.readAt || now,
    }))
  } catch {
    // silent
  }
}

const openNotification = async (item) => {
  if (!item.isRead) {
    await markAsRead(item.id)
  }

  const link = item.link || null
  if (!link) return

  if (/^https?:\/\//i.test(link)) {
    window.open(link, '_blank', 'noopener,noreferrer')
    return
  }

  router.push(link)
}

onMounted(() => fetchNotifications())
</script>

<template>
  <div class="notification-center-page">
    <!-- Page header -->
    <div class="dashboard-breadcrumb ff-page-header mb-25 notif-page-header">
      <div>
        <h2>Notifications</h2>
        <p class="header-sub">Unread: {{ unreadCount }}</p>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="btn btn-sm btn-light"
          :disabled="unreadCount === 0 || loading"
          @click="markAllAsRead"
        >
          Mark all read
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="loading"
          @click="fetchNotifications()"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Filter bar -->
    <section class="panel panel-bg notif-panel">
      <div class="panel-header notif-panel-header">
        <div class="filter-group">
          <button
            type="button"
            class="btn btn-sm"
            :class="activeFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'"
            @click="setFilter('all')"
          >
            All
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="activeFilter === 'unread' ? 'btn-primary' : 'btn-outline-primary'"
            @click="setFilter('unread')"
          >
            Unread
          </button>
        </div>

        <span class="total-meta">
          {{ totalCount }} total
        </span>
      </div>

      <div class="panel-body">
        <NotificationList
          :items="filteredNotifications"
          :loading="loading"
          :error-message="errorMessage"
          @click="openNotification"
        />

        <div v-if="hasMore && !loading" class="load-more-wrap">
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="loadMore">
            Load more
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.notification-center-page {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.notif-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.header-sub {
  margin: 4px 0 0;
  color: #e2e8f0;
  font-size: 0.88rem;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.notif-panel {
  border: 1px solid var(--border-color);
}

.notif-panel-header {
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

.total-meta {
  color: var(--text-color-secondary);
  font-size: 0.83rem;
}

.load-more-wrap {
  display: flex;
  justify-content: center;
  padding-top: 12px;
}

.panel-body {
  min-width: 0;
}

@media (max-width: 576px) {
  .notif-page-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }
}
</style>
