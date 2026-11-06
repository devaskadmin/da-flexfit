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
      <small class="role-tester-subtitle">Quickly test and switch roles for existing users.</small>
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
        <table class="table align-middle mb-0 role-tester-grid">
          <thead>
            <tr>
              <th class="role-tester-head">User</th>
              <th class="role-tester-head">Current Role</th>
              <th class="role-tester-head">Test Role</th>
              <th class="role-tester-head text-end role-tester-action-head">Apply</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in members" :key="member.id">
              <td data-label="User">
                <div class="fw-semibold role-tester-username">{{ member.FirstName }} {{ member.LastName }}</div>
                <small class="role-tester-email">@{{ member.username }}</small>
              </td>
              <td data-label="Current Role">
                <span class="role-tester-badge">{{ member.user_role || 'member' }}</span>
              </td>
              <td data-label="Test Role">
                <div class="admin-role-tester-select-wrap">
                  <select v-model="member.selectedRole" class="form-select form-select-sm admin-role-tester-form-select">
                    <option v-for="r in roles" :key="r.id" :value="r.slug">{{ r.name }}</option>
                  </select>
                  <span class="admin-role-tester-select-arrow" aria-hidden="true">▼</span>
                </div>
              </td>
              <td data-label="Apply" class="text-end role-tester-action-cell">
                <button class="btn btn-sm role-tester-apply-btn" @click="applyRole(member)">Apply</button>
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
  overflow: hidden;
}

.role-tester-subtitle {
  color: #cbd5e1;
}

.role-tester-grid {
  table-layout: auto;
}

.role-tester-grid td,
.role-tester-grid th {
  vertical-align: middle;
}

.role-tester-head {
  color: #ffffff;
  font-weight: 700;
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.role-tester-username {
  color: #ffffff;
}

.role-tester-email {
  color: #cbd5e1;
}

.role-tester-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  color: #ffffff;
  border: 1px solid #ffffff;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.78rem;
  line-height: 1;
  padding: 0.35rem 0.55rem;
  text-transform: lowercase;
}

.admin-role-tester-select-wrap {
  position: relative;
  width: 100%;
  min-width: 130px;
}

.admin-role-tester-form-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: none !important;
  background-color: rgba(8, 14, 11, 0.9) !important;
  padding-right: 2.2rem;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.35);
}

.admin-role-tester-select-arrow {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.7rem;
  line-height: 1;
  pointer-events: none;
  z-index: 1;
}

.role-tester-action-head,
.role-tester-action-cell {
  min-width: 108px;
  white-space: nowrap;
}

.role-tester-apply-btn {
  background: #111827;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.65);
  font-weight: 600;
  min-width: 78px;
}

.role-tester-apply-btn:hover,
.role-tester-apply-btn:focus {
  background: #1f2937;
  color: #ffffff;
}

.role-tester-table .table-responsive {
  overflow-x: auto;
}

@media (max-width: 768px) {
  .role-tester-table {
    padding: 10px;
  }

  .role-tester-grid thead {
    display: none;
  }

  .role-tester-grid,
  .role-tester-grid tbody,
  .role-tester-grid tr,
  .role-tester-grid td {
    display: block;
    width: 100%;
  }

  .role-tester-grid tr {
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    padding: 10px;
    margin-bottom: 10px;
  }

  .role-tester-grid td {
    border: 0;
    padding: 8px 0;
    text-align: left !important;
  }

  .role-tester-grid td::before {
    content: attr(data-label);
    display: block;
    color: #ffffff;
    font-weight: 700;
    margin-bottom: 4px;
    font-size: 0.76rem;
    letter-spacing: 0.02em;
  }

  .role-tester-action-cell {
    white-space: normal;
  }

  .role-tester-apply-btn {
    width: 100%;
  }
}

:global(body.dark-theme) .role-tester-toolbar,
:global(body.dark-theme) .role-tester-table {
  border-color: rgba(255,255,255,.16);
}
</style>
