<script setup>
import EmptyInbox from '@/components/messages/EmptyInbox.vue'
import MessageCard from '@/components/messages/MessageCard.vue'

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
})

const emit = defineEmits(['open'])

const openMessage = (item) => {
  emit('open', item)
}
</script>

<template>
  <div class="message-list-wrap">
    <p v-if="loading" class="state-message">Loading conversations...</p>
    <p v-else-if="errorMessage" class="state-message text-danger">{{ errorMessage }}</p>
    <EmptyInbox v-else-if="items.length === 0" />

    <div v-else class="message-list">
      <MessageCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        @open="openMessage"
      />
    </div>
  </div>
</template>

<style scoped>
.message-list-wrap {
  min-width: 0;
}

.message-list {
  display: grid;
  gap: 10px;
}

.state-message {
  margin: 0;
  padding: 14px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  background: var(--main-color);
}
</style>
