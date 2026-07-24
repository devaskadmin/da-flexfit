<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { API_BASE } from '@/config/env';
import ExerciseSessionCard from '@/components/workout-session/ExerciseSessionCard.vue';

const route  = useRoute();
const router = useRouter();

/* ─── Route params ───────────────────────────────────────────────────────── */
const planId = computed(() => String(route.params?.planId || '').trim());

/* ─── UI state ───────────────────────────────────────────────────────────── */
const activeTab       = ref('overview'); // 'overview' | 'dayDetails'
const loading         = ref(false);
const saving          = ref(false);
const saveMessage     = ref('');
const saveError       = ref('');
const conflictMessage = ref('');

/* ─── Data state ─────────────────────────────────────────────────────────── */
const plan             = ref(null);
const activeSession    = ref(null);  // in-progress workout_sessions row
const selectedDay      = ref('');    // day name chosen on Overview
const sessionExercises = ref([]);    // all exercises enriched with sessionSets

/* ─── Derived: plan structure ────────────────────────────────────────────── */
const scheduleMode = computed(() => plan.value?.scheduleMode || 'day');

const groups = computed(() => {
  if (scheduleMode.value === 'week') {
    return Array.isArray(plan.value?.weekGroups) && plan.value.weekGroups.length
      ? plan.value.weekGroups
      : ['Week 1'];
  }
  return Array.isArray(plan.value?.dayGroups) && plan.value.dayGroups.length
    ? plan.value.dayGroups
    : ['Any Day'];
});

const exercisesByGroup = computed(() =>
  groups.value
    .map((group) => ({
      name: group,
      exercises: sessionExercises.value.filter(
        (ex) => (ex.scheduleGroup || groups.value[0]) === group,
      ),
    }))
    .filter((g) => g.exercises.length > 0),
);

// Only exercises for the currently selected day
const dayExercises = computed(() =>
  sessionExercises.value.filter(
    (ex) => (ex.scheduleGroup || groups.value[0]) === selectedDay.value,
  ),
);

/* ─── Progress (selected day only) ──────────────────────────────────────── */
const totalCompleted = computed(() =>
  dayExercises.value.reduce(
    (acc, ex) => acc + ex.sessionSets.filter((s) => s.done).length,
    0,
  ),
);
const totalSets = computed(() =>
  dayExercises.value.reduce((acc, ex) => acc + ex.sessionSets.length, 0),
);
const progressPct = computed(() =>
  totalSets.value === 0 ? 0 : Math.round((totalCompleted.value / totalSets.value) * 100),
);

/* ─── Cardio helper ──────────────────────────────────────────────────────── */
const isCardio = (exercise) =>
  String(exercise.workoutType || '').toLowerCase() === 'cardio' ||
  (Number(exercise.duration || 0) > 0 && Number(exercise.reps || 0) === 0);

/* ─── Set helpers ────────────────────────────────────────────────────────── */
const getDefaultSetCount = (exercise) => {
  const type = String(
    exercise.WorkoutType || exercise.workoutType || exercise.workout_type ||
    exercise.ExerciseType || exercise.exerciseType || ''
  ).trim().toLowerCase();
  if (type === 'cardio' || type === 'other') return 1;
  const planned = Number(exercise.Sets ?? exercise.sets ?? 0);
  if (type === 'strength') return (Number.isFinite(planned) && planned > 0) ? planned : 3;
  return (Number.isFinite(planned) && planned > 0) ? planned : 1;
};

const buildInitialSets = (exercise) => {
  const count = getDefaultSetCount(exercise);
  return Array.from({ length: count }, (_, i) => ({
    setNum:   i + 1,
    weight:   Number(exercise.weight   || 0),
    reps:     Number(exercise.reps     || 0),
    duration: Number(exercise.duration || 0),
    done:     false,
  }));
};

const addSet = (exerciseId) => {
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex) return;
  const last = ex.sessionSets[ex.sessionSets.length - 1] || { weight: 0, reps: 0, duration: 0 };
  ex.sessionSets.push({
    setNum:   ex.sessionSets.length + 1,
    weight:   last.weight,
    reps:     last.reps,
    duration: last.duration,
    done:     false,
  });
};

