<script setup>
import { computed, onMounted, ref } from 'vue'
import { API_BASE } from '@/config/env'

const gatewayStatus = ref('warning')
const storageStatus = ref('warning')
const imageStatus = ref('warning')

const tools = computed(() => [
  {
    name: 'Gateway Connectivity',
    description: 'Verify communication with the FlexFit Gateway.',
    status: gatewayStatus.value,
  },
  {
    name: 'MinIO Connectivity',
    description: 'Verify Gateway can communicate with MinIO storage.',
    status: storageStatus.value,
  },
  {
    name: 'Test Image Retrieval',
    description: 'Verify image retrieval through Gateway and MinIO.',
    status: imageStatus.value,
  },
])

const imageCacheBuster = ref(Date.now())
const imageSrc = computed(() => {
  return `${API_BASE}/api/tools/test-image?ts=${imageCacheBuster.value}`
})

const imageLoading = ref(false)
const imageError = ref('')
const imageLoadedAt = ref('')
const imageDimensions = ref('')
const statusTimestamp = ref('')

function statusLabel(status) {
  if (status === 'online') return 'Online'
  if (status === 'offline') return 'Offline'
  if (status === 'error') return 'Error'
  return 'Warning'
}

function statusBadgeClass(status) {
  if (status === 'online') {
    return 'bg-success-subtle text-success-emphasis border border-success-subtle'
  }
  if (status === 'offline' || status === 'error') {
    return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle'
  }
  return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
}

function resetImagePreview() {
  imageLoading.value = true
  imageError.value = ''
  imageLoadedAt.value = ''
  imageDimensions.value = ''
  imageStatus.value = 'warning'
  imageCacheBuster.value = Date.now()
}

function handleImageLoad(event) {
  const width = event?.target?.naturalWidth || 0
  const height = event?.target?.naturalHeight || 0
  imageDimensions.value = `${width} x ${height}`
  imageLoadedAt.value = new Date().toLocaleString()
  imageLoading.value = false
  imageError.value = ''
  imageStatus.value = 'online'
}

function handleImageError() {
  imageLoading.value = false
  imageError.value = 'Failed to load test image through backend gateway proxy.'
  imageStatus.value = 'error'
}

async function loadToolsStatus() {
  gatewayStatus.value = 'warning'
  storageStatus.value = 'warning'

  try {
    const response = await fetch(`${API_BASE}/api/tools/status`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

    if (!response.ok) {
      throw new Error(`Tools status request failed (${response.status})`)
    }

    const data = await response.json()
    gatewayStatus.value = data.gateway ? 'online' : 'offline'
    storageStatus.value = data.storage ? 'online' : 'offline'
    if (data.timestamp) {
      statusTimestamp.value = new Date(data.timestamp).toLocaleString()
    }
  } catch (error) {
    console.error('Failed to load tools status:', error)
    gatewayStatus.value = 'error'
    storageStatus.value = 'error'
  }
}

async function refreshToolsPage() {
  await loadToolsStatus()

  resetImagePreview()
}

onMounted(() => {
  refreshToolsPage()
})
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-20">
      <div>
        <h2 class="mb-0">Tools</h2>
        <small class="text-muted">Administrative utilities and infrastructure diagnostics.</small>
      </div>
      <button class="btn btn-sm btn-primary" type="button" @click="refreshToolsPage">
        Refresh Status
      </button>
    </div>

    <div class="panel-bg role-table-wrap mobile-table">
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tool in tools" :key="tool.name">
              <td data-label="Tool" class="fw-semibold">{{ tool.name }}</td>
              <td data-label="Description">{{ tool.description }}</td>
              <td data-label="Status">
                <span class="badge" :class="statusBadgeClass(tool.status)">
                  {{ statusLabel(tool.status) }}
                </span>
              </td>
            </tr>
            <tr v-if="!tools.length">
              <td colspan="3" class="text-center text-muted py-4">No tools configured.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel-bg image-card mt-20">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-12">
        <div>
          <h5 class="mb-1">Gateway Test Image</h5>
          <small class="text-muted">Retrieved through backend endpoint {{ API_BASE }}/api/tools/test-image</small>
        </div>
        <span class="badge" :class="statusBadgeClass(imageStatus)">{{ statusLabel(imageStatus) }}</span>
      </div>

      <div class="image-stage">
        <div v-if="imageLoading" class="loading-state">
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Loading Gateway test image...
        </div>

        <div v-else-if="imageError" class="alert alert-danger py-2 mb-0" role="alert">
          {{ imageError }}
        </div>

        <img
          v-show="!imageError"
          :src="imageSrc"
          alt="Gateway Test Image"
          class="gateway-image"
          :class="{ 'image-hidden': imageLoading }"
          @load="handleImageLoad"
          @error="handleImageError"
        />
      </div>

      <div class="meta-grid mt-12">
        <div><strong>Dimensions:</strong> {{ imageDimensions || '-' }}</div>
        <div><strong>Loaded At:</strong> {{ imageLoadedAt || '-' }}</div>
        <div><strong>Status Check:</strong> {{ statusTimestamp || '-' }}</div>
        <div><strong>Success:</strong> {{ imageStatus === 'online' ? 'Yes' : 'No' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-table-wrap {
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 12px;
  padding: 14px;
}

:global(body.dark-theme) .role-table-wrap {
  border-color: rgba(255,255,255,.16);
}

.image-card {
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 12px;
  padding: 14px;
}

:global(body.dark-theme) .image-card {
  border-color: rgba(255,255,255,.16);
}

.image-stage {
  background: rgba(15, 23, 42, 0.03);
  border: 1px dashed rgba(15, 23, 42, 0.15);
  border-radius: 10px;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 10px;
}

:global(body.dark-theme) .image-stage {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255,255,255,.16);
}

.loading-state {
  color: inherit;
  font-weight: 500;
}

.gateway-image {
  width: 100%;
  max-height: 460px;
  object-fit: contain;
  border-radius: 8px;
}

.image-hidden {
  opacity: 0;
  pointer-events: none;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 8px 12px;
  font-size: 0.92rem;
}

@media (max-width: 768px) {
  .image-stage {
    min-height: 180px;
  }
}
</style>
