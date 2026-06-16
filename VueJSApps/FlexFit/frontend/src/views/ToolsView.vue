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

const migrationBusy = ref(false)
const migrationMessage = ref('')
const migrationError = ref('')
const migrationSummary = ref(null)
const migrationEntries = ref([])
const migrationVerification = ref(null)
const migrationRun = ref(null)

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

async function runMigrationAction(action, options = {}) {
  migrationBusy.value = true
  migrationError.value = ''
  migrationMessage.value = ''

  try {
    let response

    if (action === 'scan') {
      response = await fetch(`${API_BASE}/api/tools/migration/scan`, {
        method: 'GET',
        credentials: 'include',
      })
    } else if (action === 'plan') {
      response = await fetch(`${API_BASE}/api/tools/migration/plan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } else if (action === 'execute') {
      response = await fetch(`${API_BASE}/api/tools/migration/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: Boolean(options.dryRun) }),
      })
    } else if (action === 'verify') {
      response = await fetch(`${API_BASE}/api/tools/migration/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } else if (action === 'rollback') {
      response = await fetch(`${API_BASE}/api/tools/migration/rollback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteCopiedFiles: false }),
      })
    }

    if (!response || !response.ok) {
      const errorPayload = response ? await response.json().catch(() => ({})) : {}
      throw new Error(errorPayload.error || `Migration action failed (${response?.status || 'unknown'})`)
    }

    const payload = await response.json()

    if (payload.summary) {
      migrationSummary.value = payload.summary
    }
    if (Array.isArray(payload.entries)) {
      migrationEntries.value = payload.entries.slice(0, 100)
    }
    if (Array.isArray(payload.sample)) {
      migrationEntries.value = payload.sample
    }
    if (payload.run) {
      migrationRun.value = payload.run
    }
    if (payload.results || payload.failed) {
      migrationVerification.value = payload
    }

    if (action === 'execute') {
      migrationMessage.value = options.dryRun
        ? 'Dry run completed. Review the audit report before executing migration.'
        : 'Migration executed. Run verification before any cleanup steps.'
    } else if (action === 'rollback') {
      migrationMessage.value = 'Rollback completed. Database media fields were restored from backup snapshot.'
    } else {
      migrationMessage.value = 'Migration action completed successfully.'
    }
  } catch (error) {
    migrationError.value = error?.message || 'Migration action failed.'
  } finally {
    migrationBusy.value = false
  }
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

    <div class="panel-bg image-card mt-20">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-12">
        <div>
          <h5 class="mb-1">Exercise Content Migration</h5>
          <small class="text-muted">Prepare and migrate exercise media from frontend assets into backend content storage.</small>
        </div>
        <span class="badge" :class="migrationBusy ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' : 'bg-info-subtle text-info-emphasis border border-info-subtle'">
          {{ migrationBusy ? 'Running' : 'Ready' }}
        </span>
      </div>

      <div class="d-flex flex-wrap gap-2 mb-12">
        <button class="btn btn-sm btn-outline-primary" type="button" :disabled="migrationBusy" @click="runMigrationAction('scan')">Scan Existing Exercise Media</button>
        <button class="btn btn-sm btn-outline-secondary" type="button" :disabled="migrationBusy" @click="runMigrationAction('plan')">Generate Migration Plan</button>
        <button class="btn btn-sm btn-primary" type="button" :disabled="migrationBusy" @click="runMigrationAction('execute', { dryRun: false })">Execute Migration</button>
        <button class="btn btn-sm btn-outline-success" type="button" :disabled="migrationBusy" @click="runMigrationAction('verify')">Verify Migration</button>
        <button class="btn btn-sm btn-outline-danger" type="button" :disabled="migrationBusy" @click="runMigrationAction('rollback')">Rollback Migration</button>
      </div>

      <div v-if="migrationError" class="alert alert-danger py-2 mb-2" role="alert">{{ migrationError }}</div>
      <div v-else-if="migrationMessage" class="alert alert-success py-2 mb-2" role="alert">{{ migrationMessage }}</div>

      <div v-if="migrationSummary" class="meta-grid mt-12">
        <div><strong>Total Exercises:</strong> {{ migrationSummary.totalExercises || migrationSummary.total || '-' }}</div>
        <div><strong>Ready:</strong> {{ migrationSummary.readyExercises || '-' }}</div>
        <div><strong>Missing Source:</strong> {{ migrationSummary.missingSourceExercises || '-' }}</div>
        <div><strong>Total Images:</strong> {{ migrationSummary.totalImages || '-' }}</div>
      </div>

      <div v-if="migrationRun" class="meta-grid mt-12">
        <div><strong>Run ID:</strong> {{ migrationRun.runId || '-' }}</div>
        <div><strong>Success Count:</strong> {{ migrationRun.successCount ?? '-' }}</div>
        <div><strong>Failed Count:</strong> {{ migrationRun.failureCount ?? '-' }}</div>
        <div><strong>Skipped Count:</strong> {{ migrationRun.skippedCount ?? '-' }}</div>
      </div>

      <div v-if="migrationVerification?.summary" class="meta-grid mt-12">
        <div><strong>Verified:</strong> {{ migrationVerification.summary.verified ?? '-' }}</div>
        <div><strong>Verification Failed:</strong> {{ migrationVerification.summary.failed ?? '-' }}</div>
      </div>

      <div class="table-responsive mt-12" v-if="migrationEntries.length">
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>ExerciseID</th>
              <th>ExerciseTitle</th>
              <th>OldPath</th>
              <th>NewPath</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in migrationEntries" :key="entry.exerciseId || entry.ExerciseID">
              <td>{{ entry.exerciseId || entry.ExerciseID }}</td>
              <td>{{ entry.exerciseTitle || entry.ExerciseTitle }}</td>
              <td class="small">{{ entry.oldPath || entry.OldPath || '-' }}</td>
              <td class="small">{{ entry.newPath || entry.NewPath || '-' }}</td>
              <td>{{ entry.status || entry.Status || '-' }}</td>
            </tr>
          </tbody>
        </table>
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
