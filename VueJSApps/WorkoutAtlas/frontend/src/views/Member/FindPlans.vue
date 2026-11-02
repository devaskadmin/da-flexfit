<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE } from '@/config/env'
import { buildWorkoutPlanCoverImageUrl, applyWorkoutPlanImageFallback } from '@/utils/workoutPlanImage'

const router = useRouter()

const loading = ref(false)
const usingPlanId = ref('')
const errorMsg = ref('')
const successMsg = ref('')

const plans = ref([])
const selectedPlanId = ref('')
const selectedPlan = ref(null)
const selectedPlanLoading = ref(false)

const query = ref('')
const category = ref('all')
const access = ref('all')

const CATEGORY_OPTIONS = ['all', 'Weight Loss', 'Strength', 'Muscle Building', 'Cardio', 'General Fitness', 'Beginner']
const ACCESS_OPTIONS = ['all', 'Free', 'Premium']

const buildCoverImageUrl = (planId) => {
  return buildWorkoutPlanCoverImageUrl(planId)
}

const onCoverError = (event) => {
  applyWorkoutPlanImageFallback(event)
}

const normalizeAccess = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'private' || normalized === 'unlisted' || normalized === 'premium') {
    return 'Premium'
  }
  return 'Free'
}

const formatDifficulty = (plan = {}) => {
  const difficulty = String(plan?.difficulty || plan?.level || '').trim()
  return difficulty || '—'
}

const categoriesFromPlans = computed(() => {
  const categorySet = new Set(CATEGORY_OPTIONS.filter((item) => item !== 'all'))
  for (const plan of plans.value) {
    const value = String(plan?.type || '').trim()
    if (value) {
      categorySet.add(value)
    }
  }
  return ['all', ...Array.from(categorySet)]
})

const toQueryParams = () => {
  const params = {}
  const q = String(query.value || '').trim()
  if (q) params.q = q
  if (category.value !== 'all') params.category = category.value
  if (access.value !== 'all') params.access = access.value
  return params
}

const loadPlans = async () => {
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const response = await axios.get(`${API_BASE}/api/global-workout-plans`, {
      withCredentials: true,
      params: toQueryParams(),
    })
    plans.value = Array.isArray(response.data?.workoutLists) ? response.data.workoutLists : []
  } catch (err) {
    errorMsg.value = err?.response?.data?.error || 'Failed to load global workout plans.'
    plans.value = []
  } finally {
    loading.value = false
  }
}

const viewPlan = async (planId) => {
  const targetId = String(planId || '').trim()
  if (!targetId) return

  selectedPlanLoading.value = true
  selectedPlanId.value = targetId
  selectedPlan.value = null
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const response = await axios.get(`${API_BASE}/api/global-workout-plans/${encodeURIComponent(targetId)}`, {
      withCredentials: true,
    })

    const planner = response.data?.planner || null
    if (!planner) {
      throw new Error('Plan details not found.')
    }

    const dayGroups = Array.isArray(planner?.dayGroups)
      ? planner.dayGroups.map((day) => String(day || '').trim()).filter(Boolean)
      : []

    const exercises = Array.isArray(planner?.exercises) ? planner.exercises : []

    selectedPlan.value = {
      id: targetId,
      name: String(planner?.metadata?.name || '').trim() || 'Untitled Workout',
      category: String(planner?.metadata?.type || '').trim() || '—',
      duration: Number(planner?.metadata?.estimatedDuration || 0),
      access: String(response.data?.accessLevel || normalizeAccess(planner?.visibility)).trim(),
      difficulty: String(planner?.metadata?.difficulty || '').trim(),
      coverImageUrl: buildCoverImageUrl(targetId),
      days: dayGroups,
      exercises,
    }
  } catch (err) {
    errorMsg.value = err?.response?.data?.error || err?.message || 'Failed to load plan details.'
    selectedPlanId.value = ''
    selectedPlan.value = null
  } finally {
    selectedPlanLoading.value = false
  }
}

