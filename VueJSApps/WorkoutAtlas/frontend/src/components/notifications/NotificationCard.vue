<script setup>
const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click'])

const TYPE_ICONS = {
  MESSAGE:    'fa-light fa-comment-dots',
  WORKOUT:    'fa-solid fa-dumbbell',
  NUTRITION:  'fa-solid fa-utensils',
  MEMBERSHIP: 'fa-solid fa-id-card',
  SYSTEM:     'fa-light fa-gear',
  ADMIN:      'fa-solid fa-shield-halved',
}

const TYPE_COLORS = {
  MESSAGE:    '#2563eb',
  WORKOUT:    '#8b5cf6',
  NUTRITION:  '#10b981',
  MEMBERSHIP: '#f59e0b',
  SYSTEM:     '#64748b',
  ADMIN:      '#ef4444',
}

const iconClass = (type) =>
  TYPE_ICONS[String(type || 'SYSTEM').toUpperCase()] || TYPE_ICONS.SYSTEM

const iconColor = (type) =>
  TYPE_COLORS[String(type || 'SYSTEM').toUpperCase()] || TYPE_COLORS.SYSTEM

const formatRelative = (value) => {
  if (!value) return ''
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

const formatDateTime = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

const onCardClick = () => {
  emit('click', props.item)
}
</script>

<template>
  <button
    type="button"
    class="notification-card"
    :class="{ unread: !item.isRead, compact }"
    @click="onCardClick"
  >
    <div
      class="notif-icon"
      :style="{ color: iconColor(item.notificationType) }"
      aria-hidden="true"
    >
      <i :class="iconClass(item.notificationType)"></i>
    </div>

    <div class="notif-body">
      <div class="notif-top">
        <span class="notif-title">{{ item.title }}</span>
        <span v-if="!item.isRead" class="unread-dot" aria-label="Unread"></span>
      </div>

      <p class="notif-message" :class="{ 'line-clamp-2': compact }">{{ item.message }}</p>

      <div class="notif-meta">
        <span class="notif-type">{{ item.notificationType }}</span>
        <span class="notif-time">{{ compact ? formatRelative(item.createdAt) : formatDateTime(item.createdAt) }}</span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.notification-card {
  width: 100%;
  text-align: left;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--main-color);
  cursor: pointer;
  transition: background 0.15s ease;
}

.notification-card.unread {
  border-left: 4px solid #2563eb;
}

.notification-card:hover {
  background: rgba(37, 99, 235, 0.06);
}

.notification-card.compact {
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--border-color);
  padding: 10px 14px;
}

.notification-card.compact:last-child {
  border-bottom: none;
}

.notif-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  font-size: 1rem;
  border-radius: 8px;
  background: rgba(100, 116, 139, 0.08);
  flex-shrink: 0;
}

.notif-body {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 4px;
}

.notif-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.notif-title {
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2563eb;
  flex-shrink: 0;
}

.notif-message {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 0.83rem;
  line-height: 1.4;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.notif-type {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-color-secondary);
}

.notif-time {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
}
</style>
