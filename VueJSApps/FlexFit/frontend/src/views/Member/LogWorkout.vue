<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ExerciseSessionCard from '@/components/workout-session/ExerciseSessionCard.vue';
import { API_BASE } from '@/config/env';
import { getExerciseImageFromGallery } from '@/utils/exerciseImage';

const router = useRouter();

/* ─── Tab state ───────────────────────────────────────────────── */
const activeTab = ref('overview'); // 'overview' | 'dayDetails' | 'workoutHistory'

/* ─── Selected date (single date, used by all tabs) ───────────────────────── */
const selectedWorkoutDate = ref(new Date().toISOString().split('T')[0]);

/* ─── Workout History state ───────────────────────────────────────────── */
const historyWorkouts        = ref([]);
const historyLoading         = ref(false);
const historyError           = ref('');
const workoutHistoryUsername = ref('');

/* ─── Delete History state ────────────────────────────────────────────── */
const showDeleteHistoryModal  = ref(false);
const workoutHistoryToDelete  = ref(null);   // { sessionId, planName, workoutDate }
const deleteHistoryLoading    = ref(false);
const deleteHistoryError      = ref('');

/* ─── Edit History state ──────────────────────────────────────────────── */
const editingHistorySessionId = ref(null);  // sessionId currently being edited
const historyEditDraft        = ref({});    // { [workoutLogId]: [...sets] }
const savingHistoryWorkout    = ref(false);
const historySaveError        = ref('');

/* ─── Plan list state ────────────────────────────────────────────────────── */
const loading       = ref(false);
const error         = ref('');
const workoutLists  = ref([]);

/* ─── Accordion / selected plan state ───────────────────────────────────── */
const expandedPlanId    = ref(null);   // accordion open state
const expandedPlanData  = ref(null);   // full plan detail (with exercises/days)
const expandedLoading   = ref(false);

/* ─── Session state (Day Details) ───────────────────────────────────────── */
const activeSession    = ref(null);
const hasActiveWorkout = ref(false);
const selectedDay      = ref('');
const sessionExercises = ref([]);
const isPreviewMode    = ref(false);
const saving           = ref(false);
const saveMessage      = ref('');
const saveError        = ref('');
const conflictMessage  = ref('');

/* ─── Save Day state ────────────────────────────────────────────────────── */
const savingDay      = ref(false);
const saveDayMessage = ref('');
const saveDayError   = ref('');

/* ─── Accordion: active exercise ───────────────────────────────────── */
const activeExerciseId = ref(null);

// Helper: open the first incomplete exercise in a list, or null if all done
function openFirstIncomplete(exercises) {
  if (!exercises || exercises.length === 0) { activeExerciseId.value = null; return; }
  const first = exercises.find((e) => !e.sessionSets.every((s) => s.done)) || null;
  activeExerciseId.value = first ? first.id : null;
}

// Reset accordion whenever the selected day changes
watch(selectedDay, () => {
  activeExerciseId.value = null;
});

const selectExercise = (exerciseId) => {
  if (isPreviewMode.value) return;
  // Toggle: clicking the open exercise collapses it, clicking another opens it
  activeExerciseId.value = activeExerciseId.value === exerciseId ? null : exerciseId;
};

const onExerciseCompleted = (exerciseId) => {
  if (isPreviewMode.value) return;
  // Mark all sets done then collapse and advance to next incomplete
  const exercises = dayExercises.value;
  const currentIdx = exercises.findIndex((e) => e.id === exerciseId);
  // Search from next exercise onward, then wrap to beginning
  const remaining = [
    ...exercises.slice(currentIdx + 1),
    ...exercises.slice(0, currentIdx),
  ];
  const next = remaining.find((e) => !e.sessionSets.every((s) => s.done));
  activeExerciseId.value = next ? next.id : null;
};

/* ─── Format helpers ─────────────────────────────────────────────────────── */
const formatUpdatedAt = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
};

const today = () => new Date().toISOString().split('T')[0];

/* ─── Summary stats (top cards) ─────────────────────────────────────────── */
const summaryStats = computed(() => {
  if (!workoutLists.value.length) return { totalPlans: 0, totalExercises: 0, averageDuration: 0 };
  const totalDuration  = workoutLists.value.reduce((a, p) => a + Number(p.estimatedDuration || 0), 0);
  const totalExercises = workoutLists.value.reduce((a, p) => a + Number(p.exerciseCount || 0), 0);
  return {
    totalPlans: workoutLists.value.length,
    totalExercises,
    averageDuration: Math.round(totalDuration / workoutLists.value.length),
  };
});
/* ─── Workout History grouped view ──────────────────────────────────────────── */
const scheduleMode = computed(() => expandedPlanData.value?.scheduleMode || 'day');

const groups = computed(() => {
  if (!expandedPlanData.value) return [];
  if (scheduleMode.value === 'week') {
    return Array.isArray(expandedPlanData.value.weekGroups) && expandedPlanData.value.weekGroups.length
      ? expandedPlanData.value.weekGroups : ['Week 1'];
  }
  return Array.isArray(expandedPlanData.value.dayGroups) && expandedPlanData.value.dayGroups.length
    ? expandedPlanData.value.dayGroups : ['Any Day'];
});

const allExercises = computed(() => expandedPlanData.value?.exercises || []);

const exercisesByGroup = computed(() =>
  groups.value
    .map((group) => ({
      name: group,
      exercises: allExercises.value.filter(
        (ex) => (ex.scheduleGroup || groups.value[0]) === group,
      ),
    }))
    .filter((g) => g.exercises.length > 0),
);

/* ─── Derived: selected day exercises (for Day Details tab) ─────────────── */
const dayExercises = computed(() =>
  sessionExercises.value.filter(
    (ex) => (ex.scheduleGroup || (groups.value[0] || '')) === selectedDay.value,
  ),
);

// Auto-open first incomplete exercise whenever the day exercise list is populated/rebuilt
watch(
  () => dayExercises.value,
  (exercises) => {
    // Only auto-open if nothing is currently selected for this day
    if (activeExerciseId.value && exercises.some((e) => e.id === activeExerciseId.value)) return;
    openFirstIncomplete(exercises);
  },
  { immediate: true },
);

/* ─── Progress (selected day) ────────────────────────────────────────────── */
const totalCompleted = computed(() =>
  dayExercises.value.reduce((acc, ex) => acc + ex.sessionSets.filter((s) => s.done).length, 0),
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
const buildInitialSets = (exercise) => {
  const count = Math.max(Number(exercise.sets || 1), 1);
  return Array.from({ length: count }, (_, i) => ({
    setNum: i + 1, weight: Number(exercise.weight || 0),
    reps: Number(exercise.reps || 0), duration: Number(exercise.duration || 0),
    caloriesBurned: 0, distanceMiles: 0, speedMph: 0, done: false,
  }));
};

const addSet = (exerciseId) => {
  if (isPreviewMode.value) return;
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex) return;
  const last = ex.sessionSets[ex.sessionSets.length - 1] || { weight: 0, reps: 0, duration: 0, caloriesBurned: 0, distanceMiles: 0, speedMph: 0 };
  ex.sessionSets.push({ setNum: ex.sessionSets.length + 1, weight: last.weight, reps: last.reps, duration: last.duration, caloriesBurned: last.caloriesBurned, distanceMiles: last.distanceMiles, speedMph: last.speedMph, done: false });
};

const removeSet = (exerciseId, setIndex) => {
  if (isPreviewMode.value) return;
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex || ex.sessionSets.length <= 1) return;
  ex.sessionSets.splice(setIndex, 1);
  ex.sessionSets.forEach((s, i) => { s.setNum = i + 1; });
};

const updateSet = (exerciseId, setIndex, field, value) => {
  if (isPreviewMode.value) return;
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex) return;
  ex.sessionSets[setIndex][field] = field === 'done' ? Boolean(value) : (Number(value) || 0);
};

