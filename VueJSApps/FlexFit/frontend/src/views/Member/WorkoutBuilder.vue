<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import WorkoutMetadataForm from '@/components/workout-builder/WorkoutMetadataForm.vue';
import ExercisePickerModal from '@/components/workout-builder/ExercisePickerModal.vue';
import WorkoutExerciseBlock from '@/components/workout-builder/WorkoutExerciseBlock.vue';
import WorkoutScheduleListItem from '@/components/workout-builder/WorkoutScheduleListItem.vue';
import { API_BASE } from '@/config/env';
import { refreshWorkoutStatus, setUserWorkoutStatus } from '@/composable/workoutStatusManager';

const metadata = ref({
  name: '',
  description: '',
  type: 'Strength',
  estimatedDuration: 45,
});

const allExercises = ref([]);
const workoutExercises = ref([]);
const pickerOpen = ref(false);
const loadingExercises = ref(false);
const loadingPlanner = ref(false);
const saving = ref(false);
const saveMessage = ref('');
const plannerMessage = ref('');
const userId = ref(null);
const currentPlanId = ref('');
const selectedWorkoutId = ref('');
const workoutSchedules = ref([]);
const isCreatingWorkout = ref(false);
const hasSavedWorkoutDetails = ref(false);
const deletingWorkoutId = ref('');
const hasSavedWorkoutExerciseList = ref(false);
const isWorkoutDetailsOpen = ref(true);
const isSchedulePlannerOpen = ref(true);
const route = useRoute();
const router = useRouter();

// Tab: 'plans' | 'details' | 'planner'
const builderTab = ref('plans');

const scheduleMode = ref('day'); // day | week
const dayGroups = ref(['Any Day']);
const weekGroups = ref(['Week 1']);
const selectedScheduleGroup = ref(null);
const newScheduleGroupName = ref('');
const editingScheduleGroupOriginalName = ref('');
const showDeleteModal = ref(false);
const dayToDelete = ref(null);

const activeGroups = computed(() => (scheduleMode.value === 'week' ? weekGroups.value : dayGroups.value));

const workoutDaysWithExercises = computed(() => {
  return activeGroups.value.map((groupName) => {
    const exercises = workoutExercises.value.filter(
      (ex) => (ex.scheduleGroup || activeGroups.value[0]) === groupName
    );
    return {
      name: groupName,
      exercises,
      exerciseCount: exercises.length,
    };
  });
});

const hasWorkoutSchedules = computed(() => workoutSchedules.value.length > 0);
const canShowWorkoutDetails = computed(() => isCreatingWorkout.value || Boolean(selectedWorkoutId.value));
const canShowSchedulePlanner = computed(() => canShowWorkoutDetails.value && hasSavedWorkoutDetails.value);
const primarySaveLabel = computed(() => {
  if (saving.value) {
    return hasSavedWorkoutDetails.value ? 'Saving...' : 'Saving Details...';
  }
  return hasSavedWorkoutDetails.value ? 'Save Workout' : 'Save Workout Details';
});
const isEditingScheduleGroup = computed(() => Boolean(String(editingScheduleGroupOriginalName.value || '').trim()));

const plannerGroupsWithExercises = computed(() => {
  const groups = activeGroups.value.length > 0
    ? activeGroups.value
    : [scheduleMode.value === 'week' ? 'Week 1' : 'Any Day'];

  return groups.map((group) => ({
    name: group,
    exercises: workoutExercises.value
      .map((exercise, index) => ({ exercise, index }))
      .filter((entry) => (entry.exercise.scheduleGroup || groups[0]) === group),
  }));
});

const totalDuration = computed(() => {
  const fromBlocks = workoutExercises.value.reduce((total, exercise) => total + Number(exercise.duration || 0), 0);
  if (fromBlocks > 0) {
    return fromBlocks;
  }
  return Number(metadata.value.estimatedDuration || 0);
});

const completedVolume = computed(() => {
  return workoutExercises.value.reduce((total, exercise) => {
    return total + Number(exercise.sets || 0) * Number(exercise.reps || 0) * Number(exercise.weight || 0);
  }, 0);
});

const formatUpdatedAt = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
};

const syncWorkoutSchedules = (incomingLists = []) => {
  workoutSchedules.value = (Array.isArray(incomingLists) ? incomingLists : []).map((plan) => ({
    ...plan,
    updatedAtLabel: formatUpdatedAt(plan.updatedAt),
  }));
};

const resetPlannerDraft = () => {
  metadata.value = {
    name: '',
    description: '',
    type: 'Strength',
    estimatedDuration: 45,
  };
  currentPlanId.value = '';
  workoutExercises.value = [];
  scheduleMode.value = 'day';
  dayGroups.value = ['Any Day'];
  weekGroups.value = ['Week 1'];
  newScheduleGroupName.value = '';
  editingScheduleGroupOriginalName.value = '';
  plannerMessage.value = '';
  saveMessage.value = '';
  isWorkoutDetailsOpen.value = true;
  isSchedulePlannerOpen.value = true;
};

const hydratePlanner = (planner = {}, { markSaved = true } = {}) => {
  currentPlanId.value = String(planner?.planId || '').trim();

  metadata.value = {
    name: planner?.metadata?.name || '',
    description: planner?.metadata?.description || '',
    type: planner?.metadata?.type || 'Strength',
    estimatedDuration: Number(planner?.metadata?.estimatedDuration || 45),
  };

  scheduleMode.value = planner?.scheduleMode === 'week' ? 'week' : 'day';
  dayGroups.value = Array.isArray(planner?.dayGroups) && planner.dayGroups.length > 0
    ? planner.dayGroups
    : ['Any Day'];
  weekGroups.value = Array.isArray(planner?.weekGroups) && planner.weekGroups.length > 0
    ? planner.weekGroups
    : ['Week 1'];

  workoutExercises.value = Array.isArray(planner?.exercises)
    ? planner.exercises.map((exercise) => ({
        ...exercise,
        scheduleGroup: exercise?.scheduleGroup || (scheduleMode.value === 'week' ? weekGroups.value[0] : dayGroups.value[0]),
      }))
    : [];

  const assignedGroups = Array.from(
    new Set(workoutExercises.value.map((exercise) => String(exercise.scheduleGroup || '').trim()).filter(Boolean))
  );

  if (scheduleMode.value === 'week') {
    weekGroups.value = Array.from(new Set([...weekGroups.value, ...assignedGroups]));
  } else {
    dayGroups.value = Array.from(new Set([...dayGroups.value, ...assignedGroups]));
  }
  
  // Auto-select first group when loading workout
  selectedScheduleGroup.value = (scheduleMode.value === 'week' ? weekGroups.value[0] : dayGroups.value[0]) || null;

  hasSavedWorkoutDetails.value = markSaved;
  editingScheduleGroupOriginalName.value = '';
  newScheduleGroupName.value = '';
  isWorkoutDetailsOpen.value = true;
  isSchedulePlannerOpen.value = markSaved;
  // Auto-switch to Schedule Planner tab when a plan is loaded
  if (markSaved) {
    builderTab.value = 'planner';
  } else {
    builderTab.value = 'details';
  }
};