const useSelectedPlan = async () => {
  const planId = String(selectedPlan.value?.id || '').trim()
  if (!planId) return

  const dayCount = Number(selectedPlan.value?.days?.length || 0)
  const exerciseCount = Number(selectedPlan.value?.exercises?.length || 0)
  const confirmed = window.confirm(
    `Use this plan?\n\n${selectedPlan.value?.name || 'Plan'}\nCategory: ${selectedPlan.value?.category || '—'}\nAccess: ${selectedPlan.value?.access || '—'}\nDuration: ${selectedPlan.value?.duration || 0} min\nDays: ${dayCount}\nExercises: ${exerciseCount}`
  )
  if (!confirmed) return

  usingPlanId.value = planId
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const response = await axios.post(
      `${API_BASE}/api/global-workout-plans/${encodeURIComponent(planId)}/use`,
      {},
      { withCredentials: true }
    )

    const copiedPlanId = String(response.data?.planner?.planId || '').trim()
    successMsg.value = 'Plan added to your Workout Planner.'

    router.push(copiedPlanId
      ? { name: 'workouts', query: { planId: copiedPlanId } }
      : { name: 'workouts' })
  } catch (err) {
    errorMsg.value = err?.response?.data?.error || 'Failed to use this plan.'
  } finally {
    usingPlanId.value = ''
  }
}

const resetSelection = () => {
  selectedPlanId.value = ''
  selectedPlan.value = null
}

onMounted(loadPlans)
</script>

