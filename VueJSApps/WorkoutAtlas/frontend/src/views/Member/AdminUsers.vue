<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import { API_BASE } from '@/config/env'

const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const search = ref('')
const members = ref([])
const roles = ref([])
const tiers = ref([])

const isFormOpen = ref(false)
const isEditMode = ref(false)
const editingUserId = ref(null)
const promotingAdmin = ref(false)
const deleting = ref(false)
const confirmDeleteOpen = ref(false)
const deleteTarget = ref(null)

const canBootstrapAdmin = computed(() => /admin access required/i.test(errorMsg.value || ''))

const form = reactive({
  firstName: '',
  lastName: '',
  username: '',
  password: '',
  role: 'member',
  tier: 1,
  billingCycle: 'none',
  status: 'active',
  expiresAt: '',
})

function clearMessages() {
  errorMsg.value = ''
  successMsg.value = ''
}

function resetForm() {
  form.firstName = ''
  form.lastName = ''
  form.username = ''
  form.password = ''
  form.role = 'member'
  form.tier = 1
  form.billingCycle = 'none'
  form.status = 'active'
  form.expiresAt = ''
  editingUserId.value = null
  isEditMode.value = false
}

function openAddForm() {
  clearMessages()
  resetForm()
  isFormOpen.value = true
}

function openEditForm(member) {
  clearMessages()
  isEditMode.value = true
  isFormOpen.value = true
  editingUserId.value = member.id

  form.firstName = member.FirstName || ''
  form.lastName = member.LastName || ''
  form.username = member.username || ''
  form.password = ''
  form.role = member.user_role || 'member'
  form.tier = Number(member.tier || 1)
  form.billingCycle = member.billing_cycle || 'none'
  form.status = member.membership_status || 'active'
  form.expiresAt = member.expires_at ? String(member.expires_at).slice(0, 10) : ''
}

async function loadLookups() {
  const [rolesRes, tiersRes] = await Promise.all([
    axios.get(`${API_BASE}/api/admin/roles`, { withCredentials: true }),
    axios.get(`${API_BASE}/api/admin/tiers`, { withCredentials: true }),
  ])
  roles.value = rolesRes.data || []
  tiers.value = tiersRes.data || []
}

async function loadMembers() {
  loading.value = true
  clearMessages()
  try {
    const params = new URLSearchParams({ page: '1', limit: '100' })
    if (search.value?.trim()) params.set('search', search.value.trim())

    const res = await axios.get(`${API_BASE}/api/admin/members?${params.toString()}`, {
      withCredentials: true,
    })

    members.value = res.data?.data || []
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Failed to load users. Admin login required.'
  } finally {
    loading.value = false
  }
}

async function saveUser() {
  saving.value = true
  clearMessages()

  try {
    if (!form.firstName || !form.lastName || !form.username) {
      throw new Error('First name, last name, and username are required.')
    }

    if (!isEditMode.value) {
      if (!form.password) {
        throw new Error('Password is required when creating a user.')
      }

      await axios.post(
        `${API_BASE}/api/admin/members`,
        {
          firstName: form.firstName,
          lastName: form.lastName,
          username: form.username,
          password: form.password,
          role: form.role,
          tier: form.tier,
          billingCycle: form.billingCycle,
        },
        { withCredentials: true }
      )

      successMsg.value = 'User created successfully.'
    } else {
      const userId = editingUserId.value

      await axios.put(
        `${API_BASE}/api/admin/members/${userId}`,
        {
          firstName: form.firstName,
          lastName: form.lastName,
          username: form.username,
        },
        { withCredentials: true }
      )

      await axios.patch(
        `${API_BASE}/api/admin/members/${userId}/role`,
        { role: form.role },
        { withCredentials: true }
      )

      await axios.patch(
        `${API_BASE}/api/admin/members/${userId}/membership`,
        {
          tier: Number(form.tier),
          status: form.status,
          billingCycle: form.billingCycle,
          expiresAt: form.expiresAt || null,
        },
        { withCredentials: true }
      )

      successMsg.value = 'User updated successfully.'
    }

    await loadMembers()
    isFormOpen.value = false
    resetForm()
  } catch (err) {
    errorMsg.value = err.response?.data?.error || err.message || 'Failed to save user.'
  } finally {
    saving.value = false
  }
}

async function grantCredit(member, days = 30) {
  clearMessages()
  try {
    await axios.patch(
      `${API_BASE}/api/admin/members/${member.id}/credit`,
      { days, note: 'Manual admin credit' },
      { withCredentials: true }
    )
    successMsg.value = `Added ${days}-day credit to ${member.FirstName} ${member.LastName}.`
    await loadMembers()
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Failed to apply credit.'
  }
}