const clearSelection = async () => {
  selectedWorkoutId.value = '';
  isCreatingWorkout.value = false;
  hasSavedWorkoutDetails.value = false;
  builderTab.value = 'plans';
  resetPlannerDraft();
  await router.replace({ query: { ...route.query, planId: undefined } });
};

const openPicker = () => {
  pickerOpen.value = true;
};

const closePicker = () => {
  pickerOpen.value = false;
};

const createWorkoutPlan = async () => {
  saveMessage.value = '';
  if (!userId.value) {
    saveMessage.value = 'Unable to resolve user session. Please login again.';
    return;
  }

  loadingPlanner.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/workout-schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleMode: 'day' }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error || 'Failed to create workout plan.');
    }

    const data = await response.json();
    const planner = data?.planner || {};
    const createdPlanId = String(planner?.planId || '').trim();

    if (!createdPlanId) {
      throw new Error('Workout plan was created but no plan ID was returned.');
    }

    syncWorkoutSchedules(data?.workoutLists);
    selectedWorkoutId.value = createdPlanId;
    currentPlanId.value = createdPlanId;
    isCreatingWorkout.value = true;
    hasSavedWorkoutDetails.value = false;

    metadata.value = {
      name: '',
      description: '',
      type: planner?.metadata?.type || 'Strength',
      estimatedDuration: Number(planner?.metadata?.estimatedDuration || 45),
    };

    scheduleMode.value = planner?.scheduleMode === 'week' ? 'week' : 'day';
    dayGroups.value = Array.isArray(planner?.dayGroups) && planner.dayGroups.length > 0
      ? planner.dayGroups
      : ['Any Day'];
    weekGroups.value = Array.isArray(planner?.weekGroups) && planner.weekGroups.length > 0
      ? planner.weekGroups
      : ['Week 1'];
    
    // Auto-select first group
    selectedScheduleGroup.value = (scheduleMode.value === 'week' ? weekGroups.value[0] : dayGroups.value[0]) || null;
    
    workoutExercises.value = [];
    plannerMessage.value = '';
    isWorkoutDetailsOpen.value = true;
    isSchedulePlannerOpen.value = false;
    builderTab.value = 'details';

    await router.replace({ query: { ...route.query, planId: createdPlanId } });
    saveMessage.value = 'Draft workout plan created. Add details and save to continue.';
  } catch (error) {
    saveMessage.value = error.message || 'Failed to create workout plan.';
  } finally {
    loadingPlanner.value = false;
  }
};

const showAiSuggestionPlaceholder = () => {
  saveMessage.value = 'Suggest with AI is coming soon.';
};

const ensureActiveGroups = () => {
  if (scheduleMode.value === 'week' && weekGroups.value.length === 0) {
    weekGroups.value = ['Week 1'];
  }
  if (scheduleMode.value === 'day' && dayGroups.value.length === 0) {
    dayGroups.value = ['Any Day'];
  }
};

const buildDefaultGroupName = () => {
  const isWeek = scheduleMode.value === 'week';
  const current = isWeek ? weekGroups.value : dayGroups.value;
  const prefix = isWeek ? 'Week' : 'Day';
  let index = 1;
  while (current.includes(`${prefix} ${index}`)) {
    index += 1;
  }
  return `${prefix} ${index}`;
};

const getFallbackGroupName = () => (scheduleMode.value === 'week' ? 'Week 1' : 'Any Day');

const clearScheduleGroupEdit = () => {
  editingScheduleGroupOriginalName.value = '';
  newScheduleGroupName.value = '';
};

const canRemoveScheduleGroup = (groupName) => {
  const target = scheduleMode.value === 'week' ? weekGroups.value : dayGroups.value;
  if (target.length <= 1) {
    return false;
  }
  const normalized = String(groupName || '').trim().toLowerCase();
  return target.some((group) => String(group || '').trim().toLowerCase() === normalized);
};

const addScheduleGroup = () => {
  const name = (newScheduleGroupName.value || '').trim() || buildDefaultGroupName();
  const target = scheduleMode.value === 'week' ? weekGroups : dayGroups;
  const normalizedName = name.toLowerCase();

  if (target.value.some((group) => String(group).toLowerCase() === normalizedName)) {
    plannerMessage.value = `${name} already exists.`;
    return;
  }

  target.value = [...target.value, name];
  
  // Auto-select first day if none is selected
  if (!selectedScheduleGroup.value) {
    selectedScheduleGroup.value = name;
  }
  
  newScheduleGroupName.value = '';
  plannerMessage.value = '';
};

const setActiveDay = (groupName) => {
  selectedScheduleGroup.value = groupName;
  plannerMessage.value = '';
};

const startEditScheduleGroup = (groupName) => {
  const name = String(groupName || '').trim();
  if (!name) {
    return;
  }

  editingScheduleGroupOriginalName.value = name;
  newScheduleGroupName.value = name;
  plannerMessage.value = '';
};

const saveEditedScheduleGroup = () => {
  const target = scheduleMode.value === 'week' ? weekGroups : dayGroups;
  const oldName = String(editingScheduleGroupOriginalName.value || '').trim();
  if (!oldName) {
    return;
  }

  const suggestedName = String(newScheduleGroupName.value || '').trim();

  if (!suggestedName || suggestedName === oldName) {
    clearScheduleGroupEdit();
    return;
  }

  const normalizedNew = suggestedName.toLowerCase();
  const normalizedOld = oldName.toLowerCase();
  if (target.value.some((group) => String(group || '').trim().toLowerCase() === normalizedNew)) {
    plannerMessage.value = `${suggestedName} already exists.`;
    return;
  }

  target.value = target.value.map((group) => (
    String(group || '').trim().toLowerCase() === normalizedOld ? suggestedName : group
  ));

  workoutExercises.value = workoutExercises.value.map((exercise) => {
    if (String(exercise.scheduleGroup || '').trim().toLowerCase() === normalizedOld) {
      return { ...exercise, scheduleGroup: suggestedName };
    }
    return exercise;
  });

  clearScheduleGroupEdit();
  plannerMessage.value = '';
};

const removeScheduleGroup = (groupName) => {
  if (!canRemoveScheduleGroup(groupName)) {
    plannerMessage.value = `At least one ${scheduleMode.value === 'week' ? 'week' : 'day'} group is required.`;
    return;
  }

  const isWeek = scheduleMode.value === 'week';
  const target = isWeek ? weekGroups : dayGroups;
  const fallback = getFallbackGroupName();
  const normalizedRemovedName = String(groupName || '').trim().toLowerCase();

  const nextGroups = target.value.filter(
    (group) => String(group || '').trim().toLowerCase() !== normalizedRemovedName
  );
  target.value = nextGroups.length > 0 ? nextGroups : [fallback];

  const nextFallback = target.value[0] || fallback;

  if (String(editingScheduleGroupOriginalName.value || '').trim().toLowerCase() === normalizedRemovedName) {
    clearScheduleGroupEdit();
  }

  workoutExercises.value = workoutExercises.value.map((exercise) => {
    if (String(exercise.scheduleGroup || '').trim().toLowerCase() === normalizedRemovedName) {
      return { ...exercise, scheduleGroup: nextFallback };
    }
    return exercise;
  });
  
  // Clear selection if the selected group was removed
  if (selectedScheduleGroup.value && String(selectedScheduleGroup.value).trim().toLowerCase() === normalizedRemovedName) {
    selectedScheduleGroup.value = nextFallback;
  }

  plannerMessage.value = '';
};