/* ─── Load plan list ─────────────────────────────────────────────────────── */
const loadWorkoutLists = async () => {
  loading.value = true;
  error.value   = '';
  try {
    const res  = await fetch(`${API_BASE}/api/workout-planner`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load workout plans.');
    const data = await res.json();
    workoutLists.value = (Array.isArray(data?.workoutLists) ? data.workoutLists : [])
      .map((plan) => ({ ...plan, updatedAtLabel: formatUpdatedAt(plan.updatedAt) }));
  } catch (err) {
    error.value = err?.message || 'Failed to load workout plans.';
    workoutLists.value = [];
  } finally {
    loading.value = false;
  }
};

/* ─── Accordion: expand a plan (load full detail) ───────────────────────── */
const togglePlan = async (planId) => {
  const pid = String(planId || '');
  if (expandedPlanId.value === pid) {
    // Collapse
    expandedPlanId.value   = null;
    expandedPlanData.value = null;
    return;
  }

  expandedPlanId.value   = pid;
  expandedPlanData.value = null;
  expandedLoading.value  = true;

  try {
    const res  = await fetch(`${API_BASE}/api/workout-planner?planId=${encodeURIComponent(pid)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load plan details.');
    const data = await res.json();
    expandedPlanData.value = data?.planner || null;
  } catch (_) {
    expandedPlanData.value = null;
  } finally {
    expandedLoading.value = false;
  }
};

/* ─── Check active session ───────────────────────────────────────────────── */
const checkActiveSession = async () => {
  try {
    const res  = await fetch(`${API_BASE}/api/workout-sessions/active`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.session) {
      activeSession.value    = data.session;
      hasActiveWorkout.value = true;
      // Restore the date picker to the active session's start date so the
      // page always shows the correct workout even when returning on a later day.
      if (data.session.workoutDate) {
        const d = new Date(data.session.workoutDate);
        if (!isNaN(d)) {
          selectedWorkoutDate.value = d.toISOString().split('T')[0];
        }
      }
      // Auto-expand the plan that has an active session
      const pid = String(data.session.workoutPlanId || '');
      if (pid && expandedPlanId.value !== pid) await togglePlan(pid);
      selectedDay.value = data.session.workoutDayName;
      // Rebuild sessionExercises from expanded plan
      if (expandedPlanData.value) {
        sessionExercises.value = (expandedPlanData.value.exercises || []).map((ex) => ({
          ...ex, sessionSets: buildInitialSets(ex),
        }));
      }
    } else {
      activeSession.value    = null;
      hasActiveWorkout.value = false;
    }
  } catch (_) { /* non-fatal */ }
};

/* ─── Preview a day (no session created) ────────────────────────────────── */
const previewDay = (dayName) => {
  selectedDay.value      = dayName;
  isPreviewMode.value    = true;
  // Build exercise list from expanded plan for display
  sessionExercises.value = (expandedPlanData.value?.exercises || []).map((ex) => ({
    ...ex, sessionSets: buildInitialSets(ex),
  }));
  activeTab.value = 'dayDetails';
};

/* ─── Start workout for a day ────────────────────────────────────────────── */
const startDayWorkout = async (dayName) => {
  conflictMessage.value = '';
  saveError.value       = '';
  const planId = expandedPlanId.value;

  if (activeSession.value) {
    if (activeSession.value.workoutDayName === dayName) {
      selectedDay.value = dayName;
      activeTab.value   = 'dayDetails';
      return;
    }
    conflictMessage.value =
      `You already have a workout in progress (${activeSession.value.workoutDayName}). ` +
      'Please finish or end it before starting another.';
    return;
  }

  // Use the user's selected date as the workout start date; fall back to today only if unset.
  const workoutStartDate = selectedWorkoutDate.value || today();

  try {
    const res  = await fetch(`${API_BASE}/api/workout-sessions/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ workoutPlanId: planId, workoutDayName: dayName, workoutDate: workoutStartDate }),
    });
    const data = await res.json();

    if (res.status === 409) {
      conflictMessage.value = data.error || 'A workout is already in progress.';
      if (data.activeSession) activeSession.value = data.activeSession;
      return;
    }
    if (!res.ok) throw new Error(data?.error || 'Failed to start workout session.');

    activeSession.value    = data.session;
    hasActiveWorkout.value = true;
    selectedWorkoutDate.value = workoutStartDate; // lock the date picker to the start date
    selectedDay.value      = dayName;
    isPreviewMode.value    = false;

    // Build session exercises from the expanded plan
    sessionExercises.value = (expandedPlanData.value?.exercises || []).map((ex) => ({
      ...ex, sessionSets: buildInitialSets(ex),
    }));

    activeTab.value = 'dayDetails';
  } catch (err) {
    saveError.value = err?.message || 'Failed to start workout.';
  }
};

/* ─── Complete workout ───────────────────────────────────────────────────── */
const completeWorkout = async () => {
  saving.value      = true;
  saveMessage.value = '';
  saveError.value   = '';

  try {
    const sessionPayload = {
      planId:           expandedPlanId.value,
      planName:         expandedPlanData.value?.metadata?.name || '',
      workoutDate:      activeSession.value?.workoutDate || today(),
      workoutSessionId: activeSession.value?.id || null,
      exercises: dayExercises.value.map((ex) => ({
        exerciseId: ex.exerciseId, name: ex.name,
        workoutType: ex.workoutType || 'Strength',
        scheduleGroup: ex.scheduleGroup, sets: ex.sessionSets,
      })),
    };

    const logRes = await fetch(`${API_BASE}/api/workout-log/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionPayload), credentials: 'include',
    });
    if (!logRes.ok) {
      const errBody = await logRes.json().catch(() => ({}));
      throw new Error(errBody?.error || 'Failed to save session log.');
    }

    if (activeSession.value?.id) {
      await fetch(`${API_BASE}/api/workout-sessions/complete/${activeSession.value.id}`, {
        method: 'POST', credentials: 'include',
      });
    }

    saveMessage.value      = '✓ Workout complete! Great work!';
    activeSession.value    = null;
    hasActiveWorkout.value = false;

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

/* ─── End without saving ─────────────────────────────────────────────────── */
const endWithoutSaving = async () => {
  if (activeSession.value?.id) {
    try {
      await fetch(`${API_BASE}/api/workout-sessions/cancel/${activeSession.value.id}`, {
        method: 'POST', credentials: 'include',
      });
    } catch (_) { /* non-fatal */ }
  }
  activeSession.value    = null;
  hasActiveWorkout.value = false;
  isPreviewMode.value    = false;
  activeTab.value        = 'overview';
  selectedDay.value      = '';
  conflictMessage.value  = '';
};

/* ─── Navigation helpers ─────────────────────────────────────────────────── */
const startBuilder = () => router.push({ name: 'workout_builder' });
const openInBuilder = (planId) => {
  const pid = String(planId || '').trim();
  router.push(pid ? { name: 'workout_builder', query: { planId: pid } } : { name: 'workout_builder' });
};

const goToInProgress = () => {
  if (hasActiveWorkout.value && activeSession.value) {
    // Restore the date picker to the locked workout start date.
    if (activeSession.value.workoutDate) {
      const d = new Date(activeSession.value.workoutDate);
      if (!isNaN(d)) {
        selectedWorkoutDate.value = d.toISOString().split('T')[0];
      }
    }
    selectedDay.value = activeSession.value.workoutDayName || selectedDay.value;
    activeTab.value   = 'dayDetails';
  }
};
/* ─── Workout History loader ───────────────────────────────────────────── */
const loadWorkoutHistory = async () => {
  historyLoading.value  = true;
  historyError.value    = '';
  historyWorkouts.value = [];
  try {
    const res = await fetch(
      `${API_BASE}/api/workout-log/history?date=${encodeURIComponent(selectedWorkoutDate.value)}`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      let serverMsg = '';
      try { const e = await res.json(); serverMsg = e?.error || ''; } catch (_) {}
      throw new Error(serverMsg || `Server error ${res.status}`);
    }
    const data = await res.json();
    historyWorkouts.value        = Array.isArray(data.sessions) ? data.sessions : [];
    workoutHistoryUsername.value = data.username || '';
  } catch (err) {
    console.error('[WorkoutHistory] load failed:', err);
    historyError.value    = err.message || 'Unable to load workout history.';
    historyWorkouts.value = [];
  } finally {
    historyLoading.value = false;
  }
};

// Auto-reload history when the date picker changes while history tab is open
watch(selectedWorkoutDate, () => {
  if (activeTab.value === 'workoutHistory') {
    loadWorkoutHistory();
  }
});

const openHistoryTab = () => {
  activeTab.value = 'workoutHistory';
  loadWorkoutHistory();
};

/* ─── Delete history session ─────────────────────────────────────────── */
const openDeleteHistoryModal = (session) => {
  workoutHistoryToDelete.value = {
    sessionId:   session.sessionId,
    planName:    session.planName || 'Workout',
    workoutDate: session.workoutDate || selectedWorkoutDate.value,
  };
  deleteHistoryError.value  = '';
  showDeleteHistoryModal.value = true;
};

const closeDeleteHistoryModal = () => {
  showDeleteHistoryModal.value = false;
  workoutHistoryToDelete.value = null;
  deleteHistoryError.value     = '';
};

const confirmDeleteHistoryWorkout = async () => {
  if (!workoutHistoryToDelete.value) return;
  deleteHistoryLoading.value = true;
  deleteHistoryError.value   = '';
  try {
    const { sessionId } = workoutHistoryToDelete.value;
    const endpoint = sessionId != null
      ? `${API_BASE}/api/workout-log/history/session/${sessionId}`
      : null;
    if (!endpoint) throw new Error('Cannot identify session to delete.');
    const res = await fetch(endpoint, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      let msg = '';
      try { const e = await res.json(); msg = e?.error || ''; } catch (_) {}
      throw new Error(msg || `Server error ${res.status}`);
    }
    closeDeleteHistoryModal();
    await loadWorkoutHistory();
  } catch (err) {
    console.error('[DeleteHistory]', err);
    deleteHistoryError.value = err.message || 'Failed to delete workout.';
  } finally {
    deleteHistoryLoading.value = false;
  }
};
/* ─── Edit history session ──────────────────────────────────────────────── */
const startEditHistoryWorkout = (session) => {
  historySaveError.value        = '';
  editingHistorySessionId.value = session.sessionId;
  const draft = {};
  for (const ex of session.exercises) {
    draft[ex.workoutLogId] = ex.sets.map((s) => ({ ...s }));
  }
  historyEditDraft.value = draft;
};

const cancelEditHistoryWorkout = () => {
  editingHistorySessionId.value = null;
  historyEditDraft.value        = {};
  historySaveError.value        = '';
};

const updateHistoryDraft = (workoutLogId, setIdx, field, value) => {
  const sets = historyEditDraft.value[workoutLogId];
  if (!sets || !sets[setIdx]) return;
  sets[setIdx][field] = Number(value) || 0;
};

const saveHistoryWorkout = async (session) => {
  savingHistoryWorkout.value = true;
  historySaveError.value     = '';
  try {
    const exercises = session.exercises.map((ex) => ({
      workoutLogId: ex.workoutLogId,
      sets: (historyEditDraft.value[ex.workoutLogId] || ex.sets).map((s) => ({
        setNumber:      s.setNumber,
        weight:         s.weight,
        reps:           s.reps,
        duration:       s.duration,
        caloriesBurned: s.caloriesBurned,
        distanceMiles:  s.distanceMiles,
        speedMph:       s.speedMph,
      })),
    }));
    const res = await fetch(
      `${API_BASE}/api/workout-log/history/session/${session.sessionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises }),
        credentials: 'include',
      }
    );
    if (!res.ok) {
      let msg = '';
      try { const e = await res.json(); msg = e?.error || ''; } catch (_) {}
      throw new Error(msg || `Server error ${res.status}`);
    }
    cancelEditHistoryWorkout();
    await loadWorkoutHistory();
  } catch (err) {
    console.error('[SaveHistory]', err);
    historySaveError.value = err.message || 'Failed to save changes.';
  } finally {
    savingHistoryWorkout.value = false;
  }
};

