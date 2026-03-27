<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const loading = ref(false)
const saving = ref(false)
const roles = ref([])
const errorMsg = ref('')
const successMsg = ref('')

const isEdit = ref(false)
const editingId = ref(null)
const formWrapRef = ref(null)

const form = reactive({
  name: '',
  slug: '',
  description: '',
  isActive: true,
})

const clearMessages = () => {
  errorMsg.value = ''
  successMsg.value = ''
}

const resetForm = () => {
  form.name = ''
  form.slug = ''
  form.description = ''
  form.isActive = true
  isEdit.value = false
  editingId.value = null
}

const autoSlug = () => {
  if (isEdit.value && form.slug) return
  form.slug = String(form.name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
}

const loadRoles = async () => {
  loading.value = true
  clearMessages()
  try {
    const res = await axios.get(`${API_BASE}/api/admin/roles?includeInactive=true`, { withCredentials: true })
    roles.value = res.data || []
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Failed to load roles.'
  } finally {
    loading.value = false
  }
}

const editRole = (role) => {
  clearMessages()
  isEdit.value = true
  editingId.value = role.id
  form.name = role.name || ''
  form.slug = role.slug || ''
  form.description = role.description || ''
  form.isActive = Number(role.is_active) === 1

  successMsg.value = `Editing role: ${form.name}`

  nextTick(() => {
    formWrapRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const saveRole = async () => {
  saving.value = true
  clearMessages()
  try {
    if (!form.name || !form.slug) {
      throw new Error('Role name and slug are required.')
    }

    if (!isEdit.value) {
      await axios.post(
        `${API_BASE}/api/admin/roles`,
        {
          name: form.name,
          slug: form.slug,
          description: form.description,
          isActive: form.isActive,
        },
        { withCredentials: true }
      )
      successMsg.value = 'Role created.'
    } else {
      await axios.put(
        `${API_BASE}/api/admin/roles/${editingId.value}`,
        {
          name: form.name,
          slug: form.slug,
          description: form.description,
          isActive: form.isActive,
        },
        { withCredentials: true }
      )
      successMsg.value = 'Role updated.'
    }

    resetForm()
    await loadRoles()
  } catch (err) {
    errorMsg.value = err.response?.data?.error || err.message || 'Failed to save role.'
  } finally {
    saving.value = false
  }
}

onMounted(loadRoles)
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-20">
      <div>
        <h2 class="mb-0">Roles</h2>
        <small class="text-muted">Add, edit and activate/deactivate system roles.</small>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <div ref="formWrapRef" class="panel-bg role-form-wrap mb-20">
      <div class="row g-3 align-items-end">
        <div class="col-md-4">
          <label class="form-label">Role Name</label>
          <input v-model="form.name" class="form-control" @input="autoSlug" placeholder="Coach" />
        </div>
        <div class="col-md-3">
          <label class="form-label">Slug</label>
          <input v-model="form.slug" class="form-control" placeholder="coach" />
        </div>
        <div class="col-md-3">
          <label class="form-label">Description</label>
          <input v-model="form.description" class="form-control" placeholder="Can manage athletes" />
        </div>
        <div class="col-md-2">
          <label class="form-label">Status</label>
          <select v-model="form.isActive" class="form-select">
            <option :value="true">Active</option>
            <option :value="false">Inactive</option>
          </select>
        </div>
      </div>
      <div class="mt-3 d-flex gap-2 justify-content-end">
        <button type="button" class="btn btn-outline-secondary" @click="resetForm">Reset</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="saveRole">
          <i v-if="saving" class="fa-solid fa-spinner fa-spin me-2"></i>
          {{ isEdit ? 'Update Role' : 'Create Role' }}
        </button>
      </div>
    </div>

    <div class="panel-bg role-table-wrap">
      <div v-if="loading" class="p-3 text-muted">Loading roles...</div>
      <div v-else class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Status</th>
              <th class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role.id">
              <td class="fw-semibold">{{ role.name }}</td>
              <td>{{ role.slug }}</td>
              <td>{{ role.description || '—' }}</td>
              <td>
                <span class="badge" :class="Number(role.is_active) === 1 ? 'bg-success-subtle text-success-emphasis' : 'bg-secondary-subtle text-secondary-emphasis'">
                  {{ Number(role.is_active) === 1 ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-primary" @click.prevent.stop="editRole(role)">
                  <i class="fa-solid fa-pen me-1"></i>Edit
                </button>
              </td>
            </tr>
            <tr v-if="!roles.length">
              <td colspan="5" class="text-center text-muted py-4">No roles found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-form-wrap,
.role-table-wrap {
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 12px;
  padding: 14px;
}
:global(body.dark-theme) .role-form-wrap,
:global(body.dark-theme) .role-table-wrap {
  border-color: rgba(255,255,255,.16);
}
</style>