const changeScheduleMode = (mode) => {
  scheduleMode.value = mode === 'week' ? 'week' : 'day';
  clearScheduleGroupEdit();
  ensureActiveGroups();
  plannerMessage.value = '';
  const fallback = activeGroups.value[0];
  
  // Auto-select first group in new mode
  selectedScheduleGroup.value = fallback || null;

  workoutExercises.value = workoutExercises.value.map((exercise) => ({
    ...exercise,
    scheduleGroup: activeGroups.value.includes(exercise.scheduleGroup)
      ? exercise.scheduleGroup
      : fallback,
  }));
};

const toggleWorkoutDetails = () => {
  isWorkoutDetailsOpen.value = !isWorkoutDetailsOpen.value;
};

const toggleSchedulePlanner = () => {
  isSchedulePlannerOpen.value = !isSchedulePlannerOpen.value;
};

// Helper function to normalize exercise title to folder name format
const normalizeExerciseFolderName = (title) => {
  return String(title || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

// Helper function to resolve exercise image path
const resolveExerciseImage = (exercise) => {
  // 1. Try ImageURL field directly
  if (exercise.ImageURL) {
    return exercise.ImageURL;
  }
  
  // 2. Try ImageGallery array (parse JSON if string)
  if (exercise.ImageGallery) {
    try {
      const gallery = typeof exercise.ImageGallery === 'string' 
        ? JSON.parse(exercise.ImageGallery) 
        : exercise.ImageGallery;
      if (Array.isArray(gallery) && gallery.length > 0) {
        return gallery[0];
      }
    } catch (e) {
      console.warn('Failed to parse ImageGallery:', e);
    }
  }
  
  // 3. Generate fallback path based on ExerciseTitle
  if (exercise.ExerciseTitle) {
    const folderName = normalizeExerciseFolderName(exercise.ExerciseTitle);
    if (folderName) {
      return `/assets/Excerises/${folderName}/0.jpg`;
    }
  }
  
  // 4. Final fallback only if all else fails
  return '/assets/Excerises/default/default.jpg';
};

const createBlock = (exercise) => {
  const wt = String(exercise.WorkoutType || metadata.value.type || '').trim().toLowerCase();
  const isCardio = wt === 'cardio';
  return {
    id: `${exercise.ExerciseID}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    exerciseId: exercise.ExerciseID,
    name: exercise.ExerciseTitle,
    image: resolveExerciseImage(exercise),
    ImageURL: exercise.ImageURL || '',
    ImageGallery: exercise.ImageGallery || '',
    workoutType: exercise.WorkoutType || metadata.value.type,
    muscleGroup: exercise.MuscleGroup || '',
    equipment: exercise.Equipment || '',
    recordingType: exercise.RecordingType || '',
    // Strength fields — blank for cardio
    sets:     isCardio ? 0 : 0,
    reps:     isCardio ? 0 : 0,
    weight:   0,
    restTime: isCardio ? 0 : 0,
    // Cardio fields — blank for strength
    duration: 0,
    distance: 0,
    speed:    0,
    calories: 0,
    notes: '',
    scheduleGroup: activeGroups.value[0],
  };
};

const addExerciseToWorkout = (exercise) => {
  ensureActiveGroups();
  
  // Validate that a day/week is selected
  if (!selectedScheduleGroup.value) {
    plannerMessage.value = 'Select a workout day before adding exercises.';
    return;
  }
  
  // Verify the selected group still exists
  if (!activeGroups.value.includes(selectedScheduleGroup.value)) {
    plannerMessage.value = 'Selected workout day was not found.';
    selectedScheduleGroup.value = null;
    return;
  }
  
  // Create exercise block with selected schedule group
  const block = createBlock(exercise);
  block.scheduleGroup = selectedScheduleGroup.value;
  workoutExercises.value.push(block);
  
  saveMessage.value = '';
  plannerMessage.value = '';
};

const updateExerciseField = ({ id, field, value }) => {
  const target = workoutExercises.value.find((exercise) => exercise.id === id);
  if (!target) {
    return;
  }

  target[field] = value;
};

const removeExercise = (id) => {
  workoutExercises.value = workoutExercises.value.filter((exercise) => exercise.id !== id);
};

const moveExerciseUp = (id) => {
  const index = workoutExercises.value.findIndex((exercise) => exercise.id === id);
  if (index <= 0) {
    return;
  }

  const next = [...workoutExercises.value];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  workoutExercises.value = next;
};

const moveExerciseDown = (id) => {
  const index = workoutExercises.value.findIndex((exercise) => exercise.id === id);
  if (index < 0 || index >= workoutExercises.value.length - 1) {
    return;
  }

  const next = [...workoutExercises.value];
  [next[index + 1], next[index]] = [next[index], next[index + 1]];
  workoutExercises.value = next;
};

const plannerPayload = computed(() => ({
  planId: currentPlanId.value || undefined,
  metadata: {
    ...metadata.value,
  },
  scheduleMode: scheduleMode.value,
  dayGroups: dayGroups.value,
  weekGroups: weekGroups.value,
  exercises: workoutExercises.value,
}));

const persistWorkout = async ({ detailsOnly = false } = {}) => {
  saveMessage.value = '';

  if (!metadata.value.name.trim()) {
    saveMessage.value = 'Please enter a workout name.';
    return;
  }

  if (!userId.value) {
    saveMessage.value = 'Unable to resolve user session. Please login again.';
    return;
  }

  saving.value = true;

  try {
    const response = await fetch(`${API_BASE}/api/workout-planner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planner: plannerPayload.value }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to save workout planner.');
    }

    const data = await response.json();
    currentPlanId.value = String(data?.planner?.planId || currentPlanId.value || '').trim();
    selectedWorkoutId.value = currentPlanId.value;
    isCreatingWorkout.value = false;
    hasSavedWorkoutDetails.value = true;
    isSchedulePlannerOpen.value = true;
    syncWorkoutSchedules(data?.workoutLists);
    hasSavedWorkoutExerciseList.value = Boolean(data?.hasSavedWorkoutExerciseList);
    setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);
    await refreshWorkoutStatus();
    saveMessage.value = detailsOnly
      ? 'Workout details saved. You can now build your schedule.'
      : 'Workout schedule saved successfully.';
    await router.replace({ query: { ...route.query, planId: currentPlanId.value } });
  } catch (error) {
    saveMessage.value = error.message || 'Failed to save workout planner.';
  } finally {
    saving.value = false;
  }
};

const saveWorkoutDetails = async () => {
  await persistWorkout({ detailsOnly: true });
};

const saveWorkout = async () => {
  await persistWorkout({ detailsOnly: false });
};

const handlePrimarySave = async () => {
  if (!hasSavedWorkoutDetails.value) {
    await saveWorkoutDetails();
    return;
  }

  await saveWorkout();
};

const loadExercises = async () => {
  loadingExercises.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/get-exercises`, {
      credentials: 'include',
    });
    const data = await response.json();
    allExercises.value = Array.isArray(data) ? data : [];
  } finally {
    loadingExercises.value = false;
  }
};

const loadUserId = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/user-id`, {
      credentials: 'include',
    });
    const data = await response.json();
    userId.value = data?.userId || null;
  } catch {
    userId.value = null;
  }
};

