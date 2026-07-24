<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const searchQuery = ref('')
const searchInputRef = ref(null)

const recentItems = [
  { label: 'Workout Log',  icon: 'fa-light fa-dumbbell' },
  { label: 'Exercises',    icon: 'fa-light fa-person-running' },
  { label: 'Nutrition',    icon: 'fa-light fa-utensils' },
  { label: 'History',      icon: 'fa-light fa-clock-rotate-left' },
]

const close = () => {
  emit('close')
}

const handleOverlayClick = (e) => {
  if (e.target === e.currentTarget) close()
}

const handleSearch = (e) => {
  e.preventDefault()
  // Extend with real search routing here — query is in searchQuery.value
  close()
}

const handleRecentClick = (label) => {
  searchQuery.value = label
  searchInputRef.value?.focus()
}

const handleKeydown = (e) => {
  if (e.key === 'Escape') close()
}

watch(() => props.isOpen, async (val) => {
  if (val) {
    document.body.style.overflow = 'hidden'
    await nextTick()
    searchInputRef.value?.focus()
  } else {
    document.body.style.overflow = ''
    searchQuery.value = ''
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="mobile-search-overlay"
        @click="handleOverlayClick"
        role="dialog"
        aria-modal="true"
        aria-label="Search WorkoutAtlas"
      >
        <div class="mobile-search-modal">
          <!-- Header -->
          <div class="modal-header">
            <span class="modal-title">Search WorkoutAtlas</span>
            <button class="modal-close-btn" @click="close" aria-label="Close search">
              <i class="fa-light fa-xmark"></i>
            </button>
          </div>

          <!-- Search input -->
          <form class="modal-search-form" @submit="handleSearch">
            <div class="modal-search-input-wrap">
              <i class="fa-light fa-magnifying-glass search-icon"></i>
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="search"
                placeholder="Search workouts, exercises, nutrition..."
                class="modal-search-input"
                autocomplete="off"
              />
            </div>
          </form>

          <!-- Recent searches -->
          <div class="modal-recents">
            <p class="recents-label">Recent</p>
            <ul class="recents-list">
              <li
                v-for="item in recentItems"
                :key="item.label"
                class="recents-item"
                @click="handleRecentClick(item.label)"
              >
                <i :class="item.icon" class="recent-icon"></i>
                <span>{{ item.label }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Overlay */
.mobile-search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.62);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  padding-left: 16px;
  padding-right: 16px;
}

/* Modal card */
.mobile-search-modal {
  background: #111827;
  border-radius: 14px;
  width: 100%;
  max-width: 480px;
  padding: 20px;
  border: 1px solid rgba(96, 165, 250, 0.25);
  box-shadow: 0 18px 50px rgba(2, 6, 23, 0.48);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Header row */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  border: none;
  background: none;
}

.modal-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #f8fafc;
}

.modal-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: #cbd5e1;
  padding: 6px 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.modal-close-btn:hover {
  background: rgba(59, 130, 246, 0.14);
  color: #f8fafc;
}

/* Search form */
.modal-search-form {
  width: 100%;
}

.modal-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #0b1220;
  border-radius: 10px;
  padding: 10px 14px;
  border: 1.5px solid rgba(96, 165, 250, 0.35);
  transition: border-color 0.2s, background 0.2s;
}

.modal-search-input-wrap:focus-within {
  border-color: #3b82f6;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}

.search-icon {
  color: #3b82f6;
  font-size: 1rem;
  flex-shrink: 0;
}

.modal-search-input {
  flex: 1;
  background: transparent !important;
  border: none !important;
  outline: none;
  box-shadow: none !important;
  font-size: 0.95rem;
  color: #f8fafc;
}

.modal-search-input::placeholder {
  color: #94a3b8;
}

/* Recent section */
.modal-recents {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recents-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #cbd5e1;
  margin: 0;
}

.recents-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recents-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1f2937;
  border: 1px solid rgba(96, 165, 250, 0.25);
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #f8fafc;
  transition: background 0.15s;
  user-select: none;
}

.recents-item:hover {
  background: #243041;
}

.recent-icon {
  color: #3b82f6;
  font-size: 0.95rem;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

/* Fade + slide transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .mobile-search-modal,
.modal-fade-leave-active .mobile-search-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-fade-enter-from .mobile-search-modal,
.modal-fade-leave-to .mobile-search-modal {
  transform: translateY(-10px);
  opacity: 0;
}

@media (max-width: 768px) {
  .mobile-search-overlay {
    align-items: flex-start;
    padding-top: 18px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .mobile-search-modal {
    max-width: none;
    border-radius: 20px;
    padding: 16px;
    gap: 14px;
    background: #111827;
    border: 1px solid rgba(96, 165, 250, 0.25);
    box-shadow: 0 18px 50px rgba(2, 6, 23, 0.48);
    max-height: calc(100dvh - 36px);
    overflow: auto;
  }

  .modal-title {
    font-size: 1rem;
    color: #f8fafc;
  }

  .modal-close-btn {
    color: #cbd5e1;
  }

  .modal-close-btn:hover {
    background: rgba(148, 163, 184, 0.12);
    color: #f8fafc;
  }

  .modal-search-input-wrap {
    background: #0b1220;
    border-color: rgba(96, 165, 250, 0.25);
    border-radius: 14px;
    padding: 12px 14px;
  }

  .modal-search-input-wrap:focus-within {
    background: #0f172a;
    border-color: #3b82f6;
  }

  .search-icon {
    color: #3b82f6;
  }

  .modal-search-input {
    color: #f8fafc;
    font-size: 0.98rem;
  }

  .modal-search-input::placeholder {
    color: #cbd5e1;
  }

  .modal-recents {
    gap: 10px;
  }

  .recents-label {
    color: #cbd5e1;
    letter-spacing: 0.12em;
  }

  .recents-list {
    gap: 6px;
  }

  .recents-item {
    padding: 12px 14px;
    border-radius: 12px;
    background: #1f2937;
    border: 1px solid rgba(96, 165, 250, 0.25);
    color: #f8fafc;
  }

  .recents-item:hover {
    background: #243041;
  }

  .recent-icon {
    color: #3b82f6;
  }
}

@media (max-width: 480px) {
  .mobile-search-overlay {
    padding-top: 12px;
    padding-left: 10px;
    padding-right: 10px;
  }

  .mobile-search-modal {
    border-radius: 18px;
    padding: 14px;
    gap: 12px;
    max-height: calc(100dvh - 24px);
  }

  .modal-header {
    gap: 12px;
  }

  .modal-title {
    font-size: 0.96rem;
  }

  .modal-search-input-wrap {
    padding: 11px 12px;
  }

  .modal-search-input,
  .recents-item {
    font-size: 0.92rem;
  }

  .recents-item {
    padding: 11px 12px;
  }
}

</style>
