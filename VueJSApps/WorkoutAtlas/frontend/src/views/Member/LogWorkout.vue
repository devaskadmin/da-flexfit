<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ExerciseSessionCard from '@/components/workout-session/ExerciseSessionCard.vue';
import { API_BASE } from '@/config/env';

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
const plansLoaded   = ref(false);
const plansLoadError = ref('');
const plansLoadRequested = ref(false);
const workoutLists  = ref([]);
const didAutoExpandSinglePlan = ref(false);

/* ─── Accordion / selected plan state ───────────────────────────────────── */
const expandedPlanId    = ref(null);   // accordion open state
const expandedPlanData  = ref(null);   // full plan detail (with exercises/days)
const expandedLoading   = ref(false);
const dayOrderStateByPlanId = ref({});
const latestHistoryByExerciseId = ref({});

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
const hasWorkoutPlans = computed(() => plansLoaded.value && Array.isArray(workoutLists.value) && workoutLists.value.length > 0);
const shouldShowPlanLoadError = computed(() =>
  plansLoaded.value && plansLoadRequested.value && !loading.value && Boolean(plansLoadError.value)
);
/* ─── Workout History grouped view ──────────────────────────────────────────── */
const scheduleMode = computed(() => expandedPlanData.value?.scheduleMode || 'day');

const builderGroups = computed(() => {
  if (!expandedPlanData.value) return [];
  if (scheduleMode.value === 'week') {
    return Array.isArray(expandedPlanData.value.weekGroups) && expandedPlanData.value.weekGroups.length
      ? expandedPlanData.value.weekGroups : ['Week 1'];
  }
  return Array.isArray(expandedPlanData.value.dayGroups) && expandedPlanData.value.dayGroups.length
    ? expandedPlanData.value.dayGroups : ['Any Day'];
});

const normalizeGroupOrder = (baseGroups = [], preferredGroups = []) => {
  const normalizedBase = Array.isArray(baseGroups)
    ? baseGroups.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  const normalizedPreferred = [];
  const seenPreferred = new Set();
  for (const value of Array.isArray(preferredGroups) ? preferredGroups : []) {
    const label = String(value || '').trim();
    const key = label.toLowerCase();
    if (!label || seenPreferred.has(key)) continue;
    if (normalizedBase.some((group) => group.toLowerCase() === key)) {
      normalizedPreferred.push(label);
      seenPreferred.add(key);
    }
  }

  const merged = [...normalizedPreferred];
  const mergedKeys = new Set(merged.map((label) => label.toLowerCase()));
  for (const label of normalizedBase) {
    const key = label.toLowerCase();
    if (!mergedKeys.has(key)) {
      merged.push(label);
      mergedKeys.add(key);
    }
  }

  return merged;
};

const getDayOrderState = (planId) => {
  if (!planId) return null;
  return dayOrderStateByPlanId.value[String(planId)] || null;
};

const setDayOrderState = (planId, nextState) => {
  if (!planId) return;
  dayOrderStateByPlanId.value = {
    ...dayOrderStateByPlanId.value,
    [String(planId)]: {
      loading: false,
      saving: false,
      error: '',
      dirty: false,
      useCustomWorkoutLogOrder: false,
      customOrder: [],
      ...nextState,
    },
  };
};

const groups = computed(() => {
  const base = builderGroups.value;
  if (!base.length) return [];

  const state = getDayOrderState(expandedPlanId.value);
  if (!state?.useCustomWorkoutLogOrder) {
    return [...base];
  }

  return normalizeGroupOrder(base, state.customOrder || []);
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

const currentDayOrderState = computed(() => getDayOrderState(expandedPlanId.value));
const dayOrderDirty = computed(() => Boolean(currentDayOrderState.value?.dirty));
const dayOrderSaving = computed(() => Boolean(currentDayOrderState.value?.saving));
const dayOrderLoading = computed(() => Boolean(currentDayOrderState.value?.loading));

const ensureLocalCustomOrder = (planId) => {
  const state = getDayOrderState(planId);
  if (!state) {
    setDayOrderState(planId, {
      useCustomWorkoutLogOrder: true,
      customOrder: [...groups.value],
      dirty: true,
    });
    return;
  }

  if (!state.useCustomWorkoutLogOrder || !Array.isArray(state.customOrder) || !state.customOrder.length) {
    setDayOrderState(planId, {
      ...state,
      useCustomWorkoutLogOrder: true,
      customOrder: [...groups.value],
      dirty: true,
      error: '',
    });
  }
};

const loadWorkoutLogDayOrder = async (planId) => {
  const pid = String(planId || '').trim();
  if (!pid) return;

  setDayOrderState(pid, {
    ...getDayOrderState(pid),
    loading: true,
    error: '',
  });

  try {
    const response = await fetch(
      `${API_BASE}/api/workout-log/day-order?planId=${encodeURIComponent(pid)}`,
      { credentials: 'include' }
    );
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.error || 'Failed to load workout log day order.');
    }

    const payload = await response.json();
    const baseGroups = builderGroups.value;
    const customOrder = normalizeGroupOrder(baseGroups, payload?.customOrder || []);

    setDayOrderState(pid, {
      useCustomWorkoutLogOrder: payload?.useCustomWorkoutLogOrder === true,
      customOrder,
      dirty: false,
      loading: false,
      saving: false,
      error: '',
    });
  } catch (err) {
    setDayOrderState(pid, {
      ...getDayOrderState(pid),
      loading: false,
      saving: false,
      error: err?.message || 'Failed to load workout log day order.',
    });
  }
};

