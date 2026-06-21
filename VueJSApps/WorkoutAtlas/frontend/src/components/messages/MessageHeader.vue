<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  showCompose: {
    type: Boolean,
    default: false,
  },
  showBack: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()

const goCompose = () => {
  router.push({ name: 'messages_compose' })
}

const goBack = () => {
  router.push({ name: 'messages_inbox' })
}
</script>

<template>
  <div class="dashboard-breadcrumb ff-page-header mb-25 message-header-wrap">
    <div>
      <h2>{{ title }}</h2>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>

    <div class="actions">
      <button v-if="showBack" type="button" class="btn btn-sm btn-outline-light" @click="goBack">
        <i class="fa-light fa-arrow-left"></i>
        Back to Inbox
      </button>
      <button v-if="showCompose" type="button" class="btn btn-sm btn-light" @click="goCompose">
        <i class="fa-light fa-pen-to-square"></i>
        Compose
      </button>
    </div>
  </div>
</template>

<style scoped>
.message-header-wrap {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}

.subtitle {
  margin: 6px 0 0;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