const loadWorkoutPlanner = async (requestedPlanId = '') => {
  loadingPlanner.value = true;
  try {
    const query = requestedPlanId
      ? `?planId=${encodeURIComponent(String(requestedPlanId).trim())}`
      : '';

    const response = await fetch(`${API_BASE}/api/workout-planner${query}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    syncWorkoutSchedules(data?.workoutLists);

    hasSavedWorkoutExerciseList.value = Boolean(data?.hasSavedWorkoutExerciseList);
    setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);

    if (requestedPlanId) {
      const planner = data?.planner || {};
      selectedWorkoutId.value = String(planner?.planId || requestedPlanId).trim();
      isCreatingWorkout.value = false;
      const isPlannerReady = String(planner?.status || '').toLowerCase() !== 'draft';
      hydratePlanner(planner, { markSaved: isPlannerReady });
      return;
    }

    if (!workoutSchedules.value.length && !isCreatingWorkout.value) {
      selectedWorkoutId.value = '';
      hasSavedWorkoutDetails.value = false;
      resetPlannerDraft();
    }
  } catch (err) {
    console.error('Failed to load workout planner:', err);
  } finally {
    loadingPlanner.value = false;
  }
};

const selectWorkoutSchedule = async (schedule) => {
  const planId = String(schedule?.planId || '').trim();
  if (!planId) {
    return;
  }

  await router.replace({ query: { ...route.query, planId } });
  await loadWorkoutPlanner(planId);
};

const editWorkoutSchedule = async (schedule) => {
  await selectWorkoutSchedule(schedule);
  isWorkoutDetailsOpen.value = true;
};

const deleteWorkoutSchedule = async (schedule) => {
  const planId = String(schedule?.planId || '').trim();
  if (!planId) {
    return;
  }

  const planName = String(schedule?.name || 'this workout').trim();
  const confirmed = window.confirm(`Delete ${planName}? This will remove the saved workout schedule.`);
  if (!confirmed) {
    return;
  }

  deletingWorkoutId.value = planId;
  try {
    const response = await fetch(`${API_BASE}/api/workout-schedules/${encodeURIComponent(planId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error || 'Failed to delete workout plan.');
    }

    const data = await response.json();
    syncWorkoutSchedules(data?.workoutLists);
    hasSavedWorkoutExerciseList.value = Boolean(data?.hasSavedWorkoutExerciseList);
    setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);
    await refreshWorkoutStatus();

    if (selectedWorkoutId.value === planId) {
      await clearSelection();
    }

    saveMessage.value = 'Workout schedule deleted.';
  } catch (error) {
    saveMessage.value = error.message || 'Failed to delete workout schedule.';
  } finally {
    deletingWorkoutId.value = '';
  }
};

onMounted(async () => {
  const requestedPlanId = String(route.query?.planId || '').trim();
  await Promise.all([loadExercises(), loadUserId(), loadWorkoutPlanner(requestedPlanId)]);
});

watch(
  () => route.query?.planId,
  async (nextPlanId, prevPlanId) => {
    if (String(nextPlanId || '').trim() === String(prevPlanId || '').trim()) {
      return;
    }
    const normalizedNextPlanId = String(nextPlanId || '').trim();
    if (!normalizedNextPlanId) {
      if (!isCreatingWorkout.value) {
        selectedWorkoutId.value = '';
        hasSavedWorkoutDetails.value = false;
        resetPlannerDraft();
        await loadWorkoutPlanner('');
      }
      return;
    }

    await loadWorkoutPlanner(normalizedNextPlanId);
  }
);
</script>