const toggleCustomWorkoutLogOrder = (enabled) => {
  const pid = String(expandedPlanId.value || '').trim();
  if (!pid) return;

  const state = getDayOrderState(pid) || {};
  const nextEnabled = Boolean(enabled);
  const nextCustomOrder = normalizeGroupOrder(builderGroups.value, state.customOrder || []);

  setDayOrderState(pid, {
    ...state,
    useCustomWorkoutLogOrder: nextEnabled,
    customOrder: nextCustomOrder,
    dirty: true,
    error: '',
  });
};

const moveGroupUp = (groupName) => {
  const pid = String(expandedPlanId.value || '').trim();
  if (!pid) return;

  ensureLocalCustomOrder(pid);
  const state = getDayOrderState(pid);
  const order = [...(state?.customOrder || [])];
  const index = order.findIndex((label) => String(label || '').toLowerCase() === String(groupName || '').toLowerCase());
  if (index <= 0) return;

  [order[index - 1], order[index]] = [order[index], order[index - 1]];
  setDayOrderState(pid, {
    ...state,
    useCustomWorkoutLogOrder: true,
    customOrder: order,
    dirty: true,
    error: '',
  });
};

const moveGroupDown = (groupName) => {
  const pid = String(expandedPlanId.value || '').trim();
  if (!pid) return;

  ensureLocalCustomOrder(pid);
  const state = getDayOrderState(pid);
  const order = [...(state?.customOrder || [])];
  const index = order.findIndex((label) => String(label || '').toLowerCase() === String(groupName || '').toLowerCase());
  if (index < 0 || index >= order.length - 1) return;

  [order[index], order[index + 1]] = [order[index + 1], order[index]];
  setDayOrderState(pid, {
    ...state,
    useCustomWorkoutLogOrder: true,
    customOrder: order,
    dirty: true,
    error: '',
  });
};

const saveWorkoutLogDayOrder = async () => {
  const pid = String(expandedPlanId.value || '').trim();
  if (!pid) return;

  const state = getDayOrderState(pid);
  if (!state) return;

  setDayOrderState(pid, {
    ...state,
    saving: true,
    error: '',
  });

  try {
    const endpoint = state.useCustomWorkoutLogOrder
      ? `${API_BASE}/api/workout-log/day-order`
      : `${API_BASE}/api/workout-log/day-order/reset`;

    const method = state.useCustomWorkoutLogOrder ? 'PUT' : 'POST';
    const body = state.useCustomWorkoutLogOrder
      ? { planId: pid, orderedGroups: normalizeGroupOrder(builderGroups.value, state.customOrder || []) }
      : { planId: pid };

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.error || 'Failed to save workout log day order.');
    }

    const payload = await response.json();
    const customOrder = normalizeGroupOrder(builderGroups.value, payload?.customOrder || state.customOrder || []);
    setDayOrderState(pid, {
      ...state,
      useCustomWorkoutLogOrder: payload?.useCustomWorkoutLogOrder === true,
      customOrder,
      dirty: false,
      saving: false,
      error: '',
    });
  } catch (err) {
    setDayOrderState(pid, {
      ...state,
      saving: false,
      error: err?.message || 'Failed to save workout log day order.',
    });
  }
};

const resetWorkoutLogDayOrder = async () => {
  const pid = String(expandedPlanId.value || '').trim();
  if (!pid) return;

  const state = getDayOrderState(pid) || {};
  setDayOrderState(pid, {
    ...state,
    saving: true,
    error: '',
  });

  try {
    const response = await fetch(`${API_BASE}/api/workout-log/day-order/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ planId: pid }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.error || 'Failed to reset workout log order.');
    }

    const payload = await response.json();
    setDayOrderState(pid, {
      ...state,
      useCustomWorkoutLogOrder: false,
      customOrder: normalizeGroupOrder(builderGroups.value, payload?.builderOrder || []),
      dirty: false,
      saving: false,
      error: '',
    });
  } catch (err) {
    setDayOrderState(pid, {
      ...state,
      saving: false,
      error: err?.message || 'Failed to reset workout log order.',
    });
  }
};

/* ─── Derived: selected day exercises (for Day Details tab) ─────────────── */
const dayExercises = computed(() =>
  sessionExercises.value.filter(
    (ex) => (ex.scheduleGroup || (groups.value[0] || '')) === selectedDay.value,
  ),
);

watch(
  [() => groups.value, expandedPlanId, expandedLoading, plansLoaded],
  ([nextGroups, nextExpandedPlanId, nextExpandedLoading, nextPlansLoaded]) => {
    if (!nextPlansLoaded || nextExpandedLoading) {
      return;
    }

    const normalizedGroups = Array.isArray(nextGroups) ? nextGroups : [];
    const hasSelectedDay = Boolean(String(selectedDay.value || '').trim());
    const selectedDayStillExists = normalizedGroups.includes(selectedDay.value);

    if (!nextExpandedPlanId || (hasSelectedDay && !selectedDayStillExists)) {
      selectedDay.value = '';
      if (activeTab.value === 'dayDetails') {
        activeTab.value = 'overview';
      }
    }
  },
  { deep: false }
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
    prefilledFields: {},
    prefilledFromLastWorkout: false,
  }));
};

const getLatestExerciseHistory = async (exerciseId) => {
  const normalizedExerciseId = Number(exerciseId || 0);
  if (!normalizedExerciseId) {
    return null;
  }

  const cached = latestHistoryByExerciseId.value[normalizedExerciseId];
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/workouts/history/latest/${encodeURIComponent(normalizedExerciseId)}`,
      { credentials: 'include' }
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    latestHistoryByExerciseId.value = {
      ...latestHistoryByExerciseId.value,
      [normalizedExerciseId]: payload,
    };
    return payload;
  } catch (_) {
    return null;
  }
};

const applyLatestHistoryPrefill = (exercise, latestHistory) => {
  if (!exercise || !Array.isArray(exercise.sessionSets)) {
    return;
  }

  const latestSets = Array.isArray(latestHistory?.sets) ? latestHistory.sets : [];
  if (!latestSets.length) {
    return;
  }

  const exerciseType = String(exercise.workoutType || '').trim().toLowerCase();
  const latestBySetNum = new Map();
  for (const setEntry of latestSets) {
    const setNumber = Number(setEntry?.setNumber || 0);
    if (setNumber > 0) {
      latestBySetNum.set(setNumber, setEntry);
    }
  }

  exercise.sessionSets = exercise.sessionSets.map((set) => {
    const setNumber = Number(set?.setNum || 0);
    const lastSet = latestBySetNum.get(setNumber);
    if (!lastSet) {
      return {
        ...set,
        prefilledFields: { ...(set?.prefilledFields || {}) },
        prefilledFromLastWorkout: Boolean(set?.prefilledFromLastWorkout),
      };
    }

    const nextSet = {
      ...set,
      prefilledFields: { ...(set?.prefilledFields || {}) },
      prefilledFromLastWorkout: false,
    };

    const markPrefilled = (field, value) => {
      if (value === null || value === undefined) {
        return;
      }
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        return;
      }
      nextSet[field] = numericValue;
      nextSet.prefilledFields[field] = true;
      nextSet.prefilledFromLastWorkout = true;
    };

    if (exerciseType === 'strength') {
      markPrefilled('weight', lastSet.weight);
      markPrefilled('reps', lastSet.reps);
    } else {
      markPrefilled('duration', lastSet.duration);
      markPrefilled('distanceMiles', lastSet.distance);
      markPrefilled('caloriesBurned', lastSet.calories);
      markPrefilled('speedMph', lastSet.speed);
    }

    return nextSet;
  });
};

