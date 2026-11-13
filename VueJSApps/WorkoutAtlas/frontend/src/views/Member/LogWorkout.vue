<script setup>
import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ExerciseSessionCard from '@/components/workout-session/ExerciseSessionCard.vue';
import ExercisePickerModal from '@/components/workout-builder/ExercisePickerModal.vue';
import { API_BASE } from '@/config/env';
import { useWorkoutSessionDraft } from '@/composable/useWorkoutSessionDraft';
import {
  buildDiagnosticsPayload,
  buildFriendlyMessage,
  canViewTechnicalDiagnostics,
  normalizeRoleSlug,
} from '@/utils/userFriendlyErrors';
import { showConfirmDialog } from '@/utils/browserDialogs';
import {
  buildWorkoutLogExerciseGroups,
  filterWorkoutLogDayExercises,
  selectExpandedPlanDuringSessionRecovery,
  selectTabDuringSessionRecovery,
} from '@/utils/workoutLogGrouping.mjs';

const router = useRouter();
const route = useRoute();
const WORKOUT_LOG_ACTIVE_BODY_CLASS = 'wa-workout-log-active';

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
const reorderPanelOpenByPlanId = ref({});
const mobilePlanActionMenuOpenByPlanId = ref({});
const latestHistoryByExerciseId = ref({});

/* ─── Session state (Day Details) ───────────────────────────────────────── */
const activeSession    = ref(null);
const activeSessions   = ref([]);
const hasActiveWorkout = ref(false);
const showWorkoutConflictModal = ref(false);
const workoutConflictSession = ref(null);
const workoutConflictSessionIds = ref([]);
const pendingWorkoutStart = ref(null);
const conflictModalLoading = ref(false);
const conflictModalError = ref('');
const selectedDay      = ref('');
const sessionExercises = ref([]);
const isPreviewMode    = ref(false);
const saving           = ref(false);
const saveMessage      = ref('');
const saveError        = ref('');
const currentRoleSlug = ref('user');
const errorDiagnosticsByArea = ref({
  plansLoad: null,
  save: null,
  history: null,
  historySave: null,
  deleteHistory: null,
});
const diagnosticsExpandedByArea = ref({
  plansLoad: false,
  save: false,
  history: false,
  historySave: false,
  deleteHistory: false,
});
const workoutTimerNowMs = ref(Date.now());
const workoutTimerPaused = ref(false);
const pausedWorkoutElapsedSeconds = ref(0);
const addExercisePickerOpen = ref(false);
const exerciseLibraryLoading = ref(false);
const exerciseLibrary = ref([]);
const exerciseAddLoading = ref(false);
const sessionUserId = ref(null);

let workoutTimerIntervalId = null;
let workoutLogMountReady = false;

/* ─── Accordion: active exercise ───────────────────────────────────── */
const activeExerciseId = ref(null);
const {
  applyWorkoutDraft,
  clearWorkoutDraftSave,
  persistWorkoutDraft,
  queueWorkoutDraftSave,
} = useWorkoutSessionDraft({ activeSession, sessionExercises });

const canShowTechnicalDiagnostics = computed(() =>
  canViewTechnicalDiagnostics({ roleSlug: currentRoleSlug.value })
);

const parseResponseError = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => ({}));
  const rawMessage = payload?.error || payload?.detail || payload?.message || fallbackMessage;
  const parsedStatus = Number(response?.status || 0) || null;
  const code = payload?.code || payload?.errorCode || '';
  const requestId = payload?.requestId || response.headers?.get('x-request-id') || '';
  const service = payload?.service || '';
  return {
    status: parsedStatus,
    code,
    requestId,
    service,
    rawMessage,
  };
};

const parseDraftNotesPayload = (notes) => {
  if (!notes) return null;
  if (typeof notes === 'object') return notes;
  if (typeof notes !== 'string') return null;

  try {
    return JSON.parse(notes);
  } catch (_) {
    return null;
  }
};

const buildSessionExercisesFromDraft = (notes, fallbackDayName = 'Any Day') => {
  const draft = parseDraftNotesPayload(notes);
  const draftExercises = Array.isArray(draft?.exercises) ? draft.exercises : [];
  if (!draftExercises.length) {
    return [];
  }

  const safeDayName = String(fallbackDayName || 'Any Day').trim() || 'Any Day';

  return draftExercises.map((exercise, index) => {
    const sessionSets = Array.isArray(exercise?.sessionSets) ? exercise.sessionSets : [];
    const firstSet = sessionSets[0] || {};
    const inferredWorkoutType = Number(firstSet?.duration || 0) > 0 && Number(firstSet?.reps || 0) === 0
      ? 'Cardio'
      : 'Strength';

    return {
      id: String(exercise?.id || `draft-${index + 1}`),
      exerciseId: Number(exercise?.exerciseId || 0) || null,
      name: String(exercise?.name || `Exercise ${index + 1}`).trim() || `Exercise ${index + 1}`,
      workoutType: String(exercise?.workoutType || inferredWorkoutType).trim() || inferredWorkoutType,
      scheduleGroup: String(exercise?.scheduleGroup || safeDayName).trim() || safeDayName,
      sessionSets: sessionSets.map((set, setIndex) => ({
        setNum: Number(set?.setNum || setIndex + 1),
        weight: Number(set?.weight || 0),
        reps: Number(set?.reps || 0),
        duration: Number(set?.duration || 0),
        caloriesBurned: Number(set?.caloriesBurned || 0),
        distanceMiles: Number(set?.distanceMiles || 0),
        speedMph: Number(set?.speedMph || 0),
        done: Boolean(set?.done),
        notes: typeof set?.notes === 'string' ? set.notes : '',
        prefilledFields: set?.prefilledFields && typeof set.prefilledFields === 'object' ? { ...set.prefilledFields } : {},
        prefilledFromLastWorkout: Boolean(set?.prefilledFromLastWorkout),
      })),
    };
  });
};

const setFriendlyError = (area, {
  status = null,
  code = '',
  requestId = '',
  service = '',
  rawMessage = '',
  category = 'generic',
  fallback = 'Unable to complete your request. Please try again.',
  preserveValidation = true,
} = {}) => {
  const friendlyMessage = buildFriendlyMessage({
    status,
    code,
    rawMessage,
    category,
    fallback,
    preserveValidation,
  });

  if (area === 'plansLoad') plansLoadError.value = friendlyMessage;
  if (area === 'save') saveError.value = friendlyMessage;
  if (area === 'history') historyError.value = friendlyMessage;
  if (area === 'historySave') historySaveError.value = friendlyMessage;
  if (area === 'deleteHistory') deleteHistoryError.value = friendlyMessage;

  errorDiagnosticsByArea.value = {
    ...errorDiagnosticsByArea.value,
    [area]: buildDiagnosticsPayload({ status, code, requestId, service, rawMessage }),
  };
};

const clearFriendlyError = (area) => {
  if (area === 'plansLoad') plansLoadError.value = '';
  if (area === 'save') saveError.value = '';
  if (area === 'history') historyError.value = '';
  if (area === 'historySave') historySaveError.value = '';
  if (area === 'deleteHistory') deleteHistoryError.value = '';

  errorDiagnosticsByArea.value = {
    ...errorDiagnosticsByArea.value,
    [area]: null,
  };
  diagnosticsExpandedByArea.value = {
    ...diagnosticsExpandedByArea.value,
    [area]: false,
  };
};

const toggleDiagnostics = (area) => {
  diagnosticsExpandedByArea.value = {
    ...diagnosticsExpandedByArea.value,
    [area]: !diagnosticsExpandedByArea.value?.[area],
  };
};

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

const isPersonalWorkoutPlan = (plan = {}) => {
  const planType = String(plan?.planType || '').trim().toLowerCase();
  return planType !== 'featured' && planType !== 'community_shared';
};

const hasGlobalSourcePlan = (plan = {}) => Number(plan?.sourceGlobalPlanId || 0) > 0;

const getGlobalSourcePlanLabel = (plan = {}) => {
  const fallback = 'Global Plan';
  if (!hasGlobalSourcePlan(plan)) {
    return '';
  }

  const sourceName = String(plan?.sourceGlobalPlanName || '').trim();
  return sourceName || fallback;
};

const canDeleteWorkoutPlan = (plan = {}) => {
  if (!isPersonalWorkoutPlan(plan)) {
    return false;
  }

  const planId = String(plan?.planId || '').trim();
  if (!planId) {
    return false;
  }

  return String(activeSession.value?.workoutPlanId || '').trim() !== planId;
};

const formatDurationHms = (totalSeconds) => {
  const safeSeconds = Math.max(Number(totalSeconds || 0), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};

const getElapsedSecondsFromStart = (startedAtValue) => {
  if (!startedAtValue) return 0;
  const startedAtMs = new Date(startedAtValue).getTime();
  if (!Number.isFinite(startedAtMs)) return 0;
  return Math.max(Math.floor((workoutTimerNowMs.value - startedAtMs) / 1000), 0);
};

const getHistorySessionDurationSeconds = (session) => {
  const explicitDuration = Number(session?.sessionDurationSeconds || 0);
  if (explicitDuration > 0) {
    return explicitDuration;
  }

  const startedAtMs = new Date(session?.sessionStartedAt || '').getTime();
  const completedAtMs = new Date(session?.sessionCompletedAt || session?.sessionEndedAt || '').getTime();
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs)) {
    return 0;
  }

  return Math.max(Math.floor((completedAtMs - startedAtMs) / 1000), 0);
};

const activeWorkoutElapsedSeconds = computed(() => {
  if (!hasActiveWorkout.value) return 0;
  return workoutTimerPaused.value
    ? pausedWorkoutElapsedSeconds.value
    : getElapsedSecondsFromStart(activeSession.value?.startedAt);
});

const activeWorkoutTimerLabel = computed(() => formatDurationHms(activeWorkoutElapsedSeconds.value));

const canContinueConflictSession = computed(() =>
  Boolean(workoutConflictSession.value?.continuationPossible)
);

const normalizeSessionStatus = (session) =>
  String(session?.sessionStatus || session?.status || '').trim().toLowerCase();

const sessionHasTerminalState = (session) => {
  if (!session) return false;

  // Defensive: treat sessions with completion/end/cancel markers as not live.
  return Boolean(
    session?.sessionCompletedAt ||
    session?.sessionEndedAt ||
    session?.endedAt ||
    session?.completedAt ||
    session?.canceledAt ||
    session?.cancelledAt
  );
};

const isInProgressSessionStatus = (status) =>
  status === 'in_progress' || status === 'in-progress' || status === 'active';

const isLiveSessionStatus = (status) =>
  isInProgressSessionStatus(status) || status === 'paused';

const normalizedSessionStatus = computed(() => normalizeSessionStatus(activeSession.value));

const isWorkoutSessionActive = computed(() => {
  if (!hasActiveWorkout.value || !activeSession.value || isPreviewMode.value) {
    return false;
  }

  if (sessionHasTerminalState(activeSession.value)) {
    return false;
  }

  const status = normalizedSessionStatus.value;
  if (!status) {
    return false;
  }

  return isInProgressSessionStatus(status);
});

const hasLiveWorkoutSession = computed(() => {
  if (!hasActiveWorkout.value || !activeSession.value) {
    return false;
  }

  if (sessionHasTerminalState(activeSession.value)) {
    return false;
  }

  const status = normalizedSessionStatus.value;
  if (!status) {
    return false;
  }

  return isLiveSessionStatus(status);
});

const selectedDaySessionState = computed(() => {
  const day = String(selectedDay.value || '').trim();
  const sessionDay = String(activeSession.value?.workoutDayName || '').trim();
  if (!day || !sessionDay || day !== sessionDay || !hasLiveWorkoutSession.value || isPreviewMode.value) {
    return null;
  }

  return normalizedSessionStatus.value === 'paused' ? 'paused' : 'active';
});

const setWorkoutTimerRunning = (isRunning) => {
  if (isRunning) {
    if (workoutTimerIntervalId != null) return;
    workoutTimerNowMs.value = Date.now();
    workoutTimerIntervalId = window.setInterval(() => {
      workoutTimerNowMs.value = Date.now();
    }, 1000);
    return;
  }

  if (workoutTimerIntervalId != null) {
    window.clearInterval(workoutTimerIntervalId);
    workoutTimerIntervalId = null;
  }
};

const syncWorkoutTimerState = () => {
  const shouldRun = Boolean(
    hasActiveWorkout.value && activeSession.value?.startedAt && !workoutTimerPaused.value
  );
  setWorkoutTimerRunning(shouldRun);
};

const setWorkoutTimerPaused = (isPaused) => {
  workoutTimerNowMs.value = Date.now();
  if (isPaused) {
    pausedWorkoutElapsedSeconds.value = getElapsedSecondsFromStart(activeSession.value?.startedAt);
  }
  workoutTimerPaused.value = Boolean(isPaused);
  syncWorkoutTimerState();
};

const formatConflictSessionDate = (value) => {
  if (!value) return 'Date unavailable';
  const normalized = String(value).slice(0, 10);
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toLocaleDateString();
};