/* ─── Save Day helpers ───────────────────────────────────────────────────── */
const toSafeNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const saveDay = async () => {
  if (!activeSession.value?.id) return;
  savingDay.value      = true;
  saveDayMessage.value = '';
  saveDayError.value   = '';
  try {
    const payload = {
      exercises: dayExercises.value.map((ex) => ({
        exerciseId:    ex.exerciseId,
        name:          ex.name,
        workoutType:   ex.workoutType || 'Strength',
        scheduleGroup: ex.scheduleGroup,
        sets: ex.sessionSets.map((s) => ({
          setNum:         s.setNum,
          weight:         toSafeNumber(s.weight),
          reps:           toSafeNumber(s.reps),
          duration:       toSafeNumber(s.duration),
          caloriesBurned: toSafeNumber(s.caloriesBurned),
          distanceMiles:  toSafeNumber(s.distanceMiles),
          speedMph:       toSafeNumber(s.speedMph),
          done:           Boolean(s.done),
        })),
      })),
    };
    const res = await fetch(
      `${API_BASE}/api/workout-log/session/${activeSession.value.id}/save-day`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error || 'Failed to save day.');
    }
    saveDayMessage.value = '\u2713 Day saved!';
    setTimeout(() => { saveDayMessage.value = ''; }, 3000);
  } catch (err) {
    saveDayError.value = err?.message || 'Failed to save day.';
  } finally {
    savingDay.value = false;
  }
};

/* ─── Lifecycle ──────────────────────────────────────────────────────────── */
onMounted(async () => {
  await loadWorkoutLists();
  await checkActiveSession();
});
</script>