const buildSessionExercisesWithHistoryPrefill = async (baseExercises = []) => {
  const sessionRows = (Array.isArray(baseExercises) ? baseExercises : []).map((exercise) => ({
    ...exercise,
    sessionSets: buildInitialSets(exercise),
  }));

  await Promise.all(
    sessionRows.map(async (exercise) => {
      const exerciseId = Number(exercise?.exerciseId || 0);
      if (!exerciseId) {
        return;
      }
      const latestHistory = await getLatestExerciseHistory(exerciseId);
      applyLatestHistoryPrefill(exercise, latestHistory);
    })
  );

  return sessionRows;
};

const addSet = (exerciseId) => {
  if (isPreviewMode.value) return;
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex) return;
  const last = ex.sessionSets[ex.sessionSets.length - 1] || { weight: 0, reps: 0, duration: 0, caloriesBurned: 0, distanceMiles: 0, speedMph: 0 };
  ex.sessionSets.push({
    setNum: ex.sessionSets.length + 1,
    weight: last.weight,
    reps: last.reps,
    duration: last.duration,
    caloriesBurned: last.caloriesBurned,
    distanceMiles: last.distanceMiles,
    speedMph: last.speedMph,
    done: false,
    prefilledFields: {},
    prefilledFromLastWorkout: false,
  });
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
  if (field !== 'done' && ex.sessionSets[setIndex]?.prefilledFields) {
    ex.sessionSets[setIndex].prefilledFields[field] = false;
    ex.sessionSets[setIndex].prefilledFromLastWorkout = Object.values(ex.sessionSets[setIndex].prefilledFields)
      .some(Boolean);
  }
  ex.sessionSets[setIndex][field] = field === 'done' ? Boolean(value) : (Number(value) || 0);
};