<template>
  <div class="app-page-shell workout-builder-page">
    <div class="app-page-canvas app-inner-shell workout-builder-canvas">
      <section class="builder-hero ff-page-header app-header-gradient">
        <div>
          <h2>Workout Builder</h2>
          <p>Build sessions quickly with an athlete-first workflow.</p>
        </div>
        <div class="builder-hero__stats">
          <div>
            <strong>{{ workoutExercises.length }}</strong>
            <span>Exercises</span>
          </div>
          <div>
            <strong>{{ totalDuration }}</strong>
            <span>Min</span>
          </div>
          <div>
            <strong>{{ completedVolume.toLocaleString() }}</strong>
            <span>Volume</span>
          </div>
        </div>
      </section>

      <!-- ── Tab Bar ──────────────────────────────────────────── -->
      <nav class="builder-tabs" role="tablist" aria-label="Workout Builder sections">
        <button
          type="button"
          role="tab"
          :aria-selected="builderTab === 'plans'"
          :class="['builder-tab', { 'builder-tab--active': builderTab === 'plans' }]"
          @click="builderTab = 'plans'"
        >
          <i class="fa-solid fa-list-check"></i>
          Plans
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="builderTab === 'details'"
          :disabled="!canShowWorkoutDetails"
          :class="['builder-tab', { 'builder-tab--active': builderTab === 'details' }]"
          @click="builderTab = 'details'"
        >
          <i class="fa-solid fa-circle-info"></i>
          Details
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="builderTab === 'planner'"
          :disabled="!canShowSchedulePlanner"
          :class="['builder-tab', { 'builder-tab--active': builderTab === 'planner' }]"
          @click="builderTab = 'planner'"
        >
          <i class="fa-solid fa-calendar-days"></i>
          Schedule Planner
        </button>
      </nav>

      <!-- ── TAB 1: Plans ─────────────────────────────────────── -->
      <section v-show="builderTab === 'plans'" class="builder-section schedule-hub-section">
        <div class="builder-section__head builder-section__head--inline schedule-hub-head">
          <div>
            <h3>My Workout Schedules</h3>
            <p>Choose an existing plan or create a new workout schedule to continue.</p>
          </div>

          <div class="schedule-hub-head__actions">
            <button type="button" class="btn-create-plan" @click="createWorkoutPlan">
              <span class="btn-label-full">Create Workout Plan</span>
              <span class="btn-label-short">Create Plan</span>
            </button>
            <button type="button" class="btn-ai-suggest" @click="showAiSuggestionPlaceholder">
              <span class="btn-label-full">Suggest with AI</span>
              <span class="btn-label-short">AI Suggest</span>
            </button>
          </div>
        </div>

        <div v-if="loadingPlanner" class="builder-empty planner-empty planner-empty--loading" aria-live="polite">
          <div class="planner-empty__icon">📋</div>
          <h4>Loading workout schedules</h4>
          <p>Fetching saved workout plans for your account.</p>
        </div>

        <div v-else-if="!hasWorkoutSchedules && !isCreatingWorkout" class="builder-empty schedule-hub-empty" aria-live="polite">
          <div class="planner-empty__icon">🗂️</div>
          <h4>No workout schedules yet.</h4>
          <p>Create your first workout plan to start building a guided schedule.</p>
          <div class="schedule-hub-empty__actions">
            <button type="button" class="btn-create-plan" @click="createWorkoutPlan">
              <span class="btn-label-full">Create Workout Plan</span>
              <span class="btn-label-short">Create Plan</span>
            </button>
            <button type="button" class="btn-ai-suggest" @click="showAiSuggestionPlaceholder">
              <span class="btn-label-full">Suggest with AI</span>
              <span class="btn-label-short">AI Suggest</span>
            </button>
          </div>
        </div>

        <div v-else class="schedule-hub-list">
          <WorkoutScheduleListItem
            v-for="schedule in workoutSchedules"
            :key="schedule.planId"
            :schedule="schedule"
            :selected="selectedWorkoutId === schedule.planId"
            :deleting="deletingWorkoutId === schedule.planId"
            @open="selectWorkoutSchedule"
            @edit="editWorkoutSchedule"
            @delete="deleteWorkoutSchedule"
          />
        </div>
      </section>

      <!-- ── TAB 2: Details ───────────────────────────────────── -->
      <section v-show="builderTab === 'details'" class="builder-section collapsible-panel">
        <div v-if="!canShowWorkoutDetails" class="builder-empty planner-empty" aria-live="polite">
          <div class="planner-empty__icon">📝</div>
          <h4>No plan selected</h4>
          <p>Select or create a workout plan from the Plans tab first.</p>
          <button type="button" class="btn-create-plan" style="margin-top:8px" @click="builderTab = 'plans'">
            Go to Plans
          </button>
        </div>
        <div v-else>
          <div class="collapsible-header" style="cursor:default; margin-bottom:0;">
            <span class="collapsible-header__text">
              <strong>Workout Details</strong>
              <small>Set the workout context before adding exercises.</small>
            </span>
          </div>
          <div class="collapsible-panel__body">
            <WorkoutMetadataForm
              :metadata="metadata"
              @update:metadata="metadata = $event"
            />
          </div>
        </div>
      </section>

      <!-- ── TAB 3: Schedule Planner ──────────────────────────── -->
      <section v-show="builderTab === 'planner'" class="builder-section planner-section">
        <div v-if="!canShowSchedulePlanner" class="builder-empty planner-empty" aria-live="polite">
          <div class="planner-empty__icon">🗓️</div>
          <h4>Save workout details first</h4>
          <p>Fill in the workout name and details, then save to unlock the Schedule Planner.</p>
          <button type="button" class="btn-create-plan" style="margin-top:8px" @click="builderTab = 'details'">
            Go to Details
          </button>
        </div>
        <div v-else>
          <div class="planner-heading-group" style="margin-bottom:14px;">
            <h3>Workout Schedule Planner</h3>
            <p>Plan your workout flow, add exercises, and organize each session clearly.</p>
          </div>
          <div class="planner-tools">
              <div class="planner-mode-toggle" role="tablist" aria-label="Schedule grouping mode">
                <button
                  type="button"
                  class="planner-mode-btn"
                  :class="{ active: scheduleMode === 'day' }"
                  @click="changeScheduleMode('day')"
                >
                  By Day
                </button>
                <button
                  type="button"
                  class="planner-mode-btn"
                  :class="{ active: scheduleMode === 'week' }"
                  @click="changeScheduleMode('week')"
                >
                  By Week
                </button>
              </div>

              <div class="planner-group-editor">
                <input
                  v-model="newScheduleGroupName"
                  type="text"
                  :placeholder="
                    isEditingScheduleGroup
                      ? (scheduleMode === 'week' ? 'Edit week name' : 'Edit day name')
                      : (scheduleMode === 'week' ? 'Add Week (e.g. Week 2)' : 'Add Day (e.g. Day 1)')
                  "
                />
                <button
                  v-if="!isEditingScheduleGroup"
                  type="button"
                  class="planner-group-add"
                  @click="addScheduleGroup"
                >
                  Add {{ scheduleMode === 'week' ? 'Week' : 'Day' }}
                </button>
                <button
                  v-else
                  type="button"
                  class="planner-group-save"
                  @click="saveEditedScheduleGroup"
                >
                  Save {{ scheduleMode === 'week' ? 'Week' : 'Day' }}
                </button>
              </div>

              <div class="workout-day-accordion" role="list" aria-label="Workout days">
                <div
                  v-for="day in workoutDaysWithExercises"
                  :key="day.name"
                  :class="['workout-day-card', { active: selectedScheduleGroup === day.name }]"
                  role="listitem"
                >
                  <button
                    type="button"
                    class="workout-day-header"
                    @click="setActiveDay(day.name)"
                  >
                    <div class="day-title-group">
                      <strong>{{ day.name }}</strong>
                      <span v-if="selectedScheduleGroup === day.name" class="selected-badge">Selected</span>
                      <span class="exercise-count">{{ day.exerciseCount }} exercise{{ day.exerciseCount === 1 ? '' : 's' }}</span>
                    </div>

                    <div class="day-actions" @click.stop>
                      <button
                        type="button"
                        :class="['day-action-btn', selectedScheduleGroup === day.name ? 'day-action-btn--selected' : 'day-action-btn--select']"
                        @click="setActiveDay(day.name)"
                      >
                        {{ selectedScheduleGroup === day.name ? 'Selected' : 'Select' }}
                      </button>
                      <button
                        type="button"
                        class="day-action-btn day-action-btn--edit"
                        @click="startEditScheduleGroup(day.name)"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="day-action-btn day-action-btn--delete"
                        :disabled="!canRemoveScheduleGroup(day.name)"
                        @click="requestDeleteDay(day.name)"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        class="chevron-btn"
                        @click="setActiveDay(day.name)"
                      >
                        <i :class="selectedScheduleGroup === day.name ? 'fa fa-chevron-up' : 'fa fa-chevron-down'"></i>
                      </button>
                    </div>
                  </button>

                  <transition name="accordion-slide">
                    <div v-if="selectedScheduleGroup === day.name" class="workout-day-panel">
                      <div v-if="day.exercises.length > 0" class="day-exercises-list">
                        <WorkoutExerciseBlock
                          v-for="(exercise, idx) in day.exercises"
                          :key="exercise.id"
                          :exercise="exercise"
                          :index="workoutExercises.findIndex(ex => ex.id === exercise.id)"
                          :total="workoutExercises.length"
                          :schedule-groups="activeGroups"
                          :schedule-mode="scheduleMode"
                          @update-field="updateExerciseField"
                          @remove="removeExercise"
                          @move-up="moveExerciseUp"
                          @move-down="moveExerciseDown"
                        />
                      </div>

                      <div v-else class="empty-day-state">
                        <p>No exercises added to {{ day.name }} yet.</p>
                      </div>

                      <div class="day-panel-actions">
                        <button type="button" class="btn-add-exercise-day" @click="openPicker">
                          <span class="btn-add-exercise__icon">＋</span>
                          <span>Add Exercise</span>
                        </button>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>

              <p v-if="plannerMessage" class="planner-feedback planner-feedback--error">
                {{ plannerMessage }}
              </p>

              <div v-if="!selectedScheduleGroup" class="planner-helper-text">
                <i class="fa fa-info-circle"></i>
                Open a workout day to add exercises to it.
              </div>
            </div>

            <div v-if="loadingExercises" class="builder-empty planner-empty planner-empty--loading" aria-live="polite">
              <div class="planner-empty__icon">⏳</div>
              <h4>Loading exercise library</h4>
              <p>Pulling your exercise catalog now. This will only take a moment.</p>
            </div>

            <div v-else-if="loadingPlanner" class="builder-empty planner-empty planner-empty--loading" aria-live="polite">
              <div class="planner-empty__icon">📦</div>
              <h4>Loading saved planner</h4>
              <p>Fetching your saved workout schedule from your profile settings.</p>
            </div>

            <div v-else-if="workoutExercises.length === 0" class="builder-empty planner-empty" aria-live="polite">
              <div class="planner-empty__icon">🗓️</div>
              <h4>No exercises added yet</h4>
              <p>Open a workout day above and start adding exercises.</p>
            </div>
        </div>
      </section>

      <footer v-if="canShowWorkoutDetails" class="builder-footer">
        <p
          v-if="saveMessage"
          :class="[
            'save-message',
            /failed|please|unable/i.test(saveMessage) ? 'err' : 'ok',
          ]"
        >
          {{ saveMessage }}
        </p>
        <button type="button" class="btn-save" :disabled="saving" @click="handlePrimarySave">
          {{ primarySaveLabel }}
        </button>
      </footer>
    </div>

    <ExercisePickerModal
      :is-open="pickerOpen"
      :exercises="allExercises"
      :user-id="userId"
      @close="closePicker"
      @add="addExerciseToWorkout"
    />

    <!-- Delete Day Confirmation Modal -->
    <transition name="modal-fade">
      <div v-if="showDeleteModal" class="delete-modal-backdrop" @click.self="cancelDeleteDay">
        <div class="delete-modal">
          <div class="delete-modal__header">
            <h3>Delete Workout Day?</h3>
          </div>
          <div class="delete-modal__body">
            <p>
              Are you sure you want to delete <strong>{{ dayToDelete }}</strong>?
              This will also delete all exercises assigned to that day.
            </p>
          </div>
          <div class="delete-modal__actions">
            <button type="button" class="modal-btn modal-btn--cancel" @click="cancelDeleteDay">
              Cancel
            </button>
            <button type="button" class="modal-btn modal-btn--delete" @click="confirmDeleteDay">
              Delete Day
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.workout-builder-page {
  display: block;
}

