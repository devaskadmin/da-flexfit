<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { API_BASE } from '@/config/env'

const roles = ref([])
const members = ref([])
const loading = ref(false)
const search = ref('')
const errorMsg = ref('')
const successMsg = ref('')

const loadRoles = async () => {
  const res = await axios.get(`${API_BASE}/api/admin/roles`, { withCredentials: true })
  roles.value = res.data || []
}

const loadMembers = async () => {
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const params = new URLSearchParams({ page: '1', limit: '100' })
    if (search.value?.trim()) params.set('search', search.value.trim())

    const res = await axios.get(`${API_BASE}/api/admin/members?${params.toString()}`, { withCredentials: true })
    members.value = (res.data?.data || []).map((m) => ({
      ...m,
      selectedRole: m.user_role || 'member',
    }))
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Failed to load users.'
  } finally {
    loading.value = false
  }
}

const applyRole = async (member) => {
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await axios.patch(
      `${API_BASE}/api/admin/members/${member.id}/role`,
      { role: member.selectedRole },
      { withCredentials: true }
    )
    successMsg.value = `Updated role for ${member.FirstName} ${member.LastName}.`
    await loadMembers()
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Failed to update role.'
  }
}

onMounted(async () => {
  try {
    await loadRoles()
    await loadMembers()
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Could not initialize role tester.'
  }
})
</script>

<template>
  <div>
    <div class="mb-20">
      <h2 class="mb-0">Test Roles</h2>
      <small class="text-muted">Quickly test and switch roles for existing users.</small>
    </div>

    <div class="panel-bg role-tester-toolbar mb-15">
      <div class="d-flex gap-2">
        <input v-model="search" class="form-control" placeholder="Search users" @keyup.enter="loadMembers" />
        <button class="btn btn-outline-primary" @click="loadMembers">Search</button>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <div class="panel-bg role-tester-table">
      <div v-if="loading" class="p-3 text-muted">Loading users...</div>
      <div v-else class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>User</th>
              <th>Current Role</th>
              <th>Test Role</th>
              <th class="text-end">Apply</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in members" :key="member.id">
              <td>
                <div class="fw-semibold">{{ member.FirstName }} {{ member.LastName }}</div>
                <small class="text-muted">@{{ member.username }}</small>
              </td>
              <td>
                <span class="badge bg-info-subtle text-info-emphasis">{{ member.user_role || 'member' }}</span>
              </td>
              <td>
                <select v-model="member.selectedRole" class="form-select form-select-sm">
                  <option v-for="r in roles" :key="r.id" :value="r.slug">{{ r.name }}</option>
                </select>
              </td>
              <td class="text-end">
                <button class="btn btn-sm btn-primary" @click="applyRole(member)">Apply</button>
              </td>
            </tr>
            <tr v-if="!members.length">
              <td colspan="4" class="text-center text-muted py-4">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-tester-toolbar,
.role-tester-table {
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 12px;
  padding: 14px;
}
:global(body.dark-theme) .role-tester-toolbar,
:global(body.dark-theme) .role-tester-table {
  border-color: rgba(255,255,255,.16);
}
</style>
