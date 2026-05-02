<script setup>
import { ref, onMounted, computed } from 'vue'
import { API_BASE } from '@/config/env'

const emit = defineEmits(['close', 'avatar-selected'])

const avatars = ref([])
const selectedAvatar = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')

// Fetch available avatars from backend
const fetchAvatars = async () => {
  isLoading.value = true
  errorMessage.value = ''
  
  const url = `${API_BASE}/api/avatar/list`
  console.log('[AVATAR DEBUG] Fetching avatars from:', url)
  console.log('[AVATAR DEBUG] API_BASE:', API_BASE)
  
  try {
    const response = await fetch(url, {
      credentials: 'include'
    })
    
    console.log('[AVATAR DEBUG] Response status:', response.status)
    console.log('[AVATAR DEBUG] Response ok:', response.ok)
    
    if (!response.ok) {
      const text = await response.text()
      console.error('[AVATAR DEBUG] Error response:', text)
      throw new Error(`HTTP ${response.status}: ${text}`)
    }
    
    const data = await response.json()
    console.log('[AVATAR DEBUG] Response data:', data)
    
    if (data.success) {
      avatars.value = data.avatars
    } else {
      errorMessage.value = 'Failed to load avatars'
    }
  } catch (error) {
    console.error('[AVATAR DEBUG] Error fetching avatars:', error)
    console.error('[AVATAR DEBUG] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    })
    errorMessage.value = 'Failed to connect to server'
  } finally {
    isLoading.value = false
  }
}

// Select an avatar
const selectAvatar = (avatar) => {
  selectedAvatar.value = avatar
}

// Save selected avatar
const saveAvatar = async () => {
  if (!selectedAvatar.value) {
    return
  }
  
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const response = await fetch(`${API_BASE}/api/avatar/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        avatarName: selectedAvatar.value.name,
        avatarPath: selectedAvatar.value.path
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      emit('avatar-selected', data.user)
      emit('close')
    } else {
      errorMessage.value = data.message || 'Failed to save avatar'
    }
  } catch (error) {
    console.error('Error saving avatar:', error)
    errorMessage.value = 'Failed to save avatar'
  } finally {
    isLoading.value = false
  }
}

// Get full avatar URL
const getAvatarUrl = (avatar) => {
  return `${API_BASE}${avatar.path}`
}

onMounted(() => {
  fetchAvatars()
})
</script>

<template>
  <div class="avatar-modal-overlay" @click="$emit('close')">
    <div class="avatar-modal" @click.stop>
      <div class="modal-header">
        <h3>Choose Your Avatar</h3>
        <button class="close-btn" @click="$emit('close')" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Loading State -->
        <div v-if="isLoading && avatars.length === 0" class="loading-state">
          <div class="spinner"></div>
          <p>Loading avatars...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="errorMessage && avatars.length === 0" class="error-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>{{ errorMessage }}</p>
          <button @click="fetchAvatars" class="retry-btn">Retry</button>
        </div>

        <!-- Avatar Grid -->
        <div v-else class="avatar-grid">
          <div
            v-for="avatar in avatars"
            :key="avatar.name"
            class="avatar-option"
            :class="{ selected: selectedAvatar?.name === avatar.name }"
            @click="selectAvatar(avatar)"
          >
            <img :src="getAvatarUrl(avatar)" :alt="avatar.name" />
            <div class="avatar-checkmark">
              <i class="fa-solid fa-check"></i>
            </div>
          </div>
        </div>

        <!-- Error Message (during save) -->
        <div v-if="errorMessage && avatars.length > 0" class="error-message">
          {{ errorMessage }}
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-secondary">Cancel</button>
        <button
          @click="saveAvatar"
          class="btn btn-primary"
          :disabled="!selectedAvatar || isLoading"
        >
          <span v-if="isLoading">
            <i class="fa-solid fa-spinner fa-spin"></i> Saving...
          </span>
          <span v-else>Save Avatar</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.avatar-modal {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: #1e293b;
}

.modal-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #64748b;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #0d99ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state i {
  font-size: 3rem;
  color: #ef4444;
  margin-bottom: 16px;
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 20px;
  background: #0d99ff;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.retry-btn:hover {
  background: #0b7fd9;
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
}

.avatar-option {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all 0.2s ease;
  background: #f1f5f9;
}

.avatar-option:hover {
  border-color: #cbd5e1;
  transform: scale(1.05);
}

.avatar-option.selected {
  border-color: #0d99ff;
  box-shadow: 0 0 0 2px rgba(13, 153, 255, 0.2);
}

.avatar-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-checkmark {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: #0d99ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.avatar-option.selected .avatar-checkmark {
  opacity: 1;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 6px;
  text-align: center;
  font-size: 0.9rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  font-size: 0.95rem;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: #0d99ff;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #0b7fd9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Light theme specific styles */
.light-theme .avatar-modal {
  background: #ffffff;
}

.light-theme .modal-header h3 {
  color: #1e293b;
}

.light-theme .avatar-option {
  background: #f1f5f9;
}
</style>
