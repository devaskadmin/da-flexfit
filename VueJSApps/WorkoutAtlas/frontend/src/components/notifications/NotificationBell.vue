<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/env'
import { vClickOutside } from '@/composable/outsideClicker'
import NotificationDropdown from '@/components/notifications/NotificationDropdown.vue'

const router = useRouter()

const isOpen = ref(false)
const unreadCount = ref(0)
const recentItems = ref([])
const loading = ref(false)
const errorMessage = ref('')

const unreadBadge = computed(() => (unreadCount.value > 9 ? '9+' : String(unreadCount.value)))

let pollTimer = null

const fetchUnreadCount = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
      credentials: 'include',
    })
    if (!response.ok) return
    const data = await response.json()
    unreadCount.value = Number(data?.unreadCount || 0)
  } catch {
    // silent
  }
}

const fetchRecent = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetch(`${API_BASE}/api/notifications?limit=10`, {
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Failed to load notifications.')
    const data = await response.json()
    recentItems.value = Array.isArray(data?.items) ? data.items : []
    unreadCount.value = recentItems.value.filter((item) => !item.isRead).length
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to load notifications.'
  } finally {
    loading.value = false
  }
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    fetchRecent()
  }
}

const closeDropdown = () => {
  isOpen.value = false
}

const markSingleRead = async (notificationId) => {
  try {
    await fetch(`${API_BASE}/api/notifications/read`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    })
    recentItems.value = recentItems.value.map((item) =>
      item.id === notificationId ? { ...item, isRead: true } : item
    )
    unreadCount.value = recentItems.value.filter((item) => !item.isRead).length
  } catch {
    // silent
  }
}

const markAllRead = async () => {
  try {
    await fetch(`${API_BASE}/api/notifications/read`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    })
    const now = new Date().toISOString()
    recentItems.value = recentItems.value.map((item) => ({ ...item, isRead: true, readAt: item.readAt || now }))
    unreadCount.value = 0
  } catch {
    // silent
  }
}

const handleItemClick = async (item) => {
  if (!item.isRead) {
    await markSingleRead(item.id)
  }

  const link = item.link || item.actionUrl || null

  if (!link) {
    return
  }

  closeDropdown()

  if (/^https?:\/\//i.test(link)) {
    window.open(link, '_blank', 'noopener,noreferrer')
    return
  }

  router.push(link)
}

const viewAll = () => {
  closeDropdown()
  router.push({ name: 'notifications' })
}

onMounted(() => {
  fetchUnreadCount()
  pollTimer = setInterval(fetchUnreadCount, 60000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="notification-bell-wrap" v-click-outside="closeDropdown">
    <button
      type="button"
      class="navbar-btn"
      :aria-expanded="isOpen"
      aria-label="Notifications"
      title="Notifications"
      @click.stop="toggleDropdown"
    >
      <i class="fa-light fa-bell animate"></i>
      <span v-if="unreadCount > 0" class="badge bg-danger">{{ unreadBadge }}</span>
    </button>

    <Transition name="dropdown-fade">
      <NotificationDropdown
        v-if="isOpen"
        :items="recentItems"
        :loading="loading"
        :error-message="errorMessage"
        :unread-count="unreadCount"
        @click-item="handleItemClick"
        @mark-all-read="markAllRead"
        @view-all="viewAll"
      />
    </Transition>
  </div>
</template>

<style scoped>
.notification-bell-wrap {
  position: relative;
}

/* Inherited from HeaderComponent global scope */
.navbar-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: #464646;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
  position: relative;
}

.navbar-btn:hover {
  color: #1e293b;
}

.navbar-btn .badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  font-size: 0.7rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Dropdown fade animation */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .navbar-btn {
    width: 36px;
    height: 36px;
    font-size: 1rem;
    padding: 0;
    justify-content: center;
  }

  .navbar-btn .badge {
    transform: scale(0.85);
    top: -3px;
    right: -3px;
    min-width: 16px;
    height: 16px;
    font-size: 0.65rem;
  }
}
</style>