<template>
  <div class="app-page-shell find-plans-page">
    <div class="app-page-canvas app-inner-shell find-plans-page__canvas">
      <section class="ff-page-header app-header-gradient find-plans-page__hero mb-20">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h2 class="mb-0">FIND WORKOUT PLANS</h2>
            <small class="find-plans-page__subtitle">Browse complete global plans from admins and trainers.</small>
          </div>
          <button type="button" class="btn btn-outline-light btn-sm" @click="router.push({ name: 'workout_builder', query: { tab: 'create' } })">
            Build My Own Workout
          </button>
        </div>
      </section>

      <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
      <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

      <section class="panel-bg find-plans-panel mb-16">
        <div class="row g-3 align-items-end">
          <div class="col-md-5">
            <label class="form-label">Search Plans</label>
            <input v-model="query" class="form-control" placeholder="Search by name, category, or description" @keyup.enter="loadPlans" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Category</label>
            <select v-model="category" class="form-select">
              <option v-for="option in categoriesFromPlans" :key="option" :value="option">{{ option === 'all' ? 'All Categories' : option }}</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Access</label>
            <select v-model="access" class="form-select">
              <option v-for="option in ACCESS_OPTIONS" :key="option" :value="option">{{ option === 'all' ? 'All Access' : option }}</option>
            </select>
          </div>
          <div class="col-md-2 d-grid">
            <button type="button" class="btn btn-primary" :disabled="loading" @click="loadPlans">Search</button>
          </div>
        </div>
      </section>

      <div class="find-plans-layout">
        <section class="panel-bg find-plans-panel">
          <h4 class="mb-12">Available Plans</h4>
          <div v-if="loading" class="text-muted p-3">Loading plans...</div>
          <div v-else-if="!plans.length" class="text-muted p-3">No matching plans found.</div>
          <div v-else class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Plan Name</th>
                  <th>Category</th>
                  <th>Days</th>
                  <th>Difficulty</th>
                  <th>Access</th>
                  <th class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="plan in plans" :key="plan.planId">
                  <td>
                    <div class="find-plans-table-name">
                      <img
                        :src="buildCoverImageUrl(plan.planId)"
                        class="find-plans-table-cover"
                        :alt="`${plan.name || 'Workout plan'} cover`"
                        loading="lazy"
                        decoding="async"
                        @error="onCoverError"
                      />
                      <span class="fw-semibold">{{ plan.name }}</span>
                    </div>
                  </td>
                  <td>{{ plan.type || '—' }}</td>
                  <td>{{ Number(plan.dayCount || 0) }}</td>
                  <td>{{ formatDifficulty(plan) }}</td>
                  <td>
                    <span class="badge" :class="normalizeAccess(plan.visibility) === 'Premium' ? 'text-bg-warning' : 'text-bg-success'">
                      {{ normalizeAccess(plan.visibility) }}
                    </span>
                  </td>
                  <td class="text-end">
                    <button type="button" class="btn btn-sm btn-outline-primary" @click="viewPlan(plan.planId)">View Plan</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel-bg find-plans-panel">
          <div class="d-flex justify-content-between align-items-center mb-12">
            <h4 class="mb-0">Plan Details</h4>
            <button v-if="selectedPlan" type="button" class="btn btn-sm btn-outline-light" @click="resetSelection">Clear</button>
          </div>

          <div v-if="selectedPlanLoading" class="text-muted p-3">Loading plan details...</div>
          <div v-else-if="!selectedPlan" class="text-muted p-3">Select a plan to preview days, exercises, category, duration, and access.</div>
          <div v-else>
            <img
              :src="selectedPlan.coverImageUrl"
              class="find-plans-selected-cover mb-3"
              :alt="`${selectedPlan.name} cover`"
              loading="lazy"
              decoding="async"
              @error="onCoverError"
            />
            <h5 class="mb-1">{{ selectedPlan.name }}</h5>
            <p class="text-muted mb-3">{{ selectedPlan.category }} · {{ selectedPlan.duration }} min · {{ selectedPlan.access }}</p>

            <div class="row g-2 mb-3">
              <div class="col-6"><strong>Days:</strong> {{ selectedPlan.days.length }}</div>
              <div class="col-6"><strong>Exercises:</strong> {{ selectedPlan.exercises.length }}</div>
              <div class="col-6"><strong>Category:</strong> {{ selectedPlan.category }}</div>
              <div class="col-6"><strong>Duration:</strong> {{ selectedPlan.duration }} min</div>
              <div class="col-6"><strong>Access:</strong> {{ selectedPlan.access }}</div>
              <div class="col-6"><strong>Difficulty:</strong> {{ selectedPlan.difficulty || '—' }}</div>
            </div>

            <div class="find-plans-days mb-3">
              <h6 class="mb-2">Workout Days</h6>
              <ul class="mb-0">
                <li v-for="day in selectedPlan.days" :key="day">{{ day }}</li>
              </ul>
            </div>

            <div class="find-plans-exercises mb-3">
              <h6 class="mb-2">Exercises</h6>
              <ul class="mb-0">
                <li v-for="(exercise, index) in selectedPlan.exercises" :key="exercise.id || `${exercise.exerciseId || 0}-${index}`">
                  {{ exercise.name || 'Untitled Exercise' }}
                  <small class="text-muted">({{ exercise.scheduleGroup || 'Day' }})</small>
                </li>
              </ul>
            </div>

            <button type="button" class="btn btn-primary" :disabled="usingPlanId === selectedPlan.id" @click="useSelectedPlan">
              <i v-if="usingPlanId === selectedPlan.id" class="fa-solid fa-spinner fa-spin me-1"></i>
              Use This Plan
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.find-plans-page {
  --fp-surface: #18263f;
  --fp-surface-2: #1f3152;
  --fp-border: rgba(139, 183, 255, 0.24);
}

.find-plans-page__canvas {
  width: min(1280px, 100%);
  margin: 0 auto;
}

.find-plans-page__hero {
  border: 1px solid var(--fp-border);
  border-radius: 14px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #112a63 0%, #1a386d 45%, #243a6a 100%) !important;
}

.find-plans-page__subtitle {
  color: #d5e7ff;
}

.find-plans-layout {
  display: grid;
  grid-template-columns: minmax(380px, 1.2fr) minmax(320px, 1fr);
  gap: 16px;
}

.find-plans-panel {
  border: 1px solid var(--fp-border);
  border-radius: 14px;
  padding: 16px;
  background: linear-gradient(180deg, var(--fp-surface) 0%, var(--fp-surface-2) 100%);
}

.find-plans-days,
.find-plans-exercises {
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 10px;
}

.find-plans-table-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.find-plans-table-cover {
  width: 56px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid rgba(139, 183, 255, 0.3);
  background: #12233f;
}

.find-plans-selected-cover {
  width: 100%;
  max-height: 180px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--fp-border);
  background: #12233f;
}

@media (max-width: 991.98px) {
  .find-plans-layout {
    grid-template-columns: 1fr;
  }
}
</style>