const formatSessionStatus = (session) => {
  const status = normalizeSessionStatus(session);
  if (status === 'in_progress' || status === 'in-progress') return 'In Progress';
  if (status === 'paused') return 'Paused';
  if (status === 'active') return 'Active';
  return status ? status.replaceAll('_', ' ') : 'In Progress';
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
const isStatsExpanded = ref(false);
const hasWorkoutPlans = computed(() => plansLoaded.value && Array.isArray(workoutLists.value) && workoutLists.value.length > 0);
const shouldShowPlanLoadError = computed(() =>
  plansLoaded.value && plansLoadRequested.value && !loading.value && Boolean(plansLoadError.value)
);
const isWorkoutLogView = computed(() => route.name === 'workouts' || route.path === '/workouts' || route.path === '/workout-log');
const isExercisesView = computed(() => route.name === 'exercises' || route.path === '/exercises');
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

const buildExerciseNameSummary = (exercises = []) =>
  (Array.isArray(exercises) ? exercises : [])
    .map((exercise) => String(exercise?.name || exercise?.exerciseName || '').trim())
    .filter(Boolean)
    .join(' • ');

const exercisesByGroup = computed(() => {
  const grouped = buildWorkoutLogExerciseGroups({
    groups: groups.value,
    exercises: allExercises.value,
  });

  return grouped
    .map((entry) => ({
      name: entry.name,
      exercises: entry.exercises,
      exerciseNameSummary: buildExerciseNameSummary(entry.exercises),
    }))
    .filter((entry) => entry.exercises.length > 0);
});

const currentDayOrderState = computed(() => getDayOrderState(expandedPlanId.value));
const dayOrderDirty = computed(() => Boolean(currentDayOrderState.value?.dirty));
const dayOrderSaving = computed(() => Boolean(currentDayOrderState.value?.saving));
const dayOrderLoading = computed(() => Boolean(currentDayOrderState.value?.loading));

const isReorderPanelOpen = (planId) => Boolean(reorderPanelOpenByPlanId.value[String(planId || '')]);

const toggleReorderPanel = (planId) => {
  const pid = String(planId || '').trim();
  if (!pid) return;
  const current = Boolean(reorderPanelOpenByPlanId.value[pid]);
  reorderPanelOpenByPlanId.value = {
    ...reorderPanelOpenByPlanId.value,
    [pid]: !current,
  };
};

const isPlanActionMenuOpen = (planId) => Boolean(mobilePlanActionMenuOpenByPlanId.value[String(planId || '')]);

const closePlanActionMenu = (planId) => {
  const pid = String(planId || '').trim();
  if (!pid) return;

  if (!mobilePlanActionMenuOpenByPlanId.value[pid]) {
    return;
  }

  mobilePlanActionMenuOpenByPlanId.value = {
    ...mobilePlanActionMenuOpenByPlanId.value,
    [pid]: false,
  };
};

const closeAllPlanActionMenus = () => {
  if (!Object.keys(mobilePlanActionMenuOpenByPlanId.value).length) {
    return;
  }

  mobilePlanActionMenuOpenByPlanId.value = {};
};

const togglePlanActionMenu = (planId) => {
  const pid = String(planId || '').trim();
  if (!pid) return;

  const current = Boolean(mobilePlanActionMenuOpenByPlanId.value[pid]);
  mobilePlanActionMenuOpenByPlanId.value = current ? {} : { [pid]: true };
};

const onDocumentPointerDownForPlanActionMenu = (event) => {
  const target = event?.target;
  if (!target || typeof target.closest !== 'function') {
    return;
  }

  if (!target.closest('.wl-plan-mobile-actions')) {
    closeAllPlanActionMenus();
  }
};

const handlePlanMenuReorder = async (plan) => {
  const pid = String(plan?.planId || '').trim();
  if (!pid) {
    closeAllPlanActionMenus();
    return;
  }

  if (expandedPlanId.value !== pid) {
    await togglePlan(pid);
  }

  toggleReorderPanel(pid);
  closePlanActionMenu(pid);
};

const handlePlanMenuEdit = (plan) => {
  closePlanActionMenu(plan?.planId);
  openInBuilder(plan?.planId);
};

const handlePlanMenuDelete = async (plan) => {
  closePlanActionMenu(plan?.planId);
  await deleteWorkoutPlan(plan);
};

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
  filterWorkoutLogDayExercises({
    selectedDay: selectedDay.value,
    exercises: sessionExercises.value,
    fallbackGroup: groups.value[0] || '',
  })
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
    const selectedDayBelongsToActiveSession = Boolean(
      activeSession.value &&
      String(activeSession.value?.workoutDayName || '').trim() === String(selectedDay.value || '').trim()
    );

    if (!selectedDayBelongsToActiveSession && (!nextExpandedPlanId || (hasSelectedDay && !selectedDayStillExists))) {
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
  queueWorkoutDraftSave();
};

const removeSet = (exerciseId, setIndex) => {
  if (isPreviewMode.value) return;
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex || ex.sessionSets.length <= 1) return;
  ex.sessionSets.splice(setIndex, 1);
  ex.sessionSets.forEach((s, i) => { s.setNum = i + 1; });
  queueWorkoutDraftSave();
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
  queueWorkoutDraftSave();
};

/* ─── Load plan list ─────────────────────────────────────────────────────── */
const loadWorkoutLists = async () => {
  loading.value = true;
  plansLoadRequested.value = true;
  clearFriendlyError('plansLoad');
  plansLoaded.value = false;
  try {
    const res  = await fetch(`${API_BASE}/api/workout-planner`, { credentials: 'include' });
    if (!res.ok) {
      throw await parseResponseError(res, 'Failed to load workout plans.');
    }
    const data = await res.json();
    workoutLists.value = (Array.isArray(data?.workoutLists) ? data.workoutLists : [])
      .filter((plan) => isPersonalWorkoutPlan(plan))
      .map((plan) => ({ ...plan, updatedAtLabel: formatUpdatedAt(plan.updatedAt) }));

    if (workoutLists.value.length !== 1) {
      didAutoExpandSinglePlan.value = false;
    }

    plansLoaded.value = true;
  } catch (err) {
    setFriendlyError('plansLoad', {
      status: err?.status,
      code: err?.code,
      requestId: err?.requestId,
      service: err?.service,
      rawMessage: err?.rawMessage || err?.message,
      fallback: 'Unable to load workout plans right now. Please try again.',
    });
    workoutLists.value = [];
    plansLoaded.value = true;
  } finally {
    loading.value = false;
    await autoExpandSinglePlanIfNeeded();
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
    reorderPanelOpenByPlanId.value = {
      ...reorderPanelOpenByPlanId.value,
      [pid]: false,
    };
    return;
  }

  expandedPlanId.value   = pid;
  expandedPlanData.value = null;
  expandedLoading.value  = true;
  reorderPanelOpenByPlanId.value = {
    ...reorderPanelOpenByPlanId.value,
    [pid]: false,
  };

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
const sortSessionsNewestFirst = (sessions = []) => [...sessions].sort((left, right) => {
  const leftStartedAt = new Date(left?.startedAt || left?.sessionStartedAt || 0).getTime() || 0;
  const rightStartedAt = new Date(right?.startedAt || right?.sessionStartedAt || 0).getTime() || 0;
  return rightStartedAt - leftStartedAt || Number(right?.id || 0) - Number(left?.id || 0);
});

const loadInProgressSessions = async () => {
  const res = await fetch(`${API_BASE}/api/workout-sessions/in-progress`, { credentials: 'include' });
  if (!res.ok) {
    return activeSessions.value;
  }

  const data = await res.json().catch(() => ({}));
  const sessions = sortSessionsNewestFirst(Array.isArray(data?.sessions) ? data.sessions : []);
  activeSessions.value = sessions;
  return sessions;
};

const checkActiveSession = async () => {
  try {
    const sessions = await loadInProgressSessions();
    if (!sessions.length) {
      activeSession.value    = null;
      hasActiveWorkout.value = false;
      sessionExercises.value = [];
      return;
    }

    const nextSession = sessions[0];
    const nextStatus = normalizeSessionStatus(nextSession);
    const isTerminalSession = sessionHasTerminalState(nextSession);
    const hasLiveState = isLiveSessionStatus(nextStatus);

    if (isTerminalSession || !hasLiveState) {
      activeSession.value = null;
      hasActiveWorkout.value = false;
      return;
    }

    await continueExistingWorkoutSession(nextSession, { activateTab: false });
  } catch (_) { /* non-fatal */ }
};

const openCurrentWorkout = async () => {
  activeTab.value = 'dayDetails';

  try {
    const sessions = await loadInProgressSessions();
    if (!sessions.length) {
      activeSession.value = null;
      hasActiveWorkout.value = false;
      isPreviewMode.value = false;
      selectedDay.value = '';
      sessionExercises.value = [];
      return;
    }

    clearFriendlyError('save');
    await continueExistingWorkoutSession(sessions[0], { activateTab: true, pauseTimer: false });
  } catch (_) {
    // Keep Current Workout open so its existing error or empty state remains visible.
  }
};

const continueExistingWorkoutSession = async (session, { activateTab = true, pauseTimer = false } = {}) => {
  if (!session) return;

  activeSession.value = session;
  hasActiveWorkout.value = true;
  isPreviewMode.value = false;
  setWorkoutTimerPaused(pauseTimer);

  if (session.workoutDate) {
    const parsed = new Date(session.workoutDate);
    if (!Number.isNaN(parsed.getTime())) {
      selectedWorkoutDate.value = parsed.toISOString().split('T')[0];
    }
  }

  selectedDay.value = String(session.workoutDayName || '').trim();

  const pid = String(session.workoutPlanId || '').trim();
  if (!pid && session.canResumeFromDraft) {
    sessionExercises.value = buildSessionExercisesFromDraft(session.notes, session.workoutDayName);
    activeTab.value = selectTabDuringSessionRecovery({ currentTab: activeTab.value, activateTab });
    return;
  }

  expandedPlanData.value = selectExpandedPlanDuringSessionRecovery({
    currentPlan: expandedPlanData.value,
    sessionPlanId: pid,
  });
  if (pid) {
    expandedPlanId.value = pid;
    expandedLoading.value = true;
    try {
      const planRes = await fetch(`${API_BASE}/api/workout-planner?planId=${encodeURIComponent(pid)}`, { credentials: 'include' });
      if (planRes.ok) {
        const planData = await planRes.json();
        expandedPlanData.value = planData?.planner || null;
      }
    } catch (_) {
      // fallback to draft recovery below
    } finally {
      expandedLoading.value = false;
    }
  }

  if (expandedPlanData.value) {
    sessionExercises.value = await buildSessionExercisesWithHistoryPrefill(expandedPlanData.value.exercises || []);
    applyWorkoutDraft(session.notes);
    queueWorkoutDraftSave(true);
    activeTab.value = selectTabDuringSessionRecovery({ currentTab: activeTab.value, activateTab });
    return;
  }

  if (session.canResumeFromDraft) {
    sessionExercises.value = buildSessionExercisesFromDraft(session.notes, session.workoutDayName);
    activeTab.value = selectTabDuringSessionRecovery({ currentTab: activeTab.value, activateTab });
    return;
  }

  setFriendlyError('save', {
    rawMessage: 'Your previous workout plan is no longer available. You can end the unfinished session and start a new workout.',
    fallback: 'Your previous workout plan is no longer available. You can end the unfinished session and start a new workout.',
  });
};

const startWorkoutSessionRequest = async ({
  dayName,
  planId = expandedPlanId.value,
  workoutStartDate = selectedWorkoutDate.value || today(),
  endSessionIds = [],
  confirmMultipleEnd = false,
}) => {

  const response = await fetch(`${API_BASE}/api/workout-sessions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      workoutPlanId: planId,
      workoutDayName: dayName,
      workoutDate: workoutStartDate,
      ...(endSessionIds.length ? { endSessionIds, confirmMultipleEnd } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload, workoutStartDate };
};

const closeWorkoutConflictModal = () => {
  if (conflictModalLoading.value) return;
  showWorkoutConflictModal.value = false;
  workoutConflictSession.value = null;
  workoutConflictSessionIds.value = [];
  pendingWorkoutStart.value = null;
  conflictModalError.value = '';
};

const openWorkoutConflictModal = ({ sessions, pendingStart, message = '' }) => {
  const normalizedSessions = Array.isArray(sessions) ? sessions : [];
  workoutConflictSession.value = [...normalizedSessions].sort((left, right) => {
    const leftStartedAt = new Date(left?.startedAt || left?.sessionStartedAt || 0).getTime() || 0;
    const rightStartedAt = new Date(right?.startedAt || right?.sessionStartedAt || 0).getTime() || 0;
    return rightStartedAt - leftStartedAt || Number(right?.id || 0) - Number(left?.id || 0);
  })[0] || null;
  workoutConflictSessionIds.value = normalizedSessions
    .map((session) => Number(session?.id || 0))
    .filter((sessionId) => Number.isInteger(sessionId) && sessionId > 0);
  pendingWorkoutStart.value = pendingStart;
  conflictModalError.value = message;
  showWorkoutConflictModal.value = true;
};

const activateStartedWorkout = async ({ session, pendingStart }) => {
  activeSession.value = session;
  hasActiveWorkout.value = true;
  selectedWorkoutDate.value = pendingStart.workoutStartDate;
  selectedDay.value = pendingStart.dayName;
  isPreviewMode.value = false;
  setWorkoutTimerPaused(false);

  sessionExercises.value = await buildSessionExercisesWithHistoryPrefill(
    pendingStart.planExercises || []
  );
  applyWorkoutDraft(session.notes);
  queueWorkoutDraftSave(true);
  await loadInProgressSessions();
  activeTab.value = 'dayDetails';
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
  clearFriendlyError('save');

  const pendingStart = {
    dayName,
    planId: expandedPlanId.value,
    workoutStartDate: selectedWorkoutDate.value || today(),
    planExercises: expandedPlanData.value?.exercises || [],
  };

  try {
    const { response: res, payload: data } = await startWorkoutSessionRequest(pendingStart);

    if (res.status === 409 && Array.isArray(data?.activeSessions) && data.activeSessions.length) {
      openWorkoutConflictModal({ sessions: data.activeSessions, pendingStart });
      return;
    }

    if (!res.ok) {
      throw {
        status: Number(res?.status || 0) || null,
        rawMessage: data?.error || 'Failed to start workout session.',
        code: data?.code || data?.errorCode || '',
        requestId: data?.requestId || res.headers?.get('x-request-id') || '',
        service: data?.service || '',
      };
    }

    await activateStartedWorkout({ session: data.session, pendingStart });
  } catch (err) {
    setFriendlyError('save', {
      status: err?.status,
      code: err?.code,
      requestId: err?.requestId,
      service: err?.service,
      rawMessage: err?.rawMessage || err?.message,
      category: 'save',
      fallback: 'Unable to start this workout right now. Please try again.',
    });
  }
};

const continuePreviousWorkout = async () => {
  if (conflictModalLoading.value) return;

  const session = workoutConflictSession.value;
  if (!session?.continuationPossible) {
    conflictModalError.value = 'This unfinished workout cannot be restored.';
    return;
  }

  conflictModalLoading.value = true;
  clearFriendlyError('save');
  try {
    await continueExistingWorkoutSession(session, { pauseTimer: true });
    conflictModalLoading.value = false;
    closeWorkoutConflictModal();
  } catch (err) {
    conflictModalError.value = err?.message || 'Unable to restore the previous workout.';
    conflictModalLoading.value = false;
  }
};

const startNewWorkoutAfterConflict = async () => {
  if (conflictModalLoading.value) return;

  const session = workoutConflictSession.value;
  const endSessionIds = workoutConflictSessionIds.value;
  const pendingStart = pendingWorkoutStart.value;
  if (!pendingStart || !session || endSessionIds.length === 0) return;

  conflictModalLoading.value = true;
  conflictModalError.value = '';
  clearFriendlyError('save');

  try {
    if (activeSession.value) {
      const draftSaved = await persistWorkoutDraft();
      if (!draftSaved) {
        throw new Error('Unable to save the current workout progress. No workouts were ended.');
      }
    }

    const { response, payload } = await startWorkoutSessionRequest({
      ...pendingStart,
      endSessionIds,
      confirmMultipleEnd: endSessionIds.length > 1,
    });

    if (!response.ok) {
      if (response.status === 409 && Array.isArray(payload?.activeSessions)) {
        openWorkoutConflictModal({
          sessions: payload.activeSessions,
          pendingStart,
          message: payload.error || 'The unfinished workout list changed. Review it and try again.',
        });
        conflictModalLoading.value = false;
        return;
      }
      throw {
        status: Number(response?.status || 0) || null,
        rawMessage: payload?.error || 'Failed to end the previous workout.',
        code: payload?.code || payload?.errorCode || '',
        requestId: payload?.requestId || response.headers?.get('x-request-id') || '',
        service: payload?.service || '',
      };
    }

    conflictModalLoading.value = false;
    closeWorkoutConflictModal();
    await activateStartedWorkout({ session: payload.session, pendingStart });
  } catch (err) {
    conflictModalError.value = err?.rawMessage || err?.message ||
      'The previous workout could not be ended. No new workout was started.';
    conflictModalLoading.value = false;
  }
};

/* ─── Complete workout ───────────────────────────────────────────────────── */
const completeWorkout = async () => {
  saving.value      = true;
  saveMessage.value = '';
  clearFriendlyError('save');
  clearWorkoutDraftSave();

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
      throw await parseResponseError(logRes, 'Failed to save session log.');
    }

    let completedDurationSeconds = 0;
    if (activeSession.value?.id) {
      const completeRes = await fetch(`${API_BASE}/api/workout-sessions/complete/${activeSession.value.id}`, {
        method: 'POST', credentials: 'include',
      });
      const completeData = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        throw {
          status: Number(completeRes?.status || 0) || null,
          rawMessage: completeData?.error || 'Failed to complete workout session.',
          code: completeData?.code || completeData?.errorCode || '',
          requestId: completeData?.requestId || completeRes.headers?.get('x-request-id') || '',
          service: completeData?.service || '',
        };
      }
      completedDurationSeconds = Number(completeData?.session?.durationSeconds || 0);
    }

    saveMessage.value = completedDurationSeconds > 0
      ? `✓ Workout complete! Great work! Workout Time: ${formatDurationHms(completedDurationSeconds)}`
      : '✓ Workout complete! Great work!';
    const completedSessionId = Number(activeSession.value?.id || 0);
    activeSessions.value = activeSessions.value.filter(
      (session) => Number(session?.id || 0) !== completedSessionId
    );
    activeSession.value    = null;
    hasActiveWorkout.value = false;

    setTimeout(() => {
      saveMessage.value = '';
      activeTab.value   = 'overview';
      selectedDay.value = '';
    }, 2000);
  } catch (err) {
    setFriendlyError('save', {
      status: err?.status,
      code: err?.code,
      requestId: err?.requestId,
      service: err?.service,
      rawMessage: err?.rawMessage || err?.message,
      category: 'save',
      fallback: 'Unable to complete this workout right now. Please try again.',
    });
  } finally {
    saving.value = false;
  }
};

/* ─── Navigation helpers ─────────────────────────────────────────────────── */
const openInBuilder = (planId) => {
  const pid = String(planId || '').trim();
  router.push(pid
    ? { name: 'workout_builder', query: { planId: pid, tab: 'create' } }
    : { name: 'workout_builder', query: { tab: 'create' } });
};

const openRequestedPlanFromQuery = async () => {
  if (hasActiveWorkout.value) {
    return;
  }

  const requestedPlanId = String(route.query?.planId || '').trim();
  if (!requestedPlanId) {
    return;
  }

  const existsInList = workoutLists.value.some((plan) => String(plan?.planId || '').trim() === requestedPlanId);
  if (!existsInList) {
    return;
  }

  activeTab.value = 'overview';
  if (expandedPlanId.value !== requestedPlanId) {
    await togglePlan(requestedPlanId);
  }
};

const openFindPlans = () => {
  router.push({ name: 'find_plans' });
};

const openBuildMyOwnWorkout = () => {
  openInBuilder('');
};

const loadSessionUserId = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/session`, { credentials: 'include' });
    if (!response.ok) {
      sessionUserId.value = null;
      currentRoleSlug.value = 'user';
      return;
    }
    const data = await response.json().catch(() => ({}));
    sessionUserId.value = Number(data?.user?.id || 0) || null;
    currentRoleSlug.value = normalizeRoleSlug(data?.user?.role || data?.user?.roleSlug || 'user');
  } catch (_) {
    sessionUserId.value = null;
    currentRoleSlug.value = 'user';
  }
};