<template>
  <div class="app-page-shell wl-page">
    <div class="app-page-canvas app-inner-shell">

      <!-- ── Hero header ─────────────────────────────────────────────────── -->
      <section class="builder-hero ff-page-header app-header-gradient">
        <div class="builder-hero__content">
          <div class="builder-hero__text">
            <h2>Workout Log</h2>
            <p class="builder-hero__subtitle">View workout plans saved from Workout Builder and start a workout.</p>
          </div>
          <div class="builder-hero__actions">
            <input
              type="date"
              v-model="selectedWorkoutDate"
              class="wl-date-input"
              :max="new Date().toISOString().split('T')[0]"
            />
          </div>
        </div>
        <!-- Action toolbar inside hero -->
        <div class="wl-toolbar">
          <button
            type="button"
            :class="['wl-btn', hasActiveWorkout ? 'wl-btn--active' : 'wl-btn--secondary']"
            @click="goToInProgress"
          >
            <i class="fa-solid fa-clock-rotate-left"></i> Workouts In Progress
          </button>
          <button type="button" class="wl-btn" @click="startBuilder">
            <i class="fa-solid fa-dumbbell"></i> Open Workout Builder
          </button>
        </div>
      </section>

      <!-- ── Banners ─────────────────────────────────────────────────────── -->
      <div v-if="conflictMessage" class="wl-banner wl-banner--warn">
        <i class="fa-solid fa-triangle-exclamation"></i> {{ conflictMessage }}
        <button type="button" class="wl-banner-dismiss" @click="conflictMessage = ''">✕</button>
      </div>
      <div v-if="saveError" class="wl-banner wl-banner--error">
        <i class="fa-solid fa-circle-xmark"></i> {{ saveError }}
        <button type="button" class="wl-banner-dismiss" @click="saveError = ''">✕</button>
      </div>
      <div v-if="saveMessage" class="wl-banner wl-banner--success">
        <i class="fa-solid fa-circle-check"></i> {{ saveMessage }}
      </div>

      <!-- ── Stats row ───────────────────────────────────────────────────── -->
      <section v-if="workoutLists.length > 0" class="wl-stats">
        <article class="wl-stat-card app-section-card">
          <span>Saved Plans</span>
          <strong>{{ summaryStats.totalPlans }}</strong>
        </article>
        <article class="wl-stat-card app-section-card">
          <span>Avg Duration</span>
          <strong>{{ summaryStats.averageDuration }} min</strong>
        </article>
        <article class="wl-stat-card app-section-card">
          <span>Total Exercises</span>
          <strong>{{ summaryStats.totalExercises }}</strong>
        </article>
      </section>

      <!-- ── Tab bar ─────────────────────────────────────────────────────── -->
      <nav class="wl-tabs" role="tablist">
        <button
          type="button" role="tab"
          :class="['wl-tab', activeTab === 'overview' ? 'wl-tab--active' : '']"
          @click="activeTab = 'overview'"
        >
          <i class="fa-solid fa-list-ul"></i> Overview
        </button>
        <button
          type="button" role="tab"
          :class="['wl-tab', activeTab === 'dayDetails' ? 'wl-tab--active' : '', !selectedDay ? 'wl-tab--disabled' : '']"
          :disabled="!selectedDay"
          @click="selectedDay && (activeTab = 'dayDetails')"
        >
          <i class="fa-solid fa-dumbbell"></i> Day Details
          <span v-if="selectedDay" class="wl-tab-badge">{{ selectedDay }}</span>
        </button>
        <button
          type="button" role="tab"
          :class="['wl-tab', activeTab === 'workoutHistory' ? 'wl-tab--active' : '']"
          @click="openHistoryTab"
        >
          <i class="fa-solid fa-clock-rotate-left"></i> Workout History
        </button>
      </nav>

      <!-- ══ OVERVIEW TAB ════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'overview'" class="wl-tab-panel">

        <!-- Loading -->
        <div v-if="loading" class="wl-empty"><p>Loading workout plans…</p></div>

        <!-- Error -->
        <div v-else-if="error" class="wl-empty">
          <p>{{ error }}</p>
          <button type="button" class="wl-btn" @click="loadWorkoutLists">Retry</button>
        </div>

        <!-- Empty -->
        <div v-else-if="workoutLists.length === 0" class="wl-empty app-section-card">
          <i class="fa-solid fa-dumbbell wl-empty-icon"></i>
          <h6>No workout plans yet</h6>
          <p>Create your first plan in Workout Builder.</p>
          <button type="button" class="wl-btn" @click="startBuilder">Create Workout</button>
        </div>

        <!-- ── Accordion plan list ──────────────────────────────────────── -->
        <div v-else class="wl-accordion">
          <div
            v-for="plan in workoutLists"
            :key="plan.planId"
            :class="['wl-plan', expandedPlanId === String(plan.planId) ? 'wl-plan--expanded' : '']"
          >
            <!-- Plan row header -->
            <div class="wl-plan__header" @click="togglePlan(plan.planId)">
              <div class="wl-plan__left">
                <div class="wl-plan__chevron">
                  <i :class="expandedPlanId === String(plan.planId) ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
                </div>
                <div class="wl-plan__info">
                  <span class="wl-plan__name">{{ plan.name || plan.planName || 'Unnamed Plan' }}</span>
                  <div class="wl-plan__meta">
                    <span v-if="plan.estimatedDuration"><i class="fa-solid fa-clock"></i> {{ plan.estimatedDuration }} min</span>
                    <span v-if="plan.exerciseCount"><i class="fa-solid fa-list-check"></i> {{ plan.exerciseCount }} exercises</span>
                    <span v-if="plan.type || plan.workoutType" class="wl-plan__tag">{{ plan.type || plan.workoutType }}</span>
                    <span v-if="plan.updatedAtLabel"><i class="fa-solid fa-calendar"></i> {{ plan.updatedAtLabel }}</span>
                  </div>
                </div>
              </div>
              <div class="wl-plan__right" @click.stop>
                <span v-if="expandedPlanId === String(plan.planId)" class="wl-plan__selected-badge">
                  <i class="fa-solid fa-circle-check"></i> Selected
                </span>
                <button type="button" class="wl-btn-edit" @click="openInBuilder(plan.planId)">
                  <i class="fa-solid fa-pencil"></i> Edit Plan
                </button>
              </div>
            </div>

            <!-- Expanded: day cards -->
            <div v-if="expandedPlanId === String(plan.planId)" class="wl-plan__body">
              <div v-if="expandedLoading" class="wl-plan__loading">Loading days…</div>

              <div v-else-if="!expandedPlanData || exercisesByGroup.length === 0" class="wl-plan__loading">
                No scheduled days found. <button type="button" class="wl-link" @click="openInBuilder(plan.planId)">Open in Builder</button>
              </div>

              <div v-else class="wl-day-grid">
                <article
                  v-for="group in exercisesByGroup"
                  :key="group.name"
                  class="wl-day-card app-section-card"
                  :class="{ 'wl-day-card--active': activeSession && activeSession.workoutDayName === group.name }"
                >
                  <!-- Day card header -->
                  <div class="wl-day-card__header">
                    <div class="wl-day-card__title">
                      <i class="fa-solid fa-calendar-day wl-day-icon"></i>
                      <h4>{{ group.name }}</h4>
                      <span v-if="activeSession && activeSession.workoutDayName === group.name" class="wl-in-progress-chip">
                        In Progress
                      </span>
                    </div>
                    <div class="wl-day-card__meta">
                      <span><i class="fa-solid fa-list-check"></i> {{ group.exercises.length }} exercise{{ group.exercises.length !== 1 ? 's' : '' }}</span>
                      <span v-if="expandedPlanData?.metadata?.estimatedDuration">
                        <i class="fa-solid fa-clock"></i>
                        ~{{ Math.round(expandedPlanData.metadata.estimatedDuration / (exercisesByGroup.length || 1)) }} min
                      </span>
                      <span v-if="expandedPlanData?.metadata?.type">
                        <i class="fa-solid fa-tag"></i> {{ expandedPlanData.metadata.type }}
                      </span>
                    </div>
                  </div>

                  <!-- Exercise preview -->
                  <ul class="wl-day-card__exercises">
                    <li v-for="ex in group.exercises" :key="ex.id" class="wl-day-card__ex-row">
                      <span class="wl-ex-name">{{ ex.name }}</span>
                      <span class="wl-ex-detail">
                        <template v-if="isCardio(ex)">{{ ex.duration || '—' }} min</template>
                        <template v-else>{{ ex.sets || '—' }} × {{ ex.reps || '—' }}<template v-if="ex.weight"> @ {{ ex.weight }} lb</template></template>
                      </span>
                    </li>
                  </ul>

                  <!-- Action -->
                  <div class="wl-day-card__footer">
                    <button
                      v-if="activeSession && activeSession.workoutDayName === group.name"
                      type="button" class="wl-btn-resume"
                      @click="activeTab = 'dayDetails'"
                    >
                      <i class="fa-solid fa-circle-play"></i> Resume Workout
                    </button>
                    <template v-else>
                      <button
                        type="button" class="wl-btn-preview"
                        @click="previewDay(group.name)"
                      >
                        <i class="fa-solid fa-eye"></i> Preview
                      </button>
                      <button
                        type="button" class="wl-btn-start"
                        @click="startDayWorkout(group.name)"
                      >
                        <i class="fa-solid fa-play"></i> Start Workout
                      </button>
                    </template>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ DAY DETAILS TAB ═════════════════════════════════════════════ -->
      <div v-show="activeTab === 'dayDetails'" class="wl-tab-panel">

        <template v-if="selectedDay && dayExercises.length > 0">
          <!-- Preview mode banner -->
          <div v-if="isPreviewMode" class="wl-preview-banner">
            <i class="fa-solid fa-eye"></i>
            <span>Preview only — <strong>start the workout</strong> to log sets.</span>
            <button type="button" class="wl-btn-start wl-preview-banner__start" @click="startDayWorkout(selectedDay)">
              <i class="fa-solid fa-play"></i> Start Workout
            </button>
          </div>

          <!-- Day sub-header + progress -->
          <div class="wl-day-detail-header">
            <div class="wl-day-detail-header__left">
              <h4>{{ selectedDay }}</h4>
              <span class="wl-day-detail-count">{{ dayExercises.length }} exercises</span>
              <span v-if="isPreviewMode" class="wl-preview-badge"><i class="fa-solid fa-eye"></i> Preview</span>
            </div>
            <div v-if="!isPreviewMode" class="wl-day-detail-header__progress">
              <div class="wl-progress-bar">
                <div class="wl-progress-fill" :style="{ width: progressPct + '%' }"></div>
              </div>
              <span class="wl-progress-label">{{ totalCompleted }} / {{ totalSets }} sets ({{ progressPct }}%)</span>
            </div>
          </div>

          <!-- Exercises -->
          <div :class="['wl-exercise-list', isPreviewMode ? 'wl-exercise-list--preview' : '']">
            <ExerciseSessionCard
              v-for="exercise in dayExercises"
              :key="exercise.id"
              :exercise="exercise"
              :is-cardio="isCardio(exercise)"
              :is-expanded="activeExerciseId === exercise.id"
              @select="selectExercise"
              @add-set="addSet"
              @remove-set="removeSet"
              @update-set="updateSet"
              @exercise-completed="onExerciseCompleted"
            />
          </div>
        </template>

        <div v-else class="wl-empty app-section-card">
          <i class="fa-solid fa-dumbbell wl-empty-icon"></i>
          <p>No day selected. Go to <strong>Overview</strong>, pick a workout plan and click <strong>Start Workout</strong> on a day.</p>
          <button type="button" class="wl-btn" @click="activeTab = 'overview'">Go to Overview</button>
        </div>
      </div>

      <!-- ══ WORKOUT HISTORY TAB ════════════════════════════════════════ -->
      <div v-show="activeTab === 'workoutHistory'" class="wl-tab-panel">

        <!-- Date context bar -->
        <div class="wl-history-datebar">
          <span><i class="fa-solid fa-calendar-day"></i> Workouts started on <strong>{{ selectedWorkoutDate }}</strong></span>
          <button type="button" class="wl-btn-preview" style="padding:7px 12px;font-size:0.8rem" @click="loadWorkoutHistory">
            <i class="fa-solid fa-arrows-rotate"></i> Refresh
          </button>
        </div>

        <!-- Error -->
        <div v-if="historyError" class="wl-banner wl-banner--error" style="margin-bottom:12px">
          <i class="fa-solid fa-circle-xmark"></i> {{ historyError }}
        </div>

        <!-- Loading -->
        <div v-if="historyLoading" class="wl-empty"><p>Loading history…</p></div>

        <!-- Empty -->
        <div v-else-if="!historyError && historyWorkouts.length === 0" class="wl-empty app-section-card">
          <i class="fa-solid fa-calendar-xmark wl-empty-icon"></i>
          <h6>No exercises recorded</h6>
          <p v-if="workoutHistoryUsername">
            No completed workouts found for <strong>{{ workoutHistoryUsername }}</strong> started on <strong>{{ selectedWorkoutDate }}</strong>.
          </p>
          <p v-else>No completed workouts started on <strong>{{ selectedWorkoutDate }}</strong>.</p>
        </div>

        <!-- Session list -->
        <div v-else-if="!historyLoading" class="wl-history-list">
          <div
            v-for="(session, sidx) in historyWorkouts"
            :key="session.sessionId != null ? session.sessionId : sidx"
            :class="['wl-history-session', editingHistorySessionId === session.sessionId ? 'wl-history-session--editing' : '']"
          >
            <!-- Session header -->
            <div class="wl-history-session__header">
              <div class="wl-history-session__title">
                <i class="fa-solid fa-circle-check wl-hist-check-icon"></i>
                <span class="wl-history-group__plan">{{ session.planName || 'Workout' }}</span>
                <span v-if="session.workoutDayName" class="wl-history-group__day">{{ session.workoutDayName }}</span>
              </div>
              <div class="wl-history-session__meta">
                <span v-if="session.sessionStartedAt">
                  <i class="fa-solid fa-play"></i>
                  Started: {{ new Date(session.sessionStartedAt).toLocaleString() }}
                </span>
                <span v-if="session.sessionCompletedAt">
                  <i class="fa-solid fa-flag-checkered"></i>
                  Completed: {{ new Date(session.sessionCompletedAt).toLocaleString() }}
                </span>
                <!-- Edit mode: Save + Cancel -->
                <template v-if="editingHistorySessionId === session.sessionId">
                  <span v-if="historySaveError" class="wl-hist-save-error">
                    <i class="fa-solid fa-circle-xmark"></i> {{ historySaveError }}
                  </span>
                  <button
                    type="button"
                    class="wl-hist-cancel-btn"
                    :disabled="savingHistoryWorkout"
                    @click="cancelEditHistoryWorkout"
                  >
                    <i class="fa-solid fa-xmark"></i> Cancel
                  </button>
                  <button
                    type="button"
                    class="wl-hist-save-btn"
                    :disabled="savingHistoryWorkout"
                    @click="saveHistoryWorkout(session)"
                  >
                    <i v-if="savingHistoryWorkout" class="fa-solid fa-spinner fa-spin"></i>
                    <i v-else class="fa-solid fa-floppy-disk"></i>
                    {{ savingHistoryWorkout ? 'Saving\u2026' : 'Save' }}
                  </button>
                </template>
                <!-- Read-only mode: Edit + Delete -->
                <template v-else>
                  <button
                    type="button"
                    class="wl-hist-edit-btn"
                    :disabled="editingHistorySessionId !== null"
                    @click="startEditHistoryWorkout(session)"
                  >
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                  </button>
                  <button
                    type="button"
                    class="wl-hist-delete-btn"
                    title="Delete this workout record"
                    @click="openDeleteHistoryModal(session)"
                  >
                    <i class="fa-solid fa-trash"></i> Delete
                  </button>
                </template>
              </div>
            </div>

            <!-- Exercises in this session -->
            <div class="wl-history-exercises wl-history-exercises--detailed">
              <div
                v-for="(ex, eidx) in session.exercises"
                :key="ex.workoutLogId != null ? ex.workoutLogId : eidx"
                class="wl-hist-ex-card"
              >
                <!-- Exercise identity -->
                <div class="wl-hist-ex-identity">
                  <div class="wl-hist-ex-thumb">
                    <img
                      v-if="ex.exerciseImage"
                      :src="getExerciseImageFromGallery(ex.exerciseImage)"
                      :alt="ex.exerciseName"
                      class="wl-hist-thumb-img"
                    />
                    <i v-else class="fa-solid fa-dumbbell"></i>
                  </div>
                  <div class="wl-hist-ex-info">
                    <strong class="wl-hist-ex-name">{{ ex.exerciseName }}</strong>
                    <div class="wl-hist-ex-tags">
                      <span v-if="ex.muscleGroup" class="wl-hist-tag">{{ ex.muscleGroup }}</span>
                      <span v-if="ex.equipment" class="wl-hist-tag">{{ ex.equipment }}</span>
                      <span class="wl-hist-tag wl-hist-tag--type">{{ ex.workoutType || 'Strength' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Per-set table -->
                <template v-if="ex.sets && ex.sets.length > 0">
                  <!-- Strength -->
                  <template v-if="String(ex.workoutType || '').toLowerCase() === 'strength'">
                    <div class="wl-hist-sets-table">
                      <div class="wl-hist-sets-head wl-hist-sets-head--strength">
                        <span>Set</span><span>Weight (kg)</span><span>Reps</span><span>Done</span>
                      </div>
                      <div
                        v-for="(set, setIdx) in ex.sets" :key="set.setNumber"
                        :class="['wl-hist-set-row', 'wl-hist-set-row--strength', set.completed ? 'wl-hist-set-row--done' : '']"
                      >
                        <span class="wl-hist-set-num">{{ set.setNumber }}</span>
                        <!-- Weight -->
                        <input
                          v-if="editingHistorySessionId === session.sessionId"
                          type="number" class="wl-hist-set-input" min="0" step="0.5"
                          :value="historyEditDraft[ex.workoutLogId]?.[setIdx]?.weight ?? set.weight ?? 0"
                          @input="updateHistoryDraft(ex.workoutLogId, setIdx, 'weight', $event.target.value)"
                        />
                        <span v-else>{{ set.weight ?? '&mdash;' }}</span>
                        <!-- Reps -->
                        <input
                          v-if="editingHistorySessionId === session.sessionId"
                          type="number" class="wl-hist-set-input" min="0"
                          :value="historyEditDraft[ex.workoutLogId]?.[setIdx]?.reps ?? set.reps ?? 0"
                          @input="updateHistoryDraft(ex.workoutLogId, setIdx, 'reps', $event.target.value)"
                        />
                        <span v-else>{{ set.reps ?? '&mdash;' }}</span>
                        <!-- Done (always read-only) -->
                        <span>
                          <i v-if="set.completed" class="fa-solid fa-circle-check" style="color:#22c55e"></i>
                          <i v-else class="fa-regular fa-circle" style="color:#d1d5db"></i>
                        </span>
                      </div>
                    </div>
                  </template>
                  <!-- Cardio + Other: Duration, Calories, Distance, Speed, Done -->
                  <template v-else>
                    <div class="wl-hist-sets-table wl-hist-sets-table--cardio">
                      <div class="wl-hist-sets-head wl-hist-sets-head--cardio">
                        <span>Set</span>
                        <span>Duration<br><small>(min)</small></span>
                        <span>Calories<br><small>(kcal)</small></span>
                        <span>Distance<br><small>(mi)</small></span>
                        <span>Speed<br><small>(mph)</small></span>
                        <span>Done</span>
                      </div>
                      <div
                        v-for="(set, setIdx) in ex.sets" :key="set.setNumber"
                        :class="['wl-hist-set-row', 'wl-hist-set-row--cardio', set.completed ? 'wl-hist-set-row--done' : '']"
                      >
                        <span class="wl-hist-set-num">{{ set.setNumber }}</span>
                        <!-- Duration -->
                        <input
                          v-if="editingHistorySessionId === session.sessionId"
                          type="number" class="wl-hist-set-input" min="0"
                          :value="historyEditDraft[ex.workoutLogId]?.[setIdx]?.duration ?? set.duration ?? 0"
                          @input="updateHistoryDraft(ex.workoutLogId, setIdx, 'duration', $event.target.value)"
                        />
                        <span v-else>{{ set.duration != null && set.duration !== 0 ? set.duration : '&mdash;' }}</span>
                        <!-- Calories -->
                        <input
                          v-if="editingHistorySessionId === session.sessionId"
                          type="number" class="wl-hist-set-input" min="0"
                          :value="historyEditDraft[ex.workoutLogId]?.[setIdx]?.caloriesBurned ?? set.caloriesBurned ?? 0"
                          @input="updateHistoryDraft(ex.workoutLogId, setIdx, 'caloriesBurned', $event.target.value)"
                        />
                        <span v-else>{{ set.caloriesBurned != null && set.caloriesBurned !== 0 ? set.caloriesBurned : '&mdash;' }}</span>
                        <!-- Distance -->
                        <input
                          v-if="editingHistorySessionId === session.sessionId"
                          type="number" class="wl-hist-set-input" min="0" step="0.01"
                          :value="historyEditDraft[ex.workoutLogId]?.[setIdx]?.distanceMiles ?? set.distanceMiles ?? 0"
                          @input="updateHistoryDraft(ex.workoutLogId, setIdx, 'distanceMiles', $event.target.value)"
                        />
                        <span v-else>{{ set.distanceMiles != null && set.distanceMiles !== 0 ? set.distanceMiles : '&mdash;' }}</span>
                        <!-- Speed -->
                        <input
                          v-if="editingHistorySessionId === session.sessionId"
                          type="number" class="wl-hist-set-input" min="0" step="0.1"
                          :value="historyEditDraft[ex.workoutLogId]?.[setIdx]?.speedMph ?? set.speedMph ?? 0"
                          @input="updateHistoryDraft(ex.workoutLogId, setIdx, 'speedMph', $event.target.value)"
                        />
                        <span v-else>{{ set.speedMph != null && set.speedMph !== 0 ? set.speedMph : '&mdash;' }}</span>
                        <!-- Done (always read-only) -->
                        <span>
                          <i v-if="set.completed" class="fa-solid fa-circle-check" style="color:#22c55e"></i>
                          <i v-else class="fa-regular fa-circle" style="color:#d1d5db"></i>
                        </span>
                      </div>
                    </div>
                  </template>
                </template>

                <!-- Fallback: legacy record without per-set data -->
                <div v-else class="wl-history-ex__stats">
                  <template v-if="['cardio','other'].includes(String(ex.workoutType || '').toLowerCase())">
                    <span v-if="ex.totalDuration"><i class="fa-solid fa-clock"></i> {{ ex.totalDuration }} min</span>
                    <span v-if="ex.distance"><i class="fa-solid fa-road"></i> {{ ex.distance }} mi</span>
                    <span v-if="ex.calories"><i class="fa-solid fa-fire"></i> {{ ex.calories }} kcal</span>
                  </template>
                  <template v-else>
                    <span v-if="ex.totalSets"><i class="fa-solid fa-layer-group"></i> {{ ex.totalSets }} sets</span>
                    <span v-if="ex.avgReps"><i class="fa-solid fa-repeat"></i> {{ ex.avgReps }} reps</span>
                    <span v-if="ex.avgWeight"><i class="fa-solid fa-weight-hanging"></i> {{ ex.avgWeight }} lb</span>
                  </template>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Sticky bottom bar (Day Details only) ───────────────────────────── -->
    <div v-if="activeTab === 'dayDetails' && selectedDay && dayExercises.length > 0 && !isPreviewMode" class="wl-bottom-bar">
      <div class="wl-bottom-bar__inner">
        <div class="wl-bottom-bar__status">
          <span class="wl-bottom-bar__label">{{ totalCompleted }} / {{ totalSets }} sets done</span>
          <span v-if="saveDayMessage" class="wl-save-day-msg wl-save-day-msg--ok">{{ saveDayMessage }}</span>
          <span v-if="saveDayError" class="wl-save-day-msg wl-save-day-msg--err">{{ saveDayError }}</span>
        </div>
        <div class="wl-bottom-bar__actions">
          <button type="button" class="wl-btn-end" @click="endWithoutSaving">
            <i class="fa-solid fa-xmark"></i> End Workout
          </button>
          <button type="button" class="wl-btn-save-day" :disabled="savingDay || saving" @click="saveDay">
            <i v-if="savingDay" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-floppy-disk"></i>
            {{ savingDay ? 'Saving\u2026' : 'Save Day' }}
          </button>
          <button type="button" class="wl-btn-complete" :disabled="saving || savingDay" @click="completeWorkout">
            <i class="fa-solid fa-flag-checkered"></i>
            {{ saving ? 'Saving\u2026' : 'Complete Workout' }}
          </button>
        </div>
      </div>
    </div>
    <!-- ── Delete History Confirmation Modal ────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showDeleteHistoryModal" class="wl-modal-overlay" @click.self="closeDeleteHistoryModal">
        <div class="wl-modal" role="dialog" aria-modal="true" aria-labelledby="del-hist-title">
          <div class="wl-modal__header">
            <h5 id="del-hist-title"><i class="fa-solid fa-trash"></i> Delete Exercise</h5>
            <button type="button" class="wl-modal__close" @click="closeDeleteHistoryModal" aria-label="Close">&times;</button>
          </div>
          <div class="wl-modal__body">
            <p v-if="workoutHistoryToDelete">
              Are you sure you want to delete
              <strong>&ldquo;{{ workoutHistoryToDelete.planName }}&rdquo;</strong>
              from <strong>{{ workoutHistoryToDelete.workoutDate }}</strong>?
            </p>
            <p class="wl-modal__sub">This will permanently remove all exercises and sets recorded in this session.</p>
            <div v-if="deleteHistoryError" class="wl-banner wl-banner--error" style="margin-top:10px">
              <i class="fa-solid fa-circle-xmark"></i> {{ deleteHistoryError }}
            </div>
          </div>
          <div class="wl-modal__footer">
            <button type="button" class="wl-btn-preview" @click="closeDeleteHistoryModal" :disabled="deleteHistoryLoading">Cancel</button>
            <button type="button" class="wl-btn-delete" @click="confirmDeleteHistoryWorkout" :disabled="deleteHistoryLoading">
              <i class="fa-solid fa-trash"></i>
              {{ deleteHistoryLoading ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.wl-page { padding-bottom: 100px; }

/* ── Hero ──────────────────────────────────────────────────────────────── */
.builder-hero__content {
  display: flex; justify-content: space-between; align-items: center;
  gap: 16px; flex-wrap: wrap;
}
.builder-hero__text h2 { margin: 0 0 4px; }
.builder-hero__subtitle { margin: 0; opacity: 0.85; font-size: 0.92rem; }

.wl-toolbar {
  display: flex; justify-content: flex-end; gap: 10px;
  margin-top: 12px; flex-wrap: wrap;
}

/* ── Buttons ───────────────────────────────────────────────────────────── */
.wl-btn {
  border: none; border-radius: 10px; background: #2563eb;
  color: #fff; padding: 10px 14px; font-weight: 700;
  font-size: 0.85rem; cursor: pointer;
  display: inline-flex; align-items: center; gap: 7px;
  transition: background 0.15s;
}
.wl-btn:hover { background: #1d4ed8; }
.wl-btn--secondary { background: #f1f5f9; color: #1e40af; border: 1px solid #bfdbfe; }
.wl-btn--secondary:hover { background: #dbeafe; }
.wl-btn--active { background: #22c55e; }
.wl-btn--active:hover { background: #16a34a; }

.wl-link {
  background: none; border: none; color: #2563eb; font-weight: 700;
  cursor: pointer; padding: 0; font-size: inherit; text-decoration: underline;
}

/* ── Banners ────────────────────────────────────────────────────────────── */
.wl-banner {
  display: flex; align-items: center; gap: 10px;
  border-radius: 10px; padding: 12px 16px;
  font-size: 0.88rem; font-weight: 600; margin-bottom: 12px;
}
.wl-banner--warn    { background: #fef9c3; border: 1px solid #fde047; color: #854d0e; }
.wl-banner--error   { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
.wl-banner--success { background: #dcfce7; border: 1px solid #86efac; color: #166534; }
.wl-banner-dismiss  {
  margin-left: auto; background: none; border: none;
  font-size: 1rem; cursor: pointer; color: inherit; opacity: 0.6;
}
.wl-banner-dismiss:hover { opacity: 1; }

/* ── Stats ──────────────────────────────────────────────────────────────── */
.wl-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  margin-bottom: 16px;
}
.wl-stat-card {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px; padding: 14px; display: grid; gap: 6px;
}
.wl-stat-card span   { color: var(--text-color-secondary, #6b7280); font-size: 0.82rem; }
.wl-stat-card strong { color: var(--text-color, #111827); font-size: 1.25rem; font-weight: 800; }

/* ── Tabs ───────────────────────────────────────────────────────────────── */
.wl-tabs {
  display: flex; gap: 4px;
  border-bottom: 2px solid var(--border-color, #e5e7eb);
  margin-bottom: 20px;
}
.wl-tab {
  background: none; border: none;
  border-bottom: 2px solid transparent; margin-bottom: -2px;
  padding: 10px 18px; font-size: 0.88rem; font-weight: 700;
  cursor: pointer; color: var(--text-color-secondary, #6b7280);
  display: flex; align-items: center; gap: 7px;
  transition: color 0.15s, border-color 0.15s;
  border-radius: 8px 8px 0 0;
}
.wl-tab:hover      { color: #2563eb; }
.wl-tab--active    { color: #2563eb; border-bottom-color: #2563eb; }
.wl-tab--disabled  { opacity: 0.4; cursor: not-allowed; }
.wl-tab-badge {
  background: #dbeafe; color: #1d4ed8;
  border-radius: 999px; padding: 1px 9px;
  font-size: 0.72rem; font-weight: 800;
}
.wl-tab-panel { min-height: 200px; }

/* ── Empty state ────────────────────────────────────────────────────────── */
.wl-empty {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px; padding: 36px 24px; text-align: center;
  display: grid; gap: 12px; justify-items: center;
  color: var(--text-color-secondary, #6b7280);
}
.wl-empty h6    { margin: 0; color: var(--text-color, #111827); font-size: 1rem; }
.wl-empty p     { margin: 0; }
.wl-empty-icon  { font-size: 2rem; color: #bfdbfe; }

/* ── Accordion ──────────────────────────────────────────────────────────── */
.wl-accordion { display: grid; gap: 10px; }

.wl-plan {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px; background: #fff;
  overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s;
}
.wl-plan--expanded {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37,99,235,0.10);
}

.wl-plan__header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; padding: 16px 18px; cursor: pointer;
  user-select: none;
  transition: background 0.12s;
}
.wl-plan__header:hover { background: #f8fafc; }

.wl-plan__left   { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
.wl-plan__chevron {
  color: #2563eb; width: 20px; text-align: center;
  flex-shrink: 0; font-size: 0.85rem;
}
.wl-plan__info   { display: grid; gap: 5px; min-width: 0; }
.wl-plan__name   { font-size: 1rem; font-weight: 800; color: var(--text-color, #111827); }
.wl-plan__meta {
  display: flex; gap: 14px; flex-wrap: wrap;
  font-size: 0.8rem; color: var(--text-color-secondary, #6b7280);
}
.wl-plan__meta span { display: flex; align-items: center; gap: 4px; }
.wl-plan__meta i    { color: #3b82f6; }
.wl-plan__tag {
  background: #dbeafe; color: #1e40af;
  border-radius: 999px; padding: 1px 9px;
  font-size: 0.75rem; font-weight: 700;
}

.wl-plan__right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.wl-plan__selected-badge {
  background: #dbeafe; color: #1d4ed8;
  border-radius: 999px; padding: 3px 11px;
  font-size: 0.75rem; font-weight: 800;
  display: flex; align-items: center; gap: 5px;
}
.wl-btn-edit {
  background: #f1f5f9; border: 1px solid #cbd5e1;
  color: #475569; border-radius: 8px; padding: 7px 12px;
  font-size: 0.8rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 5px; transition: background 0.12s;
}
.wl-btn-edit:hover { background: #e0e7ef; }

.wl-plan__body { border-top: 1px solid var(--border-color, #e5e7eb); padding: 16px 18px; }
.wl-plan__loading { color: var(--text-color-secondary, #6b7280); font-size: 0.88rem; padding: 8px 0; }

/* ── Day cards grid ─────────────────────────────────────────────────────── */
.wl-day-grid { display: grid; gap: 14px; }

.wl-day-card {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px; padding: 16px; background: #fff;
  display: grid; gap: 12px; transition: border-color 0.15s, box-shadow 0.15s;
}
.wl-day-card--active {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
}

.wl-day-card__header  { display: grid; gap: 8px; }
.wl-day-card__title   { display: flex; align-items: center; gap: 10px; }
.wl-day-card__title h4 {
  margin: 0; font-size: 1rem; font-weight: 800;
  color: var(--text-color, #111827); flex: 1;
}
.wl-day-icon { color: #3b82f6; }
.wl-in-progress-chip {
  background: #dcfce7; color: #166534; border: 1px solid #86efac;
  border-radius: 999px; padding: 2px 10px; font-size: 0.72rem; font-weight: 800;
}
.wl-day-card__meta {
  display: flex; gap: 12px; flex-wrap: wrap;
  color: var(--text-color-secondary, #6b7280); font-size: 0.8rem;
}
.wl-day-card__meta span { display: flex; align-items: center; gap: 4px; }
.wl-day-card__meta i    { color: #3b82f6; }

.wl-day-card__exercises {
  list-style: none; padding: 0; margin: 0;
  display: grid; gap: 5px;
  border-top: 1px solid var(--border-color, #f3f4f6); padding-top: 10px;
}
.wl-day-card__ex-row {
  display: flex; justify-content: space-between;
  align-items: center; gap: 8px; font-size: 0.83rem;
}
.wl-ex-name   { color: var(--text-color, #111827); font-weight: 600; }
.wl-ex-detail { color: var(--text-color-secondary, #6b7280); white-space: nowrap; }

.wl-day-card__footer { display: flex; justify-content: flex-end; gap: 10px; }

.wl-btn-preview {
  background: #fff; border: 1.5px solid #2563eb; color: #2563eb;
  border-radius: 10px; padding: 10px 16px;
  font-size: 0.85rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s, color 0.15s;
}
.wl-btn-preview:hover { background: #eff6ff; }

.wl-btn-start {
  background: #2563eb; border: none; color: #fff;
  border-radius: 10px; padding: 10px 20px;
  font-size: 0.85rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wl-btn-start:hover { background: #1d4ed8; }

/* Preview mode */
.wl-preview-banner {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: #fffbeb; border: 1px solid #fde68a; color: #92400e;
  border-radius: 10px; padding: 12px 16px;
  font-size: 0.88rem; margin-bottom: 14px;
}
.wl-preview-banner i { color: #d97706; flex-shrink: 0; }
.wl-preview-banner span { flex: 1; }
.wl-preview-banner__start { margin-left: auto; padding: 8px 14px; font-size: 0.82rem; }

.wl-preview-badge {
  background: #fef3c7; color: #92400e; border: 1px solid #fde68a;
  border-radius: 999px; padding: 2px 10px;
  font-size: 0.72rem; font-weight: 800;
  display: flex; align-items: center; gap: 4px;
}

.wl-exercise-list--preview { opacity: 0.75; pointer-events: none; user-select: none; }
.wl-btn-resume {
  background: #22c55e; border: none; color: #fff;
  border-radius: 10px; padding: 10px 20px;
  font-size: 0.85rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wl-btn-resume:hover { background: #16a34a; }

/* ── Day Details tab ────────────────────────────────────────────────────── */
.wl-day-detail-header {
  display: flex; flex-wrap: wrap;
  justify-content: space-between; align-items: flex-start; gap: 14px;
  padding: 16px; background: var(--panel-bg, #f8fafc);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px; margin-bottom: 16px;
}
.wl-day-detail-header__left  { display: flex; align-items: center; gap: 12px; }
.wl-day-detail-header__left h4 { margin: 0; font-size: 1rem; font-weight: 800; }
.wl-day-detail-count {
  background: #dbeafe; color: #1d4ed8;
  border-radius: 999px; padding: 2px 10px;
  font-size: 0.75rem; font-weight: 700;
}
.wl-day-detail-header__progress { display: grid; gap: 6px; min-width: 200px; }

.wl-progress-bar {
  height: 8px; background: #e5e7eb;
  border-radius: 999px; overflow: hidden;
}
.wl-progress-fill {
  height: 100%; background: #22c55e;
  border-radius: 999px; transition: width 0.35s ease;
}
.wl-progress-label { color: var(--text-color-secondary, #6b7280); font-size: 0.78rem; }
.wl-exercise-list  { display: grid; gap: 12px; }

/* ── Sticky bottom bar ──────────────────────────────────────────────────── */
.wl-bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  background: rgba(255,255,255,0.96);
  border-top: 1px solid var(--border-color, #e5e7eb);
  backdrop-filter: blur(8px); padding: 12px 16px;
}
.wl-bottom-bar__inner {
  max-width: 960px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.wl-bottom-bar__status  { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.wl-bottom-bar__label   { font-size: 0.88rem; font-weight: 700; color: var(--text-color, #111827); }
.wl-bottom-bar__actions { display: flex; gap: 10px; flex-wrap: wrap; }

.wl-save-day-msg        { font-size: 0.82rem; font-weight: 600; }
.wl-save-day-msg--ok    { color: #16a34a; }
.wl-save-day-msg--err   { color: #dc2626; }

.wl-btn-save-day {
  background: #0ea5e9; border: none; color: #fff;
  border-radius: 10px; padding: 10px 18px;
  font-size: 0.88rem; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wl-btn-save-day:hover:not(:disabled) { background: #0284c7; }
.wl-btn-save-day:disabled { opacity: 0.6; cursor: not-allowed; }

.wl-btn-complete {
  background: #22c55e; border: none; color: #fff;
  border-radius: 10px; padding: 10px 18px;
  font-size: 0.88rem; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wl-btn-complete:hover:not(:disabled) { background: #16a34a; }
.wl-btn-complete:disabled { opacity: 0.6; cursor: not-allowed; }

.wl-btn-end {
  background: #f1f5f9; border: 1px solid #cbd5e1;
  color: #475569; border-radius: 10px; padding: 10px 16px;
  font-size: 0.88rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 7px; transition: background 0.15s;
}
.wl-btn-end:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

/* ── Date input ───────────────────────────────────────────────────────────── */
.wl-date-input {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.35);
  color: #fff; border-radius: 10px; padding: 8px 12px;
  font-size: 0.88rem; font-weight: 600;
  cursor: pointer; outline: none;
  color-scheme: dark;
}
.wl-date-input::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }

/* ── History tab ─────────────────────────────────────────────────────────── */
.wl-history-datebar {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--panel-bg, #f8fafc);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px; padding: 10px 16px;
  font-size: 0.88rem; color: var(--text-color-secondary, #6b7280);
  margin-bottom: 16px;
}
.wl-history-datebar i { color: #3b82f6; }

.wl-history-list { display: grid; gap: 14px; }

.wl-history-group {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px; background: #fff; overflow: hidden;
}
.wl-history-group__header {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 18px;
  background: var(--panel-bg, #f8fafc);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}
.wl-history-group__title   { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.wl-history-group__plan    { font-weight: 800; font-size: 0.95rem; color: var(--text-color, #111827); }
.wl-history-group__day {
  background: #dbeafe; color: #1e40af;
  border-radius: 999px; padding: 2px 10px;
  font-size: 0.75rem; font-weight: 700;
}

.wl-history-exercises { padding: 12px 18px; display: grid; gap: 8px; }

.wl-history-ex {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
  font-size: 0.85rem;
}
.wl-history-ex:last-child { border-bottom: none; }
.wl-history-ex__name  { font-weight: 700; color: var(--text-color, #111827); flex: 1; }
.wl-history-ex__stats {
  display: flex; gap: 12px; flex-wrap: wrap;
  color: var(--text-color-secondary, #6b7280);
  justify-content: flex-end;
}
.wl-history-ex__stats i { color: #3b82f6; margin-right: 3px; }
.wl-history-ex__type {
  background: #f3f4f6; color: #6b7280;
  border-radius: 999px; padding: 1px 9px;
  font-size: 0.72rem; font-weight: 700;
}

/* ── History session cards (0.78) ────────────────────────────────────────── */
.wl-history-session {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px; background: #fff; overflow: hidden;
  margin-bottom: 0; transition: border-color 0.15s, box-shadow 0.15s;
}
.wl-history-session--editing {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59,130,246,.12);
}
.wl-history-session__header {
  display: flex; flex-wrap: wrap; align-items: flex-start;
  justify-content: space-between; gap: 10px;
  padding: 14px 18px; background: var(--panel-bg, #f8fafc);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}
.wl-history-session__title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.wl-hist-check-icon { color: #22c55e; flex-shrink: 0; }
.wl-history-session__meta {
  display: flex; flex-wrap: wrap; gap: 14px;
  font-size: 0.78rem; color: var(--text-color-secondary, #6b7280);
}
.wl-history-session__meta i { color: #3b82f6; margin-right: 4px; }
.wl-history-exercises--detailed { padding: 12px 18px; display: grid; gap: 14px; }
.wl-hist-ex-card {
  border: 1px solid var(--border-color, #f3f4f6);
  border-radius: 10px; padding: 12px; display: grid; gap: 10px;
}
.wl-hist-ex-identity { display: flex; align-items: center; gap: 12px; }
.wl-hist-ex-thumb {
  width: 44px; height: 44px; border-radius: 8px;
  background: #f1f5f9; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0; overflow: hidden;
  color: #94a3b8; font-size: 1.1rem;
}
.wl-hist-thumb-img { width: 100%; height: 100%; object-fit: cover; }
.wl-hist-ex-info { display: grid; gap: 4px; min-width: 0; }
.wl-hist-ex-name { font-size: 0.92rem; color: var(--text-color, #111827); }
.wl-hist-ex-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.wl-hist-tag {
  background: #f1f5f9; color: #475569;
  border-radius: 999px; padding: 1px 9px;
  font-size: 0.72rem; font-weight: 600;
}
.wl-hist-tag--type { background: #dbeafe; color: #1e40af; }
.wl-hist-sets-table {
  display: grid; gap: 0;
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
  font-size: 0.82rem;
}
/* Strength: 4 columns */
.wl-hist-sets-head--strength,
.wl-hist-set-row--strength {
  display: grid;
  grid-template-columns: 48px 1fr 1fr 36px;
  padding: 7px 12px;
  align-items: center;
}
.wl-hist-sets-head--strength {
  background: #f8fafc;
  font-weight: 700; font-size: 0.75rem;
  color: var(--text-color-secondary, #6b7280);
  border-bottom: 1px solid #e5e7eb;
}
/* Cardio/Other: 6 columns */
.wl-hist-sets-table--cardio { overflow-x: auto; }
.wl-hist-sets-head--cardio,
.wl-hist-set-row--cardio {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 1fr 1fr 36px;
  padding: 6px 10px;
  align-items: center;
  min-width: 380px;
}
.wl-hist-sets-head--cardio {
  background: #f0f9ff;
  font-weight: 700; font-size: 0.73rem;
  color: var(--text-color-secondary, #6b7280);
  border-bottom: 1px solid #e5e7eb;
  line-height: 1.2;
}
.wl-hist-sets-head--cardio small { font-size: 0.65rem; font-weight: 400; display: block; }
/* Shared row styles */
.wl-hist-set-row {
  border-bottom: 1px solid #f3f4f6;
  color: var(--text-color, #111827);
  transition: background 0.12s;
}
.wl-hist-set-row:last-child { border-bottom: none; }
.wl-hist-set-row--done { background: #f0fdf4; }
.wl-hist-set-num { font-weight: 700; color: #6b7280; }

/* ── History delete button ──────────────────────────────────────────────── */
.wl-hist-delete-btn {
  display: inline-flex; align-items: center; gap: 5px;
  margin-left: auto;
  padding: 4px 10px; border-radius: 6px;
  border: 1px solid #fca5a5; background: #fff1f1;
  color: #dc2626; font-size: 0.76rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s, border-color 0.15s;
  white-space: nowrap; flex-shrink: 0;
}
.wl-hist-delete-btn:hover { background: #fee2e2; border-color: #f87171; }

/* ── History edit / save / cancel buttons ────────────────────────────── */
.wl-hist-edit-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 6px;
  border: 1px solid #bfdbfe; background: #eff6ff;
  color: #2563eb; font-size: 0.76rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s, border-color 0.15s;
  white-space: nowrap; flex-shrink: 0;
}
.wl-hist-edit-btn:hover:not(:disabled) { background: #dbeafe; border-color: #93c5fd; }
.wl-hist-edit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.wl-hist-save-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 6px;
  border: 1px solid #86efac; background: #f0fdf4;
  color: #16a34a; font-size: 0.76rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
  white-space: nowrap; flex-shrink: 0;
}
.wl-hist-save-btn:hover:not(:disabled) { background: #dcfce7; border-color: #4ade80; }
.wl-hist-save-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.wl-hist-cancel-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 6px;
  border: 1px solid #d1d5db; background: #f9fafb;
  color: #374151; font-size: 0.76rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
  white-space: nowrap; flex-shrink: 0;
}
.wl-hist-cancel-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
.wl-hist-cancel-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.wl-hist-save-error {
  font-size: 0.76rem; color: #dc2626;
  display: inline-flex; align-items: center; gap: 4px;
  flex-shrink: 1; min-width: 0; word-break: break-word;
}

/* ── History set edit input ──────────────────────────────────────────── */
.wl-hist-set-input {
  width: 100%; max-width: 80px;
  padding: 3px 6px; border-radius: 5px;
  border: 1px solid #93c5fd; background: #eff6ff;
  color: #1e3a8a; font-size: 0.82rem; font-weight: 500;
  text-align: center;
  -moz-appearance: textfield;
}
.wl-hist-set-input:focus {
  outline: none; border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,.2);
}
.wl-hist-set-input::-webkit-outer-spin-button,
.wl-hist-set-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

/* ── Confirmation Modal ─────────────────────────────────────────────────── */
.wl-modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.wl-modal {
  background: #fff; border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,.18);
  width: 100%; max-width: 440px;
  display: flex; flex-direction: column;
  animation: wl-modal-in .18s ease;
}
@keyframes wl-modal-in {
  from { opacity: 0; transform: translateY(-12px) scale(.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
.wl-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #f3f4f6;
}
.wl-modal__header h5 {
  margin: 0; font-size: 1rem; color: #dc2626;
  display: flex; align-items: center; gap: 8px;
}
.wl-modal__close {
  background: none; border: none; font-size: 1.4rem;
  line-height: 1; cursor: pointer; color: #9ca3af;
  padding: 0 4px;
}
.wl-modal__close:hover { color: #374151; }
.wl-modal__body {
  padding: 16px 20px;
  font-size: 0.92rem; color: var(--text-color, #111827);
  line-height: 1.55;
}
.wl-modal__sub {
  margin-top: 8px;
  font-size: 0.8rem; color: var(--text-color-secondary, #6b7280);
}
.wl-modal__footer {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 12px 20px 16px;
  border-top: 1px solid #f3f4f6;
}
.wl-btn-delete {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: 8px;
  background: #dc2626; color: #fff;
  border: none; font-weight: 600; font-size: 0.88rem;
  cursor: pointer; transition: background 0.15s;
}
.wl-btn-delete:hover:not(:disabled) { background: #b91c1c; }
.wl-btn-delete:disabled { opacity: .6; cursor: not-allowed; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .wl-stats { grid-template-columns: repeat(3, 1fr); }
  .wl-plan__header { flex-direction: column; align-items: flex-start; }
  .wl-plan__right  { width: 100%; justify-content: flex-end; }
  .wl-tabs { overflow-x: auto; }
  .wl-day-detail-header { flex-direction: column; }
  .wl-bottom-bar__inner { flex-direction: column; align-items: stretch; }
  .wl-bottom-bar__actions { justify-content: flex-end; }
}
</style>
