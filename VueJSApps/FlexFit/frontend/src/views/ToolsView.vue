<script setup>
import { ref } from 'vue'

const tools = ref([
  {
    name: 'AWS Gateway Status',
    description: 'Tests connectivity to the FlexFit Gateway service.',
    status: 'Coming Soon',
  },
  {
    name: 'AWS S3 Status',
    description: 'Tests connectivity from the Gateway to AWS S3.',
    status: 'Coming Soon',
  },
  {
    name: 'Test Image Retrieval',
    description: 'Tests whether FlexFit can retrieve and display a test image from S3.',
    status: 'Coming Soon',
  },
  {
    name: 'Backup Status',
    description: 'Displays backup and rsync status information.',
    status: 'Coming Soon',
  },
])
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-20">
      <div>
        <h2 class="mb-0">Tools</h2>
        <small class="text-muted">Administrative utilities and infrastructure diagnostics.</small>
      </div>
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
                <span class="badge bg-secondary-subtle text-secondary-emphasis">{{ tool.status }}</span>
              </td>
            </tr>
            <tr v-if="!tools.length">
              <td colspan="3" class="text-center text-muted py-4">No tools configured.</td>
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
</style>
