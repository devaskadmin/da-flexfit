<script setup>
import EmptyNotifications from '@/components/notifications/EmptyNotifications.vue'
import NotificationCard from '@/components/notifications/NotificationCard.vue'

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
  compact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click'])

const onCardClick = (item) => {
  emit('click', item)
}
</script>

<template>
  <div class="notification-list-wrap">
    <p v-if="loading" class="state-message">Loading notifications...</p>
    <p v-else-if="errorMessage" class="state-message text-danger">{{ errorMessage }}</p>
    <EmptyNotifications v-else-if="items.length === 0" />

    <div v-else class="notification-list" :class="{ 'notification-list--compact': compact }">
      <NotificationCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        :compact="compact"
        @click="onCardClick"
      />
    </div>
  </div>
</template>

<style scoped>
.notification-list-wrap {
  min-width: 0;
}

.notification-list {
  display: grid;
  gap: 10px;
}

.notification-list--compact {
  gap: 0;
}

.state-message {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  background: var(--main-color);
  font-size: 0.85rem;
}
</style>