const removeSet = (exerciseId, setIndex) => {
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex || ex.sessionSets.length <= 1) return;
  ex.sessionSets.splice(setIndex, 1);
  ex.sessionSets.forEach((s, i) => { s.setNum = i + 1; });
};

const updateSet = (exerciseId, setIndex, field, value) => {
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex) return;
  ex.sessionSets[setIndex][field] =
    field === 'done' ? Boolean(value) : (Number(value) || 0);
};

/* ─── Load plan ──────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split('T')[0];

const loadPlan = async () => {
  loading.value   = true;
  saveError.value = '';
  try {
    const query = planId.value ? `?planId=${encodeURIComponent(planId.value)}` : '';
    const res   = await fetch(`${API_BASE}/api/workout-planner${query}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load workout plan.');
    const data = await res.json();
    plan.value = data?.planner || null;
    sessionExercises.value = (plan.value?.exercises || []).map((ex) => ({
      ...ex,
      sessionSets: buildInitialSets(ex),
    }));
  } catch (err) {
    saveError.value = err?.message || 'Failed to load workout.';
  } finally {
    loading.value = false;
  }
};

/* ─── Check active session on mount ─────────────────────────────────────── */
const checkActiveSession = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/workout-sessions/active`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.session) return;
    // Auto-switch only if the session belongs to this plan
    if (String(data.session.workoutPlanId) === planId.value) {
      activeSession.value = data.session;
      selectedDay.value   = data.session.workoutDayName;
      activeTab.value     = 'dayDetails';
    }
  } catch (_) {
    // non-fatal
  }
};

/* ─── Start workout for a day (Overview) ────────────────────────────────── */
const startDayWorkout = async (dayName) => {
  conflictMessage.value = '';
  saveError.value       = '';

  // Already in a session for this day → just navigate
  if (activeSession.value) {
    if (activeSession.value.workoutDayName === dayName) {
      selectedDay.value = dayName;
      activeTab.value   = 'dayDetails';
      return;
    }
    conflictMessage.value =
      `You already have a workout in progress (${activeSession.value.workoutDayName}). ` +
      'Please finish or end the current workout before starting another.';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/workout-sessions/start`, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        workoutPlanId:  planId.value,
        workoutDayName: dayName,
        workoutDate:    today(),
      }),
    });
    const data = await res.json();

    if (res.status === 409) {
      conflictMessage.value = data.error || 'A workout is already in progress.';
      if (data.activeSession) activeSession.value = data.activeSession;
      return;
    }
    if (!res.ok) throw new Error(data?.error || 'Failed to start workout session.');

    activeSession.value = data.session;
    selectedDay.value   = dayName;
    activeTab.value     = 'dayDetails';
  } catch (err) {
    saveError.value = err?.message || 'Failed to start workout.';
  }
};

/* ─── Complete workout (save logs + mark session done) ───────────────────── */
const completeWorkout = async () => {
  saving.value      = true;
  saveMessage.value = '';
  saveError.value   = '';

  try {
    // 1 ── Save logs
    const sessionPayload = {
      planId:          planId.value,
      planName:        plan.value?.metadata?.name || '',
      workoutDate:     activeSession.value?.workoutDate || today(),
      workoutSessionId: activeSession.value?.id || null,
      exercises: dayExercises.value.map((ex) => ({
        exerciseId:    ex.exerciseId,
        name:          ex.name,
        workoutType:   ex.workoutType || 'Strength',
        scheduleGroup: ex.scheduleGroup,
        sets:          ex.sessionSets,
      })),
    };

    const logRes = await fetch(`${API_BASE}/api/workout-log/session`, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(sessionPayload),
      credentials: 'include',
    });
    if (!logRes.ok) {
      const errBody = await logRes.json().catch(() => ({}));
      throw new Error(errBody?.error || 'Failed to save session log.');
    }

    // 2 ── Mark session completed
    if (activeSession.value?.id) {
      await fetch(`${API_BASE}/api/workout-sessions/complete/${activeSession.value.id}`, {
        method:      'POST',
        credentials: 'include',
      });
    }

    saveMessage.value   = '✓ Workout complete! Great work!';
    activeSession.value = null;

    setTimeout(() => {
      saveMessage.value = '';
      activeTab.value   = 'overview';
      selectedDay.value = '';
    }, 2000);
  } catch (err) {
    saveError.value = err?.message || 'Failed to complete workout.';
  } finally {
    saving.value = false;
  }
};