function requestDelete(member) {
  clearMessages()
  deleteTarget.value = member
  confirmDeleteOpen.value = true
}

function cancelDelete() {
  confirmDeleteOpen.value = false
  deleteTarget.value = null
}

async function confirmDeleteUser() {
  const member = deleteTarget.value
  if (!member?.id) {
    cancelDelete()
    return
  }

  deleting.value = true
  clearMessages()

  try {
    await axios.delete(`${API_BASE}/api/admin/members/${member.id}`, {
      withCredentials: true,
    })

    successMsg.value = `User ${member.FirstName || ''} ${member.LastName || ''} and all media content deleted successfully.`.trim()

    if (isEditMode.value && Number(editingUserId.value) === Number(member.id)) {
      isFormOpen.value = false
      resetForm()
    }

    await loadMembers()
    cancelDelete()
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Failed to delete member.'
  } finally {
    deleting.value = false
  }
}

async function promoteCurrentUserToAdmin() {
  promotingAdmin.value = true
  clearMessages()

  try {
    const res = await axios.post(
      `${API_BASE}/api/bootstrap/promote-self-admin`,
      {},
      { withCredentials: true }
    )

    successMsg.value = res.data?.message || 'User promoted to admin.'

    // Refresh data after promotion
    await loadLookups()
    await loadMembers()
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Failed to promote current user to admin.'
  } finally {
    promotingAdmin.value = false
  }
}