const loadExerciseLibrary = async () => {
  exerciseLibraryLoading.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/get-exercises`, { credentials: 'include' });
    const data = await response.json().catch(() => []);
    exerciseLibrary.value = Array.isArray(data) ? data : [];
  } catch (_) {
    exerciseLibrary.value = [];
  } finally {
    exerciseLibraryLoading.value = false;
  }
};

const openAddExercisePicker = async () => {
  if (!hasActiveWorkout.value || isPreviewMode.value || saving.value || exerciseAddLoading.value) {
    return;
  }

  if (!activeSession.value?.id) {
    clearFriendlyError('save');
    saveError.value = 'No active in-progress workout found.';
    return;
  }

  clearFriendlyError('save');

  if (!exerciseLibrary.value.length && !exerciseLibraryLoading.value) {
    await loadExerciseLibrary();
  }

  if (!exerciseLibrary.value.length) {
    setFriendlyError('save', {
      rawMessage: 'Unable to load Exercise Database right now.',
      fallback: 'Unable to load Exercise Database right now.',
    });
    return;
  }

  addExercisePickerOpen.value = true;
};

const closeAddExercisePicker = () => {
  if (exerciseAddLoading.value) return;
  addExercisePickerOpen.value = false;
};

const addExerciseToActiveWorkout = async (pickedExercises) => {
  const selectedItems = Array.isArray(pickedExercises) ? pickedExercises : [pickedExercises];
  const validExerciseIds = selectedItems
    .map((item) => Number(item?.ExerciseID || item?.exerciseId || 0))
    .filter((id) => id > 0);

  if (!validExerciseIds.length) {
    return;
  }

  if (!hasActiveWorkout.value || !activeSession.value?.id) {
    clearFriendlyError('save');
    saveError.value = 'No active in-progress workout found.';
    return;
  }

  exerciseAddLoading.value = true;
  clearFriendlyError('save');
  saveMessage.value = '';

  let addedCount = 0;

  try {
    for (const exerciseId of validExerciseIds) {
      const response = await fetch(`${API_BASE}/api/workout-sessions/active/add-exercise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          exerciseId,
          sessionId: Number(activeSession.value?.id || 0),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw {
          status: Number(response?.status || 0) || null,
          rawMessage: payload?.error || 'Failed to add exercise to active workout.',
          code: payload?.code || payload?.errorCode || '',
          requestId: payload?.requestId || response.headers?.get('x-request-id') || '',
          service: payload?.service || '',
        };
      }

      const addedExercise = payload?.exercise;
      if (!addedExercise) {
        continue;
      }

      if (expandedPlanData.value && Array.isArray(expandedPlanData.value.exercises)) {
        expandedPlanData.value.exercises = [...expandedPlanData.value.exercises, addedExercise];
      }

      const sessionExercise = {
        ...addedExercise,
        sessionSets: buildInitialSets(addedExercise),
      };
      const latestHistory = await getLatestExerciseHistory(sessionExercise.exerciseId);
      applyLatestHistoryPrefill(sessionExercise, latestHistory);

      sessionExercises.value = [...sessionExercises.value, sessionExercise];
      addedCount += 1;
    }

    if (addedCount > 0) {
      saveMessage.value = `${addedCount} exercise${addedCount === 1 ? '' : 's'} added to ${selectedDay.value}.`;
      addExercisePickerOpen.value = false;
      queueWorkoutDraftSave(true);
    }
  } catch (err) {
    setFriendlyError('save', {
      status: err?.status,
      code: err?.code,
      requestId: err?.requestId,
      service: err?.service,
      rawMessage: err?.rawMessage || err?.message,
      category: 'save',
      fallback: 'Unable to add exercise to this workout right now.',
    });
  } finally {
    exerciseAddLoading.value = false;
  }
};

const removePlanFromUi = (planId) => {
  const pid = String(planId || '').trim();
  if (!pid) {
    return;
  }

  workoutLists.value = workoutLists.value.filter((plan) => String(plan?.planId || '').trim() !== pid);

  if (expandedPlanId.value === pid) {
    expandedPlanId.value = null;
    expandedPlanData.value = null;
    selectedDay.value = '';
    activeTab.value = 'overview';
  }

  const nextDayOrderStateByPlanId = { ...dayOrderStateByPlanId.value };
  delete nextDayOrderStateByPlanId[pid];
  dayOrderStateByPlanId.value = nextDayOrderStateByPlanId;

  const nextReorderPanelOpenByPlanId = { ...reorderPanelOpenByPlanId.value };
  delete nextReorderPanelOpenByPlanId[pid];
  reorderPanelOpenByPlanId.value = nextReorderPanelOpenByPlanId;

  const nextMobilePlanActionMenuOpenByPlanId = { ...mobilePlanActionMenuOpenByPlanId.value };
  delete nextMobilePlanActionMenuOpenByPlanId[pid];
  mobilePlanActionMenuOpenByPlanId.value = nextMobilePlanActionMenuOpenByPlanId;

  if (workoutLists.value.length !== 1) {
    didAutoExpandSinglePlan.value = false;
  }
};