/* ─── End workout without saving ────────────────────────────────────────── */
const endWithoutSaving = async () => {
  if (activeSession.value?.id) {
    try {
      await fetch(`${API_BASE}/api/workout-sessions/cancel/${activeSession.value.id}`, {
        method:      'POST',
        credentials: 'include',
      });
    } catch (_) { /* non-fatal */ }
  }
  activeSession.value   = null;
  activeTab.value       = 'overview';
  selectedDay.value     = '';
  conflictMessage.value = '';
};

/* ─── Navigation ─────────────────────────────────────────────────────────── */
const goBack        = () => router.push({ name: 'workouts' });
const openInBuilder = () =>
  router.push({ name: 'workout_builder', query: { planId: planId.value } });

/* ─── Lifecycle ──────────────────────────────────────────────────────────── */
onMounted(async () => {
  await loadPlan();
  await checkActiveSession();
});
</script>

<template>
  <div class="app-page-shell workout-detail-page">
    <div class="app-page-canvas app-inner-shell">

      <!-- Loading -->
      <div v-if="loading" class="wd-loading"><p>Loading workout…</p></div>

      <!-- Load error -->
      <div v-else-if="saveError && !plan" class="wd-error">
        <p>{{ saveError }}</p>
        <button type="button" class="wd-btn-primary" @click="loadPlan">Retry</button>
      </div>

      <!-- Main -->
      <template v-else-if="plan">

        <!-- Hero header -->
        <section class="wd-hero ff-page-header app-header-gradient">
          <div class="wd-hero__back">
            <button type="button" class="wd-back-btn" @click="goBack">
              <i class="fa-solid fa-arrow-left"></i> Workouts
            </button>
          </div>

          <div class="wd-hero__body">
            <div class="wd-hero__text">
              <h2>{{ plan.metadata?.name || 'Workout Session' }}</h2>
              <p v-if="plan.metadata?.description">{{ plan.metadata.description }}</p>
            </div>
            <div class="wd-hero__stats">
              <div class="wd-stat">
                <strong>{{ sessionExercises.length }}</strong>
                <span>Exercises</span>
              </div>
              <div class="wd-stat">
                <strong>{{ plan.metadata?.estimatedDuration || 0 }}</strong>
                <span>Min</span>
              </div>
              <div class="wd-stat">
                <strong>{{ plan.metadata?.type || 'Strength' }}</strong>
                <span>Type</span>
              </div>
            </div>
          </div>

          <!-- Session in-progress badge -->
          <div v-if="activeSession" class="wd-session-badge">
            <i class="fa-solid fa-circle-play"></i>
            Session in progress &mdash; {{ activeSession.workoutDayName }}
            &bull; Started {{ new Date(activeSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
          </div>

          <div class="wd-hero__actions">
            <button type="button" class="wd-btn-edit" @click="openInBuilder">
              <i class="fa-solid fa-pencil"></i> Edit Plan
            </button>
          </div>
        </section>

        <!-- Banners -->
        <div v-if="conflictMessage" class="wd-banner wd-banner--warn">
          <i class="fa-solid fa-triangle-exclamation"></i>
          {{ conflictMessage }}
          <button type="button" class="wd-banner-dismiss" @click="conflictMessage = ''">✕</button>
        </div>
        <div v-if="saveError && plan" class="wd-banner wd-banner--error">
          <i class="fa-solid fa-circle-xmark"></i>
          {{ saveError }}
          <button type="button" class="wd-banner-dismiss" @click="saveError = ''">✕</button>
        </div>
        <div v-if="saveMessage" class="wd-banner wd-banner--success">
          <i class="fa-solid fa-circle-check"></i>
          {{ saveMessage }}
        </div>

        <!-- Tab bar -->
        <nav class="wd-tabs" role="tablist">
          <button
            type="button" role="tab"
            :class="['wd-tab', activeTab === 'overview' ? 'wd-tab--active' : '']"
            @click="activeTab = 'overview'"
          >
            <i class="fa-solid fa-list-ul"></i> Overview
          </button>
          <button
            type="button" role="tab"
            :class="['wd-tab', activeTab === 'dayDetails' ? 'wd-tab--active' : '', !selectedDay ? 'wd-tab--disabled' : '']"
            :disabled="!selectedDay"
            @click="selectedDay && (activeTab = 'dayDetails')"
          >
            <i class="fa-solid fa-dumbbell"></i>
            Day Details
            <span v-if="selectedDay" class="wd-tab-badge">{{ selectedDay }}</span>
          </button>
        </nav>

        <!-- ══ OVERVIEW TAB ══════════════════════════════════════════════ -->
        <div v-show="activeTab === 'overview'" class="wd-tab-panel">

          <section v-if="exercisesByGroup.length === 0" class="wd-empty app-section-card">
            <p>No exercises in this plan yet.</p>
            <button type="button" class="wd-btn-primary" @click="openInBuilder">
              Add Exercises in Builder
            </button>
          </section>

          <div v-else class="wd-day-grid">
            <article
              v-for="group in exercisesByGroup"
              :key="group.name"
              class="wd-day-card app-section-card"
              :class="{ 'wd-day-card--active': activeSession && activeSession.workoutDayName === group.name }"
            >
              <!-- Card header -->
              <div class="wd-day-card__header">
                <div class="wd-day-card__title">
                  <i
                    :class="scheduleMode === 'week' ? 'fa-solid fa-calendar-week' : 'fa-solid fa-calendar-day'"
                    class="wd-day-card__icon"
                  ></i>
                  <h4>{{ group.name }}</h4>
                  <span v-if="activeSession && activeSession.workoutDayName === group.name" class="wd-in-progress-chip">
                    In Progress
                  </span>
                </div>
                <div class="wd-day-card__meta">
                  <span><i class="fa-solid fa-list-check"></i> {{ group.exercises.length }} exercise{{ group.exercises.length !== 1 ? 's' : '' }}</span>
                  <span v-if="plan.metadata?.estimatedDuration">
                    <i class="fa-solid fa-clock"></i>
                    ~{{ Math.round(plan.metadata.estimatedDuration / (exercisesByGroup.length || 1)) }} min
                  </span>
                  <span v-if="plan.metadata?.type"><i class="fa-solid fa-tag"></i> {{ plan.metadata.type }}</span>
                </div>
              </div>

              <!-- Exercise summary -->
              <ul class="wd-day-card__exercises">
                <li v-for="ex in group.exercises" :key="ex.id" class="wd-day-card__exercise-row">
                  <span class="wd-ex-name">{{ ex.name }}</span>
                  <span class="wd-ex-detail">
                    <template v-if="isCardio(ex)">{{ ex.duration || '—' }} min</template>
                    <template v-else>{{ ex.sets || '—' }} × {{ ex.reps || '—' }}<template v-if="ex.weight"> @ {{ ex.weight }} lb</template></template>
                  </span>
                </li>
              </ul>

              <!-- Action buttons -->
              <div class="wd-day-card__footer">
                <button
                  v-if="activeSession && activeSession.workoutDayName === group.name"
                  type="button" class="wd-btn-resume"
                  @click="activeTab = 'dayDetails'"
                >
                  <i class="fa-solid fa-circle-play"></i> Resume Workout
                </button>
                <button
                  v-else
                  type="button" class="wd-btn-start"
                  @click="startDayWorkout(group.name)"
                >
                  <i class="fa-solid fa-play"></i> Start Workout
                </button>
              </div>
            </article>
          </div>
        </div>

        <!-- ══ DAY DETAILS TAB ═══════════════════════════════════════════ -->
        <div v-show="activeTab === 'dayDetails'" class="wd-tab-panel">

          <template v-if="selectedDay && dayExercises.length > 0">

            <!-- Day sub-header + progress -->
            <div class="wd-day-detail-header">
              <div class="wd-day-detail-header__left">
                <h4>{{ selectedDay }}</h4>
                <span class="wd-day-detail-header__count">{{ dayExercises.length }} exercises</span>
              </div>
              <div class="wd-day-detail-header__progress">
                <div class="wd-progress-bar">
                  <div class="wd-progress-fill" :style="{ width: progressPct + '%' }"></div>
                </div>
                <span class="wd-progress-label">{{ totalCompleted }} / {{ totalSets }} sets ({{ progressPct }}%)</span>
              </div>
            </div>

            <!-- Exercises -->
            <div class="wd-exercise-list">
              <ExerciseSessionCard
                v-for="exercise in dayExercises"
                :key="exercise.id"
                :exercise="exercise"
                :is-cardio="isCardio(exercise)"
                @add-set="addSet"
                @remove-set="removeSet"
                @update-set="updateSet"
              />
            </div>

          </template>

          <section v-else class="wd-empty app-section-card">
            <p>No day selected. Go to <strong>Overview</strong> and click <strong>Start Workout</strong> on a day to begin.</p>
            <button type="button" class="wd-btn-primary" @click="activeTab = 'overview'">
              Go to Overview
            </button>
          </section>
        </div>

      </template>
    </div>

    <!-- Sticky bottom bar (Day Details only) -->
    <div v-if="activeTab === 'dayDetails' && selectedDay && dayExercises.length > 0" class="wd-bottom-bar">
      <div class="wd-bottom-bar__inner">
        <span class="wd-bottom-bar__label">{{ totalCompleted }} / {{ totalSets }} sets done</span>
        <div class="wd-bottom-bar__actions">
          <button type="button" class="wd-btn-end" @click="endWithoutSaving">
            <i class="fa-solid fa-xmark"></i> End Workout
          </button>
          <button type="button" class="wd-btn-complete" :disabled="saving" @click="completeWorkout">
            <i class="fa-solid fa-flag-checkered"></i>
            {{ saving ? 'Saving…' : 'Complete Workout' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workout-detail-page { padding-bottom: 100px; }

/* Loading / Error */
.wd-loading, .wd-error {
  padding: 48px 24px; text-align: center;
  color: var(--text-color-secondary, #6b7280);
}

/* Hero */
.wd-hero {
  border-radius: 16px; padding: 20px;
  display: grid; gap: 14px; margin-bottom: 16px;
}
.wd-hero__back { display: flex; }
.wd-back-btn {
  background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35);
  color: #fff; border-radius: 8px; padding: 6px 12px;
  font-size: 0.82rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 6px; transition: background 0.15s;
}
.wd-back-btn:hover { background: rgba(255,255,255,0.28); }

.wd-hero__body {
  display: flex; flex-wrap: wrap; gap: 16px;
  justify-content: space-between; align-items: flex-start;
}
.wd-hero__text h2 { margin: 0; color: #fff; font-size: 1.5rem; }
.wd-hero__text p  { margin: 4px 0 0; color: rgba(255,255,255,0.78); font-size: 0.88rem; }
.wd-hero__stats   { display: flex; gap: 16px; flex-wrap: wrap; }
.wd-stat { display: flex; flex-direction: column; align-items: center; min-width: 56px; }
.wd-stat strong { color: #fff; font-size: 1.3rem; font-weight: 800; line-height: 1; }
.wd-stat span   { color: rgba(255,255,255,0.7); font-size: 0.7rem; margin-top: 3px; }

/* Session badge */
.wd-session-badge {
  display: flex; align-items: center; gap: 8px;
  background: rgba(34,197,94,0.22); border: 1px solid rgba(34,197,94,0.45);
  color: #bbf7d0; border-radius: 10px; padding: 8px 14px;
  font-size: 0.82rem; font-weight: 700;
}
.wd-session-badge i { color: #4ade80; }

.wd-hero__actions { display: flex; gap: 10px; flex-wrap: wrap; }
.wd-btn-edit {
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.35);
  color: #fff; border-radius: 10px; padding: 10px 18px;
  font-size: 0.88rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wd-btn-edit:hover { background: rgba(255,255,255,0.25); }

/* Banners */
.wd-banner {
  display: flex; align-items: center; gap: 10px;
  border-radius: 10px; padding: 12px 16px;
  font-size: 0.88rem; font-weight: 600; margin-bottom: 12px;
}
.wd-banner--warn    { background: #fef9c3; border: 1px solid #fde047; color: #854d0e; }
.wd-banner--error   { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
.wd-banner--success { background: #dcfce7; border: 1px solid #86efac; color: #166534; }
.wd-banner-dismiss {
  margin-left: auto; background: none; border: none;
  font-size: 1rem; cursor: pointer; color: inherit; opacity: 0.6;
}
.wd-banner-dismiss:hover { opacity: 1; }

/* Tabs */
.wd-tabs {
  display: flex; gap: 4px;
  border-bottom: 2px solid var(--border-color, #e5e7eb);
  margin-bottom: 20px;
}
.wd-tab {
  background: none; border: none;
  border-bottom: 2px solid transparent; margin-bottom: -2px;
  padding: 10px 18px; font-size: 0.88rem; font-weight: 700;
  cursor: pointer; color: var(--text-color-secondary, #6b7280);
  display: flex; align-items: center; gap: 7px;
  transition: color 0.15s, border-color 0.15s;
  border-radius: 8px 8px 0 0;
}
.wd-tab:hover         { color: #2563eb; }
.wd-tab--active       { color: #2563eb; border-bottom-color: #2563eb; }
.wd-tab--disabled     { opacity: 0.4; cursor: not-allowed; }
.wd-tab-badge {
  background: #dbeafe; color: #1d4ed8;
  border-radius: 999px; padding: 1px 9px;
  font-size: 0.72rem; font-weight: 800;
}

.wd-tab-panel { min-height: 200px; }

/* Day grid */
.wd-day-grid { display: grid; gap: 16px; }
.wd-day-card {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px; padding: 18px;
  display: grid; gap: 14px; background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.wd-day-card--active {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34,197,94,0.15);
}
.wd-day-card__header  { display: grid; gap: 10px; }
.wd-day-card__title   { display: flex; align-items: center; gap: 10px; }
.wd-day-card__title h4 {
  margin: 0; font-size: 1.05rem; font-weight: 800;
  color: var(--text-color, #111827); flex: 1;
}
.wd-day-card__icon    { color: #3b82f6; font-size: 1rem; }
.wd-in-progress-chip {
  background: #dcfce7; color: #166534;
  border: 1px solid #86efac;
  border-radius: 999px; padding: 2px 10px;
  font-size: 0.72rem; font-weight: 800;
}
.wd-day-card__meta {
  display: flex; gap: 14px; flex-wrap: wrap;
  color: var(--text-color-secondary, #6b7280); font-size: 0.82rem;
}
.wd-day-card__meta span { display: flex; align-items: center; gap: 5px; }
.wd-day-card__meta i   { color: #3b82f6; }

.wd-day-card__exercises {
  list-style: none; padding: 0; margin: 0;
  display: grid; gap: 6px;
  border-top: 1px solid var(--border-color, #f3f4f6);
  padding-top: 12px;
}
.wd-day-card__exercise-row {
  display: flex; justify-content: space-between;
  align-items: center; gap: 8px; font-size: 0.84rem;
}
.wd-ex-name   { color: var(--text-color, #111827); font-weight: 600; }
.wd-ex-detail { color: var(--text-color-secondary, #6b7280); white-space: nowrap; }
.wd-day-card__footer { display: flex; justify-content: flex-end; gap: 10px; }

.wd-btn-start {
  background: #2563eb; border: none; color: #fff;
  border-radius: 10px; padding: 10px 20px;
  font-size: 0.88rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wd-btn-start:hover  { background: #1d4ed8; }
.wd-btn-resume {
  background: #22c55e; border: none; color: #fff;
  border-radius: 10px; padding: 10px 20px;
  font-size: 0.88rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wd-btn-resume:hover { background: #16a34a; }

/* Day detail header */
.wd-day-detail-header {
  display: flex; flex-wrap: wrap;
  justify-content: space-between; align-items: flex-start; gap: 14px;
  padding: 16px;
  background: var(--panel-bg, #f8fafc);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px; margin-bottom: 16px;
}
.wd-day-detail-header__left  { display: flex; align-items: center; gap: 12px; }
.wd-day-detail-header__left h4 { margin: 0; font-size: 1rem; font-weight: 800; }
.wd-day-detail-header__count {
  background: #dbeafe; color: #1d4ed8;
  border-radius: 999px; padding: 2px 10px;
  font-size: 0.75rem; font-weight: 700;
}
.wd-day-detail-header__progress { display: grid; gap: 6px; min-width: 200px; }

/* Progress bar */
.wd-progress-bar {
  height: 8px; background: #e5e7eb;
  border-radius: 999px; overflow: hidden;
}
.wd-progress-fill {
  height: 100%; background: #22c55e;
  border-radius: 999px; transition: width 0.35s ease;
}
.wd-progress-label { color: var(--text-color-secondary, #6b7280); font-size: 0.78rem; }

/* Exercise list */
.wd-exercise-list { display: grid; gap: 12px; }

/* Empty state */
.wd-empty {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px; padding: 32px 20px; text-align: center;
  display: grid; gap: 14px; justify-items: center;
  color: var(--text-color-secondary, #6b7280);
}
.wd-btn-primary {
  background: #2563eb; border: none; color: #fff;
  border-radius: 10px; padding: 10px 18px;
  font-size: 0.88rem; font-weight: 700; cursor: pointer; transition: background 0.15s;
}
.wd-btn-primary:hover { background: #1d4ed8; }

/* Sticky bottom bar */
.wd-bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  background: rgba(255,255,255,0.96);
  border-top: 1px solid var(--border-color, #e5e7eb);
  backdrop-filter: blur(8px); padding: 12px 16px;
}
.wd-bottom-bar__inner {
  max-width: 960px; margin: 0 auto;
  display: flex; align-items: center;
  justify-content: space-between; gap: 12px;
}
.wd-bottom-bar__label { font-size: 0.88rem; font-weight: 700; color: var(--text-color, #111827); }
.wd-bottom-bar__actions { display: flex; gap: 10px; }

.wd-btn-complete {
  background: #22c55e; border: none; color: #fff;
  border-radius: 10px; padding: 10px 18px;
  font-size: 0.88rem; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wd-btn-complete:hover:not(:disabled) { background: #16a34a; }
.wd-btn-complete:disabled { opacity: 0.6; cursor: not-allowed; }

.wd-btn-end {
  background: #f1f5f9; border: 1px solid #cbd5e1;
  color: #475569; border-radius: 10px; padding: 10px 16px;
  font-size: 0.88rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wd-btn-end:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

/* Responsive */
@media (max-width: 768px) {
  .workout-detail-page {
    padding-bottom: calc(108px + var(--wa-mobile-bottom-nav-clearance, calc(92px + env(safe-area-inset-bottom))));
  }

  .wd-bottom-bar {
    bottom: var(--wa-mobile-bottom-nav-clearance, calc(92px + env(safe-area-inset-bottom)));
  }
}

@media (max-width: 600px) {
  .wd-hero__body { flex-direction: column; }
  .wd-hero__stats { justify-content: space-around; width: 100%; }
  .wd-tabs { overflow-x: auto; }
  .wd-day-detail-header { flex-direction: column; }
  .wd-bottom-bar__inner { flex-direction: column; align-items: stretch; }
  .wd-bottom-bar__actions { justify-content: flex-end; }
}
</style>