.workout-builder-canvas {
  display: grid;
  gap: 16px;
}

/* ── Tab Bar ──────────────────────────────────────────────────── */
.builder-tabs {
  display: flex;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 5px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.builder-tab {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 10px;
  min-height: 42px;
  padding: 0 10px;
  font-weight: 700;
  font-size: 0.86rem;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
  cursor: pointer;
  white-space: nowrap;
}

.builder-tab i {
  font-size: 0.82rem;
}

.builder-tab:hover:not(:disabled) {
  background: #f1f5f9;
  color: #1e293b;
}

.builder-tab--active {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.builder-tab--active:hover {
  background: #1d4ed8;
  color: #ffffff;
}

.builder-tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.builder-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.builder-hero h2 {
  margin: 0;
  font-size: 1.28rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.builder-hero p {
  margin: 8px 0 0;
  color: #cbd5e1;
  font-size: 0.92rem;
}

.builder-hero__stats {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.builder-hero__stats div {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 10px 10px;
  display: grid;
  gap: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.builder-hero__stats strong {
  font-size: 1.1rem;
  line-height: 1;
}

.builder-hero__stats span {
  font-size: 0.76rem;
  color: #cbd5e1;
}

.builder-section {
  background: #ffffff;
  border: 1px solid #e5ecf5;
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.045);
}

.collapsible-panel {
  padding: 16px;
}

.schedule-hub-head__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.schedule-hub-list {
  display: grid;
  gap: 12px;
}

.schedule-hub-empty {
  border-style: solid;
  background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
  gap: 12px;
}

.schedule-hub-empty__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-create-plan,
.btn-ai-suggest {
  border-radius: 12px;
  min-height: 46px;
  padding: 0 16px;
  font-weight: 700;
  font-size: 0.88rem;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.btn-create-plan {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
}

.btn-create-plan:hover {
  transform: translateY(-1px);
  background: #1d4ed8;
}

.btn-ai-suggest {
  border: 1px solid #dc2626;
  background: #dc2626;
  color: #fff;
  box-shadow: 0 8px 18px rgba(220, 38, 38, 0.18);
}

.btn-ai-suggest:hover {
  transform: translateY(-1px);
  background: #b91c1c;
}

.collapsible-header {
  width: 100%;
  border: 1px solid #e6ebf3;
  background: #f8fafc;
  border-radius: 14px;
  padding: 14px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.collapsible-header:hover {
  background: #f1f5f9;
  border-color: #dbe4ef;
}

.collapsible-header__text {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.collapsible-header__text strong {
  color: #0f172a;
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: -0.012em;
}

.collapsible-header__text small {
  color: #64748b;
  font-size: 0.84rem;
}

.collapsible-header__icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #e2e8f0;
  color: #1e293b;
  flex: 0 0 auto;
  transition: transform 0.2s ease;
}

.collapsible-header__icon.open {
  transform: rotate(180deg);
}

.collapsible-panel__body {
  margin-top: 20px;
}

.panel-collapse-enter-active,
.panel-collapse-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.panel-collapse-enter-from,
.panel-collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.planner-section {
  border: 1px solid #dfe7f2;
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
  padding: 16px;
}

.planner-panel-head {
  cursor: pointer;
  margin-bottom: 0;
  border: 1px solid #e5ebf4;
  border-radius: 14px;
  padding: 14px;
  background: #f8fafc;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.planner-panel-head:hover {
  background: #f1f5f9;
  border-color: #dbe4ef;
}

.planner-head-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.planner-heading-group {
  min-width: 0;
}

.planner-heading-group h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.planner-heading-group p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.85rem;
}

.planner-tools {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.planner-mode-toggle {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid #dbe4ef;
  border-radius: 12px;
  background: #f8fafc;
  padding: 4px;
  gap: 6px;
}

.planner-mode-btn {
  border: none;
  background: transparent;
  color: #334155;
  border-radius: 9px;
  min-height: 40px;
  padding: 8px 10px;
  font-weight: 700;
  font-size: 0.88rem;
}

.planner-mode-btn.active {
  background: #dbeafe;
  color: #1d4ed8;
}

.planner-group-editor {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.planner-feedback {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
}

.planner-feedback--error {
  color: #b91c1c;
}

.planner-group-editor input {
  border: 1px solid #d6dee9;
  border-radius: 12px;
  min-height: 46px;
  padding: 11px 12px;
  background: #f8fafc;
}

.planner-group-add {
  border: 1px solid #1d4ed8;
  border-radius: 12px;
  min-height: 46px;
  padding: 0 14px;
  background: #2563eb;
  color: #fff;
  font-weight: 700;
}

.planner-group-save {
  border: 1px solid #059669;
  border-radius: 12px;
  min-height: 46px;
  padding: 0 14px;
  background: #059669;
  color: #fff;
  font-weight: 700;
}

.planner-helper-text {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  background: #f0f9ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  font-size: 0.88rem;
  font-weight: 600;
  margin-top: 12px;
}

.planner-helper-text i {
  font-size: 14px;
}

/* Workout Day Accordion System */
.workout-day-accordion {
  display: grid;
  gap: 10px;
}

.workout-day-card {
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  background: #ffffff;
  overflow: hidden;
  transition: all 0.2s ease;
}

.workout-day-card.active {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.10);
}

.workout-day-header {
  width: 100%;
  border: none;
  background: transparent;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease;
}

.workout-day-header:hover {
  background: rgba(0, 0, 0, 0.02);
}

.workout-day-card.active .workout-day-header {
  background: transparent;
}

.day-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
  flex: 1;
}

.day-title-group strong {
  font-size: 0.96rem;
  font-weight: 700;
  color: #0f172a;
}

.selected-badge {
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.exercise-count {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.day-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.day-action-btn {
  border-radius: 8px;
  min-height: 32px;
  padding: 0 10px;
  font-size: 0.8rem;
  font-weight: 700;
  transition: all 0.2s ease;
}

.day-action-btn--select {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
}

.day-action-btn--select:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.day-action-btn--selected {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #ffffff;
  cursor: default;
}

.day-action-btn--selected:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.day-action-btn--edit {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.day-action-btn--edit:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}

.day-action-btn--delete {
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #b91c1c;
}

.day-action-btn--delete:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
}

.day-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chevron-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
}

.chevron-btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.workout-day-card.active .chevron-btn {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.workout-day-panel {
  background: #ffffff;
  border-top: 1px solid #dbe4f0;
  padding: 16px;
}

.workout-day-card.active .workout-day-panel {
  background: #ffffff;
}

.day-exercises-list {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.empty-day-state {
  border: 1px dashed #bfdbfe;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  background: #f8fbff;
  margin-bottom: 16px;
}

.empty-day-state p {
  margin: 0;
  color: #64748b;
  font-size: 0.92rem;
}

.day-panel-actions {
  display: flex;
  justify-content: center;
  margin-top: 4px;
}

.btn-add-exercise-day {
  border: 1px solid #10b981;
  border-radius: 12px;
  background: #059669;
  color: #fff;
  font-weight: 700;
  padding: 12px 24px;
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 6px 16px rgba(5, 150, 105, 0.18);
  transition: all 0.2s ease;
  font-size: 0.92rem;
}

.btn-add-exercise-day:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(5, 150, 105, 0.25);
  background: #047857;
}

.btn-add-exercise-day .btn-add-exercise__icon {
  font-size: 1rem;
  line-height: 1;
}

/* Accordion slide animation */
.accordion-slide-enter-active,
.accordion-slide-leave-active {
  transition: all 0.3s ease;
  max-height: 2000px;
  overflow: hidden;
}

.accordion-slide-enter-from,
.accordion-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Delete Modal */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.delete-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}

.delete-modal {
  width: min(420px, 100%);
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25);
  animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.delete-modal__header {
  padding: 20px 22px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.delete-modal__header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
}

.delete-modal__body {
  padding: 20px 22px;
}

.delete-modal__body p {
  margin: 0;
  color: #475569;
  font-size: 0.94rem;
  line-height: 1.6;
}

.delete-modal__body strong {
  color: #0f172a;
  font-weight: 700;
}

.delete-modal__actions {
  padding: 16px 22px 20px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.modal-btn {
  border-radius: 10px;
  min-height: 42px;
  padding: 0 20px;
  font-weight: 700;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.modal-btn--cancel {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
}

.modal-btn--cancel:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.modal-btn--delete {
  border: 1px solid #dc2626;
  background: #dc2626;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
}

.modal-btn--delete:hover {
  background: #b91c1c;
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.3);
}

/* Responsive adjustments */
@media (max-width: 639px) {
  .day-title-group {
    flex-basis: 100%;
  }

  .day-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .workout-day-header {
    flex-wrap: wrap;
  }
}

.builder-section__head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1.02rem;
}

.builder-section__head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.86rem;
}

.builder-section__head--inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.btn-add-exercise {
  width: 100%;
  border: 1px solid #10b981;
  border-radius: 12px;
  background: #059669;
  color: #fff;
  font-weight: 700;
  padding: 12px 16px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 8px 18px rgba(5, 150, 105, 0.2);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.btn-add-exercise:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(5, 150, 105, 0.28);
}

.btn-add-exercise__icon {
  font-size: 1rem;
  line-height: 1;
}

.builder-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  color: #64748b;
}

.planner-empty {
  border: 1px solid #dce5f3;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fbff 0%, #f7fafc 100%);
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 18px;
  min-height: 180px;
}

.planner-empty--loading {
  border-color: #cbd5e1;
}

.planner-empty__icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #e2e8f0;
  font-size: 1.35rem;
}

.planner-empty h4 {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: 1.02rem;
}

.planner-empty p {
  margin: 0;
  max-width: 420px;
  color: #64748b;
  font-size: 0.92rem;
}

.btn-add-exercise--empty {
  margin-top: 8px;
  width: 100%;
  max-width: 260px;
}

.planner-content {
  display: grid;
  gap: 12px;
}

.planner-group-card {
  border: 1px solid #d6e0ee;
  border-radius: 14px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
}

.planner-group-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.planner-group-card__head h4 {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
}

.planner-group-card__head p {
  margin: 2px 0 0;
  color: #64748b;
  font-size: 0.84rem;
}

.planner-remove-group {
  border: 1px solid #fecaca;
  border-radius: 10px;
  min-height: 36px;
  padding: 0 10px;
  background: #fff1f2;
  color: #b91c1c;
  font-weight: 600;
}

.planner-remove-group:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.planner-group-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
  color: #64748b;
  font-size: 0.88rem;
  background: #f8fafc;
}

.builder-footer {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e8edf4;
  border-radius: 14px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
}

.save-message {
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
}

.save-message.ok {
  color: #166534;
}

.save-message.err {
  color: #b91c1c;
}

.btn-save {
  width: 100%;
  border: none;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  font-weight: 700;
  padding: 12px 18px;
  min-height: 48px;
}

.btn-save:disabled {
  opacity: 0.55;
}

@media (min-width: 640px) {
  .workout-builder-canvas { gap: 16px; }

  .builder-hero {
    padding: 20px;
  }

  .builder-section,
  .planner-section,
  .collapsible-panel {
    padding: 20px;
  }

  .planner-group-editor {
    grid-template-columns: 1fr auto;
  }

  .schedule-hub-head__actions {
    justify-content: flex-end;
  }

  .planner-group-add {
    min-width: 132px;
  }

  .planner-primary-actions {
    justify-content: flex-end;
  }

  .btn-add-exercise {
    width: auto;
    min-width: 180px;
  }

  .builder-footer {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .btn-save {
    width: auto;
    min-width: 180px;
  }
}

@media (min-width: 992px) {
  .workout-builder-canvas { gap: 16px; }

  .builder-hero {
    padding: 22px;
  }

  .builder-section,
  .planner-section,
  .collapsible-panel,
  .builder-footer {
    padding: 24px;
  }

  .planner-content {
    gap: 16px;
  }
}

/* ── Short / long label toggle ───────────────────────────────────── */
.btn-label-short { display: none; }

@media (max-width: 639px) {
  /* Show short labels, hide long ones */
  .btn-label-full  { display: none; }
  .btn-label-short { display: inline; }

  /* Side-by-side instead of stacked */
  .schedule-hub-head__actions,
  .schedule-hub-empty__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
  }

  .btn-create-plan,
  .btn-ai-suggest {
    width: 100%;
    padding: 0 10px;
    font-size: 0.83rem;
  }

  /* Tab bar: horizontal scroll so 3 tabs never overflow */
  .builder-tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
  }
  .builder-tabs::-webkit-scrollbar { display: none; }
  .builder-tab {
    flex-shrink: 0;
    min-width: 0;
    font-size: 0.82rem;
    padding: 0 8px;
  }

  /* Hero stats: allow horizontal scroll when screen is very narrow */
  .builder-hero__stats {
    overflow-x: auto;
    scrollbar-width: none;
    grid-template-columns: repeat(3, minmax(80px, 1fr));
  }
  .builder-hero__stats::-webkit-scrollbar { display: none; }

  /* Footer: stack label above save button */
  .builder-footer {
    grid-template-columns: 1fr;
  }
  .btn-save {
    width: 100%;
  }

  /* Day actions: wrap on very small phones */
  .day-actions {
    flex-wrap: wrap;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE COMPRESSION  ≤ 768px
   v0.81.5 — Workout Builder Mobile Compression
   CSS only — no logic/API/auth changes
   ═══════════════════════════════════════════════════════════════════ */

/* Global density helper */
.workout-builder-mobile {
  gap: 8px;
  padding: 8px;
  margin: 6px;
}

@media (max-width: 768px) {
  /* ── Canvas ── */
  .workout-builder-canvas {
    gap: 8px;
  }

  /* ── Hero compression ── */
  .builder-hero {
    padding: 10px 12px;
    gap: 8px;
    border-radius: 14px;
    flex-direction: row;
    align-items: center;
  }

  .builder-hero h2 {
    font-size: 1rem;
    margin: 0;
  }

  .builder-hero p {
    font-size: 0.78rem;
    margin-top: 2px;
  }

  /* Stats: 3-col, 60px target height */
  .builder-hero__stats {
    gap: 6px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .builder-hero__stats div {
    padding: 6px 8px;
    border-radius: 8px;
    gap: 2px;
    min-height: 0;
  }

  .builder-hero__stats strong {
    font-size: 0.95rem;
    line-height: 1;
  }

  .builder-hero__stats span {
    font-size: 0.65rem;
  }

  /* ── Tab bar ── */
  .builder-tabs {
    padding: 4px;
    border-radius: 10px;
  }

  .builder-tab {
    min-height: 34px;
    font-size: 0.78rem;
    padding: 0 7px;
    gap: 5px;
    border-radius: 7px;
  }

  .builder-tab i {
    font-size: 0.74rem;
  }

  /* ── Sections ── */
  .builder-section,
  .planner-section,
  .collapsible-panel {
    padding: 10px;
    border-radius: 12px;
  }

  /* ── Day card header ── */
  .workout-day-header {
    padding: 8px 10px;
    gap: 6px;
  }

  .day-title-group {
    gap: 5px;
  }

  .day-title-group strong {
    font-size: 0.85rem;
  }

  .selected-badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  .exercise-count {
    font-size: 11px;
  }

  /* Day actions — two rows on mobile */
  .day-actions {
    flex-wrap: wrap;
    gap: 4px;
    justify-content: flex-end;
  }

  .day-action-btn {
    min-height: 28px;
    padding: 0 8px;
    font-size: 0.73rem;
    border-radius: 6px;
  }

  .chevron-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }

  /* ── Day panel ── */
  .workout-day-panel {
    padding: 8px 10px;
  }

  .day-exercises-list {
    gap: 8px;
    margin-bottom: 10px;
  }

  /* ── Add Exercise button ── */
  .btn-add-exercise-day {
    padding: 8px 16px;
    min-height: 36px;
    font-size: 0.82rem;
    border-radius: 10px;
  }

  /* ── Planner tools ── */
  .planner-tools {
    gap: 8px;
    margin-bottom: 10px;
  }

  .planner-mode-btn {
    min-height: 34px;
    font-size: 0.82rem;
    padding: 4px 8px;
  }

  .planner-group-editor input {
    min-height: 36px;
    padding: 7px 10px;
    font-size: 0.82rem;
    border-radius: 10px;
  }

  .planner-group-add,
  .planner-group-save {
    min-height: 36px;
    font-size: 0.82rem;
    padding: 0 12px;
    border-radius: 10px;
  }

  /* ── Schedule list ── */
  .schedule-hub-list {
    gap: 8px;
  }

  /* ── Create/AI buttons ── */
  .btn-create-plan,
  .btn-ai-suggest {
    min-height: 36px;
    font-size: 0.8rem;
    padding: 0 12px;
    border-radius: 10px;
  }

  /* ── Empty states ── */
  .planner-empty {
    padding: 16px 12px;
    min-height: 120px;
    gap: 6px;
  }

  .planner-empty__icon {
    width: 40px;
    height: 40px;
    font-size: 1.1rem;
  }

  .planner-empty h4 {
    font-size: 0.9rem;
  }

  .planner-empty p {
    font-size: 0.8rem;
  }

  /* ── Collapsible header ── */
  .collapsible-header {
    padding: 10px 12px;
    border-radius: 10px;
  }

  .collapsible-header__text strong {
    font-size: 0.9rem;
  }

  .collapsible-header__text small {
    font-size: 0.76rem;
  }

  .collapsible-panel__body {
    margin-top: 10px;
  }

  /* ── Footer ── */
  .builder-footer {
    padding: 10px;
    gap: 8px;
    border-radius: 10px;
  }

  .btn-save {
    min-height: 40px;
    font-size: 0.88rem;
  }

  /* ── Heading groups ── */
  .planner-heading-group h3 {
    font-size: 0.9rem;
  }

  .planner-heading-group p {
    font-size: 0.77rem;
  }

  .builder-section__head h3 {
    font-size: 0.9rem;
  }

  .builder-section__head p {
    font-size: 0.77rem;
  }

  /* ── Workout day accordion ── */
  .workout-day-accordion {
    gap: 6px;
  }

  .workout-day-card {
    border-radius: 10px;
  }

  /* ── Empty day state ── */
  .empty-day-state {
    padding: 14px;
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .empty-day-state p {
    font-size: 0.82rem;
  }
}

@media (max-width: 480px) {
  .workout-builder-canvas {
    gap: 6px;
  }

  .builder-hero {
    padding: 8px 10px;
  }

  .builder-hero h2 {
    font-size: 0.92rem;
  }

  .builder-hero__stats div {
    padding: 5px 6px;
  }

  .builder-hero__stats strong {
    font-size: 0.88rem;
  }

  .builder-hero__stats span {
    font-size: 0.6rem;
  }

  .builder-tab {
    min-height: 30px;
    font-size: 0.74rem;
    padding: 0 5px;
  }

  .day-action-btn {
    min-height: 26px;
    padding: 0 6px;
    font-size: 0.68rem;
  }

  .builder-section,
  .planner-section,
  .collapsible-panel {
    padding: 8px;
    border-radius: 10px;
  }
}

@media (max-width: 390px) {
  .workout-builder-canvas {
    gap: 5px;
  }

  .builder-hero {
    padding: 7px 9px;
  }

  .builder-hero h2 {
    font-size: 0.88rem;
  }

  .builder-hero__stats strong {
    font-size: 0.82rem;
  }

  .builder-tab {
    min-height: 28px;
    font-size: 0.7rem;
    gap: 4px;
  }

  .builder-tab i {
    font-size: 0.68rem;
  }

  .day-action-btn {
    min-height: 24px;
    padding: 0 5px;
    font-size: 0.65rem;
  }

  .workout-day-header {
    padding: 6px 8px;
  }
}
</style>