const deleteWorkoutPlan = async (plan) => {
  const planId = String(plan?.planId || '').trim();
  if (!planId || !canDeleteWorkoutPlan(plan)) {
    return;
  }

  const planName = String(plan?.name || plan?.planName || 'this workout plan').trim();
  const confirmed = await showConfirmDialog(`Delete ${planName}? This will permanently remove this workout plan.`, {
    title: 'Delete Workout Plan',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
  });
  if (!confirmed) {
    return;
  }

  clearFriendlyError('save');
  saveMessage.value = '';

  try {
    const res = await fetch(`${API_BASE}/api/workout-schedules/${encodeURIComponent(planId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw {
        status: Number(res?.status || 0) || null,
        rawMessage: body?.error || 'Failed to delete workout plan.',
        code: body?.code || body?.errorCode || '',
        requestId: body?.requestId || res.headers?.get('x-request-id') || '',
        service: body?.service || '',
      };
    }

    removePlanFromUi(planId);
    saveMessage.value = 'Workout plan deleted.';
    await autoExpandSinglePlanIfNeeded();
  } catch (err) {
    setFriendlyError('save', {
      status: err?.status,
      code: err?.code,
      requestId: err?.requestId,
      service: err?.service,
      rawMessage: err?.rawMessage || err?.message,
      fallback: 'Unable to delete this workout plan right now. Please try again.',
    });
  }
};

/* ─── Workout History loader ───────────────────────────────────────────── */
const loadWorkoutHistory = async () => {
  historyLoading.value  = true;
  clearFriendlyError('history');
  historyWorkouts.value = [];
  try {
    const res = await fetch(
      `${API_BASE}/api/workout-log/history?date=${encodeURIComponent(selectedWorkoutDate.value)}`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      throw await parseResponseError(res, `Server error ${res.status}`);
    }
    const data = await res.json();
    historyWorkouts.value        = Array.isArray(data.sessions) ? data.sessions : [];
    workoutHistoryUsername.value = data.username || '';
  } catch (err) {
    console.error('[WorkoutHistory] load failed:', err);
    setFriendlyError('history', {
      status: err?.status,
      code: err?.code,
      requestId: err?.requestId,
      service: err?.service,
      rawMessage: err?.rawMessage || err?.message,
      fallback: 'Unable to load workout history right now. Please try again.',
    });
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

watch(
  [hasActiveWorkout, () => activeSession.value?.startedAt, workoutTimerPaused],
  () => {
    syncWorkoutTimerState();
  },
  { immediate: true },
);

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
  clearFriendlyError('deleteHistory');
  showDeleteHistoryModal.value = true;
};

const closeDeleteHistoryModal = () => {
  showDeleteHistoryModal.value = false;
  workoutHistoryToDelete.value = null;
  clearFriendlyError('deleteHistory');
};

const confirmDeleteHistoryWorkout = async () => {
  if (!workoutHistoryToDelete.value) return;
  deleteHistoryLoading.value = true;
  clearFriendlyError('deleteHistory');
  try {
    const { sessionId } = workoutHistoryToDelete.value;
    const endpoint = sessionId != null
      ? `${API_BASE}/api/workout-log/history/session/${sessionId}`
      : null;
    if (!endpoint) {
      setFriendlyError('deleteHistory', {
        rawMessage: 'Cannot identify session to delete.',
        fallback: 'Cannot identify session to delete.',
      });
      return;
    }
    const res = await fetch(endpoint, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      throw await parseResponseError(res, `Server error ${res.status}`);
    }
    closeDeleteHistoryModal();
    await loadWorkoutHistory();
  } catch (err) {
    console.error('[DeleteHistory]', err);
    setFriendlyError('deleteHistory', {
      status: err?.status,
      code: err?.code,
      requestId: err?.requestId,
      service: err?.service,
      rawMessage: err?.rawMessage || err?.message,
      fallback: 'Unable to delete this workout record right now. Please try again.',
    });
  } finally {
    deleteHistoryLoading.value = false;
  }
};
/* ─── Edit history session ──────────────────────────────────────────────── */
const startEditHistoryWorkout = (session) => {
  clearFriendlyError('historySave');
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
  clearFriendlyError('historySave');
};

const updateHistoryDraft = (workoutLogId, setIdx, field, value) => {
  const sets = historyEditDraft.value[workoutLogId];
  if (!sets || !sets[setIdx]) return;
  sets[setIdx][field] = Number(value) || 0;
};

const saveHistoryWorkout = async (session) => {
  savingHistoryWorkout.value = true;
  clearFriendlyError('historySave');
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
      throw await parseResponseError(res, `Server error ${res.status}`);
    }
    cancelEditHistoryWorkout();
    await loadWorkoutHistory();
  } catch (err) {
    console.error('[SaveHistory]', err);
    setFriendlyError('historySave', {
      status: err?.status,
      code: err?.code,
      requestId: err?.requestId,
      service: err?.service,
      rawMessage: err?.rawMessage || err?.message,
      category: 'save',
      fallback: 'Unable to save changes right now. Please try again.',
    });
  } finally {
    savingHistoryWorkout.value = false;
  }
};

/* ─── Lifecycle ──────────────────────────────────────────────────────────── */
onMounted(async () => {
  document.addEventListener('pointerdown', onDocumentPointerDownForPlanActionMenu);
  document.body.classList.add(WORKOUT_LOG_ACTIVE_BODY_CLASS);
  try {
    await loadSessionUserId();
    await loadWorkoutLists();
    await checkActiveSession();
    await openRequestedPlanFromQuery();
  } finally {
    workoutLogMountReady = true;
  }
});

onActivated(async () => {
  if (!workoutLogMountReady) return;
  await loadSessionUserId();
  await loadWorkoutLists();
  await checkActiveSession();
  await openRequestedPlanFromQuery();
});

onUnmounted(() => {
  workoutLogMountReady = false;
  document.removeEventListener('pointerdown', onDocumentPointerDownForPlanActionMenu);
  document.body.classList.remove(WORKOUT_LOG_ACTIVE_BODY_CLASS);
  void persistWorkoutDraft();
  setWorkoutTimerRunning(false);
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
      </section>

      <nav class="wl-view-switch wa-h-tabs" aria-label="Workout log and exercises navigation">
        <router-link
          to="/workout-log"
          class="wl-view-switch__link wl-view-switch__link--log wa-h-tab"
          :class="{
            'wl-view-switch__link--active wa-h-tab--active': isWorkoutLogView,
            'wl-view-switch__link--expanded': isWorkoutLogView,
            'wl-view-switch__link--compact': isExercisesView,
          }"
        >
          <i class="fa-solid fa-dumbbell" aria-hidden="true"></i>
          <span>Workout Log</span>
        </router-link>
        <router-link
          to="/exercises"
          class="wl-view-switch__link wl-view-switch__link--exercises wa-h-tab"
          :class="{
            'wl-view-switch__link--active wa-h-tab--active': isExercisesView,
            'wl-view-switch__link--expanded': isExercisesView,
            'wl-view-switch__link--compact': isWorkoutLogView,
          }"
        >
          <i class="fa-solid fa-book-open" aria-hidden="true"></i>
          <span>Exercises</span>
        </router-link>
      </nav>

      <!-- ── Banners ─────────────────────────────────────────────────────── -->
      <div v-if="saveError" class="wl-banner wl-banner--error">
        <i class="fa-solid fa-circle-xmark"></i> {{ saveError }}
        <button type="button" class="wl-banner-dismiss" @click="clearFriendlyError('save')">✕</button>
        <div
          v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.save"
          class="wl-error-diag"
        >
          <button type="button" class="wl-error-diag__toggle" @click="toggleDiagnostics('save')">
            {{ diagnosticsExpandedByArea.save ? 'Hide details' : 'Show details' }}
          </button>
          <dl v-if="diagnosticsExpandedByArea.save" class="wl-error-diag__list">
            <div><dt>Status</dt><dd>{{ errorDiagnosticsByArea.save.status }}</dd></div>
            <div><dt>Code</dt><dd>{{ errorDiagnosticsByArea.save.code }}</dd></div>
            <div><dt>Request ID</dt><dd>{{ errorDiagnosticsByArea.save.requestId }}</dd></div>
            <div><dt>Service</dt><dd>{{ errorDiagnosticsByArea.save.service }}</dd></div>
            <div><dt>Time</dt><dd>{{ errorDiagnosticsByArea.save.timestamp }}</dd></div>
          </dl>
        </div>
      </div>
      <div v-if="saveMessage" class="wl-banner wl-banner--success">
        <i class="fa-solid fa-circle-check"></i> {{ saveMessage }}
      </div>

      <!-- ── Tab bar ─────────────────────────────────────────────────────── -->
      <nav class="wl-tabs wa-h-tabs wa-h-tabs--tricolor" role="tablist">
        <button
          type="button" role="tab"
          :class="['wl-tab', 'wa-h-tab', activeTab === 'overview' ? 'wl-tab--active wa-h-tab--active' : '']"
          @click="activeTab = 'overview'"
        >
          <i class="fa-solid fa-list-ul"></i> Start My Workout
        </button>
        <button
          type="button" role="tab"
          :class="['wl-tab', 'wa-h-tab', activeTab === 'dayDetails' ? 'wl-tab--active wa-h-tab--active' : '']"
          @click="openCurrentWorkout"
        >
          <i class="fa-solid fa-dumbbell"></i> Current Workout
        </button>
        <button
          type="button" role="tab"
          :class="['wl-tab', 'wa-h-tab', activeTab === 'workoutHistory' ? 'wl-tab--active wa-h-tab--active' : '']"
          @click="openHistoryTab"
        >
          <i class="fa-solid fa-clock-rotate-left"></i> Workout Log
        </button>
      </nav>

      <!-- ══ OVERVIEW TAB ════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'overview'" class="wl-tab-panel">

        <section class="wl-stats-section app-section-card">
          <button
            type="button"
            class="wl-stats-toggle"
            :aria-expanded="isStatsExpanded ? 'true' : 'false'"
            aria-controls="workout-statistics-panel"
            @click="isStatsExpanded = !isStatsExpanded"
          >
            <span class="wl-stats-toggle__title">Workout Statistics</span>
            <i
              class="fa-solid"
              :class="isStatsExpanded ? 'fa-chevron-up' : 'fa-chevron-down'"
              aria-hidden="true"
            ></i>
          </button>

          <transition name="wl-stats-collapse">
            <div
              v-if="isStatsExpanded"
              id="workout-statistics-panel"
              class="wl-stats-collapse-body"
            >
              <section class="wl-stats">
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
            </div>
          </transition>
        </section>

        <!-- Loading -->
        <div v-if="loading || !plansLoaded" class="wl-empty"><p>Loading workout plans...</p></div>

        <!-- Error -->
        <div v-else-if="shouldShowPlanLoadError" class="wl-empty">
          <p>{{ plansLoadError }}</p>
          <div
            v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.plansLoad"
            class="wl-error-diag wl-error-diag--inline"
          >
            <button type="button" class="wl-error-diag__toggle" @click="toggleDiagnostics('plansLoad')">
              {{ diagnosticsExpandedByArea.plansLoad ? 'Hide details' : 'Show details' }}
            </button>
            <dl v-if="diagnosticsExpandedByArea.plansLoad" class="wl-error-diag__list">
              <div><dt>Status</dt><dd>{{ errorDiagnosticsByArea.plansLoad.status }}</dd></div>
              <div><dt>Code</dt><dd>{{ errorDiagnosticsByArea.plansLoad.code }}</dd></div>
              <div><dt>Request ID</dt><dd>{{ errorDiagnosticsByArea.plansLoad.requestId }}</dd></div>
              <div><dt>Service</dt><dd>{{ errorDiagnosticsByArea.plansLoad.service }}</dd></div>
              <div><dt>Time</dt><dd>{{ errorDiagnosticsByArea.plansLoad.timestamp }}</dd></div>
            </dl>
          </div>
          <button type="button" class="wl-btn" @click="loadWorkoutLists">Retry</button>
        </div>

        <!-- Empty -->
        <div v-else-if="workoutLists.length === 0" class="wl-empty app-section-card">
          <i class="fa-solid fa-dumbbell wl-empty-icon"></i>
          <h6>No workout plans yet</h6>
          <p>Select a starter plan or build your own workout.</p>
          <div class="d-flex flex-wrap gap-2 justify-content-center">
            <button type="button" class="wl-btn" @click="openFindPlans">Find a Workout Plan</button>
            <button type="button" class="wl-btn wl-btn-secondary" @click="openBuildMyOwnWorkout">Build My Own Workout</button>
          </div>
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
                    <span v-if="hasGlobalSourcePlan(plan)" class="wl-plan__source-tag" :title="`Based on ${getGlobalSourcePlanLabel(plan)}`">
                      <i class="fa-solid fa-diagram-project"></i>
                      Based on {{ getGlobalSourcePlanLabel(plan) }}
                    </span>
                    <span v-if="plan.updatedAtLabel"><i class="fa-solid fa-calendar"></i> {{ plan.updatedAtLabel }}</span>
                  </div>
                </div>
              </div>
              <div class="wl-plan__right" @click.stop>
                <span v-if="expandedPlanId === String(plan.planId)" class="wl-plan__selected-badge">
                  <i class="fa-solid fa-circle-check"></i> Selected
                </span>
                <button
                  v-if="expandedPlanId === String(plan.planId)"
                  type="button"
                  class="wl-btn-reorder"
                  :aria-expanded="isReorderPanelOpen(plan.planId) ? 'true' : 'false'"
                  @click="toggleReorderPanel(plan.planId)"
                >
                  <i class="fa-solid fa-arrows-up-down"></i>
                  Reorder
                </button>
                <button
                  type="button"
                  class="wl-btn-edit"
                  @click="openInBuilder(plan.planId)"
                  title="Edit Plan"
                  aria-label="Edit Plan"
                >
                  <i class="fa-solid fa-pencil" aria-hidden="true"></i>
                </button>
                <button
                  v-if="canDeleteWorkoutPlan(plan)"
                  type="button"
                  class="wl-btn-plan-delete"
                  @click="deleteWorkoutPlan(plan)"
                  title="Delete Plan"
                  aria-label="Delete Plan"
                >
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>

                <div class="wl-plan-mobile-actions" :class="{ 'wl-plan-mobile-actions--open': isPlanActionMenuOpen(plan.planId) }">
                  <button
                    type="button"
                    class="wl-plan-mobile-actions__trigger"
                    aria-label="Open plan actions"
                    :aria-expanded="isPlanActionMenuOpen(plan.planId) ? 'true' : 'false'"
                    @click.stop="togglePlanActionMenu(plan.planId)"
                  >
                    <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
                  </button>

                  <div
                    v-if="isPlanActionMenuOpen(plan.planId)"
                    class="wl-plan-mobile-actions__menu"
                    role="menu"
                    aria-label="Workout plan actions"
                    @click.stop
                  >
                    <button
                      type="button"
                      class="wl-plan-mobile-actions__item"
                      role="menuitem"
                      @click="handlePlanMenuReorder(plan)"
                    >
                      <i class="fa-solid fa-arrows-up-down" aria-hidden="true"></i>
                      <span>Reorder</span>
                    </button>

                    <button
                      type="button"
                      class="wl-plan-mobile-actions__item"
                      role="menuitem"
                      @click="handlePlanMenuEdit(plan)"
                    >
                      <i class="fa-solid fa-pencil" aria-hidden="true"></i>
                      <span>Edit Plan</span>
                    </button>

                    <button
                      v-if="canDeleteWorkoutPlan(plan)"
                      type="button"
                      class="wl-plan-mobile-actions__item wl-plan-mobile-actions__item--danger"
                      role="menuitem"
                      @click="handlePlanMenuDelete(plan)"
                    >
                      <i class="fa-solid fa-trash" aria-hidden="true"></i>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Expanded: day cards -->
            <div v-if="expandedPlanId === String(plan.planId)" class="wl-plan__body">
              <div v-if="expandedLoading" class="wl-plan__loading">Loading days…</div>

              <div v-else-if="!expandedPlanData || exercisesByGroup.length === 0" class="wl-plan__loading wl-plan__loading--empty-state">
                <p class="wl-plan__empty-message">No scheduled days found.</p>
                <button
                  type="button"
                  class="wl-plan__empty-open-builder-btn"
                  @click="openInBuilder(plan.planId)"
                >
                  Open in Builder
                </button>
              </div>

              <div
                v-else
                class="wl-day-grid"
                :class="{ 'wl-day-grid--reorder-open': isReorderPanelOpen(plan.planId) }"
              >
                <div
                  class="wl-day-order-collapsible"
                  :class="{ 'wl-day-order-collapsible--open': isReorderPanelOpen(plan.planId) }"
                >
                  <div class="wl-day-order-toolbar workout-log-order-toolbar app-section-card">
                    <label class="wl-day-order-toggle">
                      <input
                        type="checkbox"
                        :checked="currentDayOrderState?.useCustomWorkoutLogOrder === true"
                        @change="toggleCustomWorkoutLogOrder($event.target.checked)"
                      />
                      <span>Use Custom Order</span>
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
                    <p class="wl-day-order-helper">
                      Enable custom order, then use Move Up/Down on each workout day card.
                    </p>
                    <p v-if="currentDayOrderState?.error" class="wl-day-order-error">
                      {{ currentDayOrderState.error }}
                    </p>
                  </div>
                </div>
                <article
                  v-for="group in exercisesByGroup"
                  :key="group.name"
                  class="wl-day-card app-section-card"
                >
                  <!-- Day card header -->
                  <div class="wl-day-card__header">
                    <div class="wl-day-card__title">
                      <i class="fa-solid fa-calendar-day wl-day-icon"></i>
                      <h4>{{ group.name }}</h4>
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

                  <!-- Exercise preview summary -->
                  <p
                    class="wl-day-card__ex-summary"
                    :title="group.exerciseNameSummary || undefined"
                    :aria-label="group.exerciseNameSummary ? `Exercises: ${group.exerciseNameSummary}` : 'No exercises listed'"
                  >
                    {{ group.exerciseNameSummary || 'No exercises listed' }}
                  </p>

                  <!-- Action -->
                  <div class="wl-day-card__footer">
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
      <div v-show="activeTab === 'dayDetails'" class="wl-tab-panel wl-tab-panel--day-details">

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
              <div class="wl-day-detail-header__meta">
                <span class="wl-progress-label">{{ totalCompleted }} / {{ totalSets }} sets ({{ progressPct }}%)</span>
                <span v-if="activeSession && hasActiveWorkout" class="wl-workout-time">
                  <i class="fa-solid fa-stopwatch"></i>
                  Workout Time: <strong>{{ activeWorkoutTimerLabel }}</strong>
                  <span v-if="workoutTimerPaused" class="wl-workout-time__paused">Paused</span>
                </span>
              </div>
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

          <div v-if="hasActiveWorkout && activeSession && !isPreviewMode" class="wl-bottom-bar">
            <div class="wl-bottom-bar__inner">
              <span class="wl-bottom-bar__label">{{ totalCompleted }} / {{ totalSets }} sets done</span>
              <div class="wl-bottom-bar__actions">
                <button type="button" class="wl-btn-add-exercise" :disabled="saving || exerciseLibraryLoading || exerciseAddLoading" @click="openAddExercisePicker">
                  <i v-if="exerciseLibraryLoading || exerciseAddLoading" class="fa-solid fa-spinner fa-spin"></i>
                  <i v-else class="fa-solid fa-dumbbell"></i>
                  <span>{{ exerciseAddLoading ? 'Adding…' : 'Add Exercise' }}</span>
                </button>
                <button type="button" class="wl-btn-complete" :disabled="saving" @click="completeWorkout">
                  <i class="fa-solid fa-flag-checkered"></i>
                  {{ saving ? 'Saving…' : 'Complete & End Workout' }}
                </button>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="wl-empty app-section-card">
          <i class="fa-solid fa-dumbbell wl-empty-icon"></i>
          <h6>{{ activeSessions.length ? 'Current workout unavailable' : 'No workout in progress' }}</h6>
          <p v-if="activeSessions.length">
            {{ selectedDay || 'The latest unfinished workout' }} could not be restored from its saved workout details.
          </p>
          <p v-else>Choose a workout day to begin your next session.</p>
          <button type="button" class="wl-btn" @click="activeTab = 'overview'">Start My Workout</button>
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
          <div
            v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.history"
            class="wl-error-diag"
          >
            <button type="button" class="wl-error-diag__toggle" @click="toggleDiagnostics('history')">
              {{ diagnosticsExpandedByArea.history ? 'Hide details' : 'Show details' }}
            </button>
            <dl v-if="diagnosticsExpandedByArea.history" class="wl-error-diag__list">
              <div><dt>Status</dt><dd>{{ errorDiagnosticsByArea.history.status }}</dd></div>
              <div><dt>Code</dt><dd>{{ errorDiagnosticsByArea.history.code }}</dd></div>
              <div><dt>Request ID</dt><dd>{{ errorDiagnosticsByArea.history.requestId }}</dd></div>
              <div><dt>Service</dt><dd>{{ errorDiagnosticsByArea.history.service }}</dd></div>
              <div><dt>Time</dt><dd>{{ errorDiagnosticsByArea.history.timestamp }}</dd></div>
            </dl>
          </div>
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
                <span v-if="getHistorySessionDurationSeconds(session) > 0">
                  <i class="fa-solid fa-stopwatch"></i>
                  Workout Time: {{ formatDurationHms(getHistorySessionDurationSeconds(session)) }}
                </span>
                <!-- Edit mode: Save + Cancel -->
                <template v-if="editingHistorySessionId === session.sessionId">
                  <span v-if="historySaveError" class="wl-hist-save-error">
                    <i class="fa-solid fa-circle-xmark"></i> {{ historySaveError }}
                    <button
                      v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.historySave"
                      type="button"
                      class="wl-error-diag__toggle wl-error-diag__toggle--inline"
                      @click="toggleDiagnostics('historySave')"
                    >
                      {{ diagnosticsExpandedByArea.historySave ? 'Hide details' : 'Show details' }}
                    </button>
                    <span
                      v-if="canShowTechnicalDiagnostics && diagnosticsExpandedByArea.historySave && errorDiagnosticsByArea.historySave"
                      class="wl-hist-save-error__details"
                    >
                      Status {{ errorDiagnosticsByArea.historySave.status }} | Code {{ errorDiagnosticsByArea.historySave.code }} | Request {{ errorDiagnosticsByArea.historySave.requestId }}
                    </span>
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
                        <span>Set</span><span>Weight (lbs)</span><span>Reps</span><span>Done</span>
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

    <ExercisePickerModal
      :is-open="addExercisePickerOpen"
      :exercises="exerciseLibrary"
      :user-id="sessionUserId"
      @close="closeAddExercisePicker"
      @add="addExerciseToActiveWorkout"
    />
    <Teleport to="body">
      <div v-if="showWorkoutConflictModal" class="wl-modal-overlay wl-conflict-overlay">
        <div class="wl-modal wl-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="workout-conflict-title">
          <div class="wl-modal__header wl-conflict-modal__header">
            <h5 id="workout-conflict-title">
              <i class="fa-solid fa-clock-rotate-left"></i> Previous Workout Found
            </h5>
            <button
              type="button"
              class="wl-modal__close"
              aria-label="Close previous workout dialog"
              :disabled="conflictModalLoading"
              @click="closeWorkoutConflictModal"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <div class="wl-modal__body wl-conflict-modal__body">
            <p class="wl-conflict-modal__message">
              You have an unfinished workout. Would you like to continue it or end your previous workouts and start a new one?
            </p>

            <div v-if="workoutConflictSession" class="wl-conflict-summary">
              <div v-if="workoutConflictSession.workoutPlanName" class="wl-conflict-summary__plan">
                {{ workoutConflictSession.workoutPlanName }}
              </div>
              <div class="wl-conflict-summary__day">{{ workoutConflictSession.workoutDayName || 'Workout' }}</div>
              <div class="wl-conflict-summary__meta">
                <span><i class="fa-regular fa-calendar" aria-hidden="true"></i>{{ formatConflictSessionDate(workoutConflictSession.workoutDate) }}</span>
                <span class="wl-conflict-summary__status"><i class="fa-solid fa-circle" aria-hidden="true"></i>In Progress</span>
              </div>
            </div>

            <div v-if="conflictModalError" class="wl-banner wl-banner--error wl-conflict-modal__error" role="alert">
              <i class="fa-solid fa-circle-xmark"></i> {{ conflictModalError }}
            </div>
          </div>
          <div class="wl-modal__footer wl-conflict-modal__actions">
            <button
              type="button"
              class="wl-conflict-action wl-conflict-action--continue"
              :disabled="conflictModalLoading || !canContinueConflictSession"
              @click="continuePreviousWorkout"
            >
              <i class="fa-solid fa-circle-play"></i>
              <span>{{ conflictModalLoading ? 'Please wait…' : 'Continue Previous' }}</span>
            </button>
            <button
              type="button"
              class="wl-conflict-action wl-conflict-action--start"
              :disabled="conflictModalLoading || !workoutConflictSession"
              @click="startNewWorkoutAfterConflict"
            >
              <i class="fa-solid fa-play"></i>
              <span>{{ conflictModalLoading ? 'Please wait…' : 'Exit & Start New' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
              <div
                v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.deleteHistory"
                class="wl-error-diag"
              >
                <button type="button" class="wl-error-diag__toggle" @click="toggleDiagnostics('deleteHistory')">
                  {{ diagnosticsExpandedByArea.deleteHistory ? 'Hide details' : 'Show details' }}
                </button>
                <dl v-if="diagnosticsExpandedByArea.deleteHistory" class="wl-error-diag__list">
                  <div><dt>Status</dt><dd>{{ errorDiagnosticsByArea.deleteHistory.status }}</dd></div>
                  <div><dt>Code</dt><dd>{{ errorDiagnosticsByArea.deleteHistory.code }}</dd></div>
                  <div><dt>Request ID</dt><dd>{{ errorDiagnosticsByArea.deleteHistory.requestId }}</dd></div>
                  <div><dt>Service</dt><dd>{{ errorDiagnosticsByArea.deleteHistory.service }}</dd></div>
                  <div><dt>Time</dt><dd>{{ errorDiagnosticsByArea.deleteHistory.timestamp }}</dd></div>
                </dl>
              </div>
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
.wl-page {
  --mobile-bottom-nav-height: 0px;
  padding-bottom: 100px;
}

/* ── Hero ──────────────────────────────────────────────────────────────── */
.builder-hero__content {
  display: flex; justify-content: space-between; align-items: center;
  gap: 16px; flex-wrap: wrap;
}
.builder-hero__text h2 { margin: 0 0 4px; }
.builder-hero__subtitle { margin: 0; opacity: 0.85; font-size: 0.92rem; }

.wl-error-diag {
  margin-top: 8px;
}

.wl-error-diag--inline {
  margin: 6px 0 10px;
}

.wl-error-diag__toggle {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.28);
  color: #e2e8f0;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 0.76rem;
  cursor: pointer;
}

.wl-error-diag__toggle--inline {
  margin-left: 8px;
}

.wl-error-diag__list {
  margin: 8px 0 0;
  display: grid;
  gap: 4px;
  font-size: 0.76rem;
}

.wl-error-diag__list div {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.wl-error-diag__list dt {
  min-width: 76px;
  margin: 0;
  color: #cbd5e1;
  font-weight: 700;
}

.wl-error-diag__list dd {
  margin: 0;
  color: #f8fafc;
  overflow-wrap: anywhere;
}

.wl-hist-save-error__details {
  display: block;
  margin-top: 4px;
  font-size: 0.74rem;
  color: #fca5a5;
}

.wl-toolbar {
  display: flex; justify-content: flex-end; gap: 10px;
  margin-top: 12px; flex-wrap: wrap;
}

.wl-session-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
  padding: 6px 11px;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  border: 1px solid transparent;
}

.wl-session-status-badge--active {
  background: #dcfce7;
  color: #166534;
  border-color: #86efac;
}

.wl-session-status-badge--paused {
  background: #fff7ed;
  color: #9a3412;
  border-color: #fdba74;
}

.wl-day-order-toolbar {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  margin-top: 10px;
  margin-bottom: 10px;
  padding: 10px 12px;
}

.wl-day-order-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  font-size: 0.79rem;
  color: #f8fafc;
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
  align-items: center;
}

.wl-order-toolbar-btn {
  border-radius: 8px;
  padding: 7px 10px;
  min-height: 32px;
  font-size: 0.74rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;
  text-align: center;
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
  padding: 4px 8px;
  min-height: 28px;
  font-size: 0.68rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  line-height: 1;
  text-align: center;
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
.wl-btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}
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
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;
  margin: 0;
}
.wl-stat-card {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px; padding: 14px; display: grid; gap: 6px;
}
.wl-stat-card span   { color: var(--text-color-secondary, #6b7280); font-size: 0.82rem; }
.wl-stat-card strong { color: var(--text-color, #111827); font-size: 1.25rem; font-weight: 800; }
.wl-stats-section {
  margin-bottom: 14px;
  padding: 10px 12px;
  display: grid;
  gap: 10px;
}
.wl-stats-toggle {
  width: 100%;
  border: 1px solid rgba(145, 160, 200, 0.22);
  background: rgba(51, 65, 103, 0.88);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 14px;
  font-size: 0.98rem;
  font-weight: 800;
  cursor: pointer;
  border-radius: 10px;
  text-align: left;
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}
.wl-stats-toggle i {
  color: #ffffff;
  font-size: 0.94rem;
}
.wl-stats-toggle__title {
  display: inline-flex;
  align-items: center;
}
.wl-stats-toggle:hover {
  background: rgba(59, 74, 116, 0.94);
  border-color: rgba(145, 160, 200, 0.32);
}
.wl-stats-toggle:focus {
  outline: none !important;
  box-shadow: none !important;
}
.wl-stats-toggle:focus:not(:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}
.wl-stats-toggle:focus-visible {
  outline: none !important;
  border-color: rgba(148, 163, 184, 0.62);
  box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.28) !important;
}
.wl-stats-collapse-body {
  overflow: hidden;
  padding-top: 2px;
}
.wl-stats-collapse-enter-active,
.wl-stats-collapse-leave-active {
  transition: max-height 250ms ease, opacity 250ms ease;
}
.wl-stats-collapse-enter-from,
.wl-stats-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
.wl-stats-collapse-enter-to,
.wl-stats-collapse-leave-from {
  max-height: 320px;
  opacity: 1;
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */
.wl-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  margin-bottom: 20px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.wl-tabs.wa-h-tabs--tricolor > :nth-child(1):not(.wa-h-tab--active):not(.active):not([aria-selected="true"]) {
  background: #2563EB !important;
}
.wl-tabs.wa-h-tabs--tricolor > :nth-child(2):not(.wa-h-tab--active):not(.active):not([aria-selected="true"]) {
  background: #15803D !important;
}
.wl-tabs.wa-h-tabs--tricolor > :nth-child(3):not(.wa-h-tab--active):not(.active):not([aria-selected="true"]) {
  background: #8f1f2a !important;
}

.wl-tabs.wa-h-tabs--tricolor > :nth-child(1) { --wl-tab-assigned-bg: #2563EB; }
.wl-tabs.wa-h-tabs--tricolor > :nth-child(2) { --wl-tab-assigned-bg: #15803D; }
.wl-tabs.wa-h-tabs--tricolor > :nth-child(3) { --wl-tab-assigned-bg: #8f1f2a; }

.wl-tabs.wa-h-tabs--tricolor .wl-tab {
  background: var(--wl-tab-assigned-bg, #2563EB) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  filter: none !important;
}

.wl-tabs.wa-h-tabs--tricolor .wl-tab:hover,
.wl-tabs.wa-h-tabs--tricolor .wl-tab:focus,
.wl-tabs.wa-h-tabs--tricolor .wl-tab:focus-visible,
.wl-tabs.wa-h-tabs--tricolor .wl-tab:active,
.wl-tabs.wa-h-tabs--tricolor .wl-tab.active,
.wl-tabs.wa-h-tabs--tricolor .wl-tab.wa-h-tab--active,
.wl-tabs.wa-h-tabs--tricolor .wl-tab[aria-selected="true"] {
  background: var(--wl-tab-assigned-bg, #2563EB) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  filter: none !important;
}

.wl-tabs.wa-h-tabs--tricolor .wl-tab.wa-h-tab--active,
.wl-tabs.wa-h-tabs--tricolor .wl-tab.active,
.wl-tabs.wa-h-tabs--tricolor .wl-tab[aria-selected="true"] {
  box-shadow: inset 0 -2px 0 0 rgba(200, 221, 255, 0.95), 0 0 0 1px rgba(196, 220, 255, 0.28) !important;
  outline: 2px solid rgba(196, 220, 255, 0.55) !important;
  outline-offset: -2px !important;
}

.wl-tabs.wa-h-tabs--tricolor > :nth-child(1).wa-h-tab--active,
.wl-tabs.wa-h-tabs--tricolor > :nth-child(1).active,
.wl-tabs.wa-h-tabs--tricolor > :nth-child(1)[aria-selected="true"],
.wl-tabs.wa-h-tabs--tricolor > :nth-child(2).wa-h-tab--active,
.wl-tabs.wa-h-tabs--tricolor > :nth-child(2).active,
.wl-tabs.wa-h-tabs--tricolor > :nth-child(2)[aria-selected="true"],
.wl-tabs.wa-h-tabs--tricolor > :nth-child(3).wa-h-tab--active,
.wl-tabs.wa-h-tabs--tricolor > :nth-child(3).active,
.wl-tabs.wa-h-tabs--tricolor > :nth-child(3)[aria-selected="true"] {
  box-shadow: inset 0 -2px 0 0 rgba(200, 221, 255, 0.95), 0 0 0 1px rgba(196, 220, 255, 0.28) !important;
}
.wl-view-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 4px;
  padding: 4px;
  margin-bottom: 12px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.wl-view-switch.wa-h-tabs {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  align-items: stretch;
}
.wl-view-switch__link {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 48px;
  text-decoration: none;
  border: 1px solid transparent;
  margin-bottom: 0;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 7px;
  line-height: 1.12;
  white-space: nowrap;
  border-radius: 3px;
  color: #ffffff !important;
  transition: color 0.2s ease, background-color 0.2s ease, font-size 200ms ease;
}
.wl-view-switch__link::after {
  content: '';
  display: none;
}
.wl-view-switch__link i,
.wl-view-switch__link span {
  color: inherit;
}
.wl-view-switch__link--expanded {
  flex-basis: auto;
  max-width: 100%;
  width: 100%;
}
.wl-view-switch__link--compact {
  flex-basis: auto;
  max-width: 100%;
  width: 100%;
}
.wl-view-switch.wa-h-tabs .wl-view-switch__link--log {
  background: #1E305C !important;
}
.wl-view-switch.wa-h-tabs .wl-view-switch__link--exercises {
  background: #1E305C !important;
}
.wl-view-switch__link:hover {
  color: #ffffff !important;
  filter: brightness(1.06);
}
.wl-view-switch.wa-h-tabs .wl-view-switch__link--log.wl-view-switch__link--active {
  color: #ffffff !important;
  background: #15803D !important;
  font-size: 16px;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 0 rgba(255, 255, 255, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
}
.wl-view-switch.wa-h-tabs .wl-view-switch__link--exercises.wl-view-switch__link--active {
  color: #ffffff !important;
  background: #15803D !important;
  font-size: 16px;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 0 rgba(255, 255, 255, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
}
.wl-view-switch__link.wl-view-switch__link--active::after {
  content: 'ACTIVE';
  display: block;
  width: 100%;
  margin-top: 2px;
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: center;
  color: #ffffff;
}
@media (prefers-reduced-motion: reduce) {
  .wl-view-switch__link {
    transition: none;
  }
  .wl-stats-collapse-enter-active,
  .wl-stats-collapse-leave-active {
    transition: none;
  }
}
.wl-tab {
  flex: 1 1 0;
  min-width: 0;
  border: 1px solid transparent;
  margin-bottom: 0;
  padding: 9px 12px;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: filter 0.15s ease, box-shadow 0.15s ease;
  border-radius: 3px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.wl-tab--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wl-tab-badge {
  background: #dbeafe; color: #1d4ed8;
  border-radius: 999px; padding: 1px 9px;
  font-size: 0.72rem; font-weight: 800;
}

.wl-tab-active-badge,
.wl-tab-paused-badge,
.wl-tab-inactive-badge {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 0.69rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.wl-tab-active-badge {
  background: #dcfce7;
  color: #166534;
}

.wl-tab-paused-badge {
  background: #fff7ed;
  color: #9a3412;
}

.wl-tab-inactive-badge {
  background: #e2e8f0;
  color: #475569;
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
.wl-plan__source-tag {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 0.72rem;
  font-weight: 600;
}

.wl-plan__right {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 10px; flex-shrink: 0; flex-wrap: wrap;
}
.wl-plan__selected-badge {
  background: #dbeafe; color: #1d4ed8;
  border-radius: 999px; padding: 6px 11px;
  min-height: 30px;
  font-size: 0.75rem; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  text-align: center;
}
.wl-btn-edit {
  background: #f1f5f9; border: 1px solid #cbd5e1;
  color: #475569; border-radius: 8px; padding: 7px 12px;
  min-height: 30px; font-size: 0.8rem; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  text-align: center; transition: background 0.12s;
}
.wl-btn-edit:hover { background: #e0e7ef; }

.wl-btn-plan-delete {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #b91c1c;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: background 0.12s;
}

.wl-btn-plan-delete:hover {
  background: #ffe4e6;
}

.wl-plan__right .wl-btn-edit,
.wl-plan__right .wl-btn-plan-delete {
  width: 36px;
  min-width: 36px;
  height: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.wl-plan__right .wl-btn-edit {
  background: var(--wa-action-blue, #2f6bff);
  border: 1px solid var(--wa-action-blue, #2f6bff);
  color: #ffffff;
}

.wl-plan__right .wl-btn-edit:hover,
.wl-plan__right .wl-btn-edit:focus-visible {
  background: var(--wa-action-blue-hover, #2459d8);
  border-color: var(--wa-action-blue-hover, #2459d8);
  color: #ffffff;
}

.wl-plan__right .wl-btn-plan-delete {
  background: #dc2626;
  border: 1px solid #dc2626;
  color: #ffffff;
}

.wl-plan__right .wl-btn-plan-delete:hover,
.wl-plan__right .wl-btn-plan-delete:focus-visible {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #ffffff;
}

.wl-plan__right .wl-btn-edit i,
.wl-plan__right .wl-btn-plan-delete i {
  font-size: 0.95rem;
  line-height: 1;
}

.wl-btn-reorder {
  background: #eaf2ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 7px 11px;
  min-height: 30px;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  line-height: 1;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.wl-btn-reorder:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}

.wl-plan-mobile-actions {
  position: relative;
  display: none;
  flex-shrink: 0;
}

.wl-plan-mobile-actions__trigger {
  width: 36px;
  min-width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #31435f;
  background: #142033;
  color: #f8fafc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.wl-plan-mobile-actions__trigger i {
  font-size: 1rem;
  line-height: 1;
}

.wl-plan-mobile-actions__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 168px;
  max-width: min(220px, calc(100vw - 24px));
  z-index: 20;
  border: 1px solid #2f4261;
  border-radius: 10px;
  background: #0f1f38;
  box-shadow: 0 12px 20px rgba(2, 6, 23, 0.35);
  overflow: hidden;
}

.wl-plan-mobile-actions__item {
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid rgba(100, 116, 139, 0.25);
  background: #0f1f38;
  color: #f8fafc;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  text-align: left;
  font-size: 0.83rem;
  font-weight: 700;
  cursor: pointer;
}

.wl-plan-mobile-actions__item:last-child {
  border-bottom: 0;
}

.wl-plan-mobile-actions__item i {
  width: 18px;
  text-align: center;
  color: #93c5fd;
}

.wl-plan-mobile-actions__item--danger i,
.wl-plan-mobile-actions__item--danger {
  color: #fecaca;
}

.wl-plan-mobile-actions__item:hover,
.wl-plan-mobile-actions__item:focus-visible {
  background: #1b2d4c;
  outline: none;
}

.wl-day-order-collapsible {
  grid-column: 1 / -1;
}

.wl-day-order-helper {
  margin: 0;
  font-size: 0.7rem;
  color: #cbd5e1;
}

.wl-day-order-collapsible {
  width: 100%;
  grid-column: 1 / -1;
}

.wl-plan__body { border-top: 1px solid var(--border-color, #e5e7eb); padding: 16px 18px; }
.wl-plan__loading { color: var(--text-color-secondary, #6b7280); font-size: 0.88rem; padding: 8px 0; }

.wl-plan__loading--empty-state {
  display: grid;
  justify-items: center;
  align-items: start;
}

.wl-plan__empty-message {
  margin: 0;
}

.wl-plan__empty-open-builder-btn {
  margin-top: 8px;
  background: #2563eb;
  color: #ffffff;
  border: 0;
  border-radius: 4px !important;
  padding: 8px 12px;
  width: auto !important;
  height: auto !important;
  min-height: 44px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  font-size: 0.83rem;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  white-space: normal;
  text-align: center;
}

.wl-plan__empty-open-builder-btn:hover,
.wl-plan__empty-open-builder-btn:focus-visible {
  background: #1d4ed8;
}

/* ── Day cards grid ─────────────────────────────────────────────────────── */
.wl-day-grid { display: grid; gap: 14px; }

.wl-day-card {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px; padding: 12px 14px; background: #fff;
  display: grid; gap: 8px; transition: border-color 0.15s, box-shadow 0.15s;
}
.wl-day-card__header  { display: grid; gap: 8px; }
.wl-day-card__title   { display: flex; align-items: center; gap: 10px; }
.wl-day-card__title h4 {
  margin: 0; font-size: 1rem; font-weight: 800;
  color: var(--text-color, #111827); flex: 1;
}
.wl-day-icon { color: #3b82f6; }
.wl-day-card__meta {
  display: flex; gap: 12px; flex-wrap: wrap;
  color: var(--text-color-secondary, #6b7280); font-size: 0.8rem;
  align-items: center;
}
.wl-day-card__meta span { display: flex; align-items: center; gap: 4px; }
.wl-day-card__meta i    { color: #3b82f6; }

.wl-day-card__ex-summary {
  margin: 0;
  border-top: 1px solid var(--border-color, #f3f4f6);
  padding-top: 7px;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-color-secondary, #6b7280);
  white-space: normal;
  overflow-wrap: anywhere;
}

.wl-day-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

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

/* ── Day Details tab ────────────────────────────────────────────────────── */
.wl-day-detail-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  padding: 16px; background: var(--panel-bg, #f8fafc);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px; margin-bottom: 16px;
}
.wl-day-detail-header__left  { display: flex; align-items: center; gap: 12px; min-width: 0; }
.wl-day-detail-header__left h4 { margin: 0; font-size: 1rem; font-weight: 800; }
.wl-day-detail-count {
  background: #dbeafe; color: #1d4ed8;
  border-radius: 999px; padding: 2px 10px;
  font-size: 0.75rem; font-weight: 700;
}
.wl-day-detail-header__progress {
  display: grid;
  gap: 8px;
  width: 100%;
  margin: 0 auto;
}
.wl-day-detail-header__meta {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  text-align: center;
}

.wl-progress-bar {
  height: 8px; background: #e5e7eb;
  border-radius: 999px; overflow: hidden;
}
.wl-progress-fill {
  height: 100%; background: #22c55e;
  border-radius: 999px; transition: width 0.35s ease;
}
.wl-progress-label { color: var(--text-color-secondary, #6b7280); font-size: 0.78rem; }
.wl-workout-time {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 700;
}
.wl-workout-time strong { color: #ffffff; }
.wl-workout-time i { color: #2563eb; }
.wl-exercise-list  { display: grid; gap: 12px; }

.wl-tab-session-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.2);
  color: #bbf7d0;
  font-size: 0.7rem;
  font-weight: 800;
}

.wl-active-sessions {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid var(--wl-border, rgba(148, 163, 184, 0.24));
  border-radius: 10px;
  background: var(--wl-surface-1, #1b2444);
}

.wl-active-sessions__heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.wl-active-sessions__heading h4,
.wl-active-sessions__heading p { margin: 0; }
.wl-active-sessions__heading h4 { color: #ffffff; font-size: 0.95rem; }
.wl-active-sessions__heading p { color: #94a3b8; font-size: 0.76rem; margin-top: 2px; }
.wl-active-sessions__heading > span { color: #cbd5e1; font-size: 0.75rem; white-space: nowrap; }

.wl-active-sessions__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 8px;
}

.wl-active-session {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: #111b2e;
}

.wl-active-session--selected { border-color: rgba(74, 222, 128, 0.6); }
.wl-active-session__details { display: grid; gap: 2px; min-width: 0; }
.wl-active-session__details strong { color: #ffffff; overflow-wrap: anywhere; }
.wl-active-session__details span { color: #cbd5e1; font-size: 0.76rem; }
.wl-active-session__details small { color: #94a3b8; font-size: 0.7rem; text-transform: capitalize; }
.wl-active-session__resume {
  min-width: 88px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 700;
}
.wl-active-session__resume:disabled { opacity: 0.5; cursor: not-allowed; }
.wl-active-session__unavailable { grid-column: 1 / -1; color: #fca5a5; font-size: 0.7rem; }

/* ── Workout actions (in-flow) ──────────────────────────────────────────── */
.wl-bottom-bar {
  position: static;
  margin-top: 12px;
  margin-bottom: 0;
  padding: 12px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  background: rgba(255,255,255,0.96);
}
.wl-bottom-bar__inner {
  max-width: 960px;
  margin: 0 auto;
  display: grid; align-items: center; gap: 8px;
}
.wl-bottom-bar__label   { font-size: 0.88rem; font-weight: 700; color: var(--text-color, #111827); }

.wl-bottom-bar__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
  align-items: center;
  gap: 8px;
}

.wl-btn-add-exercise {
  background: #2563eb;
  border: none;
  color: #fff;
  border-radius: 10px;
  min-height: 44px;
  padding: 10px 14px;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 0.15s;
  white-space: nowrap;
}

.wl-btn-add-exercise i { color: #fff; }
.wl-btn-add-exercise:hover:not(:disabled),
.wl-btn-add-exercise:active:not(:disabled) { background: #1d4ed8; }
.wl-btn-add-exercise:disabled { opacity: 0.6; cursor: not-allowed; }

.wl-btn-complete {
  background: #dc2626; border: none; color: #fff;
  min-height: 44px;
  border-radius: 10px; padding: 10px 18px;
  font-size: 0.88rem; font-weight: 800; cursor: pointer;
  width: 100%;
  display: flex; align-items: center; justify-content: center; gap: 7px;
  transition: background 0.15s;
}
.wl-btn-complete i { color: #fff; }
.wl-btn-complete:hover:not(:disabled),
.wl-btn-complete:active:not(:disabled) { background: #b91c1c; }
.wl-btn-complete:disabled { opacity: 0.6; cursor: not-allowed; }

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

.wl-tab-panel .wl-history-datebar,
.wl-tab-panel .wl-history-datebar span,
.wl-tab-panel .wl-history-datebar strong {
  color: #ffffff;
}

.wl-tab-panel .wl-empty.app-section-card {
  color: #cbd5e1;
}
.wl-tab-panel .wl-empty.app-section-card h6 {
  color: #ffffff;
  font-weight: 600;
}
.wl-tab-panel .wl-empty.app-section-card p,
.wl-tab-panel .wl-empty.app-section-card p strong {
  color: #cbd5e1;
}
.wl-tab-panel .wl-empty.app-section-card p strong {
  color: #ffffff;
}

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
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border: 1px solid var(--wa-btn-danger-border, #dc2626);
  border-radius: 5px;
  background: var(--wa-btn-danger, #3b1d2b);
  color: #ffffff;
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.wl-modal__close:hover {
  background: var(--wa-btn-danger-hover, #512334);
  border-color: var(--wa-btn-danger-border, #dc2626);
}

.wl-modal__close:focus-visible {
  outline: none;
  box-shadow: var(--wa-btn-danger-focus, 0 0 0 4px rgba(220, 38, 38, 0.24));
}

@media (max-width: 640px) {
  .wl-modal__close {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
  }
}
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

/* ── Previous workout conflict modal ───────────────────────────────────── */
.wl-conflict-overlay {
  padding: 8px;
}

.wl-conflict-modal {
  width: min(100%, 420px);
  max-height: calc(100dvh - 16px);
  overflow: hidden;
  background: #111827;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f8fafc;
}

.wl-conflict-modal__header {
  flex-shrink: 0;
  padding: 12px 12px 10px;
  gap: 8px;
  background: #0f172a;
  border-color: #334155;
}

.wl-conflict-modal__header h5 {
  min-width: 0;
  color: #f8fafc;
  font-size: 0.96rem;
  line-height: 1.25;
}

.wl-conflict-modal__header h5 i {
  color: #2563eb;
}

.wl-conflict-modal .wl-modal__close,
.wl-conflict-modal .wl-modal__close:hover,
.wl-conflict-modal .wl-modal__close:focus {
  position: relative;
  z-index: 2;
  border-radius: 4px !important;
  background: #3f151b;
  border-color: #7f1d1d;
  color: #f87171;
}

.wl-conflict-modal .wl-modal__close:hover,
.wl-conflict-modal .wl-modal__close:focus {
  background: #4c1820;
  border-color: #ef4444;
}

.wl-conflict-modal .wl-modal__close i {
  color: #f87171;
  pointer-events: none;
}

.wl-conflict-modal__body {
  min-height: 0;
  padding: 12px;
  color: #e2e8f0;
}

.wl-conflict-modal__message {
  margin: 0 0 10px;
  font-size: 0.86rem;
  line-height: 1.45;
}

.wl-conflict-summary {
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 1px solid #334155;
  border-radius: 7px;
  background: #1e293b;
}

.wl-conflict-summary__plan {
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.2;
  text-transform: uppercase;
}

.wl-conflict-summary__day {
  overflow-wrap: anywhere;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 800;
  line-height: 1.25;
}

.wl-conflict-summary__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: #cbd5e1;
  font-size: 0.75rem;
  line-height: 1.3;
}

.wl-conflict-summary__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.wl-conflict-summary__status {
  color: #4ade80;
  font-weight: 800;
}

.wl-conflict-summary__status i {
  font-size: 0.5rem;
}

.wl-conflict-modal__error {
  margin-top: 10px;
}

.wl-conflict-modal__actions {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 10px 12px 12px;
  background: #0f172a;
  border-color: #334155;
}

.wl-conflict-action {
  width: 100%;
  min-width: 0;
  min-height: 46px;
  padding: 8px 6px;
  border: 1px solid transparent;
  border-radius: 7px;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 0.76rem;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.wl-conflict-action--continue {
  background: #2563eb;
  border-color: #1d4ed8;
}

.wl-conflict-action--start {
  background: #15803d;
  border-color: #166534;
}

.wl-conflict-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.wl-workout-time__paused {
  margin-left: 4px;
  color: #fbbf24;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
}

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
  background: linear-gradient(135deg, #0f2561 0%, #112463 42%, #1b2444 100%) !important;
  border: 1px solid var(--wl-border);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
}

.wl-page .wl-date-input {
  background: var(--wl-surface-1);
  border-color: var(--wl-border-strong);
  color: var(--wl-text);
}

.wl-page .wl-date-input::-webkit-calendar-picker-indicator {
  filter: brightness(0) invert(1);
  opacity: 1;
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
.wl-page .wl-btn-complete {
  background: #dc2626;
}

.wl-page .wl-btn-add-exercise {
  background: #2563eb;
}

.wl-page .wl-btn--active:hover,
.wl-page .wl-btn-complete:hover {
  background: #b91c1c;
}

.wl-page .wl-btn-add-exercise:hover {
  background: #1d4ed8;
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
.wl-page .wl-day-card__ex-summary,
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
  margin-bottom: 20px;
}

.wl-page .wl-tab {
  border-radius: 3px;
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

.wl-page .wl-day-card__ex-summary,
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

.wl-page .wl-day-card__footer .wl-btn-preview {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.wl-page .wl-day-card__footer .wl-btn-preview i {
  color: #ffffff;
}

.wl-page .wl-day-card__footer .wl-btn-preview:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #ffffff;
}

.wl-page .wl-day-card__footer .wl-btn-preview:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}

.wl-page .wl-order-toolbar-btn--save:hover,
.wl-page .wl-btn-start:hover,
.wl-page .wl-hist-save-btn:hover:not(:disabled) {
  background: #166534;
}

.wl-page .wl-custom-order-badge {
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

.wl-page :deep(.c3-row-done) {
  background: var(--wl-surface-1) !important;
}

.wl-page :deep(.sec-meta p),
.wl-page :deep(.set-num),
.wl-page :deep(.sec-sets-summary),
.wl-page :deep(.c3-col-set),
.wl-page :deep(.c3-col-info) {
  color: #cbd5e1;
}

.wl-page :deep(.sec-meta h5),
.wl-page :deep(.c3-set-num),
.wl-page :deep(.c3-col-value),
.wl-page :deep(.c3-btn-label) {
  color: #ffffff;
}

.wl-page :deep(.c3-head span),
.wl-page :deep(.sec-summary) {
  color: #cbd5e1;
}

.wl-page :deep(.sec-prefill-note) {
  color: #94a3b8;
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
  color: var(--wl-text);
  border-radius: 8px;
}

.wl-page :deep(.sec-select-btn),
.wl-page :deep(.add-set-btn) {
  border-color: color-mix(in srgb, var(--wl-accent) 45%, var(--wl-border) 55%);
  color: #ffffff;
}

.wl-page :deep(.set-input),
.wl-page :deep(.set-input--prefilled) {
  background: #111b2e !important;
  color: #ffffff !important;
}

.wl-page :deep(.exercise-collapse-btn) {
  width: 30px;
  height: 30px;
  min-width: 30px;
  padding: 0;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(96, 165, 250, 0.4);
  background: rgba(15, 23, 42, 0.55);
  color: #60a5fa;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.wl-page :deep(.exercise-collapse-btn:hover) {
  background: rgba(30, 64, 175, 0.26);
  border-color: rgba(96, 165, 250, 0.62);
  color: #93c5fd;
}

.wl-page :deep(.exercise-collapse-btn:active) {
  transform: translateY(0);
  background: rgba(37, 99, 235, 0.3);
}

.wl-page :deep(.exercise-collapse-btn:focus-visible) {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.24);
}

.wl-page :deep(.exercise-collapse-btn.sec-select-btn--active) {
  border-color: rgba(96, 165, 250, 0.68);
  background: rgba(30, 64, 175, 0.36);
  color: #bfdbfe;
}

.wl-page :deep(.exercise-collapse-btn i) {
  transition: transform 0.22s ease;
}

.wl-page :deep(.exercise-collapse-btn.is-collapsed i) {
  transform: rotate(180deg);
}

.wl-page :deep(.set-input::placeholder) {
  color: #94a3b8;
}

.wl-page :deep(.c3-rm-btn) {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(239, 68, 68, 0.14);
}

.wl-page :deep(.c3-complete-btn),
.wl-page :deep(.c3-finish-btn) {
  background: #16a34a;
  border-color: #15803d;
  color: #ffffff;
}

.wl-page :deep(.c3-complete-btn:hover),
.wl-page :deep(.c3-finish-btn:hover) {
  background: #15803d;
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

/* ── v0.84.68.5 Mobile — Workout Log Compact Rework ──────────────────────── */
@media (max-width: 768px) {
  :global(html:not(.wa-mobile-menu-open):not(.overflow-hidden)) {
    height: auto !important;
    min-height: 100%;
    overflow-y: auto !important;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  }

  :global(body.wa-workout-log-active:not(.wa-mobile-menu-open)) {
    height: auto !important;
    min-height: 100%;
    overflow-x: clip !important;
    overflow-y: visible !important;
    touch-action: pan-y;
  }

  :global(body.wa-workout-log-active:not(.wa-mobile-menu-open) #app),
  :global(body.wa-workout-log-active:not(.wa-mobile-menu-open) .body-padding),
  :global(body.wa-workout-log-active:not(.wa-mobile-menu-open) .main-content) {
    height: auto !important;
    min-height: 0;
    overflow-x: clip !important;
    overflow-y: visible !important;
  }

  :global(body.wa-workout-log-active:not(.wa-mobile-menu-open) .main-content) {
    touch-action: pan-y;
  }

  .wl-page {
    --mobile-bottom-nav-height: max(
      76px,
      calc(var(--wa-mobile-bottom-nav-height, 0px) + var(--wa-mobile-bottom-nav-gap, 0px))
    );
    --wl-page-bottom-clearance: calc(
      var(--mobile-bottom-nav-height, 0px) +
      env(safe-area-inset-bottom) +
      24px
    );
    padding-bottom: var(--wl-page-bottom-clearance);
    overflow-x: clip !important;
    overflow-y: visible !important;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  }

  .wl-tab-panel--day-details {
    padding-bottom: var(--wl-page-bottom-clearance);
  }

  .wl-bottom-bar__inner {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    align-items: center;
  }

  .wl-bottom-bar__label {
    font-size: 0.68rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Global density */
  .workout-log-mobile .app-page-canvas { gap: 6px; }
  .wl-exercise-list { gap: 6px; }
  .wl-accordion      { gap: 6px; }
  .wl-history-list   { gap: 6px; }
  .wl-day-grid       { gap: 6px; }

  /* Hero: compact padding, no glow */
  .builder-hero {
    padding: 10px 12px;
    gap: 6px;
    border-radius: 12px;
    min-height: auto;
    box-shadow: none;
  }
  .builder-hero__content { gap: 3px; }

  /* Title + date row: side-by-side, subtitle hidden */
  .wl-hero-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .builder-hero__text h2 { font-size: 0.88rem; margin: 0; }
  .builder-hero__subtitle { display: none; }

  /* Date picker: small pill */
  .wl-date-input {
    width: auto;
    min-width: 92px;
    height: 30px;
    padding: 3px 7px;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* Header action buttons: short pills, same height */
  .wl-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-top: 6px;
  }
  .wl-toolbar .wl-btn {
    height: 32px;
    min-height: 32px;
    font-size: 10px;
    padding: 0 6px;
    border-radius: 999px;
    line-height: 1;
    gap: 3px;
    justify-content: center;
    box-shadow: none;
  }
  .wl-toolbar .wl-btn i { font-size: 10px; }

  /* Stat cards: compact */
  .wl-stats {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    margin: 0;
  }
  .wl-stats-section {
    padding: 8px 10px;
    margin-bottom: 8px;
    gap: 8px;
  }
  .wl-stats-toggle {
    font-size: 0.84rem;
    padding: 10px 11px;
  }
  .wl-stat-card {
    min-height: 44px;
    padding: 5px 6px;
    gap: 1px;
    border-radius: 9px;
    align-content: center;
    box-shadow: none;
  }
  .wl-stat-card span   { font-size: 0.56rem; }
  .wl-stat-card strong { font-size: 0.78rem; }

  /* Tabs stay horizontal and compact on mobile via shared wa-h-tabs styling. */
  .wl-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    white-space: normal;
    flex-wrap: initial;
    max-width: 100%;
    gap: 1px;
    padding: 1px;
    margin-bottom: 6px;
    overflow: hidden;
    border-radius: 9px;
  }
  .wl-tab {
    min-width: 0;
    min-height: 30px;
    padding: 3px 3px;
    font-size: 0.6rem;
    gap: 2px;
    margin-bottom: 0;
    justify-content: center;
    text-align: center;
    border: 1px solid transparent;
    border-radius: 6px;
    white-space: normal;
    line-height: 1.05;
  }
  .wl-tab i { font-size: 0.62rem; }
  .wl-tab--disabled {
    opacity: 0.5;
  }
  /* Remove the day badge/text from the tab row entirely on mobile */
  .wl-tab-badge { display: none; }

  /* Plan card: tight spacing, small pill badges, no glow */
  .wl-plan { border-radius: 10px; }
  .wl-plan--expanded { box-shadow: none; }
  .wl-plan__header  { padding: 8px 10px; gap: 6px; }
  .wl-plan__left    { gap: 8px; }
  .wl-plan__chevron { font-size: 0.7rem; width: 16px; }
  .wl-plan__info    { gap: 2px; }
  .wl-plan__name    { font-size: 0.76rem; }
  .wl-plan__meta    { font-size: 0.6rem; gap: 6px; }
  .wl-plan__tag     { padding: 0 6px; font-size: 0.58rem; }
  .wl-plan__body    { padding: 6px 8px; }
  .wl-plan__loading { font-size: 0.72rem; padding: 6px 0; }
  .wl-plan__right   { gap: 6px; }
  .wl-plan__selected-badge {
    padding: 1px 6px;
    font-size: 0.58rem;
    gap: 3px;
  }
  .wl-btn-reorder {
    min-height: 26px;
    padding: 3px 8px;
    font-size: 0.62rem;
    border-radius: 999px;
    gap: 3px;
    border-color: rgba(96, 165, 250, 0.45);
    background: #243244;
    color: #cbd5e1;
  }
  .wl-btn-reorder i {
    color: #60a5fa;
  }
  .wl-btn-reorder:hover,
  .wl-btn-reorder:focus-visible {
    background: #2b3d55;
    border-color: rgba(147, 197, 253, 0.6);
    color: #f8fafc;
  }
  .wl-btn-edit {
    min-height: 26px;
    padding: 3px 8px;
    font-size: 0.62rem;
    border-radius: 8px;
    gap: 3px;
  }
  .wl-btn-plan-delete {
    min-height: 26px;
    padding: 3px 8px;
    font-size: 0.62rem;
    border-radius: 8px;
    gap: 3px;
  }

  .wl-day-order-collapsible {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    margin: 0;
    transform: translateY(-2px);
    transition: max-height 0.2s ease, opacity 0.2s ease, transform 0.2s ease, margin 0.2s ease;
  }

  .wl-day-order-collapsible--open {
    max-height: 260px;
    opacity: 1;
    overflow: visible;
    margin: 0 0 2px;
    transform: translateY(0);
  }

  /* Day order toolbar: tighter */
  .wl-day-order-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
    align-items: center;
    justify-content: flex-start;
    padding: 0 4px;
    gap: 2px;
    margin-top: 0;
    margin-bottom: 0;
    min-height: 0;
  }
  .wl-day-order-toolbar.app-section-card {
    padding: 0 4px !important;
  }
  .wl-day-order-helper {
    font-size: 0.56rem;
    line-height: 1.15;
    margin-top: 1px;
  }
  .wl-day-order-toggle {
    font-size: 0.6rem;
    gap: 4px;
    line-height: 1.15;
  }
  .wl-day-order-toggle input { width: 12px; height: 12px; }
  .wl-custom-order-badge { font-size: 0.54rem; padding: 1px 6px; }
  .wl-day-order-actions {
    width: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    align-items: center;
    margin: 0;
  }
  .wl-order-toolbar-btn {
    min-height: 34px;
    height: 34px;
    padding: 0 10px;
    font-size: 0.62rem;
    border-radius: 999px;
    gap: 4px;
    line-height: 1;
    white-space: nowrap;
  }
  .wl-order-btn {
    padding: 0 5px;
    min-height: 18px;
    font-size: 0.54rem;
  }

  .wl-day-grid:not(.wl-day-grid--reorder-open) .wl-order-btn {
    display: none;
  }

  /* Workout day cards: smaller text, tighter rows, no glow */
  .wl-day-card {
    padding: 5px 7px 6px;
    gap: 4px;
    border-radius: 10px;
  }
  .wl-day-card__header   { gap: 4px; }
  .wl-day-card__title    { gap: 5px; }
  .wl-day-card__title h4 { font-size: 0.78rem; }
  .wl-day-card__meta     { font-size: 0.6rem; gap: 4px; }
  .wl-day-card__ex-summary {
    padding-top: 5px;
    font-size: 0.62rem;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }
  .wl-day-card__footer   { gap: 6px; }

  /* Preview / Start buttons: compact */
  .wl-btn-preview,
  .wl-btn-start {
    padding: 6px 10px;
    min-height: 32px;
    font-size: 0.66rem;
    border-radius: 9px;
    gap: 5px;
  }

  /* Secondary label sizes (global ~20% reduction) */
  .wl-plan__meta span        { font-size: 0.6rem; }
  .wl-history-session__meta  { font-size: 0.6rem; }
  .wl-hist-tag                { font-size: 0.56rem; padding: 1px 6px; }

  /* Day detail header (Day Details panel) */
  .wl-day-detail-header {
    padding: 9px;
    gap: 6px;
    margin-bottom: 6px;
    border-radius: 10px;
  }
  .wl-day-detail-header__left    { gap: 6px; }
  .wl-day-detail-header__left h4 { font-size: 0.78rem; }
  .wl-day-detail-count           { padding: 1px 7px; font-size: 0.58rem; }
  .wl-day-detail-header__progress { width: 100%; min-width: 0; gap: 6px; }
  .wl-day-detail-header__meta { gap: 6px 12px; }
  .wl-progress-label              { font-size: 0.6rem; }
  .wl-preview-badge               { padding: 1px 7px; font-size: 0.56rem; }

  .wl-workout-time {
    color: #cbd5e1;
  }

  .wl-workout-time strong {
    color: #f8fafc;
  }

  .wl-workout-time i {
    color: #60a5fa;
  }

  .wl-active-sessions { padding: 10px; }
  .wl-active-sessions__heading { align-items: flex-start; }
  .wl-active-sessions__list { grid-template-columns: minmax(0, 1fr); }
  .wl-active-session { width: 100%; box-sizing: border-box; }

  /* History */
  .wl-history-datebar { padding: 6px 10px; font-size: 0.64rem; margin-bottom: 6px; gap: 6px; }
  .wl-history-session { border-radius: 10px; }
  .wl-history-session--editing { box-shadow: none; }
  .wl-history-session__header     { padding: 8px 10px; gap: 6px; }
  .wl-history-group__plan         { font-size: 0.74rem; }
  .wl-history-group__day          { font-size: 0.58rem; padding: 1px 7px; }
  .wl-history-exercises--detailed { padding: 8px 10px; gap: 8px; }
  .wl-hist-ex-card    { padding: 8px; gap: 6px; border-radius: 9px; }
  .wl-hist-ex-thumb   { width: 30px; height: 30px; font-size: 0.74rem; }
  .wl-hist-ex-name    { font-size: 0.7rem; }
  .wl-hist-edit-btn,
  .wl-hist-save-btn,
  .wl-hist-cancel-btn,
  .wl-hist-delete-btn { padding: 2px 7px; font-size: 0.58rem; gap: 3px; }
  .wl-hist-sets-table--cardio { overflow-x: auto; }

  .wl-tab-panel .wl-empty,
  .wl-tab-panel .wl-empty p,
  .wl-tab-panel .wl-empty h6,
  .wl-history-datebar,
  .wl-history-datebar span,
  .wl-history-session__title,
  .wl-history-group__plan,
  .wl-hist-ex-name,
  .wl-hist-set-row {
    color: #f8fafc;
  }

  .wl-history-datebar strong,
  .wl-history-session__meta,
  .wl-history-session__meta span,
  .wl-hist-tag,
  .wl-hist-set-num,
  .wl-hist-sets-head--strength,
  .wl-hist-sets-head--cardio,
  .wl-hist-sets-head--cardio small,
  .wl-history-ex__stats,
  .wl-history-ex__stats span,
  .wl-hist-ex-info,
  .wl-hist-ex-tags {
    color: #cbd5e1;
  }

  .wl-tab-panel .wl-empty .wl-empty-icon,
  .wl-history-datebar i,
  .wl-history-session__meta i,
  .wl-history-ex__stats i {
    color: #60a5fa;
  }

  .wl-history-datebar .wl-btn-preview {
    color: #cbd5e1;
    border-color: rgba(96, 165, 250, 0.45);
    background: #1b2444;
  }

  .wl-history-datebar .wl-btn-preview:hover {
    color: #f8fafc;
    background: #273142;
  }

  .wl-tab-panel .wl-empty p,
  .wl-tab-panel .wl-empty h6 {
    margin-bottom: 0;
  }

  .wl-page :deep(.session-exercise-card),
  .wl-page :deep(.sec-meta h5),
  .wl-page :deep(.sec-meta p),
  .wl-page :deep(.sec-summary),
  .wl-page :deep(.sec-prefill-note),
  .wl-page :deep(.strength-mobile-field span),
  .wl-page :deep(.c3-col-info),
  .wl-page :deep(.c3-col-value),
  .wl-page :deep(.c3-btn-label),
  .wl-page :deep(.set-num),
  .wl-page :deep(.c3-set-num) {
    color: #f8fafc;
  }

  .wl-page :deep(.sec-meta p),
  .wl-page :deep(.strength-mobile-field span),
  .wl-page :deep(.c3-col-info),
  .wl-page :deep(.sec-summary),
  .wl-page :deep(.sec-prefill-note),
  .wl-page :deep(.set-input::placeholder),
  .wl-page :deep(.c3-col-set),
  .wl-page :deep(.set-num) {
    color: #cbd5e1;
  }

  .wl-page :deep(.strength-mobile-row),
  .wl-page :deep(.c3-set-group) {
    background: #1b2444 !important;
    border: 1px solid rgba(96, 165, 250, 0.22) !important;
  }

  .wl-page :deep(.c3-set-group.c3-set-done),
  .wl-page :deep(.strength-mobile-row--done),
  .wl-page :deep(.sec-set-row.set-done) {
    background: rgba(22, 163, 74, 0.10) !important;
    border-color: rgba(34, 197, 94, 0.35) !important;
    color: #f8fafc !important;
  }

  .wl-page :deep(.c3-set-group.c3-set-done .c3-row),
  .wl-page :deep(.c3-set-group.c3-set-done .c3-row:first-child),
  .wl-page :deep(.c3-set-group.c3-set-done .c3-row-done),
  .wl-page :deep(.strength-mobile-row--done .strength-mobile-field span),
  .wl-page :deep(.strength-mobile-row--done .set-input),
  .wl-page :deep(.sec-set-row.set-done .set-input) {
    background: rgba(22, 163, 74, 0.10) !important;
    color: #f8fafc !important;
  }

  .wl-page :deep(.c3-set-group.c3-set-done .c3-col-info),
  .wl-page :deep(.c3-set-group.c3-set-done .c3-col-set),
  .wl-page :deep(.c3-set-group.c3-set-done .c3-set-num),
  .wl-page :deep(.sec-set-row.set-done .set-num) {
    color: #f8fafc !important;
  }

  .wl-page :deep(.c3-set-group.c3-set-done .c3-complete-btn),
  .wl-page :deep(.c3-complete-btn--done),
  .wl-page :deep(.c3-icon-btn--done) {
    border-color: rgba(34, 197, 94, 0.45) !important;
    background: rgba(34, 197, 94, 0.16) !important;
    color: #ffffff !important;
  }

  .wl-page :deep(.strength-mobile-row .c3-icon-btn) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 10px;
    font-size: 0.78rem;
  }

  .wl-page :deep(.add-set-btn),
  .wl-page :deep(.c3-complete-btn),
  .wl-page :deep(.c3-finish-btn) {
    min-height: 44px;
  }

  .wl-page :deep(.session-exercise-card),
  .wl-page :deep(.cardio-table-wrap),
  .wl-page :deep(.cardio-3col-table) {
    max-width: 100%;
    min-width: 0;
    overflow-x: hidden;
  }

  .wl-page :deep(.strength-mobile-row .c3-icon-btn--remove) {
    background: rgba(239, 68, 68, 0.12) !important;
    border: 1px solid rgba(248, 113, 113, 0.35) !important;
    color: #fca5a5 !important;
  }

  .wl-page :deep(.strength-mobile-row .c3-icon-btn--complete),
  .wl-page :deep(.strength-mobile-row .c3-complete-btn) {
    background: rgba(34, 197, 94, 0.16) !important;
    border: 1px solid rgba(34, 197, 94, 0.45) !important;
    color: #86efac !important;
  }

  .wl-page :deep(.strength-mobile-row .set-input),
  .wl-page :deep(.c3-set-group .set-input) {
    background: #111b2e !important;
    border-color: rgba(96, 165, 250, 0.3) !important;
    color: #f8fafc !important;
  }

  .wl-page :deep(.strength-mobile-row .set-input::placeholder),
  .wl-page :deep(.c3-set-group .set-input::placeholder) {
    color: #94a3b8 !important;
  }

  .wl-page :deep(.c3-set-group.c3-set-done .fa-circle-check),
  .wl-page :deep(.sec-sets-summary--done i) {
    color: #22c55e !important;
  }

  /* Bottom bar: compact buttons */
  .wl-btn-complete {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 5px 8px;
    min-height: 32px;
    font-size: 0.66rem;
    border-radius: 9px;
    gap: 4px;
    justify-content: center;
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wl-btn-add-exercise {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 5px 8px;
    min-height: 32px;
    font-size: 0.66rem;
    border-radius: 9px;
    gap: 4px;
    justify-content: center;
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media (max-width: 800px) {
  .wl-plan {
    overflow: visible;
  }

  .wl-plan__right .wl-btn-reorder,
  .wl-plan__right .wl-btn-edit,
  .wl-plan__right .wl-btn-plan-delete {
    display: none;
  }

  .wl-plan-mobile-actions {
    display: inline-flex;
  }
}

/* ── Small mobile (≤ 640px) — layout stacking only, sizes inherited from 768px ── */
@media (max-width: 640px) {
  .wl-stats { grid-template-columns: minmax(0, 1fr); }
  .wl-plan__header { flex-direction: column; align-items: flex-start; }
  .wl-plan__right  { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
  .wl-day-detail-header { flex-direction: column; }
  .wl-bottom-bar__inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    gap: 6px;
  }
  .wl-bottom-bar__actions {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
    gap: 6px;
  }
  .wl-history-session__meta { flex-direction: column; gap: 4px; }
  .wl-history-datebar { flex-direction: column; align-items: flex-start; gap: 6px; }
  .wl-day-card__footer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .wl-day-card__footer > .wl-btn-preview,
  .wl-day-card__footer > .wl-btn-start {
    width: 100%;
    min-width: 0;
    height: 44px;
    min-height: 44px;
    max-height: 48px;
    padding: 5px 8px;
    justify-content: center;
    align-items: center;
    line-height: 1.15;
  }
  .wl-btn-add-exercise,
  .wl-btn-complete {
    width: 100%;
    min-width: 0;
    flex: initial;
    justify-content: center;
  }
}

/* ── Narrow mobile (≤ 480px) — keep same 50/50 horizontal nav ──────────── */
@media (max-width: 480px) {
  .wl-view-switch {
    gap: 3px;
    padding: 2px;
  }

  .wl-view-switch .wl-view-switch__link,
  .wl-view-switch .wl-view-switch__link--expanded,
  .wl-view-switch .wl-view-switch__link--compact {
    flex: 1 1 auto;
    flex-basis: auto;
    max-width: 100% !important;
    width: 100% !important;
    min-height: 52px;
    min-width: 0;
    padding: 8px 6px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.1;
    gap: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wl-view-switch .wl-view-switch__link i {
    font-size: 0.78rem;
    flex-shrink: 0;
  }

  .wl-view-switch__link.wl-view-switch__link--active::after {
    font-size: 0.52rem;
    margin-top: 1px;
  }

  .wl-tabs {
    gap: 2px;
    padding: 2px;
    margin-bottom: 8px;
  }

  .wl-tab {
    min-height: 40px;
    padding: 6px 5px;
    font-size: 0.68rem;
    line-height: 1.12;
    gap: 3px;
    flex-wrap: wrap;
    align-content: center;
  }

  .wl-tab i {
    font-size: 0.7rem;
    flex-shrink: 0;
  }

  .wl-tab-active-badge,
  .wl-tab-paused-badge,
  .wl-tab-inactive-badge {
    display: inline-flex;
    width: fit-content;
    margin-top: 1px;
    line-height: 1;
  }

  .wl-stats-section {
    padding: 10px;
    margin-bottom: 10px;
    gap: 9px;
  }

  .wl-stats-toggle {
    min-height: 44px;
    padding: 10px 12px;
    font-size: 0.82rem;
    align-items: center;
  }

  .wl-stats-toggle__title {
    line-height: 1.2;
  }

  .wl-stats-collapse-body {
    padding-top: 2px;
  }

  .wl-stats {
    gap: 8px;
  }

  .wl-stat-card {
    min-height: 46px;
    padding: 6px 8px;
    border-radius: 10px;
  }

  .wl-plan {
    border-radius: 11px;
  }

  .wl-plan__header {
    padding: 9px 10px;
    gap: 7px;
  }

  .wl-plan__left {
    width: 100%;
    gap: 7px;
  }

  .wl-plan__meta {
    row-gap: 3px;
  }

  .wl-plan__right {
    width: 100%;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(148, 163, 184, 0.22);
    justify-content: flex-end;
  }

  .wl-btn-edit,
  .wl-btn-plan-delete {
    min-height: 28px;
    padding: 4px 9px;
    border-radius: 9px;
  }
}

/* ── Tiny mobile (≤ 390px) — final trim, badges hidden for width ────────── */
@media (max-width: 390px) {
  .wl-stat-card { padding: 4px 5px; }
  .wl-stat-card span   { font-size: 0.52rem; }
  .wl-stat-card strong { font-size: 0.72rem; }
  .wl-tab { min-height: 28px; padding: 2px 3px; font-size: 0.56rem; }
  .wl-tab-inactive-badge { display: none; }
  .wl-toolbar .wl-btn  { font-size: 9px; }
}
</style>



