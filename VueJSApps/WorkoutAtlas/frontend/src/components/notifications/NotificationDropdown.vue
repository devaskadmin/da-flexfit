<script setup>
import NotificationList from '@/components/notifications/NotificationList.vue'

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  unreadCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['click-item', 'mark-all-read', 'view-all'])

const onCardClick = (item) => {
  emit('click-item', item)
}

const onMarkAllRead = () => {
  emit('mark-all-read')
}

const onViewAll = () => {
  emit('view-all')
}
</script>

<template>
  <div class="notif-dropdown" role="dialog" aria-label="Notifications">
    <div class="notif-dropdown-header">
      <span class="notif-dropdown-title">Notifications</span>
      <button
        v-if="unreadCount > 0"
        type="button"
        class="btn-mark-all"
        @click.stop="onMarkAllRead"
      >
        Mark all read
      </button>
    </div>

    <div class="notif-dropdown-body">
      <NotificationList
        :items="items"
        :loading="loading"
        :error-message="errorMessage"
        :compact="true"
        @click="onCardClick"
      />
    </div>

    <div class="notif-dropdown-footer">
      <button type="button" class="btn-view-all" @click.stop="onViewAll">
        View All Notifications
      </button>
    </div>
  </div>
</template>

<style scoped>
.notif-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 340px;
  max-width: calc(100vw - 24px);
  background: var(--main-color, #fff);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1200;
  overflow: hidden;
}

.notif-dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
}

.notif-dropdown-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-color);
}

.btn-mark-all {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.78rem;
  color: #2563eb;
  padding: 0;
}

.btn-mark-all:hover {
  text-decoration: underline;
}

.notif-dropdown-body {
  max-height: 320px;
  overflow-y: auto;
}

.notif-dropdown-footer {
  border-top: 1px solid var(--border-color);
  padding: 0;
}

.btn-view-all {
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #2563eb;
  text-align: center;
  transition: background 0.15s ease;
}

.btn-view-all:hover {
  background: rgba(37, 99, 235, 0.06);
}

@media (max-width: 480px) {
  .notif-dropdown {
    right: -60px;
  }
}
</style>
