<script setup>
const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['open'])

const onOpen = () => {
  emit('open', props.item)
}
</script>

<template>
  <button type="button" class="message-card panel panel-bg" :class="{ unread: item.isUnread }" @click="onOpen">
    <div class="top-row">
      <h6 class="sender">{{ item.senderName }}</h6>
      <span class="date">{{ item.displayDate }}</span>
    </div>

    <p class="subject">{{ item.subject }}</p>
    <p class="preview">{{ item.preview }}</p>

    <div class="bottom-row">
      <span class="status" :class="item.isUnread ? 'status-unread' : 'status-read'">
        {{ item.isUnread ? 'Unread' : 'Read' }}
      </span>
    </div>
  </button>
</template>

<style scoped>
.message-card {
  width: 100%;
  text-align: left;
  border: 1px solid var(--border-color);
  display: grid;
  gap: 8px;
  padding: 14px;
}

.message-card.unread {
  border-left: 4px solid #2563eb;
}

.top-row,
.bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.sender {
  margin: 0;
  color: var(--text-color);
}

.date {
  color: var(--text-color-secondary);
  font-size: 0.82rem;
  white-space: nowrap;
}

.subject {
  margin: 0;
  color: var(--text-color);
  font-weight: 600;
}

.preview {
  margin: 0;
  color: var(--text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.status {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-unread {
  color: #2563eb;
}

.status-read {
  color: var(--text-color-secondary);
}
</style>