/* ─── Load plan list ─────────────────────────────────────────────────────── */
const loadWorkoutLists = async () => {
  loading.value = true;
  plansLoadRequested.value = true;
  plansLoadError.value = '';
  plansLoaded.value = false;
  try {
    const res  = await fetch(`${API_BASE}/api/workout-planner`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load workout plans.');
    const data = await res.json();
    workoutLists.value = (Array.isArray(data?.workoutLists) ? data.workoutLists : [])
      .map((plan) => ({ ...plan, updatedAtLabel: formatUpdatedAt(plan.updatedAt) }));

    if (workoutLists.value.length !== 1) {
      didAutoExpandSinglePlan.value = false;
    }

    plansLoaded.value = true;
    await autoExpandSinglePlanIfNeeded();
  } catch (err) {
    plansLoadError.value = err?.message || 'Failed to load workout plans.';
    workoutLists.value = [];
    plansLoaded.value = true;
  } finally {
    loading.value = false;
  }
};

const autoExpandSinglePlanIfNeeded = async () => {
  if (!plansLoaded.value || loading.value || plansLoadError.value) {
    return;
  }

  if (workoutLists.value.length !== 1) {
    return;
  }

  if (expandedPlanId.value || didAutoExpandSinglePlan.value) {
    return;
  }

  const onlyPlanId = String(workoutLists.value[0]?.planId || '').trim();
  if (!onlyPlanId) {
    return;
  }

  await togglePlan(onlyPlanId);
  didAutoExpandSinglePlan.value = true;
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
    if (expandedPlanData.value) {
      await loadWorkoutLogDayOrder(pid);
    }
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
        sessionExercises.value = await buildSessionExercisesWithHistoryPrefill(expandedPlanData.value.exercises || []);
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
    sessionExercises.value = await buildSessionExercisesWithHistoryPrefill(expandedPlanData.value?.exercises || []);

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

/* ─── Lifecycle ──────────────────────────────────────────────────────────── */
onMounted(async () => {
  await loadWorkoutLists();
  await checkActiveSession();
});
</script>

<template>
  <div class="app-page-shell wl-page workout-log-mobile">
    <div class="app-page-canvas app-inner-shell">

      <!-- ── Hero header ─────────────────────────────────────────────────── -->
      <section class="builder-hero ff-page-header app-header-gradient">
        <div class="builder-hero__content">
          <div class="wl-hero-title-row">
            <div class="builder-hero__text">
              <h2>Workout Log</h2>
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
          :class="['wl-tab', activeTab === 'dayDetails' ? 'wl-tab--active' : '', (!selectedDay || !hasWorkoutPlans) ? 'wl-tab--disabled' : '']"
          :disabled="!selectedDay || !hasWorkoutPlans"
          @click="selectedDay && hasWorkoutPlans && (activeTab = 'dayDetails')"
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
        <div v-if="loading || !plansLoaded" class="wl-empty"><p>Loading workout plans...</p></div>

        <!-- Error -->
        <div v-else-if="shouldShowPlanLoadError" class="wl-empty">
          <p>{{ plansLoadError }}</p>
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
                <div class="wl-day-order-toolbar workout-log-order-toolbar app-section-card">
                  <label class="wl-day-order-toggle">
                    <input
                      type="checkbox"
                      :checked="currentDayOrderState?.useCustomWorkoutLogOrder === true"
                      @change="toggleCustomWorkoutLogOrder($event.target.checked)"
                    />
                    <span>Use Custom Workout Log Order</span>
                  </label>
                  <span
                    v-if="currentDayOrderState?.useCustomWorkoutLogOrder"
                    class="wl-custom-order-badge"
                  >
                    Custom Order Enabled
                  </span>
                  <div class="wl-day-order-actions">
                    <button
                      type="button"
                      class="wl-order-toolbar-btn wl-order-toolbar-btn--reset"
                      :disabled="dayOrderSaving || dayOrderLoading"
                      @click="resetWorkoutLogDayOrder"
                    >
                      <i class="fa-solid fa-rotate-left"></i> Reset Order
                    </button>
                    <button
                      type="button"
                      class="wl-order-toolbar-btn wl-order-toolbar-btn--save"
                      :disabled="dayOrderSaving || dayOrderLoading || !dayOrderDirty"
                      @click="saveWorkoutLogDayOrder"
                    >
                      <i v-if="dayOrderSaving" class="fa-solid fa-spinner fa-spin"></i>
                      <i v-else class="fa-solid fa-floppy-disk"></i>
                      Save Order
                    </button>
                  </div>
                  <p v-if="currentDayOrderState?.error" class="wl-day-order-error">
                    {{ currentDayOrderState.error }}
                  </p>
                </div>
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
                      <button
                        type="button"
                        class="wl-order-btn"
                        :disabled="!currentDayOrderState?.useCustomWorkoutLogOrder || dayOrderSaving || groups.findIndex((g) => g === group.name) === 0"
                        @click="moveGroupUp(group.name)"
                      >
                        <i class="fa-solid fa-arrow-up"></i> Move Up
                      </button>
                      <button
                        type="button"
                        class="wl-order-btn"
                        :disabled="!currentDayOrderState?.useCustomWorkoutLogOrder || dayOrderSaving || groups.findIndex((g) => g === group.name) === groups.length - 1"
                        @click="moveGroupDown(group.name)"
                      >
                        <i class="fa-solid fa-arrow-down"></i> Move Down
                      </button>
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

        <div
          v-if="workoutLists.length > 1 && !expandedPlanId"
          class="wl-plan-picker-hint"
        >
          Select a workout plan to view its days.
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
                    <img v-if="ex.exerciseImage" :src="ex.exerciseImage" :alt="ex.exerciseName" class="wl-hist-thumb-img" />
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
        <span class="wl-bottom-bar__label">{{ totalCompleted }} / {{ totalSets }} sets done</span>
        <div class="wl-bottom-bar__actions">
          <button type="button" class="wl-btn-end" @click="endWithoutSaving">
            <i class="fa-solid fa-xmark"></i> End Workout
          </button>
          <button type="button" class="wl-btn-complete" :disabled="saving" @click="completeWorkout">
            <i class="fa-solid fa-flag-checkered"></i>
            {{ saving ? 'Saving…' : 'Complete Workout' }}
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

.wl-day-order-toolbar {
  grid-column: 1 / -1;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  margin-bottom: 10px;
  padding: 8px 10px;
}

.wl-day-order-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  font-size: 0.79rem;
  color: #1e293b;
}

.wl-day-order-toggle input {
  width: 14px;
  height: 14px;
}

.wl-custom-order-badge {
  display: inline-flex;
  width: fit-content;
  padding: 3px 8px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 0.69rem;
  font-weight: 700;
  border: 1px solid #86efac;
}

.wl-day-order-actions {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}

.wl-order-toolbar-btn {
  border-radius: 8px;
  padding: 5px 10px;
  min-height: 30px;
  font-size: 0.74rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
  transition: background 0.14s, border-color 0.14s, color 0.14s, box-shadow 0.14s;
}

.wl-order-toolbar-btn--reset {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #475569;
}

.wl-order-toolbar-btn--reset i {
  color: #64748b;
}

.wl-order-toolbar-btn--reset:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.wl-order-toolbar-btn--save {
  background: #16a34a;
  border: 1px solid #15803d;
  color: #fff;
}

.wl-order-toolbar-btn--save:hover {
  background: #15803d;
}

.wl-order-toolbar-btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  box-shadow: none;
}