onMounted(async () => {
  loading.value = true
  clearMessages()
  try {
    await loadLookups()
    await loadMembers()
  } catch (err) {
    errorMsg.value = err.response?.data?.error || 'Could not load admin data.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="users-admin-page">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-20">
      <div>
        <h2 class="mb-0">Users Management</h2>
        <small class="text-muted">Add, edit, search, and manage membership credits.</small>
      </div>

      <button class="btn btn-primary" @click="openAddForm">
        <i class="fa-solid fa-user-plus me-2"></i>
        Add User
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger d-flex justify-content-between align-items-center gap-2 flex-wrap">
      <span>{{ errorMsg }}</span>
      <button
        v-if="canBootstrapAdmin"
        class="btn btn-sm btn-danger"
        :disabled="promotingAdmin"
        @click="promoteCurrentUserToAdmin"
      >
        <i v-if="promotingAdmin" class="fa-solid fa-spinner fa-spin me-1"></i>
        <i v-else class="fa-solid fa-user-shield me-1"></i>
        {{ promotingAdmin ? 'Promoting...' : 'Make Current User Admin' }}
      </button>
    </div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <div class="panel-bg users-toolbar mb-15">
      <div class="row g-2 align-items-center">
        <div class="col-lg-8">
          <div class="input-group">
            <span class="input-group-text"><i class="fa-solid fa-magnifying-glass"></i></span>
            <input
              v-model="search"
              class="form-control"
              placeholder="Search by first name, last name, or username"
              @keyup.enter="loadMembers"
            />
          </div>
        </div>
        <div class="col-lg-4 d-flex justify-content-lg-end gap-2">
          <button class="btn btn-outline-primary" @click="loadMembers">
            <i class="fa-solid fa-rotate me-2"></i>Search
          </button>
        </div>
      </div>
    </div>

    <div class="panel-bg users-table-wrap">
      <div v-if="loading" class="p-4 text-center text-muted">Loading users...</div>

      <div v-else class="table-responsive">
        <table class="table align-middle mb-0 users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Expires</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in members" :key="member.id">
              <td>
                <div class="fw-semibold">{{ member.FirstName }} {{ member.LastName }}</div>
                <small class="text-muted">@{{ member.username }}</small>
              </td>
              <td><span class="badge bg-info-subtle text-info-emphasis">{{ member.user_role || 'member' }}</span></td>
              <td>
                <span class="badge bg-primary-subtle text-primary-emphasis">
                  {{ member.tier_name || `Tier ${member.tier || 1}` }}
                </span>
              </td>
              <td>{{ member.membership_status || 'active' }}</td>
              <td>{{ member.expires_at ? String(member.expires_at).slice(0, 10) : '—' }}</td>
              <td class="text-end">
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-outline-secondary" @click="openEditForm(member)">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="btn btn-outline-success" @click="grantCredit(member, 30)">
                    +30d
                  </button>
                  <button class="btn btn-outline-danger" @click="requestDelete(member)">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="!members.length">
              <td colspan="6" class="text-center text-muted py-4">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="isFormOpen" class="users-form-overlay" @click.self="isFormOpen = false">
      <div class="users-form-card panel-bg">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">{{ isEditMode ? 'Edit User' : 'Add User' }}</h5>
          <button class="btn btn-sm btn-outline-secondary" @click="isFormOpen = false">Close</button>
        </div>

        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">First Name</label>
            <input v-model="form.firstName" class="form-control" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Last Name</label>
            <input v-model="form.lastName" class="form-control" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Username / Email</label>
            <input v-model="form.username" class="form-control" />
          </div>
          <div class="col-md-6" v-if="!isEditMode">
            <label class="form-label">Password</label>
            <input v-model="form.password" class="form-control" type="password" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Role</label>
            <select v-model="form.role" class="form-select">
              <option v-for="r in roles" :key="r.id" :value="r.slug">{{ r.name }}</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Tier</label>
            <select v-model="form.tier" class="form-select">
              <option v-for="t in tiers" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Billing Cycle</label>
            <select v-model="form.billingCycle" class="form-select">
              <option value="none">None</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>

          <template v-if="isEditMode">
            <div class="col-md-6">
              <label class="form-label">Membership Status</label>
              <select v-model="form.status" class="form-select">
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">Expires At</label>
              <input v-model="form.expiresAt" class="form-control" type="date" />
            </div>
          </template>
        </div>

        <div class="mt-4 d-flex justify-content-end gap-2">
          <button
            v-if="isEditMode"
            class="btn btn-outline-danger me-auto"
            :disabled="deleting"
            @click="requestDelete({ id: editingUserId, FirstName: form.firstName, LastName: form.lastName, username: form.username, user_role: form.role, tier_name: null })"
          >
            <i class="fa-solid fa-trash me-2"></i>
            Delete User
          </button>
          <button class="btn btn-outline-secondary" @click="isFormOpen = false">Cancel</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveUser">
            <i v-if="saving" class="fa-solid fa-spinner fa-spin me-2"></i>
            {{ saving ? 'Saving...' : 'Save User' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="confirmDeleteOpen" class="users-form-overlay" @click.self="cancelDelete">
      <div class="users-confirm-card panel-bg">
        <h5 class="mb-2 text-danger">Delete User and Media Content?</h5>
        <p class="text-muted mb-3">
          This will permanently delete the user account and all media content stored for this user,
          including images, videos, and custom exercise media.
          <strong>This action cannot be undone.</strong>
        </p>

        <div class="delete-target-details mb-3">
          <div class="row g-1 text-sm">
            <div class="col-6"><span class="text-muted">User ID:</span> {{ deleteTarget?.id || '—' }}</div>
            <div class="col-6"><span class="text-muted">Username:</span> {{ deleteTarget?.username || '—' }}</div>
            <div class="col-6"><span class="text-muted">Role:</span> {{ deleteTarget?.user_role || '—' }}</div>
            <div class="col-6"><span class="text-muted">Tier:</span> {{ deleteTarget?.tier_name || '—' }}</div>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2">
          <button class="btn btn-outline-secondary" :disabled="deleting" @click="cancelDelete">Cancel</button>
          <button class="btn btn-danger" :disabled="deleting" @click="confirmDeleteUser">
            <i v-if="deleting" class="fa-solid fa-spinner fa-spin me-2"></i>
            {{ deleting ? 'Deleting...' : 'Delete User and Media' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.users-toolbar,
.users-table-wrap {
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 12px;
  padding: 14px;
}

.users-table thead th {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: .04em;
  opacity: .85;
}

.users-form-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 20px;
}

.users-form-card {
  width: min(840px, 96vw);
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  padding: 18px;
}

.users-confirm-card {
  width: min(460px, 94vw);
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  padding: 18px;
}

.delete-target-details {
  background: rgba(15, 23, 42, 0.04);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.85rem;
}

:global(body.dark-theme) .delete-target-details {
  background: rgba(255, 255, 255, 0.06);
}

.text-sm {
  font-size: 0.85rem;
}

:global(body.dark-theme) .users-toolbar,
:global(body.dark-theme) .users-table-wrap,
:global(body.dark-theme) .users-form-card,
:global(body.dark-theme) .users-confirm-card {
  border-color: rgba(255, 255, 255, 0.16);
}

:global(body.dark-theme) .users-table thead th {
  color: #cbd5e1;
}
</style>