.wl-day-order-error {
  margin: 0 0 0 2px;
  color: #b91c1c;
  font-size: 0.75rem;
  font-weight: 600;
}

.wl-order-btn {
  border: 1px solid #d5dde7;
  background: #f8fafc;
  color: #475569;
  border-radius: 6px;
  padding: 2px 7px;
  min-height: 24px;
  font-size: 0.68rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
  transition: background 0.14s, border-color 0.14s, color 0.14s;
}

.wl-order-btn i {
  color: #64748b;
  font-size: 0.62rem;
}

.wl-order-btn:hover {
  background: #f1f5f9;
  border-color: #b7c3d4;
}

.wl-order-btn:disabled {
  opacity: 0.55;
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

.wl-plan-picker-hint {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 600;
}

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
  align-items: center;
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
.wl-bottom-bar__label   { font-size: 0.88rem; font-weight: 700; color: var(--text-color, #111827); }
.wl-bottom-bar__actions { display: flex; gap: 10px; }

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

/* ── v0.81.9 Hero title row utility ──────────────────────────────────────── */
.wl-hero-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

/* ── v0.81.6 Global density utility ──────────────────────────────────────── */
.workout-log-mobile { /* defined here; used in template root */ }

<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/views/Member/LogWorkout.vue
=======
/* ── 0.84.39 Workout Log dark-theme color normalization (scoped) ─────────── */
.wl-page {
  --wl-surface-1: var(--wa-shell-surface, #121923);
  --wl-surface-2: var(--wa-shell-surface-elevated, #17212d);
  --wl-surface-3: var(--wa-shell-surface-soft, #1d2a38);
  --wl-border: var(--wa-shell-border, rgba(255, 255, 255, 0.09));
  --wl-border-strong: var(--wa-shell-border-strong, rgba(255, 255, 255, 0.16));
  --wl-text: var(--wa-shell-text, #f8fafc);
  --wl-text-secondary: var(--wa-shell-text-secondary, #a4b0c0);
  --wl-text-muted: var(--wa-shell-text-muted, #738196);
  --wl-accent: var(--wa-shell-accent, var(--main-color, #3b82f6));
}

.wl-page .builder-hero.ff-page-header.app-header-gradient {
  background: var(--wl-surface-2) !important;
  border: 1px solid var(--wl-border);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
}

.wl-page .wl-date-input {
  background: var(--wl-surface-1);
  border-color: var(--wl-border-strong);
  color: var(--wl-text);
}

.wl-page .wl-date-input::-webkit-calendar-picker-indicator {
  filter: invert(0.86);
}

.wl-page .wl-btn {
  background: var(--wl-accent);
  border-radius: 8px;
}

.wl-page .wl-btn:hover {
  filter: brightness(1.08);
}

.wl-page .wl-btn--secondary {
  background: var(--wl-surface-2);
  color: var(--wl-text-secondary);
  border: 1px solid var(--wl-border);
}

.wl-page .wl-btn--secondary:hover {
  background: var(--wl-surface-3);
  color: var(--wl-text);
}

.wl-page .wl-btn--active,
.wl-page .wl-btn-resume,
.wl-page .wl-btn-complete {
  background: #16a34a;
}

.wl-page .wl-btn--active:hover,
.wl-page .wl-btn-resume:hover,
.wl-page .wl-btn-complete:hover {
  background: #15803d;
}

.wl-page .wl-stats .wl-stat-card,
.wl-page .wl-empty,
.wl-page .wl-plan,
.wl-page .wl-plan__body,
.wl-page .wl-day-card,
.wl-page .wl-day-order-toolbar,
.wl-page .wl-day-detail-header,
.wl-page .wl-history-datebar,
.wl-page .wl-history-session,
.wl-page .wl-history-session__header,
.wl-page .wl-hist-ex-card,
.wl-page .wl-history-group,
.wl-page .wl-history-group__header,
.wl-page .wl-modal,
.wl-page .wl-bottom-bar {
  background: var(--wl-surface-1);
  border-color: var(--wl-border);
  color: var(--wl-text);
}

.wl-page .wl-plan__header:hover,
.wl-page .wl-day-order-toolbar,
.wl-page .wl-hist-ex-thumb,
.wl-page .wl-hist-sets-head--strength,
.wl-page .wl-hist-sets-head--cardio,
.wl-page .wl-history-datebar,
.wl-page .wl-day-detail-header,
.wl-page .wl-modal__header,
.wl-page .wl-modal__footer,
.wl-page .wl-bottom-bar {
  background: var(--wl-surface-2);
}

.wl-page .wl-plan-picker-hint {
  background: var(--wl-surface-2);
  border-color: var(--wl-border);
  color: var(--wl-text-secondary);
}

.wl-page .wl-plan--expanded {
  border-color: color-mix(in srgb, var(--wl-accent) 55%, var(--wl-border) 45%);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--wl-accent) 25%, transparent 75%);
}

.wl-page .wl-plan__name,
.wl-page .wl-day-card__title h4,
.wl-page .wl-ex-name,
.wl-page .wl-history-group__plan,
.wl-page .wl-hist-ex-name,
.wl-page .wl-bottom-bar__label,
.wl-page .wl-modal__body,
.wl-page .wl-stat-card strong {
  color: var(--wl-text);
}

.wl-page .wl-day-order-toggle,
.wl-page .wl-plan__meta,
.wl-page .wl-day-card__meta,
.wl-page .wl-ex-detail,
.wl-page .wl-progress-label,
.wl-page .wl-history-session__meta,
.wl-page .wl-hist-set-num,
.wl-page .wl-modal__sub,
.wl-page .wl-stat-card span,
.wl-page .wl-empty {
  color: var(--wl-text-secondary);
}

.wl-page .wl-empty-icon,
.wl-page .wl-plan__chevron,
.wl-page .wl-day-icon,
.wl-page .wl-plan__meta i,
.wl-page .wl-day-card__meta i,
.wl-page .wl-history-datebar i,
.wl-page .wl-history-ex__stats i,
.wl-page .wl-history-session__meta i {
  color: color-mix(in srgb, var(--wl-accent) 68%, var(--wl-text-secondary) 32%);
}

.wl-page .wl-tabs {
  border-bottom-color: var(--wl-border);
}

.wl-page .wl-tab {
  color: var(--wl-text-muted);
}

.wl-page .wl-tab:hover,
.wl-page .wl-tab--active {
  color: var(--wl-accent);
}

.wl-page .wl-tab--active {
  border-bottom-color: var(--wl-accent);
}

.wl-page .wl-tab-badge,
.wl-page .wl-plan__tag,
.wl-page .wl-plan__selected-badge,
.wl-page .wl-day-detail-count,
.wl-page .wl-history-group__day,
.wl-page .wl-hist-tag--type {
  background: color-mix(in srgb, var(--wl-accent) 22%, transparent 78%);
  border: 1px solid color-mix(in srgb, var(--wl-accent) 45%, transparent 55%);
  color: color-mix(in srgb, var(--wl-accent) 78%, #ffffff 22%);
}

.wl-page .wl-day-card__exercises,
.wl-page .wl-plan__body,
.wl-page .wl-history-session__header,
.wl-page .wl-modal__header,
.wl-page .wl-modal__footer,
.wl-page .wl-bottom-bar,
.wl-page .wl-hist-sets-table,
.wl-page .wl-hist-set-row,
.wl-page .wl-hist-ex {
  border-color: var(--wl-border);
}

.wl-page .wl-order-toolbar-btn,
.wl-page .wl-order-btn,
.wl-page .wl-btn-edit,
.wl-page .wl-btn-preview,
.wl-page .wl-btn-end,
.wl-page .wl-hist-edit-btn,
.wl-page .wl-hist-cancel-btn,
.wl-page .wl-hist-set-input,
.wl-page .wl-link {
  background: var(--wl-surface-2);
  border-color: var(--wl-border);
  color: var(--wl-text-secondary);
  border-radius: 8px;
}

.wl-page .wl-order-toolbar-btn--reset:hover,
.wl-page .wl-order-btn:hover,
.wl-page .wl-btn-edit:hover,
.wl-page .wl-btn-preview:hover,
.wl-page .wl-hist-edit-btn:hover:not(:disabled),
.wl-page .wl-hist-cancel-btn:hover:not(:disabled) {
  background: var(--wl-surface-3);
  color: var(--wl-text);
}

.wl-page .wl-link {
  text-decoration-color: color-mix(in srgb, var(--wl-accent) 60%, transparent 40%);
}

.wl-page .wl-order-toolbar-btn--save,
.wl-page .wl-btn-start,
.wl-page .wl-hist-save-btn {
  background: #15803d;
  border-color: #166534;
  color: #f8fafc;
}

.wl-page .wl-order-toolbar-btn--save:hover,
.wl-page .wl-btn-start:hover,
.wl-page .wl-hist-save-btn:hover:not(:disabled) {
  background: #166534;
}

.wl-page .wl-custom-order-badge,
.wl-page .wl-in-progress-chip {
  background: rgba(22, 163, 74, 0.18);
  border-color: rgba(74, 222, 128, 0.45);
  color: #bbf7d0;
}

.wl-page .wl-preview-banner {
  background: rgba(217, 119, 6, 0.14);
  border-color: rgba(245, 158, 11, 0.4);
  color: #fde68a;
}

.wl-page .wl-preview-badge {
  background: rgba(217, 119, 6, 0.18);
  border-color: rgba(245, 158, 11, 0.45);
  color: #fcd34d;
}

.wl-page .wl-history-session--editing,
.wl-page .wl-day-card--active {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
}

.wl-page .wl-day-card--active {
  border-color: rgba(74, 222, 128, 0.45);
}

.wl-page .wl-hist-ex-thumb,
.wl-page .wl-hist-tag,
.wl-page .wl-hist-set-input,
.wl-page .wl-hist-set-row--done,
.wl-page .wl-hist-sets-head--cardio,
.wl-page .wl-hist-sets-head--strength,
.wl-page .wl-hist-sets-table,
.wl-page .wl-hist-set-row {
  background: var(--wl-surface-2);
}

.wl-page .wl-hist-set-row--done {
  background: rgba(22, 163, 74, 0.14);
}

.wl-page .wl-modal {
  border: 1px solid var(--wl-border);
}

.wl-page .wl-btn-delete,
.wl-page .wl-hist-delete-btn {
  border-radius: 8px;
}

.wl-page .wl-bottom-bar {
  backdrop-filter: blur(8px);
  background: color-mix(in srgb, var(--wl-surface-2) 92%, transparent 8%);
}

/* Day Details child card theme overrides without touching shared component styles. */
.wl-page :deep(.session-exercise-card),
.wl-page :deep(.cardio-3col-table),
.wl-page :deep(.c3-head),
.wl-page :deep(.c3-row-done),
.wl-page :deep(.set-input),
.wl-page :deep(.sec-thumb-placeholder),
.wl-page :deep(.sec-prefill-note),
.wl-page :deep(.sec-header--active),
.wl-page :deep(.sec-header:hover) {
  background: var(--wl-surface-1);
  border-color: var(--wl-border);
  color: var(--wl-text);
}

.wl-page :deep(.session-exercise-card) {
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.22);
}

.wl-page :deep(.sec-meta p),
.wl-page :deep(.set-num),
.wl-page :deep(.sec-sets-summary),
.wl-page :deep(.c3-col-set),
.wl-page :deep(.c3-col-info) {
  color: var(--wl-text-secondary);
}

.wl-page :deep(.sec-type-chip),
.wl-page :deep(.sec-select-btn--active) {
  background: color-mix(in srgb, var(--wl-accent) 22%, transparent 78%);
  border-color: color-mix(in srgb, var(--wl-accent) 45%, transparent 55%);
  color: color-mix(in srgb, var(--wl-accent) 78%, #ffffff 22%);
}

.wl-page :deep(.sec-select-btn),
.wl-page :deep(.set-input),
.wl-page :deep(.add-set-btn),
.wl-page :deep(.c3-rm-btn),
.wl-page :deep(.c3-complete-btn),
.wl-page :deep(.c3-finish-btn) {
  background: var(--wl-surface-2);
  border-color: var(--wl-border);
  color: var(--wl-text-secondary);
  border-radius: 8px;
}

.wl-page :deep(.sec-select-btn),
.wl-page :deep(.add-set-btn) {
  border-color: color-mix(in srgb, var(--wl-accent) 45%, var(--wl-border) 55%);
  color: var(--wl-accent);
}

.wl-page :deep(.set-input:focus) {
  border-color: color-mix(in srgb, var(--wl-accent) 70%, #ffffff 30%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--wl-accent) 25%, transparent 75%);
}

.wl-page :deep(.sec-set-row.set-done),
.wl-page :deep(.c3-set-group.c3-set-done),
.wl-page :deep(.c3-set-group.c3-set-done .c3-row:first-child),
.wl-page :deep(.c3-set-group.c3-set-done .c3-row-done),
.wl-page :deep(.c3-finish-btn--done),
.wl-page :deep(.c3-complete-btn--done) {
  background: rgba(22, 163, 74, 0.14) !important;
  color: #bbf7d0;
}

>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/views/Member/LogWorkout.vue
/* ── v0.81.9 Mobile 768px — Workout Log Compact Layout ───────────────────── */
@media (max-width: 768px) {
  /* Global density */
  .workout-log-mobile .app-page-canvas { gap: 8px; }
  .wl-exercise-list { gap: 8px; }
  .wl-accordion      { gap: 8px; }
  .wl-history-list   { gap: 8px; }
  .wl-day-grid       { gap: 8px; }

  /* Hero: compact padding */
  .builder-hero {
    padding: 18px;
    gap: 12px;
    border-radius: 18px;
    min-height: auto;
  }
  .builder-hero__content { gap: 6px; }

  /* Title + date row: side-by-side, subtitle hidden */
  .wl-hero-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .builder-hero__text h2 { font-size: 1.15rem; margin: 0; }
  .builder-hero__subtitle { display: none; }

  /* Date picker: auto width, pill style */
  .wl-date-input {
    width: auto;
    min-width: 140px;
    height: 44px;
    padding: 8px 14px;
    font-size: 16px;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* Toolbar: 2-column grid */
  .wl-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 10px;
  }
  .wl-toolbar .wl-btn {
    height: 46px;
    font-size: 14px;
    padding: 8px;
    justify-content: center;
  }

  /* Stats cards: 3-col compact */
  .wl-stats {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }
  .wl-stat-card {
    min-height: 80px;
    padding: 10px;
    gap: 4px;
    align-content: center;
  }
  .wl-stat-card span   { font-size: 0.72rem; }
  .wl-stat-card strong { font-size: 1.05rem; }

  /* Tabs: horizontal scroll, no wrap */
  .wl-tabs {
    overflow-x: auto;
    white-space: nowrap;
    flex-wrap: nowrap;
    max-width: 100%;
    scrollbar-width: none;
    gap: 2px;
    margin-bottom: 12px;
  }
  .wl-tabs::-webkit-scrollbar { display: none; }
  .wl-tab {
    flex-shrink: 0;
    padding: 8px 12px;
    font-size: 0.8rem;
    gap: 5px;
  }
  .wl-tab-badge { font-size: 0.67rem; padding: 1px 7px; }

  /* Plan accordion */
  .wl-plan__header  { padding: 12px 14px; }
  .wl-plan__name    { font-size: 0.9rem; }
  .wl-plan__meta    { font-size: 0.74rem; gap: 8px; }
  .wl-plan__body    { padding: 10px 12px; }

  /* Day cards */
  .wl-day-card          { padding: 12px; gap: 8px; }
  .wl-day-card__title h4 { font-size: 0.9rem; }
  .wl-day-card__meta    { font-size: 0.74rem; gap: 8px; }
  .wl-day-order-toolbar {
    display: flex;
    width: 100%;
    align-items: flex-start;
    justify-content: flex-start;
  }
  .wl-day-order-actions {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .wl-order-toolbar-btn {
    min-height: 30px;
    padding: 5px 9px;
    font-size: 0.73rem;
  }
  .wl-order-btn {
    padding: 2px 6px;
    min-height: 22px;
    font-size: 0.66rem;
  }
  .wl-day-card__ex-row  { font-size: 0.78rem; }

  /* §3 Global font reduction — secondary labels */
  .wl-ex-detail { font-size: 0.72rem; }
  .wl-plan__meta span { font-size: 0.72rem; }
  .wl-history-session__meta { font-size: 0.72rem; }
  .wl-hist-tag  { font-size: 0.66rem; padding: 1px 7px; }

  /* Day detail header */
  .wl-day-detail-header { padding: 12px; gap: 8px; margin-bottom: 10px; }

  /* History */
  .wl-history-session__header     { padding: 10px 14px; gap: 8px; }
  .wl-history-exercises--detailed { padding: 10px 14px; gap: 10px; }
  .wl-hist-ex-card    { padding: 10px; gap: 8px; }
  .wl-hist-ex-thumb   { width: 36px; height: 36px; font-size: 0.9rem; }
  .wl-hist-ex-name    { font-size: 0.85rem; }
  .wl-history-datebar { padding: 8px 12px; font-size: 0.8rem; margin-bottom: 10px; }

  /* Bottom bar */
  .wl-bottom-bar { padding: 8px 12px; }
  .wl-btn-complete,
  .wl-btn-end {
    padding: 8px 12px;
    font-size: 0.82rem;
    border-radius: 8px;
  }
}

/* ── Small mobile (≤ 640px) ──────────────────────────────────────────────── */
@media (max-width: 640px) {
  .wl-stats { grid-template-columns: repeat(3, 1fr); }
  .wl-plan__header { flex-direction: column; align-items: flex-start; }
  .wl-plan__right  { width: 100%; justify-content: flex-end; }
  .wl-day-detail-header { flex-direction: column; }
  .wl-bottom-bar__inner { flex-direction: column; align-items: stretch; }
  .wl-bottom-bar__actions { justify-content: flex-end; }

  /* Toolbar: keep 2-column grid (Progress | Builder side-by-side) */
  .wl-toolbar { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .wl-toolbar .wl-btn { height: 46px; justify-content: center; padding: 8px; font-size: 14px; min-width: 0; }

  /* Tabs */
  .wl-tabs { flex-wrap: nowrap; scrollbar-width: none; padding-bottom: 2px; }
  .wl-tabs::-webkit-scrollbar { display: none; }
  .wl-tab { flex-shrink: 0; padding: 10px 12px; font-size: 0.82rem; }

  /* Stats */
  .wl-stat-card { padding: 10px; gap: 4px; }
  .wl-stat-card strong { font-size: 1.05rem; }
  .wl-stat-card span   { font-size: 0.76rem; }

  /* History */
  .wl-history-session__meta { flex-direction: column; gap: 6px; }
  .wl-history-datebar { flex-direction: column; align-items: flex-start; gap: 8px; padding: 10px 12px; font-size: 0.82rem; }

  /* Day card footer */
  .wl-day-card__footer { flex-direction: column; }
  .wl-btn-preview, .wl-btn-start, .wl-btn-resume { width: 100%; justify-content: center; }

  /* Bottom bar */
  .wl-bottom-bar__actions { gap: 8px; }
  .wl-btn-end, .wl-btn-complete { flex: 1; justify-content: center; font-size: 0.82rem; padding: 9px 12px; }
}

/* ── Tiny mobile (≤ 480px) ──────────────────────────────────────────────── */
@media (max-width: 480px) {
  /* Stats: keep 3-col, shrink further */
  .wl-stats { gap: 6px; }
  .wl-stat-card { padding: 7px 8px; min-height: 60px; }
  .wl-stat-card span   { font-size: 0.66rem; }
  .wl-stat-card strong { font-size: 0.92rem; }

  /* Hero text */
  .builder-hero__text h2  { font-size: 1.1rem; }
  .builder-hero__subtitle { font-size: 0.78rem; }

  /* Toolbar stays 2-column grid (DO NOT stack on 480) */
  .wl-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .wl-toolbar .wl-btn { height: 42px; font-size: 13px; }

  /* Tabs smaller */
  .wl-tab { padding: 7px 10px; font-size: 0.76rem; }

  /* Plan header: always stacked */
  .wl-plan__header { gap: 10px; padding: 10px 12px; }

  /* Day cards */
  .wl-day-card { padding: 10px; }

  .wl-day-order-toolbar {
    padding: 7px 8px;
  }
  .wl-order-toolbar-btn {
    font-size: 0.7rem;
    min-height: 29px;
    padding: 5px 8px;
  }

  /* History edit buttons smaller */
  .wl-hist-edit-btn, .wl-hist-save-btn, .wl-hist-cancel-btn, .wl-hist-delete-btn {
    padding: 3px 8px; font-size: 0.7rem;
  }

  /* Cardio set table */
  .wl-hist-sets-table--cardio { overflow-x: auto; }
}

/* ── Narrow mobile (≤ 390px) ─────────────────────────────────────────────── */
@media (max-width: 390px) {
  .wl-stat-card { padding: 6px; }
  .wl-stat-card span   { font-size: 0.62rem; }
  .wl-stat-card strong { font-size: 0.86rem; }
  .wl-tab { padding: 6px 8px; font-size: 0.72rem; }
  .wl-toolbar .wl-btn  { font-size: 0.74rem; height: 32px; }
}
</style>
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/views/Member/LogWorkout.vue
=======



>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/views/Member/LogWorkout.vue
