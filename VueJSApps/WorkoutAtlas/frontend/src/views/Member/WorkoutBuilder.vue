<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import WorkoutMetadataForm from '@/components/workout-builder/WorkoutMetadataForm.vue';
import ExercisePickerModal from '@/components/workout-builder/ExercisePickerModal.vue';
import WorkoutExerciseBlock from '@/components/workout-builder/WorkoutExerciseBlock.vue';
import WorkoutScheduleListItem from '@/components/workout-builder/WorkoutScheduleListItem.vue';
import { API_BASE } from '@/config/env';
import { refreshWorkoutStatus, setUserWorkoutStatus } from '@/composable/workoutStatusManager';
import { DEFAULT_EXERCISE_IMAGE, getExerciseImage } from '@/utils/exerciseImage';
import { DEFAULT_WORKOUT_PLAN_IMAGE, buildWorkoutPlanCoverImageUrl, applyWorkoutPlanImageFallback } from '@/utils/workoutPlanImage';
import { countUniqueWorkoutPlanExercises } from '@/utils/workoutPlanExerciseCount';
import { showConfirmDialog } from '@/utils/browserDialogs';
import {
  buildDiagnosticsPayload,
  buildFriendlyMessage,
  canViewTechnicalDiagnostics,
} from '@/utils/userFriendlyErrors';

const metadata = ref({
  name: '',
  description: '',
  type: 'Strength',
  category: 'General Fitness',
  planType: '',
  estimatedDuration: 45,
  planDurationWeeks: '',
  goalId: '',
  goalTargetDate: '',
  goalContext: null,
  goals: [],
  otherGoal: '',
});

const allExercises = ref([]);
const workoutExercises = ref([]);
const pickerOpen = ref(false);
const loadingExercises = ref(false);
const loadingPlanner = ref(false);
const loadingFeaturedPlans = ref(false);
const cloningFeaturedPlanId = ref('');
const loadingGoals = ref(false);
const saving = ref(false);
const publishing = ref(false);
const saveMessage = ref('');
const plannerMessage = ref('');
const userId = ref(null);
const currentRoleSlug = ref('');
const currentPlanId = ref('');
const selectedWorkoutId = ref('');
const viewEditMode = ref(false);
const workoutSchedules = ref([]);
const isCreatingWorkout = ref(false);
const hasSavedWorkoutDetails = ref(false);
const deletingWorkoutId = ref('');
const hasSavedWorkoutExerciseList = ref(false);
const canCreateFeaturedPlans = ref(false);
const isWorkoutDetailsOpen = ref(true);
const isSchedulePlannerOpen = ref(true);
const openMenuDay = ref(null);
const openMenuPlacement = ref('down');
const openMenuAnchor = ref('top');
const aiPrompt = ref('');
const aiResponse = ref('');
const aiLoading = ref(false);
const gatewayTestLoading = ref(false);
const aiError = ref('');
const isAdminUser = ref(false);
const planPublicationStatus = ref('draft');
const selectedPublicationStatus = ref('draft');
const isGlobalPlanFeatured = ref(false);
const adminUserPlansLoading = ref(false);
const adminUserPlansError = ref('');
const adminUserPlans = ref([]);
const globalPlansLoading = ref(false);
const globalPlansDeletingId = ref('');
const globalPlansError = ref('');
const globalPlansSuccess = ref('');
const globalPlans = ref([]);
const showGlobalDeletePlanModal = ref(false);
const selectedGlobalPlanForDelete = ref(null);

const MENU_ESTIMATED_HEIGHT = 260;
const MENU_SAFE_GAP = 12;

const getDayMenuPlacement = (buttonEl) => {
  if (!buttonEl || typeof window === 'undefined') {
    return 'down';
  }

  const rect = buttonEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  return spaceBelow < MENU_ESTIMATED_HEIGHT + MENU_SAFE_GAP && spaceAbove > spaceBelow ? 'up' : 'down';
};

const closeDayMenu = (e) => {
  if (inlineEditingDayName.value && !e.target.closest('.day-title-edit-wrap')) {
    saveInlineDayNameEdit();
  }

  if (!e.target.closest('.day-kebab-wrap')) {
    openMenuDay.value = null;
    openMenuPlacement.value = 'down';
    openMenuAnchor.value = 'top';
  }
};

const toggleDayMenu = (dayName, event, anchor = 'top') => {
  if (openMenuDay.value === dayName) {
    openMenuDay.value = null;
    openMenuPlacement.value = 'down';
    openMenuAnchor.value = 'top';
    return;
  }

  openMenuPlacement.value = getDayMenuPlacement(event?.currentTarget);
  openMenuAnchor.value = anchor;
  openMenuDay.value = dayName;
};
const route = useRoute();
const router = useRouter();

// Tab: 'view' | 'create' | 'ai' | 'global'
const builderTab = ref('view');
const planSourceTab = ref('my');
const globalPlansSubTab = ref('global');
const mainAccordion = ref({
  build: true,
});

const scheduleMode = ref('day');
const dayGroups = ref([]);
const weekGroups = ref([]);
const dayGroupOrders = ref([]);
const weekGroupOrders = ref([]);
const selectedScheduleGroup = ref(null);
const expandedGroupIdByMode = ref({ day: null, week: null });
const dayGroupIdentityMap = ref([]);
const weekGroupIdentityMap = ref([]);
const newScheduleGroupName = ref('');
const newScheduleGroupNameBottom = ref('');
const inlineEditingDayName = ref('');
const inlineDayNameDraft = ref('');
const inlineDayNameError = ref('');
const scheduleGroupEditorError = ref('');
const scheduleGroupBottomEditorError = ref('');
const selectedExerciseInsertPosition = ref('bottom');
const showDeleteModal = ref(false);
const showPublishPlanModal = ref(false);
const showSaveWorkoutPlanModal = ref(false);
const showPlanTypeConversionModal = ref(false);
const dayToDelete = ref(null);
const skipNextRoutePlannerLoad = ref(false);
const plannerLoadRequestId = ref(0);
const conversionTargetPlanType = ref('');
const conversionDestinationTitle = ref('');
const conversionPreview = ref(null);
const conversionPreviewLoading = ref(false);
const conversionCreateLoading = ref(false);
const conversionError = ref('');
const conversionInfo = ref('');

const featuredWorkoutPlans = ref([]);
const showManagedMarketplacePlans = ref(false);
const marketplaceSearchQuery = ref('');
const marketplaceFiltersOpen = ref(false);
const marketplaceFilters = ref({
  source: 'all',
  pricing: 'all',
  workoutType: 'all',
  category: 'all',
  difficulty: 'all',
  planDuration: 'all',
});
const currentWorkoutPlanSlide = ref(0);
const selectedTemplatePlanId = ref('');
const selectedTemplatePlanName = ref('');
const showGlobalLibraryViewModal = ref(false);
const globalLibraryViewLoading = ref(false);
const globalLibraryViewError = ref('');
const globalLibraryViewPlan = ref(null);
const globalLibraryViewDaySchedules = ref([]);
const errorDiagnosticsByArea = ref({
  conversion: null,
  ai: null,
  globalPlans: null,
  adminUserPlans: null,
  globalLibraryView: null,
});
const diagnosticsExpandedByArea = ref({
  conversion: false,
  ai: false,
  globalPlans: false,
  adminUserPlans: false,
  globalLibraryView: false,
});
const personalGoals = ref([]);
const WORKOUT_BUILDER_DRAFT_STORAGE_KEY = 'wa_workout_builder_unsaved_draft_v1';
const coverUploadInputRef = ref(null);
const coverImageRevision = ref(0);
const currentPlanHasCustomCover = ref(false);
const persistedCoverImageReference = ref('');
const pendingCoverFile = ref(null);
const pendingCoverPreviewUrl = ref('');
const coverUploadInFlight = ref(false);
const coverDeleteInFlight = ref(false);

const canShowTechnicalDiagnostics = computed(() =>
  canViewTechnicalDiagnostics({ roleSlug: currentRoleSlug.value })
);

const setFriendlyAreaError = (area, {
  status = null,
  code = '',
  requestId = '',
  service = '',
  rawMessage = '',
  category = 'generic',
  fallback = 'Unable to complete your request. Please try again.',
  preserveValidation = true,
} = {}) => {
  const message = buildFriendlyMessage({
    status,
    code,
    rawMessage,
    category,
    fallback,
    preserveValidation,
  });

  if (area === 'conversion') conversionError.value = message;
  if (area === 'ai') aiError.value = message;
  if (area === 'globalPlans') globalPlansError.value = message;
  if (area === 'adminUserPlans') adminUserPlansError.value = message;
  if (area === 'globalLibraryView') globalLibraryViewError.value = message;

  errorDiagnosticsByArea.value = {
    ...errorDiagnosticsByArea.value,
    [area]: buildDiagnosticsPayload({ status, code, requestId, service, rawMessage }),
  };
};

const clearAreaError = (area) => {
  if (area === 'conversion') conversionError.value = '';
  if (area === 'ai') aiError.value = '';
  if (area === 'globalPlans') globalPlansError.value = '';
  if (area === 'adminUserPlans') adminUserPlansError.value = '';
  if (area === 'globalLibraryView') globalLibraryViewError.value = '';

  errorDiagnosticsByArea.value = {
    ...errorDiagnosticsByArea.value,
    [area]: null,
  };
  diagnosticsExpandedByArea.value = {
    ...diagnosticsExpandedByArea.value,
    [area]: false,
  };
};

const toggleErrorDiagnostics = (area) => {
  diagnosticsExpandedByArea.value = {
    ...diagnosticsExpandedByArea.value,
    [area]: !diagnosticsExpandedByArea.value?.[area],
  };
};
const coverUploadProgress = ref(0);
const coverUiMessage = ref('');
const coverUiMessageType = ref('info');

const PLAN_TYPE_GLOBAL = 'global';
const PLAN_TYPE_PERSONAL = 'personal';
const PLAN_TYPE_TRAINER_SHARED = 'trainer_shared';
const PLAN_TYPE_COMMUNITY = 'community';
const PLAN_TYPE_MARKETPLACE = 'marketplace';

const defaultWorkoutPlanTypeByRole = computed(() => {
  return PLAN_TYPE_PERSONAL;
});

const workoutPlanTypeOptions = computed(() => {
  const role = String(currentRoleSlug.value || '').trim().toLowerCase();
  const isTrainerRole = role === 'trainer';
  const canUseGlobalPlan = isTrainerRole || isAdminUser.value;
  const showTrainerShared = isTrainerRole || isAdminUser.value;

  const options = [
    { value: PLAN_TYPE_PERSONAL, label: 'Personal (Private)' },
    ...(showTrainerShared ? [{ value: PLAN_TYPE_TRAINER_SHARED, label: 'Trainer Shared' }] : []),
    { value: PLAN_TYPE_COMMUNITY, label: 'Community' },
    { value: PLAN_TYPE_MARKETPLACE, label: 'Marketplace Paid (Coming Soon)' },
    ...(canUseGlobalPlan ? [{ value: PLAN_TYPE_GLOBAL, label: 'Global Plan (Shown to All)' }] : []),
  ];

  const selectedPlanType = String(metadata.value?.planType || '').trim();
  const hasSelectedInOptions = options.some((option) => option.value === selectedPlanType);
  if (!hasSelectedInOptions && ['featured', 'community_shared'].includes(selectedPlanType)) {
    const legacyLabel = selectedPlanType === 'featured' ? 'Featured (Legacy)' : 'Community Shared (Legacy)';
    options.push({ value: selectedPlanType, label: legacyLabel });
  }

  return options;
});

const workoutPlanCategoryOptions = [
  'Weight Loss',
  'Strength',
  'Muscle Building',
  'Cardio',
  'General Fitness',
  'Beginner',
];

const canEditSelectedPlanType = computed(() => {
  return !String(currentPlanId.value || '').trim();
});

const planTypeLabelMap = Object.freeze({
  personal: 'Personal (Private)',
  trainer_shared: 'Trainer Shared',
  community: 'Community',
  global: 'Global Plan',
  featured: 'Featured (Legacy)',
  community_shared: 'Community Shared (Legacy)',
  marketplace: 'Marketplace Paid (Coming Soon)',
});

const normalizedCurrentPlanType = computed(() => String(metadata.value?.planType || '').trim().toLowerCase());

const selectedPlanTypeDisplayLabel = computed(() => {
  const selected = normalizedCurrentPlanType.value;
  if (!selected) return 'Unknown';
  return planTypeLabelMap[selected] || selected.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
});

const conversionSourcePlanName = computed(() => {
  const currentName = String(metadata.value?.name || '').trim();
  return currentName || 'Untitled Workout';
});

const conversionDefaultDestinationTitle = computed(() => {
  return `${conversionSourcePlanName.value} - Copy`;
});

const normalizedConversionRole = computed(() => {
  const role = String(currentRoleSlug.value || '').trim().toLowerCase();
  return role === 'administrator' ? 'admin' : role;
});

const isAuthorizedConversionTargetType = (candidateType) => {
  const planType = String(candidateType || '').trim().toLowerCase();
  const role = normalizedConversionRole.value;

  if (!planType || planType === PLAN_TYPE_MARKETPLACE) {
    return false;
  }

  if (planType === PLAN_TYPE_GLOBAL) {
    return role === 'admin';
  }

  if (planType === PLAN_TYPE_TRAINER_SHARED) {
    return role === 'trainer';
  }

  return [PLAN_TYPE_PERSONAL, PLAN_TYPE_COMMUNITY].includes(planType);
};

const canConvertExistingPlanType = computed(() => {
  if (!String(currentPlanId.value || '').trim()) {
    return false;
  }
  if (canEditSelectedPlanType.value) {
    return false;
  }
  const selected = normalizedCurrentPlanType.value;
  if (selected === PLAN_TYPE_MARKETPLACE) {
    return false;
  }
  return true;
});

const conversionTargetOptions = computed(() => {
  const conversionTypeLabels = Object.freeze({
    [PLAN_TYPE_PERSONAL]: 'Personal (Only visible to you)',
    [PLAN_TYPE_COMMUNITY]: 'Community (Created and shared with others)',
    [PLAN_TYPE_TRAINER_SHARED]: 'Trainer Shared (Trainer-created shared plans)',
    [PLAN_TYPE_GLOBAL]: 'Global (Available to everyone)',
  });

  const selected = normalizedCurrentPlanType.value;
  const options = workoutPlanTypeOptions.value
    .filter((option) => {
      const value = String(option?.value || '').trim().toLowerCase();
      if (!value || value === selected) return false;
      return isAuthorizedConversionTargetType(value);
    })
    .map((option) => ({
      value: String(option.value || '').trim().toLowerCase(),
      label: conversionTypeLabels[String(option.value || '').trim().toLowerCase()] || String(option.label || '').trim(),
      disabled: Boolean(option.disabled),
    }));

  return options;
});

const conversionUnavailableReason = computed(() => {
  if (!String(currentPlanId.value || '').trim()) {
    return 'Save this workout plan before converting plan type.';
  }

  const selected = normalizedCurrentPlanType.value;
  if (selected === PLAN_TYPE_MARKETPLACE) {
    return 'Marketplace plan conversion is not implemented yet.';
  }

  if (!conversionTargetOptions.value.length) {
    return 'No authorized destination plan types are available for this account and source plan type.';
  }

  return '';
});

const ensureDraftPlanTypeDefault = () => {
  if (String(currentPlanId.value || '').trim()) {
    return;
  }

  if (String(metadata.value?.planType || '').trim()) {
    return;
  }

  metadata.value = {
    ...metadata.value,
    planType: defaultWorkoutPlanTypeByRole.value,
  };
};

const resetPlanTypeConversionState = () => {
  conversionPreview.value = null;
  clearAreaError('conversion');
  conversionInfo.value = '';
};

const normalizeConversionDestinationTitle = () => {
  conversionDestinationTitle.value = String(conversionDestinationTitle.value || '').trimStart();
};

const validateConversionDestinationTitle = () => {
  const trimmed = String(conversionDestinationTitle.value || '').trim();
  if (!trimmed) {
    return 'Enter a new plan name for the converted copy.';
  }
  if (trimmed.length > 150) {
    return 'New plan name must be 150 characters or fewer.';
  }
  return '';
};

const markConversionInputChanged = () => {
  conversionPreview.value = null;
  conversionInfo.value = '';
  clearAreaError('conversion');
};

const closePlanTypeConversionModal = () => {
  if (conversionPreviewLoading.value || conversionCreateLoading.value) {
    return;
  }
  showPlanTypeConversionModal.value = false;
};

const openPlanTypeConversionModal = () => {
  if (!canConvertExistingPlanType.value) {
    return;
  }

  resetPlanTypeConversionState();
  const firstOption = conversionTargetOptions.value.find((option) => !option.disabled);
  if (!firstOption) {
    clearAreaError('conversion');
    conversionError.value = conversionUnavailableReason.value || 'No destination workout plan types are currently available.';
    return;
  }
  conversionTargetPlanType.value = String(firstOption?.value || '');
  conversionDestinationTitle.value = conversionDefaultDestinationTitle.value;
  showPlanTypeConversionModal.value = true;
};

const requestPlanTypeConversionPreview = async () => {
  const sourcePlanId = String(currentPlanId.value || '').trim();
  const targetPlanType = String(conversionTargetPlanType.value || '').trim();
  const destinationTitle = String(conversionDestinationTitle.value || '').trim();
  if (!sourcePlanId || !targetPlanType) {
    clearAreaError('conversion');
    conversionError.value = 'Select a destination plan type to preview conversion.';
    return;
  }

  const destinationTitleError = validateConversionDestinationTitle();
  if (destinationTitleError) {
    clearAreaError('conversion');
    conversionError.value = destinationTitleError;
    return;
  }

  conversionPreviewLoading.value = true;
  clearAreaError('conversion');
  conversionInfo.value = '';
  conversionPreview.value = null;

  try {
    const response = await fetch(`${API_BASE}/api/workout-schedules/${encodeURIComponent(sourcePlanId)}/plan-type-conversion-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ targetPlanType, destinationTitle }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw {
        status: Number(response?.status || 0) || null,
        rawMessage: data?.error || 'Failed to preview plan type conversion.',
        code: data?.code || data?.errorCode || '',
        requestId: data?.requestId || response.headers?.get('x-request-id') || '',
        service: data?.service || '',
      };
    }

    conversionPreview.value = data?.preview || null;
    conversionInfo.value = data?.canCreateConvertedPlan
      ? 'Preview ready. Confirm to create a separate converted workout plan.'
      : 'Preview found compatibility issues. Resolve blockers before conversion.';
  } catch (error) {
    setFriendlyAreaError('conversion', {
      status: error?.status,
      code: error?.code,
      requestId: error?.requestId,
      service: error?.service,
      rawMessage: error?.rawMessage || error?.message,
      fallback: 'Unable to preview this conversion right now. Please try again.',
      preserveValidation: true,
    });
  } finally {
    conversionPreviewLoading.value = false;
  }
};

const confirmPlanTypeConversion = async () => {
  const sourcePlanId = String(currentPlanId.value || '').trim();
  const targetPlanType = String(conversionTargetPlanType.value || '').trim();
  const destinationTitle = String(conversionDestinationTitle.value || '').trim();
  if (!sourcePlanId || !targetPlanType) {
    clearAreaError('conversion');
    conversionError.value = 'Select a destination plan type before conversion.';
    return;
  }

  const destinationTitleError = validateConversionDestinationTitle();
  if (destinationTitleError) {
    clearAreaError('conversion');
    conversionError.value = destinationTitleError;
    return;
  }

  conversionCreateLoading.value = true;
  clearAreaError('conversion');

  try {
    const response = await fetch(`${API_BASE}/api/workout-schedules/${encodeURIComponent(sourcePlanId)}/plan-type-conversion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ targetPlanType, destinationTitle }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      conversionPreview.value = data?.preview || conversionPreview.value;
      throw {
        status: Number(response?.status || 0) || null,
        rawMessage: data?.error || 'Failed to convert workout plan type.',
        code: data?.code || data?.errorCode || '',
        requestId: data?.requestId || response.headers?.get('x-request-id') || '',
        service: data?.service || '',
      };
    }

    syncWorkoutPlannerCapabilities(data);
    syncWorkoutSchedules(data?.workoutLists);
    hasSavedWorkoutExerciseList.value = Boolean(data?.hasSavedWorkoutExerciseList);
    setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);
    await refreshWorkoutStatus();

    const convertedPlanId = String(data?.convertedPlanId || data?.planner?.planId || '').trim();
    if (convertedPlanId) {
      await router.replace({ query: { ...route.query, planId: convertedPlanId } });
      await loadWorkoutPlanner(convertedPlanId);
    }

    saveMessage.value = 'Workout plan copied successfully.';
    showPlanTypeConversionModal.value = false;
  } catch (error) {
    setFriendlyAreaError('conversion', {
      status: error?.status,
      code: error?.code,
      requestId: error?.requestId,
      service: error?.service,
      rawMessage: error?.rawMessage || error?.message,
      fallback: 'Unable to convert this workout plan right now. Please try again.',
      preserveValidation: true,
    });
  } finally {
    conversionCreateLoading.value = false;
  }
};

const formatGoalDateLabel = (dateStr) => {
  if (!dateStr) return '';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(dateStr);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatGoalOptionLabel = (goal) => {
  const targetValue = Number(goal?.targetValue || 0);
  const targetUnit = String(goal?.targetUnit || 'lb').trim() || 'lb';
  const dateLabel = formatGoalDateLabel(goal?.targetDate);
  if (String(goal?.goalType || '').trim() === 'exercise_weight') {
    const exName = String(goal?.exerciseName || 'Exercise').trim() || 'Exercise';
    return `${exName} -- ${targetValue} ${targetUnit} by ${dateLabel}`;
  }
  return `Reach ${targetValue} ${targetUnit} by ${dateLabel}`;
};

const formatGoalContextOptionLabel = (goalContext) => {
  if (!goalContext || typeof goalContext !== 'object') {
    return 'Linked goal (unavailable)';
  }

  const goalType = String(goalContext?.goalType || '').trim();
  const targetValue = Number(goalContext?.targetValue || 0);
  const targetUnit = String(goalContext?.targetUnit || 'lb').trim() || 'lb';
  const rawTargetDate = String(goalContext?.targetDate || '').trim();
  const parsedDate = rawTargetDate ? new Date(rawTargetDate) : null;
  const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : (rawTargetDate || 'N/A');

  if (goalType === 'exercise_weight') {
    const exerciseName = String(goalContext?.exerciseName || 'Exercise').trim() || 'Exercise';
    return `${exerciseName} -- ${targetValue} ${targetUnit} by ${dateLabel}`;
  }

  return `Reach ${targetValue} ${targetUnit} by ${dateLabel}`;
};

const normalizeGlobalGoalType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'body_weight') return 'body_weight';
  if (normalized === 'exercise_weight') return 'exercise_weight';
  return 'none';
};

const formatGlobalGoalTypeLabel = (value) => {
  const normalized = normalizeGlobalGoalType(value);
  if (normalized === 'body_weight') return 'Body Weight';
  if (normalized === 'exercise_weight') return 'Exercise Weight';
  return 'No Specific Goal';
};

const normalizeGlobalCategory = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const lookup = {
    'weight loss': 'Weight Loss',
    strength: 'Strength',
    'muscle building': 'Muscle Building',
    cardio: 'Cardio',
    'general fitness': 'General Fitness',
    beginner: 'Beginner',
    global: 'General Fitness',
    featured: 'General Fitness',
    community_shared: 'General Fitness',
    'community shared': 'General Fitness',
  };
  return lookup[raw.toLowerCase()] || raw;
};

const normalizeGlobalPlan = (plan = {}) => ({
  publicationStatusRaw: String(plan.status ?? plan.publicationStatus ?? plan.planStatus ?? '').trim().toLowerCase(),
  planId: String(plan.planId || '').trim(),
  name: String(plan.name || '').trim() || 'Untitled Workout',
  description: String(plan.description || '').trim(),
  type: normalizeGlobalCategory(plan.category ?? plan.type),
  category: normalizeGlobalCategory(plan.category ?? plan.type),
  workoutType: String(plan.workoutType || '').trim(),
  source: String(plan.source || plan.planSource || '').trim(),
  pricing: String(plan.pricing || '').trim(),
  isPaid: typeof plan.isPaid === 'boolean' ? plan.isPaid : null,
  difficulty: String(plan.difficulty || plan.level || plan.experienceLevel || '').trim(),
  planDurationWeeks: plan.planDurationWeeks ?? plan.durationWeeks ?? plan.weeks ?? null,
  planType: String(plan.planType || '').trim(),
  estimatedDuration: Number(plan.estimatedDuration ?? plan.estimatedDurationMinutes ?? plan.duration ?? 0),
  goalType: normalizeGlobalGoalType(plan.goalType),
  dayCount: Number(plan.dayCount || 0),
  exerciseCount: Number(plan.exerciseCount || 0),
  updatedAt: plan.updatedAt || null,
  status: normalizePlanPublicationStatus(plan.status ?? plan.publicationStatus ?? plan.planStatus),
  visibility: String(plan.visibility || 'private').trim() || 'private',
  isFeatured: typeof plan?.isFeatured === 'boolean'
    ? plan.isFeatured
    : (typeof plan?.featured === 'boolean' ? plan.featured : String(plan?.planType || '').trim().toLowerCase() === 'featured'),
  hasCustomCoverImage: Boolean(plan.hasCustomCoverImage),
  coverImageUrl: buildWorkoutPlanCoverImageUrl(plan.planId),
});

const buildPlanCoverImageUrl = (planId, revision = coverImageRevision.value) => buildWorkoutPlanCoverImageUrl(planId, revision);

const activePlanId = computed(() => String(currentPlanId.value || selectedWorkoutId.value || '').trim());

const canEditCurrentPlanCover = computed(() => {
  const planType = String(metadata.value?.planType || '').trim().toLowerCase();
  if (['global', 'featured', 'community_shared'].includes(planType)) {
    const role = String(currentRoleSlug.value || '').trim().toLowerCase();
    return isAdminUser.value || role === 'trainer';
  }

  return true;
});

const hasPreviewCoverSelected = computed(() => Boolean(String(pendingCoverPreviewUrl.value || '').trim()));

const normalizeCoverReference = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const trimmed = String(value).trim();
  if (!trimmed || /^(null|undefined)$/i.test(trimmed)) {
    return '';
  }
  return trimmed;
};

const isDefaultWorkoutPlanCoverReference = (value) => {
  const normalized = normalizeCoverReference(value);
  if (!normalized) {
    return true;
  }

  const cleaned = normalized
    .split('?')[0]
    .split('#')[0]
    .replace(/\\/g, '/');
  const segments = cleaned.split('/').filter(Boolean);
  const rawLeaf = segments.length ? segments[segments.length - 1] : cleaned;
  let leaf = rawLeaf;
  try {
    leaf = decodeURIComponent(rawLeaf);
  } catch (_) {
    leaf = rawLeaf;
  }
  const lowerLeaf = String(leaf || '').trim().toLowerCase();

  return /^default(?:\.[a-z0-9]+)?$/i.test(lowerLeaf);
};

const readCoverReferenceFromSource = (source = {}) => {
  if (!source || typeof source !== 'object') {
    return '';
  }

  const candidates = [
    source.coverImage,
    source.cover_image,
    source.coverImageReference,
    source.cover_image_reference,
    source.coverImageStorageKey,
    source.cover_image_storage_key,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCoverReference(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const resolvePersistedCoverReferenceForPlan = (planner = {}) => {
  const normalizedPlanId = String(planner?.planId || currentPlanId.value || selectedWorkoutId.value || '').trim();
  const scheduleRow = normalizedPlanId
    ? workoutSchedules.value.find((plan) => String(plan?.planId || '').trim() === normalizedPlanId)
    : null;

  const fromPlannerMetadata = readCoverReferenceFromSource(planner?.metadata || {});
  const fromPlanner = readCoverReferenceFromSource(planner || {});
  const fromScheduleRow = readCoverReferenceFromSource(scheduleRow || {});

  return fromPlannerMetadata || fromPlanner || fromScheduleRow || '';
};

const hasPersistedCustomCover = computed(() => {
  if (!hasPersistedPlanForCover.value) {
    return false;
  }
  return !isDefaultWorkoutPlanCoverReference(persistedCoverImageReference.value);
});

const currentPlanCoverImageUrl = computed(() => {
  const pendingPreview = String(pendingCoverPreviewUrl.value || '').trim();
  if (pendingPreview) {
    return pendingPreview;
  }

  if (!activePlanId.value) {
    return DEFAULT_WORKOUT_PLAN_IMAGE;
  }

  return buildPlanCoverImageUrl(activePlanId.value);
});

const hasPersistedPlanForCover = computed(() => Boolean(activePlanId.value));

const showDeletePlanCoverButton = computed(() => {
  return hasPersistedPlanForCover.value
    && canEditCurrentPlanCover.value
    && hasPersistedCustomCover.value
    && !hasPreviewCoverSelected.value;
});

const isCoverActionBusy = computed(() => coverUploadInFlight.value || coverDeleteInFlight.value);

const updateCoverUiMessage = (message = '', type = 'info') => {
  coverUiMessage.value = String(message || '').trim();
  coverUiMessageType.value = type;
};

const clearPendingCoverSelection = () => {
  if (pendingCoverPreviewUrl.value && pendingCoverPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(pendingCoverPreviewUrl.value);
  }
  pendingCoverPreviewUrl.value = '';
  pendingCoverFile.value = null;
};

const setPendingCoverSelection = (file) => {
  clearPendingCoverSelection();
  pendingCoverFile.value = file;
  pendingCoverPreviewUrl.value = URL.createObjectURL(file);
};

const openCoverUploadPicker = () => {
  if (!canEditCurrentPlanCover.value || isCoverActionBusy.value) {
    return;
  }

  coverUploadInputRef.value?.click();
};

const refreshCoverImages = () => {
  coverImageRevision.value = Date.now();
};

const uploadCoverImageViaXhr = ({ planId, file }) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('coverImage', file);

    xhr.open('POST', `${API_BASE}/api/workout-schedules/${encodeURIComponent(planId)}/cover`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        coverUploadProgress.value = 0;
        return;
      }
      coverUploadProgress.value = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onerror = () => reject(new Error('Failed to upload cover image.'));

    xhr.onload = () => {
      let payload = {};
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch (_) {
        payload = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
      } else {
        reject(new Error(payload?.error || 'Failed to upload cover image.'));
      }
    };

    xhr.send(formData);
  });
};

const uploadSelectedCoverImageForPlan = async ({ planId, file }) => {
  const result = await uploadCoverImageViaXhr({ planId, file });
  currentPlanHasCustomCover.value = true;
  persistedCoverImageReference.value = `APP/workout-plans/${String(planId || '').trim()}/images/cover.jpg`;
  clearPendingCoverSelection();
  refreshCoverImages();
  syncWorkoutSchedules(workoutSchedules.value);
  featuredWorkoutPlans.value = featuredWorkoutPlans.value.map((plan) => {
    if (String(plan?.planId || '').trim() !== String(planId || '').trim()) return plan;
    return {
      ...plan,
      hasCustomCoverImage: true,
      coverImageUrl: buildPlanCoverImageUrl(planId),
    };
  });
  return result;
};

const uploadPendingCoverAfterPlanCreate = async (planId) => {
  if (!pendingCoverFile.value) {
    return;
  }

  coverUploadInFlight.value = true;
  coverUploadProgress.value = 0;
  updateCoverUiMessage('Uploading selected cover image...', 'info');

  try {
    const result = await uploadSelectedCoverImageForPlan({
      planId,
      file: pendingCoverFile.value,
    });
    updateCoverUiMessage(result?.message || 'Workout plan cover uploaded successfully.', 'success');
  } catch (error) {
    clearPendingCoverSelection();
    refreshCoverImages();
    updateCoverUiMessage(error?.message || 'Workout plan was created, but cover upload failed. Open Upload / Replace to retry.', 'error');
  } finally {
    coverUploadInFlight.value = false;
    coverUploadProgress.value = 0;
  }
};

const onCoverFileSelected = async (event) => {
  const file = event?.target?.files?.[0] || null;
  if (!file) {
    return;
  }

  const mimeType = String(file.type || '').trim().toLowerCase();
  const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!allowedMimeTypes.has(mimeType)) {
    updateCoverUiMessage('Unsupported file type. Use JPG, PNG, WEBP, or GIF.', 'error');
    event.target.value = '';
    return;
  }

  setPendingCoverSelection(file);

  if (!hasPersistedPlanForCover.value) {
    updateCoverUiMessage('Preview ready. Save the workout plan to upload this cover image.', 'info');
    event.target.value = '';
    return;
  }

  const planId = activePlanId.value;

  coverUploadInFlight.value = true;
  coverUploadProgress.value = 0;
  updateCoverUiMessage('Uploading selected cover image...', 'info');

  try {
    const result = await uploadSelectedCoverImageForPlan({ planId, file });
    updateCoverUiMessage(result?.message || 'Workout plan cover uploaded successfully.', 'success');
  } catch (error) {
    clearPendingCoverSelection();
    refreshCoverImages();
    updateCoverUiMessage(error?.message || 'Failed to upload workout plan cover.', 'error');
  } finally {
    coverUploadInFlight.value = false;
    coverUploadProgress.value = 0;
    event.target.value = '';
  }
};

const deleteCoverImage = async () => {
  const planId = activePlanId.value;
  if (!planId || !canEditCurrentPlanCover.value || isCoverActionBusy.value) {
    return;
  }

  coverDeleteInFlight.value = true;
  updateCoverUiMessage('Removing cover image...', 'info');

  try {
    const response = await fetch(`${API_BASE}/api/workout-schedules/${encodeURIComponent(planId)}/cover`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to remove workout plan cover.');
    }

    currentPlanHasCustomCover.value = false;
    persistedCoverImageReference.value = 'default.JPG';
    clearPendingCoverSelection();
    refreshCoverImages();
    syncWorkoutSchedules(workoutSchedules.value);
    featuredWorkoutPlans.value = featuredWorkoutPlans.value.map((plan) => {
      if (String(plan?.planId || '').trim() !== planId) return plan;
      return {
        ...plan,
        hasCustomCoverImage: false,
        coverImageUrl: buildPlanCoverImageUrl(planId),
      };
    });
    updateCoverUiMessage(payload?.message || 'Workout plan cover removed.', 'success');
  } catch (error) {
    updateCoverUiMessage(error?.message || 'Failed to remove workout plan cover.', 'error');
  } finally {
    coverDeleteInFlight.value = false;
  }
};

const onPlanCoverImageError = (event) => {
  applyWorkoutPlanImageFallback(event);
};

const formatGlobalAccess = (plan = {}) => {
  const visibility = String(plan?.visibility || '').trim().toLowerCase();
  if (visibility === 'private' || visibility === 'unlisted') {
    return 'Premium';
  }
  return 'Free';
};

const formatGlobalUpdatedDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
};

const clearGlobalPlansMessages = () => {
  clearAreaError('globalPlans');
  globalPlansSuccess.value = '';
};

const resolveSelectedGoalTypeForGlobalPlan = () => {
  const selectedGoalId = String(metadata.value?.goalId || '').trim();
  const goalCandidates = Array.isArray(goalOptionsForSelect.value) ? goalOptionsForSelect.value : [];

  if (selectedGoalId) {
    const selectedGoal = goalCandidates.find((option) => String(option?.value || '').trim() === selectedGoalId);
    const goalType = String(selectedGoal?.goalType || metadata.value?.goalContext?.goalType || '').trim().toLowerCase();
    if (goalType === 'exercise_weight') return 'exercise_weight';
    if (goalType === 'body_weight') return 'body_weight';
  }

  const fallbackGoalType = String(metadata.value?.goalContext?.goalType || '').trim().toLowerCase();
  if (fallbackGoalType === 'exercise_weight') return 'exercise_weight';
  if (fallbackGoalType === 'body_weight') return 'body_weight';

  return 'none';
};

const buildGlobalPlanDraftPayload = (overrides = {}) => ({
  title: String(overrides.title ?? metadata.value?.name ?? 'Untitled Global Workout').trim() || 'Untitled Global Workout',
  description: String(overrides.description ?? metadata.value?.description ?? '').trim(),
  estimatedDurationMinutes: Number(overrides.estimatedDurationMinutes ?? metadata.value?.estimatedDuration ?? 45) || 45,
  category: overrides.category ?? metadata.value?.category ?? null,
  planType: String(overrides.planType ?? 'global').trim().toLowerCase() || 'global',
  goalType: String(overrides.goalType ?? resolveSelectedGoalTypeForGlobalPlan()).trim().toLowerCase() || 'none',
  goalTargetDate: overrides.goalTargetDate ?? ((metadata.value?.goalTargetDate === null || metadata.value?.goalTargetDate === undefined || metadata.value?.goalTargetDate === '') ? null : String(metadata.value?.goalTargetDate || '').trim()),
  planDurationWeeks: overrides.planDurationWeeks ?? ((metadata.value?.planDurationWeeks === null || metadata.value?.planDurationWeeks === undefined || metadata.value?.planDurationWeeks === '') ? null : Number(metadata.value?.planDurationWeeks)),
  accessLevel: String(overrides.accessLevel ?? 'public').trim().toLowerCase() || 'public',
});

const loadGlobalPlans = async () => {
  if (!canAccessGlobalManagement.value) {
    globalPlans.value = [];
    return;
  }

  globalPlansLoading.value = true;
  clearGlobalPlansMessages();

  try {
    const response = await fetch(`${API_BASE}/api/admin/global-workout-plans`, {
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const status = Number(response.status || 0);
      const apiError = String(data?.error || '').trim().toLowerCase();
      if (status === 404 || apiError.includes('no global workout plans')) {
        globalPlans.value = [];
        return;
      }
      throw new Error(data?.error || 'Failed to load global workout plans.');
    }

    globalPlans.value = Array.isArray(data?.workoutLists)
      ? data.workoutLists.map(normalizeGlobalPlan)
      : [];
  } catch (error) {
    setFriendlyAreaError('globalPlans', {
      rawMessage: error?.message || 'Failed to load global workout plans.',
      fallback: 'Unable to load global workout plans right now. Please try again.',
    });
  } finally {
    globalPlansLoading.value = false;
  }
};

const createGlobalPlanDraft = async () => {
  clearGlobalPlansMessages();
  try {
    const response = await fetch(`${API_BASE}/api/admin/global-workout-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(buildGlobalPlanDraftPayload()),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to create global workout plan draft.');
    }

    globalPlans.value = Array.isArray(data?.workoutLists)
      ? data.workoutLists.map(normalizeGlobalPlan)
      : globalPlans.value;
    globalPlansSuccess.value = String(data?.message || 'Global workout plan draft created.').trim() || 'Global workout plan draft created.';
  } catch (error) {
    setFriendlyAreaError('globalPlans', {
      rawMessage: error?.message || 'Failed to create global workout plan draft.',
      fallback: 'Unable to create a global workout plan draft right now.',
    });
  }
};

const viewGlobalPlanSummary = async (plan = {}) => {
  const targetId = String(plan?.planId || '').trim();
  if (!targetId) {
    return;
  }

  clearGlobalPlansMessages();
  try {
    await router.replace({ query: { ...route.query, planId: targetId } });
    builderTab.value = 'view';
    viewEditMode.value = true;
    await loadWorkoutPlanner(targetId, { targetTab: 'view', enableViewEditMode: true });
    const name = String(plan?.name || 'Untitled Workout').trim() || 'Untitled Workout';
    globalPlansSuccess.value = `Loaded ${name} for editing.`;
  } catch (error) {
    setFriendlyAreaError('globalPlans', {
      rawMessage: error?.message || 'Failed to open global workout plan.',
      fallback: 'Unable to open this global workout plan right now.',
    });
  }
};

const requestDeleteGlobalPlan = (plan = {}) => {
  const targetId = String(plan?.planId || '').trim();
  if (!targetId || globalPlansDeletingId.value) {
    return;
  }

  selectedGlobalPlanForDelete.value = {
    planId: targetId,
    name: String(plan?.name || 'Untitled Workout').trim() || 'Untitled Workout',
  };
  showGlobalDeletePlanModal.value = true;
};

const closeGlobalDeletePlanModal = ({ force = false } = {}) => {
  if (globalPlansDeletingId.value && !force) {
    return;
  }
  showGlobalDeletePlanModal.value = false;
  selectedGlobalPlanForDelete.value = null;
};

const confirmDeleteGlobalPlan = async () => {
  const plan = selectedGlobalPlanForDelete.value || {};
  const targetId = String(plan?.planId || '').trim();
  if (!targetId || globalPlansDeletingId.value) {
    return;
  }

  globalPlansDeletingId.value = targetId;
  clearGlobalPlansMessages();

  try {
    const response = await fetch(`${API_BASE}/api/admin/global-workout-plans/${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to delete global workout plan.');
    }

    closeGlobalDeletePlanModal({ force: true });
    globalPlansDeletingId.value = '';
    await loadGlobalPlans();
    globalPlansSuccess.value = 'Global workout plan deleted.';
  } catch (error) {
    setFriendlyAreaError('globalPlans', {
      rawMessage: error?.message || 'Failed to delete global workout plan.',
      fallback: 'Unable to delete this global workout plan right now.',
    });
  } finally {
    if (globalPlansDeletingId.value === targetId) {
      globalPlansDeletingId.value = '';
    }
  }
};

const goalOptionsForSelect = computed(() => {
  const toGoalDateLabel = (rawDate) => {
    const trimmed = String(rawDate || '').trim();
    if (!trimmed) return '';
    const parsed = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return trimmed;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeGoalOptions = personalGoals.value.map((goal) => ({
    value: String(goal?.id || ''),
    label: formatGoalOptionLabel(goal),
    displayName: String(goal?.goalType || '').trim() === 'exercise_weight'
      ? `${String(goal?.exerciseName || 'Exercise').trim() || 'Exercise'} (${Number(goal?.targetValue || 0)} ${String(goal?.targetUnit || 'lb').trim() || 'lb'})`
      : `Reach ${Number(goal?.targetValue || 0)} ${String(goal?.targetUnit || 'lb').trim() || 'lb'}`,
    goalType: String(goal?.goalType || '').trim(),
    exerciseName: String(goal?.exerciseName || '').trim(),
    targetValue: Number(goal?.targetValue || 0),
    targetUnit: String(goal?.targetUnit || 'lb').trim() || 'lb',
    targetDate: String(goal?.targetDate || '').trim(),
    targetDateLabel: toGoalDateLabel(goal?.targetDate),
  })).filter((entry) => entry.value);

  const selectedGoalId = String(metadata.value?.goalId || '').trim();
  const hasSelectedGoalInActiveOptions = !!selectedGoalId
    && activeGoalOptions.some((entry) => entry.value === selectedGoalId);

  const unavailableSelectedGoalOption = (!selectedGoalId || hasSelectedGoalInActiveOptions)
    ? null
    : {
        value: selectedGoalId,
        label: `${formatGoalContextOptionLabel(metadata.value?.goalContext)} (Archived or unavailable)`,
        displayName: `${formatGoalContextOptionLabel(metadata.value?.goalContext)} (Archived or unavailable)`,
        targetDateLabel: metadata.value?.goalContext?.targetDate ? formatGoalDateLabel(metadata.value?.goalContext?.targetDate) : '',
      };

  return [
    { value: '', label: 'No Goal' },
    ...activeGoalOptions,
    ...(unavailableSelectedGoalOption ? [unavailableSelectedGoalOption] : []),
  ];
});

const storeUnsavedBuilderDraft = () => {
  try {
    const snapshot = {
      metadata: metadata.value,
      workoutExercises: workoutExercises.value,
      dayGroups: dayGroups.value,
      weekGroups: weekGroups.value,
      dayGroupOrders: dayGroupOrders.value,
      weekGroupOrders: weekGroupOrders.value,
      selectedScheduleGroup: selectedScheduleGroup.value,
      planPublicationStatus: planPublicationStatus.value,
      selectedPublicationStatus: selectedPublicationStatus.value,
      isGlobalPlanFeatured: isGlobalPlanFeatured.value,
      currentPlanId: currentPlanId.value,
      selectedWorkoutId: selectedWorkoutId.value,
      isCreatingWorkout: isCreatingWorkout.value,
      hasSavedWorkoutDetails: hasSavedWorkoutDetails.value,
      isWorkoutDetailsOpen: isWorkoutDetailsOpen.value,
      isSchedulePlannerOpen: isSchedulePlannerOpen.value,
      builderTab: builderTab.value,
      timestamp: Date.now(),
    };
    localStorage.setItem(WORKOUT_BUILDER_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures and continue using in-memory state.
  }
};

const restoreUnsavedBuilderDraft = () => {
  try {
    const raw = localStorage.getItem(WORKOUT_BUILDER_DRAFT_STORAGE_KEY);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);

    if (!snapshot || typeof snapshot !== 'object') {
      localStorage.removeItem(WORKOUT_BUILDER_DRAFT_STORAGE_KEY);
      return false;
    }

    if (snapshot.metadata && typeof snapshot.metadata === 'object') {
      metadata.value = {
        ...metadata.value,
        ...snapshot.metadata,
      };
    }

    workoutExercises.value = Array.isArray(snapshot.workoutExercises) ? snapshot.workoutExercises : workoutExercises.value;
    dayGroups.value = Array.isArray(snapshot.dayGroups) ? snapshot.dayGroups : dayGroups.value;
    weekGroups.value = Array.isArray(snapshot.weekGroups) ? snapshot.weekGroups : weekGroups.value;
    dayGroupOrders.value = Array.isArray(snapshot.dayGroupOrders) ? snapshot.dayGroupOrders : dayGroupOrders.value;
    weekGroupOrders.value = Array.isArray(snapshot.weekGroupOrders) ? snapshot.weekGroupOrders : weekGroupOrders.value;
    selectedScheduleGroup.value = snapshot.selectedScheduleGroup ?? selectedScheduleGroup.value;
    planPublicationStatus.value = String(snapshot.planPublicationStatus || planPublicationStatus.value || 'draft').trim() || 'draft';
    selectedPublicationStatus.value = String(snapshot.selectedPublicationStatus || selectedPublicationStatus.value || planPublicationStatus.value).trim() || planPublicationStatus.value;
    isGlobalPlanFeatured.value = Boolean(snapshot.isGlobalPlanFeatured);
    currentPlanId.value = String(snapshot.currentPlanId || currentPlanId.value || '').trim();
    selectedWorkoutId.value = String(snapshot.selectedWorkoutId || selectedWorkoutId.value || '').trim();
    isCreatingWorkout.value = Boolean(snapshot.isCreatingWorkout);
    hasSavedWorkoutDetails.value = Boolean(snapshot.hasSavedWorkoutDetails);
    isWorkoutDetailsOpen.value = snapshot.isWorkoutDetailsOpen !== false;
    isSchedulePlannerOpen.value = snapshot.isSchedulePlannerOpen !== false;
    builderTab.value = String(snapshot.builderTab || 'create').trim() || 'create';

    localStorage.removeItem(WORKOUT_BUILDER_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

const openExistingGoalCreationFlow = async () => {
  storeUnsavedBuilderDraft();
  await router.push({ path: '/settings', query: { tab: 'goals', returnTo: '/workout-builder' } });
};

const loadActiveGoals = async () => {
  loadingGoals.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/goals?status=active`, {
      credentials: 'include',
    });
    if (!response.ok) {
      personalGoals.value = [];
      return;
    }

    const data = await response.json().catch(() => ({}));
    personalGoals.value = Array.isArray(data?.goals) ? data.goals : [];

  } catch {
    personalGoals.value = [];
  } finally {
    loadingGoals.value = false;
  }
};

const featuredWorkoutPlanSlides = computed(() => {
  if (!Array.isArray(featuredWorkoutPlans.value) || !featuredWorkoutPlans.value.length) {
    return [];
  }

  const grouped = new Map();
  featuredWorkoutPlans.value.forEach((plan) => {
    const title = String(plan?.type || 'Featured').trim() || 'Featured';
    if (!grouped.has(title)) {
      grouped.set(title, []);
    }

    grouped.get(title).push({
      planId: String(plan?.planId || '').trim(),
      name: String(plan?.name || '').trim() || 'Untitled Workout',
      description: String(plan?.description || '').trim(),
      estimatedDuration: Number(plan?.estimatedDuration || 0),
      exerciseCount: Number(plan?.exerciseCount || 0),
    });
  });

  return Array.from(grouped.entries()).map(([title, plans]) => ({ title, plans }));
});

const hasFeaturedWorkoutPlans = computed(() => featuredWorkoutPlanSlides.value.length > 0);

const normalizeMarketplaceText = (value) => String(value || '').trim().toLowerCase();

const resolveMarketplaceSource = (plan = {}) => {
  const directSource = normalizeMarketplaceText(
    plan?.source || plan?.planSource || plan?.sourceType || plan?.ownerType || plan?.createdByRole || plan?.authorRole
  );
  if (directSource) {
    if (directSource.includes('trainer')) return 'trainer';
    if (directSource.includes('community')) return 'community';
    if (directSource.includes('global') || directSource.includes('workoutatlas') || directSource.includes('admin')) return 'global';
  }

  const explicitPlanType = normalizeMarketplaceText(plan?.planType);
  if (explicitPlanType === 'trainer_shared' || explicitPlanType === 'trainer') return 'trainer';
  if (explicitPlanType === 'community' || explicitPlanType === 'community_shared') return 'community';
  if (explicitPlanType === 'global' || explicitPlanType === 'featured') return 'global';

  return '';
};

const resolveMarketplacePricing = (plan = {}) => {
  const pricingText = normalizeMarketplaceText(plan?.pricing || plan?.priceType || plan?.billingModel || plan?.accessTier);
  if (pricingText) {
    if (pricingText.includes('free')) return 'free';
    if (pricingText.includes('paid') || pricingText.includes('premium')) return 'paid';
  }

  if (typeof plan?.isPaid === 'boolean') {
    return plan.isPaid ? 'paid' : 'free';
  }

  if (typeof plan?.isPremium === 'boolean') {
    return plan.isPremium ? 'paid' : 'free';
  }

  return '';
};

const resolveMarketplaceWorkoutType = (plan = {}) => {
  return normalizeMarketplaceText(plan?.workoutType);
};

const resolveMarketplaceCategory = (plan = {}) => {
  return normalizeMarketplaceText(plan?.category || plan?.type);
};

const resolveMarketplaceDifficulty = (plan = {}) => {
  return normalizeMarketplaceText(plan?.difficulty || plan?.level || plan?.experienceLevel);
};

const resolveMarketplaceDurationWeeks = (plan = {}) => {
  const rawValue = plan?.planDurationWeeks ?? plan?.durationWeeks ?? plan?.weeks;
  const numeric = Number(rawValue);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};
const formatMarketplaceSourceLabel = (plan = {}) => {
  const normalizedSource = resolveMarketplaceSource(plan);
  if (normalizedSource === 'global') return 'WorkoutAtlas Global';
  if (normalizedSource === 'trainer') return 'Trainer';
  if (normalizedSource === 'community') return 'Community';
  return '—';
};

const resolveMarketplacePublicationStatus = (plan = {}) => {
  const normalizedRawStatus = normalizeMarketplaceText(
    plan?.publicationStatusRaw
    || plan?.status
    || plan?.publicationStatus
    || plan?.planStatus
  );

  if (!normalizedRawStatus) {
    return '';
  }

  if (normalizedRawStatus === 'active' || normalizedRawStatus === 'published') {
    return 'active';
  }
  if (normalizedRawStatus === 'draft') {
    return 'draft';
  }
  if (normalizedRawStatus === 'archived' || normalizedRawStatus === 'inactive') {
    return 'archived';
  }

  return '';
};

const resolveMarketplaceFeaturedFlag = (plan = {}) => {
  if (typeof plan?.isFeatured === 'boolean') {
    return plan.isFeatured;
  }

  if (typeof plan?.featured === 'boolean') {
    return plan.featured;
  }

  const normalizedPlanType = normalizeMarketplaceText(plan?.planType);
  return normalizedPlanType === 'featured';
};

const getMarketplaceStatusBadges = (plan = {}) => {
  const publicationStatus = resolveMarketplacePublicationStatus(plan);
  const isFeaturedPlan = resolveMarketplaceFeaturedFlag(plan);

  const badges = [];
  if (publicationStatus === 'draft') {
    badges.push({ key: 'draft', label: 'Draft', tone: 'draft' });
  }

  if (publicationStatus === 'active') {
    badges.push({ key: 'published', label: 'Published', tone: 'published' });
    if (isFeaturedPlan) {
      badges.push({ key: 'featured', label: 'Featured', tone: 'featured' });
    }
  }

  return badges;
};

const formatMarketplaceStatusLabel = (plan = {}) => {
  const publicationStatus = resolveMarketplacePublicationStatus(plan);
  if (publicationStatus === 'active') return 'Published';
  if (publicationStatus === 'archived') return 'Archived';
  if (publicationStatus === 'draft') return 'Draft';
  return '—';
};

const formatMarketplacePlanTypeLabel = (plan = {}) => {
  const normalizedPlanType = normalizeMarketplaceText(plan?.planType);
  if (normalizedPlanType === 'personal') return 'Personal';
  if (normalizedPlanType === 'community') return 'Community';
  if (normalizedPlanType === 'trainer_shared') return 'Trainer Shared';
  if (normalizedPlanType === 'global') return 'Global';
  if (normalizedPlanType === 'featured' || normalizedPlanType === 'community_shared') return 'Global';
  return normalizedPlanType
    ? normalizedPlanType.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
    : '—';
};

const manageableMarketplacePlans = computed(() => {
  return Array.isArray(globalPlans.value)
    ? globalPlans.value.map((plan) => ({
        planId: String(plan?.planId || '').trim(),
        name: String(plan?.name || '').trim() || 'Untitled Workout',
        description: String(plan?.description || '').trim(),
        type: String(plan?.type || plan?.category || 'General Fitness').trim() || 'General Fitness',
        category: String(plan?.category || plan?.type || 'General Fitness').trim() || 'General Fitness',
        workoutType: String(plan?.workoutType || '').trim(),
        source: String(plan?.source || plan?.planSource || '').trim(),
        pricing: String(plan?.pricing || '').trim(),
        isPaid: typeof plan?.isPaid === 'boolean' ? plan.isPaid : null,
        difficulty: String(plan?.difficulty || plan?.level || '').trim(),
        planDurationWeeks: plan?.planDurationWeeks ?? plan?.durationWeeks ?? null,
        planType: String(plan?.planType || '').trim(),
        estimatedDuration: Number(plan?.estimatedDuration || 0),
        exerciseCount: Number(plan?.exerciseCount || 0),
        dayCount: Number(plan?.dayCount || 0),
        publicationStatusRaw: String(plan?.publicationStatusRaw ?? plan?.status ?? plan?.publicationStatus ?? plan?.planStatus ?? '').trim().toLowerCase(),
        status: String(plan?.status ?? plan?.publicationStatus ?? plan?.planStatus ?? '').trim().toLowerCase(),
        isFeatured: typeof plan?.isFeatured === 'boolean'
          ? plan.isFeatured
          : (typeof plan?.featured === 'boolean' ? plan.featured : String(plan?.planType || '').trim().toLowerCase() === 'featured'),
        coverImageUrl: buildPlanCoverImageUrl(plan?.planId),
      }))
    : [];
});
const activeMarketplacePlans = computed(() => {
  return showManagedMarketplacePlans.value ? manageableMarketplacePlans.value : featuredWorkoutPlans.value;
});
const hasActiveMarketplacePlans = computed(() => activeMarketplacePlans.value.length > 0);
const normalizedMarketplaceSearchQuery = computed(() => String(marketplaceSearchQuery.value || '').trim().toLowerCase());
const marketplaceFilterCapabilities = computed(() => {
  const plans = Array.isArray(activeMarketplacePlans.value) ? activeMarketplacePlans.value : [];
  return {
    source: plans.some((plan) => Boolean(resolveMarketplaceSource(plan))),
    pricing: plans.some((plan) => Boolean(resolveMarketplacePricing(plan))),
    workoutType: plans.some((plan) => Boolean(resolveMarketplaceWorkoutType(plan))),
    category: plans.some((plan) => Boolean(resolveMarketplaceCategory(plan))),
    difficulty: plans.some((plan) => Boolean(resolveMarketplaceDifficulty(plan))),
    planDuration: plans.some((plan) => Number.isFinite(resolveMarketplaceDurationWeeks(plan))),
  };
});
const categoryFilterOptions = computed(() => {
  const canonical = ['Weight Loss', 'Muscle Building', 'Endurance', 'General Fitness'];
  const canonicalSlugs = canonical.map((entry) => normalizeMarketplaceText(entry));
  const discovered = Array.from(new Set(
    activeMarketplacePlans.value
      .map((plan) => String(plan?.category || plan?.type || '').trim())
      .filter(Boolean)
  ));
  const extra = discovered
    .filter((entry) => !canonicalSlugs.includes(normalizeMarketplaceText(entry)))
    .sort((a, b) => a.localeCompare(b));

  return [
    { value: 'all', label: 'All Categories' },
    ...canonical.map((entry) => ({ value: normalizeMarketplaceText(entry), label: entry })),
    ...extra.map((entry) => ({ value: normalizeMarketplaceText(entry), label: entry })),
  ];
});
const hasMarketplaceActiveFilters = computed(() => {
  const values = marketplaceFilters.value;
  return Object.keys(values).some((key) => String(values[key] || 'all') !== 'all');
});
const activeMarketplaceFilterCount = computed(() => {
  const values = marketplaceFilters.value;
  const capabilities = marketplaceFilterCapabilities.value;
  const supportedKeys = Object.keys(values).filter((key) => capabilities[key] !== false);
  return supportedKeys.reduce((count, key) => (String(values[key] || 'all') === 'all' ? count : count + 1), 0);
});
const filteredMarketplacePlans = computed(() => {
  const searchText = normalizedMarketplaceSearchQuery.value;
  return activeMarketplacePlans.value.filter((plan) => {
    if (searchText) {
      const searchableFields = [
        plan?.name,
        plan?.description,
        plan?.category,
        plan?.type,
        plan?.workoutType,
      ];
      const matchesSearch = searchableFields.some((value) => String(value || '').toLowerCase().includes(searchText));
      if (!matchesSearch) {
        return false;
      }
    }

    if (marketplaceFilterCapabilities.value.source && marketplaceFilters.value.source !== 'all') {
      if (resolveMarketplaceSource(plan) !== marketplaceFilters.value.source) {
        return false;
      }
    }

    if (marketplaceFilterCapabilities.value.pricing && marketplaceFilters.value.pricing !== 'all') {
      if (resolveMarketplacePricing(plan) !== marketplaceFilters.value.pricing) {
        return false;
      }
    }

    if (marketplaceFilterCapabilities.value.workoutType && marketplaceFilters.value.workoutType !== 'all') {
      const workoutType = resolveMarketplaceWorkoutType(plan);
      if (marketplaceFilters.value.workoutType === 'other') {
        if (!workoutType || ['strength', 'cardio'].includes(workoutType)) {
          return false;
        }
      } else if (workoutType !== marketplaceFilters.value.workoutType) {
        return false;
      }
    }

    if (marketplaceFilterCapabilities.value.category && marketplaceFilters.value.category !== 'all') {
      if (resolveMarketplaceCategory(plan) !== marketplaceFilters.value.category) {
        return false;
      }
    }

    if (marketplaceFilterCapabilities.value.difficulty && marketplaceFilters.value.difficulty !== 'all') {
      if (resolveMarketplaceDifficulty(plan) !== marketplaceFilters.value.difficulty) {
        return false;
      }
    }

    if (marketplaceFilterCapabilities.value.planDuration && marketplaceFilters.value.planDuration !== 'all') {
      const weeks = resolveMarketplaceDurationWeeks(plan);
      if (!Number.isFinite(weeks)) {
        return false;
      }
      if (marketplaceFilters.value.planDuration === '1-4' && (weeks < 1 || weeks > 4)) {
        return false;
      }
      if (marketplaceFilters.value.planDuration === '5-8' && (weeks < 5 || weeks > 8)) {
        return false;
      }
      if (marketplaceFilters.value.planDuration === '9-12' && (weeks < 9 || weeks > 12)) {
        return false;
      }
      if (marketplaceFilters.value.planDuration === '13+' && weeks < 13) {
        return false;
      }
    }

    return true;
  });
});
const hasFilteredMarketplacePlans = computed(() => filteredMarketplacePlans.value.length > 0);
const marketplaceFiltersHaveNoMatches = computed(() => {
  return hasActiveMarketplacePlans.value
    && !hasFilteredMarketplacePlans.value
    && (Boolean(normalizedMarketplaceSearchQuery.value) || hasMarketplaceActiveFilters.value);
});
const marketplacePlansLoading = computed(() => showManagedMarketplacePlans.value ? globalPlansLoading.value : loadingFeaturedPlans.value);
const hasMultipleFeaturedWorkoutPlanSlides = computed(() => featuredWorkoutPlanSlides.value.length > 1);

const clearMarketplaceSearch = () => {
  marketplaceSearchQuery.value = '';
};

const clearMarketplaceFilters = () => {
  marketplaceFilters.value = {
    source: 'all',
    pricing: 'all',
    workoutType: 'all',
    category: 'all',
    difficulty: 'all',
    planDuration: 'all',
  };
};

const activeWorkoutPlanSlide = computed(() => {
  if (!featuredWorkoutPlanSlides.value.length) {
    return { title: 'Featured Workout Plans', plans: [] };
  }

  const safeIndex = Math.min(
    Math.max(Number(currentWorkoutPlanSlide.value || 0), 0),
    featuredWorkoutPlanSlides.value.length - 1
  );
  return featuredWorkoutPlanSlides.value[safeIndex];
});

const setWorkoutPlanSlide = (index) => {
  if (index < 0 || index >= featuredWorkoutPlanSlides.value.length) {
    return;
  }
  currentWorkoutPlanSlide.value = index;
};

const goToNextWorkoutPlanSlide = () => {
  const total = featuredWorkoutPlanSlides.value.length;
  if (!total) {
    return;
  }

  const nextIndex = currentWorkoutPlanSlide.value >= total - 1
    ? 0
    : currentWorkoutPlanSlide.value + 1;
  setWorkoutPlanSlide(nextIndex);
};

const goToPreviousWorkoutPlanSlide = () => {
  const total = featuredWorkoutPlanSlides.value.length;
  if (!total) {
    return;
  }

  const previousIndex = currentWorkoutPlanSlide.value <= 0
    ? total - 1
    : currentWorkoutPlanSlide.value - 1;
  setWorkoutPlanSlide(previousIndex);
};

const setSelectedTemplatePlan = (plan) => {
  selectedTemplatePlanId.value = String(plan?.planId || '').trim();
  selectedTemplatePlanName.value = String(plan?.name || '').trim();
};

const selectTemplatePlan = async (plan) => {
  const templatePlanId = String(plan?.planId || '').trim();
  if (!templatePlanId) {
    return;
  }

  setSelectedTemplatePlan(plan);

  if (!userId.value) {
    saveMessage.value = 'Unable to resolve user session. Please login again.';
    return;
  }

  cloningFeaturedPlanId.value = templatePlanId;
  saveMessage.value = '';
  try {
    const response = await fetch(`${API_BASE}/api/global-workout-plans/${encodeURIComponent(templatePlanId)}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error || 'Failed to copy global workout plan.');
    }

    const data = await response.json();
    syncWorkoutPlannerCapabilities(data);
    syncWorkoutSchedules(data?.workoutLists);

    const planner = data?.planner || {};
    const newPlanId = String(planner?.planId || '').trim();
    if (!newPlanId) {
      throw new Error('Global workout copied, but no personal plan was returned.');
    }

    selectedWorkoutId.value = newPlanId;
    currentPlanId.value = newPlanId;
    isCreatingWorkout.value = true;
    hasSavedWorkoutDetails.value = false;

    hydratePlanner(planner, { markSaved: false });
    builderTab.value = 'create';
    saveMessage.value = 'Global workout plan loaded. Save to keep your personal copy.';

    await router.replace({ query: { ...route.query, planId: newPlanId } });
  } catch (error) {
    saveMessage.value = error.message || 'Failed to copy global workout plan.';
  } finally {
    cloningFeaturedPlanId.value = '';
  }
};

const closeGlobalLibraryViewModal = () => {
  if (globalLibraryViewLoading.value) {
    return;
  }
  showGlobalLibraryViewModal.value = false;
  clearAreaError('globalLibraryView');
  globalLibraryViewPlan.value = null;
  globalLibraryViewDaySchedules.value = [];
};

const openGlobalLibraryViewModal = async (plan) => {
  const templatePlanId = String(plan?.planId || '').trim();
  if (!templatePlanId) {
    return;
  }

  globalLibraryViewLoading.value = true;
  clearAreaError('globalLibraryView');
  showGlobalLibraryViewModal.value = true;
  globalLibraryViewDaySchedules.value = [];
  globalLibraryViewPlan.value = {
    planId: templatePlanId,
    name: String(plan?.name || 'Untitled Workout').trim() || 'Untitled Workout',
    description: String(plan?.description || '').trim(),
    type: String(plan?.type || '').trim() || 'General Fitness',
    category: String(plan?.category || plan?.type || '').trim(),
    difficulty: String(plan?.difficulty || '').trim(),
    estimatedDuration: Number(plan?.estimatedDuration || 0),
    exerciseCount: Number(plan?.exerciseCount || 0),
    dayCount: Number(plan?.dayCount || 0),
    objective: String(plan?.objective || plan?.planObjective || '').trim(),
    goal: String(plan?.goal || plan?.planGoal || '').trim(),
    coverImageUrl: String(plan?.coverImageUrl || buildPlanCoverImageUrl(templatePlanId)).trim(),
  };

  try {
    const detailsEndpoint = showManagedMarketplacePlans.value
      ? `${API_BASE}/api/admin/global-workout-plans/${encodeURIComponent(templatePlanId)}`
      : `${API_BASE}/api/global-workout-plans/${encodeURIComponent(templatePlanId)}`;

    const response = await fetch(detailsEndpoint, {
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to load global workout plan details.');
    }

    const planner = data?.planner || {};
    const metadata = planner?.metadata || {};
    const exercises = Array.isArray(planner?.exercises) ? planner.exercises : [];

    const normalizedExercises = exercises.map((exercise) => ({
      ...exercise,
      scheduleGroup: String(exercise?.scheduleGroup || '').trim(),
    }));

    const explicitDayGroups = Array.isArray(planner?.dayGroups)
      ? planner.dayGroups.map((group) => String(group || '').trim()).filter(Boolean)
      : [];

    const exerciseDayGroups = Array.from(
      new Set(normalizedExercises.map((exercise) => String(exercise?.scheduleGroup || '').trim()).filter(Boolean))
    );

    const mergedDayGroups = [...explicitDayGroups, ...exerciseDayGroups]
      .filter((group, index, source) => source.findIndex((entry) => entry.toLowerCase() === group.toLowerCase()) === index);

    const resolvedDayGroups = mergedDayGroups.length ? mergedDayGroups : ['Unscheduled'];
    const daySchedules = resolvedDayGroups.map((groupLabel) => {
      const dayExercises = normalizedExercises.filter((exercise) => {
        const group = String(exercise?.scheduleGroup || '').trim();
        if (!groupLabel || groupLabel === 'Unscheduled') {
          return !group;
        }
        return group.toLowerCase() === groupLabel.toLowerCase();
      });

      return {
        name: groupLabel,
        exercises: dayExercises,
      };
    });

    const numericMetaDayCount = Number(metadata?.workoutDays || metadata?.dayCount || metadata?.numberOfWorkoutDays || 0);
    const resolvedDayCount = daySchedules.some((entry) => entry.exercises.length)
      ? daySchedules.filter((entry) => entry.exercises.length).length
      : (numericMetaDayCount > 0 ? numericMetaDayCount : Number(plan?.dayCount || 0));

    const rawDifficulty = String(
      metadata?.difficulty
      || metadata?.level
      || metadata?.fitnessLevel
      || plan?.difficulty
      || ''
    ).trim();

    const resolvedCategory = String(
      metadata?.category
      || metadata?.goalType
      || metadata?.fitnessGoal
      || plan?.category
      || plan?.type
      || ''
    ).trim();

    const resolvedObjective = String(
      metadata?.objective
      || metadata?.planObjective
      || metadata?.trainingObjective
      || metadata?.focus
      || plan?.objective
      || ''
    ).trim();

    const resolvedGoal = String(
      metadata?.goal
      || metadata?.planGoal
      || metadata?.goalSummary
      || metadata?.targetGoal
      || ''
    ).trim();

    const resolvedGoalFromContext = (!resolvedGoal && metadata?.goalContext && typeof metadata.goalContext === 'object')
      ? formatGoalContextOptionLabel(metadata.goalContext)
      : '';

    const resolvedGoalFromGoalsArray = (!resolvedGoal && !resolvedGoalFromContext && Array.isArray(metadata?.goals) && metadata.goals.length)
      ? metadata.goals.map((entry) => String(entry || '').trim()).filter(Boolean).join(', ')
      : '';

    globalLibraryViewPlan.value = {
      planId: String(planner?.planId || templatePlanId).trim(),
      name: String(metadata?.name || plan?.name || 'Untitled Workout').trim() || 'Untitled Workout',
      description: String(metadata?.description || plan?.description || '').trim(),
      type: String(metadata?.category || plan?.type || 'General Fitness').trim() || 'General Fitness',
      category: resolvedCategory,
      difficulty: rawDifficulty,
      estimatedDuration: Number(metadata?.estimatedDuration || plan?.estimatedDuration || 0),
      exerciseCount: Number(countUniqueWorkoutPlanExercises(exercises) || plan?.exerciseCount || 0),
      dayCount: Number(resolvedDayCount || 0),
      objective: resolvedObjective,
      goal: resolvedGoal || resolvedGoalFromContext || resolvedGoalFromGoalsArray,
      accessLevel: String(data?.accessLevel || '').trim(),
      coverImageUrl: String(plan?.coverImageUrl || buildPlanCoverImageUrl(String(planner?.planId || templatePlanId).trim())).trim(),
    };

    globalLibraryViewDaySchedules.value = daySchedules;
  } catch (error) {
    setFriendlyAreaError('globalLibraryView', {
      rawMessage: error?.message || 'Failed to load global workout plan details.',
      fallback: 'Unable to load global workout plan details right now.',
    });
  } finally {
    globalLibraryViewLoading.value = false;
  }
};

const closeGlobalLibraryInlinePreview = () => {
  closeGlobalLibraryViewModal();
};

const hasValue = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }
  if (typeof value === 'string') {
    return String(value).trim().length > 0;
  }
  return Boolean(value);
};

const formatPreviewStat = (value, suffix = '') => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '—';
  }
  return suffix ? `${numeric} ${suffix}` : String(numeric);
};

const formatPreviewText = (value, fallback = '—') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const resolvePreviewExerciseType = (exercise = {}) => {
  const workoutType = String(exercise?.workoutType || exercise?.WorkoutType || '').trim().toLowerCase();
  const recordingType = String(exercise?.recordingType || exercise?.RecordingType || '').trim().toLowerCase();

  if (workoutType === 'cardio') {
    return 'cardio';
  }
  if (workoutType === 'strength') {
    return 'strength';
  }
  if (recordingType === 'time & distance') {
    return 'cardio';
  }
  if (recordingType === 'sets & reps') {
    return 'strength';
  }

  if (hasValue(exercise?.duration) || hasValue(exercise?.distance)) {
    return 'cardio';
  }
  if (hasValue(exercise?.sets) || hasValue(exercise?.reps) || hasValue(exercise?.weight) || hasValue(exercise?.restTime)) {
    return 'strength';
  }

  return 'other';
};

const previewDayHasStrengthFields = (dayExercises = []) => {
  return dayExercises.some((exercise) => {
    if (resolvePreviewExerciseType(exercise) !== 'strength') {
      return false;
    }
    return hasValue(exercise?.sets) || hasValue(exercise?.reps) || hasValue(exercise?.weight) || hasValue(exercise?.restTime);
  });
};

const previewDayHasCardioFields = (dayExercises = []) => {
  return dayExercises.some((exercise) => {
    if (resolvePreviewExerciseType(exercise) !== 'cardio') {
      return false;
    }
    return hasValue(exercise?.duration) || hasValue(exercise?.distance);
  });
};

const canUsePlanFromPreview = computed(() => {
  return !showManagedMarketplacePlans.value && Boolean(String(globalLibraryViewPlan.value?.planId || '').trim());
});

const triggerUsePlanFromPreview = () => {
  if (!globalLibraryViewPlan.value || !canUsePlanFromPreview.value) {
    return;
  }
  selectTemplatePlan({
    ...globalLibraryViewPlan.value,
    planId: globalLibraryViewPlan.value.planId,
  });
};

const openMainAccordion = (panel) => {
  if (panel !== 'build') {
    return;
  }
  mainAccordion.value[panel] = !mainAccordion.value[panel];
};

const sortGroupsByOrder = (groups = [], orderEntries = []) => {
  const normalized = Array.isArray(groups)
    ? groups.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (!normalized.length) {
    return [];
  }

  const fallbackOrderMap = new Map();
  normalized.forEach((label, index) => {
    fallbackOrderMap.set(label.toLowerCase(), index + 1);
  });

  const explicitOrderMap = new Map();
  if (Array.isArray(orderEntries)) {
    orderEntries.forEach((entry, index) => {
      const label = String(entry?.label || '').trim();
      if (!label) {
        return;
      }
      const parsed = Number(entry?.sortOrder);
      explicitOrderMap.set(label.toLowerCase(), Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1);
    });
  }

  return [...normalized].sort((left, right) => {
    const leftKey = left.toLowerCase();
    const rightKey = right.toLowerCase();
    const leftOrder = explicitOrderMap.get(leftKey) ?? fallbackOrderMap.get(leftKey) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = explicitOrderMap.get(rightKey) ?? fallbackOrderMap.get(rightKey) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return (fallbackOrderMap.get(leftKey) || 0) - (fallbackOrderMap.get(rightKey) || 0);
  });
};

const buildOrderEntries = (groups = []) => {
  return groups.map((label, index) => ({
    label,
    sortOrder: index + 1,
  }));
};

const syncGroupOrders = (mode, groups) => {
  const ordered = buildOrderEntries(groups);
  if (mode === 'week') {
    weekGroupOrders.value = ordered;
  } else {
    dayGroupOrders.value = ordered;
  }
};

const normalizeScheduleMode = (modeCandidate) => {
  return String(modeCandidate || '').trim().toLowerCase() === 'week' ? 'week' : 'day';
};

const groupRefsByMode = {
  day: dayGroups,
  week: weekGroups,
};

const groupOrderRefsByMode = {
  day: dayGroupOrders,
  week: weekGroupOrders,
};

const getGroupRefForMode = (modeCandidate = scheduleMode.value) => {
  const mode = normalizeScheduleMode(modeCandidate);
  return groupRefsByMode[mode] || dayGroups;
};

const getGroupOrderRefForMode = (modeCandidate = scheduleMode.value) => {
  const mode = normalizeScheduleMode(modeCandidate);
  return groupOrderRefsByMode[mode] || dayGroupOrders;
};

const activeGroups = computed(() => {
  const mode = normalizeScheduleMode(scheduleMode.value);
  const groups = getGroupRefForMode(mode);
  const orders = getGroupOrderRefForMode(mode);
  return sortGroupsByOrder(groups.value, orders.value);
});

const scheduleModeLabel = computed(() => normalizeScheduleMode(scheduleMode.value) === 'week' ? 'Week' : 'Day');
const scheduleModeLabelLower = computed(() => scheduleModeLabel.value.toLowerCase());
const scheduleGroupEditorLabel = computed(() => `Add Workout ${scheduleModeLabel.value}:`);
const scheduleGroupInputPlaceholder = computed(() => `${scheduleModeLabel.value} Name`);
const scheduleGroupAddButtonLabel = computed(() => `+ Add ${scheduleModeLabel.value}`);
const scheduleGroupEmptyStateText = computed(() => `No workout ${scheduleModeLabelLower.value}s added. Add a ${scheduleModeLabelLower.value} to begin.`);

const WORKOUT_DAY_NAME_MAX_LENGTH = 60;
const WORKOUT_DAY_NAME_DISPLAY_MAX_LENGTH = 48;
const WORKOUT_DAY_NAME_ALLOWED_PATTERN = /^[A-Za-z0-9&'() -]+$/;
const WORKOUT_DAY_NAME_INLINE_ALLOWED_MESSAGE = 'Only letters, numbers, spaces, ampersands, hyphens, apostrophes, and parentheses are allowed.';

const formatPlannerDayNameForDisplay = (value, maxLength = WORKOUT_DAY_NAME_DISPLAY_MAX_LENGTH) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};

const normalizeGroupKey = (value) => String(value || '').trim().toLowerCase();
let scheduleGroupIdentitySeed = 0;

const createScheduleGroupId = (mode) => {
  scheduleGroupIdentitySeed += 1;
  return `${mode}-group-${Date.now().toString(36)}-${scheduleGroupIdentitySeed.toString(36)}`;
};

const getGroupIdentityRefForMode = (modeCandidate = scheduleMode.value) => {
  const mode = normalizeScheduleMode(modeCandidate);
  return mode === 'week' ? weekGroupIdentityMap : dayGroupIdentityMap;
};

const transferScheduleGroupIdentity = (modeCandidate, oldGroupName, newGroupName) => {
  const mode = normalizeScheduleMode(modeCandidate);
  const identityRef = getGroupIdentityRefForMode(mode);
  const oldKey = normalizeGroupKey(oldGroupName);
  const newKey = normalizeGroupKey(newGroupName);
  if (!oldKey || !newKey || oldKey === newKey) {
    return;
  }

  const next = [...identityRef.value];
  const existingNew = next.find((entry) => entry?.normalizedName === newKey);
  if (existingNew) {
    return;
  }

  const target = next.find((entry) => entry?.normalizedName === oldKey);
  if (!target) {
    return;
  }

  target.normalizedName = newKey;
  identityRef.value = next;
};

const syncScheduleGroupIdentityMap = (modeCandidate, groups = []) => {
  const mode = normalizeScheduleMode(modeCandidate);
  const identityRef = getGroupIdentityRefForMode(mode);
  const current = Array.isArray(identityRef.value) ? identityRef.value : [];
  const usedIds = new Set();

  const next = groups
    .map((groupName) => normalizeGroupKey(groupName))
    .filter(Boolean)
    .map((normalizedName) => {
      const existing = current.find((entry) => entry?.normalizedName === normalizedName && !usedIds.has(entry.id));
      if (existing) {
        usedIds.add(existing.id);
        return existing;
      }
      const created = {
        id: createScheduleGroupId(mode),
        normalizedName,
      };
      usedIds.add(created.id);
      return created;
    });

  identityRef.value = next;
};

const getScheduleGroupId = (groupName, modeCandidate = scheduleMode.value) => {
  const mode = normalizeScheduleMode(modeCandidate);
  const normalized = normalizeGroupKey(groupName);
  if (!normalized) {
    return null;
  }

  const identityRef = getGroupIdentityRefForMode(mode);
  const hit = identityRef.value.find((entry) => entry?.normalizedName === normalized);
  return hit?.id || null;
};

const resolveScheduleGroupNameFromId = (groupId, modeCandidate = scheduleMode.value) => {
  const mode = normalizeScheduleMode(modeCandidate);
  const identityRef = getGroupIdentityRefForMode(mode);
  const groupRef = getGroupRefForMode(mode);

  const identity = identityRef.value.find((entry) => entry?.id === groupId);
  if (!identity) {
    return '';
  }

  return groupRef.value.find((groupName) => normalizeGroupKey(groupName) === identity.normalizedName) || '';
};

const getExpandedGroupId = (modeCandidate = scheduleMode.value) => {
  const mode = normalizeScheduleMode(modeCandidate);
  return expandedGroupIdByMode.value[mode] || null;
};

const setExpandedGroupId = (modeCandidate, groupId) => {
  const mode = normalizeScheduleMode(modeCandidate);
  expandedGroupIdByMode.value = {
    ...expandedGroupIdByMode.value,
    [mode]: groupId || null,
  };
};

const ensureAccordionSelectionForMode = (modeCandidate) => {
  const mode = normalizeScheduleMode(modeCandidate);
  const groupRef = getGroupRefForMode(mode);
  syncScheduleGroupIdentityMap(mode, groupRef.value);

  const identityRef = getGroupIdentityRefForMode(mode);
  if (!identityRef.value.length) {
    setExpandedGroupId(mode, null);
    if (normalizeScheduleMode(scheduleMode.value) === mode) {
      selectedScheduleGroup.value = null;
    }
    return;
  }

  const currentExpandedId = getExpandedGroupId(mode);
  const stillExists = identityRef.value.some((entry) => entry?.id === currentExpandedId);
  if (!stillExists) {
    setExpandedGroupId(mode, identityRef.value[0].id);
  }

  if (normalizeScheduleMode(scheduleMode.value) === mode) {
    const resolvedName = resolveScheduleGroupNameFromId(getExpandedGroupId(mode), mode);
    selectedScheduleGroup.value = resolvedName || groupRef.value[0] || null;
  }
};

const isScheduleGroupExpanded = (groupName, modeCandidate = scheduleMode.value) => {
  const mode = normalizeScheduleMode(modeCandidate);
  const groupId = getScheduleGroupId(groupName, mode);
  if (!groupId) {
    return false;
  }
  return getExpandedGroupId(mode) === groupId;
};

const toggleScheduleGroupAccordion = (groupName) => {
  const mode = normalizeScheduleMode(scheduleMode.value);
  const normalizedName = String(groupName || '').trim();
  if (!normalizedName) {
    return;
  }

  const groupId = getScheduleGroupId(normalizedName, mode);
  if (!groupId) {
    return;
  }

  if (getExpandedGroupId(mode) === groupId) {
    setExpandedGroupId(mode, null);
  } else {
    setExpandedGroupId(mode, groupId);
    selectedScheduleGroup.value = normalizedName;
  }

  plannerMessage.value = '';
};

const validateWorkoutDayName = (rawValue) => {
  const typedValue = String(rawValue ?? '');

  if (typedValue.length > WORKOUT_DAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Workout ${scheduleModeLabelLower.value} names can be at most ${WORKOUT_DAY_NAME_MAX_LENGTH} characters.`,
    };
  }

  const trimmedValue = typedValue.trim();
  if (!trimmedValue) {
    return {
      ok: false,
      message: `Workout ${scheduleModeLabelLower.value} name cannot be empty.`,
    };
  }

  if (!WORKOUT_DAY_NAME_ALLOWED_PATTERN.test(trimmedValue)) {
    return {
      ok: false,
      message: WORKOUT_DAY_NAME_INLINE_ALLOWED_MESSAGE,
    };
  }

  return { ok: true, value: trimmedValue };
};

const clearScheduleGroupEditorError = (source = 'all') => {
  if (source === 'all' || source === 'top') {
    if (scheduleGroupEditorError.value) {
      scheduleGroupEditorError.value = '';
    }
  }

  if (source === 'all' || source === 'bottom') {
    if (scheduleGroupBottomEditorError.value) {
      scheduleGroupBottomEditorError.value = '';
    }
  }
};

const hasMultipleScheduleGroups = computed(() => activeGroups.value.length > 1);
const isAdminGlobalPlanDraftFlow = computed(() => {
  if (!isAdminUser.value) {
    return false;
  }
  const planType = String(metadata.value?.planType || '').trim().toLowerCase();
  return ['global', 'featured', 'community_shared'].includes(planType);
});
const canAccessGlobalManagement = computed(() => isAdminUser.value || canCreateFeaturedPlans.value);
const canViewAdminUserPlans = computed(() => isAdminUser.value);
const hasPersistedCurrentPlan = computed(() => Boolean(String(currentPlanId.value || selectedWorkoutId.value || '').trim()));
const isGlobalPlanTypeSelected = computed(() => String(metadata.value?.planType || '').trim().toLowerCase() === 'global');
const isGlobalWorkflowPlanType = computed(() => {
  const planType = String(metadata.value?.planType || '').trim().toLowerCase();
  return ['global', 'featured', 'community_shared'].includes(planType);
});
const isMarketplacePlanTypeSelected = computed(() => String(metadata.value?.planType || '').trim().toLowerCase() === 'marketplace');
const canManagePublicationStatus = computed(() => {
  if (!userId.value) {
    return false;
  }

  if (isGlobalWorkflowPlanType.value) {
    return isAdminUser.value;
  }

  if (isMarketplacePlanTypeSelected.value) {
    return false;
  }

  return true;
});
const showPublicationStatusControls = computed(() => canManagePublicationStatus.value);
const showGlobalPublicationControls = computed(() => isAdminUser.value && isGlobalPlanTypeSelected.value && hasPersistedCurrentPlan.value);
const showGlobalFeaturedToggle = computed(() => showGlobalPublicationControls.value);
const isNewGlobalPlan = computed(() => isAdminGlobalPlanDraftFlow.value && !String(currentPlanId.value || '').trim());
const isDraftGlobalPlan = computed(() => isAdminGlobalPlanDraftFlow.value && planPublicationStatus.value === 'draft');
const isPublishedGlobalPlan = computed(() => isAdminGlobalPlanDraftFlow.value && planPublicationStatus.value === 'active');
const isArchivedGlobalPlan = computed(() => isAdminGlobalPlanDraftFlow.value && planPublicationStatus.value === 'archived');

const backendSupportedPublicationTransitions = {
  draft: ['draft', 'active'],
  active: ['active', 'draft'],
  archived: ['draft'],
};

const normalizePlanPublicationStatus = (statusValue) => {
  const normalized = String(statusValue || '').trim().toLowerCase();
  if (normalized === 'active') {
    return 'active';
  }
  if (normalized === 'archived') {
    return 'archived';
  }
  return 'draft';
};

const publicationStatusLabel = computed(() => {
  switch (planPublicationStatus.value) {
    case 'active':
      return 'Published';
    case 'archived':
      return 'Archived';
    default:
      return 'Draft';
  }
});

const publicationStatusClass = computed(() => {
  switch (planPublicationStatus.value) {
    case 'active':
      return 'publication-status-badge--published';
    case 'archived':
      return 'publication-status-badge--archived';
    default:
      return 'publication-status-badge--draft';
  }
});

const publicationStatusOptions = computed(() => {
  if (!showPublicationStatusControls.value) {
    return [];
  }

  const currentStatus = normalizePlanPublicationStatus(planPublicationStatus.value);
  const allowedTargets = backendSupportedPublicationTransitions[currentStatus] || [];
  const baseOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Published' },
    { value: 'archived', label: 'Archived' },
  ];

  return baseOptions.map((option) => {
    const disabled = !allowedTargets.includes(option.value);
    const reason = disabled
      ? `${publicationStatusLabel.value} -> ${option.label} is not supported by the current backend transition rules.`
      : '';
    return {
      ...option,
      disabled,
      reason,
    };
  });
});

const publicationStatusDisplayLabel = (statusValue) => {
  const normalized = normalizePlanPublicationStatus(statusValue);
  if (normalized === 'active') {
    return 'Published';
  }
  if (normalized === 'archived') {
    return 'Archived';
  }
  return 'Draft';
};

const savePlanModalSummary = computed(() => {
  const selectedStatus = normalizePlanPublicationStatus(selectedPublicationStatus.value);
  const currentStatus = normalizePlanPublicationStatus(planPublicationStatus.value);
  const planName = String(metadata.value?.name || '').trim() || 'Untitled Workout';

  return {
    planName,
    currentStatusLabel: publicationStatusDisplayLabel(currentStatus),
    selectedStatusLabel: publicationStatusDisplayLabel(selectedStatus),
    selectedStatus,
  };
});

const publicationStatusSectionDescription = computed(() => {
  if (showGlobalFeaturedToggle.value) {
    return 'Control publication visibility and featured placement.';
  }
  return 'Control publication visibility for this workout plan.';
});

const selectedPublicationStatusDisabledReason = computed(() => {
  const selected = normalizePlanPublicationStatus(selectedPublicationStatus.value);
  const option = publicationStatusOptions.value.find((entry) => entry.value === selected);
  return option?.disabled ? option.reason : '';
});

const canToggleGlobalFeatured = computed(() => {
  if (!showGlobalFeaturedToggle.value) {
    return false;
  }
  return normalizePlanPublicationStatus(selectedPublicationStatus.value) === 'active';
});

watch(
  showGlobalPublicationControls,
  (visible) => {
    if (!visible) {
      selectedPublicationStatus.value = 'draft';
      if (isGlobalPlanTypeSelected.value) {
        isGlobalPlanFeatured.value = false;
      }
    }
  },
  { immediate: true }
);

watch(
  () => metadata.value?.planType,
  () => {
    if (!canManagePublicationStatus.value) {
      selectedPublicationStatus.value = normalizePlanPublicationStatus(planPublicationStatus.value);
      return;
    }

    if (isMarketplacePlanTypeSelected.value) {
      selectedPublicationStatus.value = 'draft';
      return;
    }

    selectedPublicationStatus.value = normalizePlanPublicationStatus(planPublicationStatus.value);
  }
);

const workoutDaysWithExercises = computed(() => {
  return activeGroups.value.map((groupName) => {
    const exercises = workoutExercises.value.filter(
      (ex) => String(ex?.scheduleGroup || '').trim() === groupName
    );
    return {
      name: groupName,
      exercises,
      exerciseCount: countUniqueWorkoutPlanExercises(exercises),
    };
  });
});

const accordionGroupsWithExercises = computed(() => {
  const mode = normalizeScheduleMode(scheduleMode.value);
  const expandedId = getExpandedGroupId(mode);
  const identityRef = getGroupIdentityRefForMode(mode);
  const idByNameKey = new Map(
    identityRef.value.map((entry) => [entry.normalizedName, entry.id])
  );

  return workoutDaysWithExercises.value.map((group) => {
    const normalizedName = normalizeGroupKey(group.name);
    const stableId = idByNameKey.get(normalizedName) || `${mode}-group-fallback-${normalizedName || 'empty'}`;
    return {
      ...group,
      stableId,
      isExpanded: stableId === expandedId,
    };
  });
});

const hasWorkoutSchedules = computed(() => workoutSchedules.value.length > 0);
const isViewEditMode = computed(() => {
  const hasSelectedPlan = Boolean(String(currentPlanId.value || selectedWorkoutId.value || '').trim());
  return builderTab.value === 'view' && viewEditMode.value && hasSelectedPlan;
});

const canShowWorkoutDetails = computed(() => builderTab.value === 'create' || isViewEditMode.value || isCreatingWorkout.value || Boolean(selectedWorkoutId.value));
const showSaveFooter = computed(() => builderTab.value === 'create' || isViewEditMode.value);
const canModifyScheduleDayActions = computed(() => {
  return builderTab.value === 'create' || isViewEditMode.value || isCreatingWorkout.value;
});
const planDetailsHeaderText = computed(() => {
  if (builderTab.value === 'create') {
    return 'Create Workout Plan';
  }
  if (isViewEditMode.value) {
    return 'Edit Workout Plan';
  }
  return 'Workout Plan Details';
});
const planDetailsSubtitleText = computed(() => {
  if (builderTab.value === 'create') {
    return 'Create Plan name, description, type, duration, and goals.';
  }
  if (isViewEditMode.value) {
    return 'Edit Plan name, description, type, duration, and goals.';
  }
  return 'Plan name, description, type, duration, and goals.';
});
const primarySaveLabel = computed(() => {
  if (saving.value || publishing.value) {
    return 'Saving Workout Plan...';
  }
  if (isViewEditMode.value) {
    return 'Save Changes';
  }
  if (builderTab.value === 'create') {
    return 'Create Workout Plan';
  }
  return 'Save Workout Plan';
});

const plannerGroupsWithExercises = computed(() => {
  const groups = activeGroups.value;

  if (!groups.length) {
    return [];
  }

  return groups.map((group) => ({
    name: group,
    exercises: workoutExercises.value
      .map((exercise, index) => ({ exercise, index }))
      .filter((entry) => String(entry.exercise?.scheduleGroup || '').trim() === group),
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

const formatUserPlanCreatedAt = (plan = {}) => formatUpdatedAt(plan?.createdAt || null);

const normalizeAdminUserPlan = (plan = {}) => ({
  planId: String(plan?.planId || '').trim(),
  userId: Number(plan?.userId || 0) || null,
  username: String(plan?.username || '').trim(),
  displayName: String(plan?.displayName || '').trim() || String(plan?.username || '').trim() || 'Unknown User',
  planName: String(plan?.planName || '').trim() || 'Untitled Workout',
  duration: Number(plan?.duration || 0),
  exerciseCount: Number(plan?.exerciseCount || 0),
  createdAt: plan?.createdAt || null,
  updatedAt: plan?.updatedAt || null,
});

const clearAdminUserPlansError = () => {
  clearAreaError('adminUserPlans');
};

const loadAdminUserPlans = async () => {
  if (!canViewAdminUserPlans.value) {
    adminUserPlans.value = [];
    clearAdminUserPlansError();
    return;
  }

  adminUserPlansLoading.value = true;
  clearAdminUserPlansError();
  try {
    const response = await fetch(`${API_BASE}/api/admin/user-workout-plans`, {
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to load user workout plans.');
    }

    adminUserPlans.value = Array.isArray(data?.workoutLists)
      ? data.workoutLists.map(normalizeAdminUserPlan)
      : [];
  } catch (error) {
    setFriendlyAreaError('adminUserPlans', {
      rawMessage: error?.message || 'Failed to load user workout plans.',
      fallback: 'Unable to load user workout plans right now.',
    });
    adminUserPlans.value = [];
  } finally {
    adminUserPlansLoading.value = false;
  }
};

const viewUserPlanReadOnly = () => {
  saveMessage.value = 'Cross-user detail view is read-only and will be enabled in a future stage.';
};

const isPersonalWorkoutPlan = (plan = {}) => {
  const planType = String(plan?.planType || '').trim().toLowerCase();
  return !['global', 'featured', 'community_shared'].includes(planType);
};

const syncWorkoutSchedules = (incomingLists = []) => {
  workoutSchedules.value = (Array.isArray(incomingLists) ? incomingLists : [])
    .filter((plan) => isPersonalWorkoutPlan(plan))
    .map((plan) => ({
      ...plan,
      hasCustomCoverImage: Boolean(plan?.hasCustomCoverImage),
      coverImageUrl: buildPlanCoverImageUrl(plan?.planId),
      updatedAtLabel: formatUpdatedAt(plan.updatedAt),
    }));
};

const syncWorkoutPlannerCapabilities = (payload = {}) => {
  canCreateFeaturedPlans.value = Boolean(payload?.canCreateFeaturedPlans);
};

const committedPlannerState = ref('');

const buildPlannerDirtyState = () => {
  const sanitizedExercises = (Array.isArray(workoutExercises.value) ? workoutExercises.value : []).map((exercise = {}) => ({
    ...exercise,
    id: String(exercise?.id || ''),
  }));

  return JSON.stringify({
    metadata: {
      name: String(metadata.value?.name || '').trim(),
      description: String(metadata.value?.description || '').trim(),
      type: String(metadata.value?.type || '').trim(),
      category: metadata.value?.category == null ? '' : String(metadata.value?.category || '').trim(),
      planType: String(metadata.value?.planType || '').trim(),
      estimatedDuration: Number(metadata.value?.estimatedDuration || 0),
      planDurationWeeks: metadata.value?.planDurationWeeks == null ? '' : String(metadata.value?.planDurationWeeks),
      goalId: String(metadata.value?.goalId || '').trim(),
      goalTargetDate: String(metadata.value?.goalTargetDate || '').trim(),
      goalContext: metadata.value?.goalContext || null,
      goals: Array.isArray(metadata.value?.goals) ? metadata.value.goals : [],
      otherGoal: String(metadata.value?.otherGoal || '').trim(),
    },
    scheduleMode: normalizeScheduleMode(scheduleMode.value),
    dayGroups: Array.isArray(dayGroups.value) ? dayGroups.value : [],
    weekGroups: Array.isArray(weekGroups.value) ? weekGroups.value : [],
    dayGroupOrders: Array.isArray(dayGroupOrders.value) ? dayGroupOrders.value : [],
    weekGroupOrders: Array.isArray(weekGroupOrders.value) ? weekGroupOrders.value : [],
    selectedScheduleGroup: selectedScheduleGroup.value || null,
    exercises: sanitizedExercises,
    planPublicationStatus: normalizePlanPublicationStatus(planPublicationStatus.value),
    selectedPublicationStatus: normalizePlanPublicationStatus(selectedPublicationStatus.value),
    isGlobalPlanFeatured: Boolean(isGlobalPlanFeatured.value),
    currentPlanId: String(currentPlanId.value || '').trim(),
    selectedWorkoutId: String(selectedWorkoutId.value || '').trim(),
    isCreatingWorkout: Boolean(isCreatingWorkout.value),
  });
};

const markPlannerStateCommitted = () => {
  committedPlannerState.value = buildPlannerDirtyState();
};

const hasUnsavedPlannerChanges = computed(() => {
  if (!committedPlannerState.value) {
    const hasAnyText = Boolean(String(metadata.value?.name || '').trim() || String(metadata.value?.description || '').trim());
    const hasAnyStructure = Boolean((Array.isArray(dayGroups.value) && dayGroups.value.length)
      || (Array.isArray(weekGroups.value) && weekGroups.value.length)
      || (Array.isArray(workoutExercises.value) && workoutExercises.value.length)
      || String(currentPlanId.value || '').trim());
    return hasAnyText || hasAnyStructure;
  }

  return buildPlannerDirtyState() !== committedPlannerState.value;
});

const resetPlannerDraft = ({ preserveSaveMessage = false } = {}) => {
  metadata.value = {
    name: '',
    description: '',
    type: 'Strength',
    category: 'General Fitness',
    planType: defaultWorkoutPlanTypeByRole.value,
    estimatedDuration: 45,
    planDurationWeeks: '',
    goalId: '',
    goalTargetDate: '',
    goalContext: null,
    goals: [],
    otherGoal: '',
  };
  currentPlanId.value = '';
  workoutExercises.value = [];
  scheduleMode.value = 'day';
  dayGroups.value = [];
  weekGroups.value = [];
  dayGroupOrders.value = [];
  weekGroupOrders.value = [];
  selectedScheduleGroup.value = null;
  expandedGroupIdByMode.value = { day: null, week: null };
  dayGroupIdentityMap.value = [];
  weekGroupIdentityMap.value = [];
  newScheduleGroupName.value = '';
  newScheduleGroupNameBottom.value = '';
  inlineEditingDayName.value = '';
  inlineDayNameDraft.value = '';
  clearScheduleGroupEditorError('all');
  plannerMessage.value = '';
  if (!preserveSaveMessage) {
    saveMessage.value = '';
  }
  planPublicationStatus.value = 'draft';
  selectedPublicationStatus.value = 'draft';
  isGlobalPlanFeatured.value = false;
  isWorkoutDetailsOpen.value = true;
  isSchedulePlannerOpen.value = true;
  coverUploadInFlight.value = false;
  coverDeleteInFlight.value = false;
  coverUploadProgress.value = 0;
  currentPlanHasCustomCover.value = false;
  persistedCoverImageReference.value = '';
  clearPendingCoverSelection();
  updateCoverUiMessage('', 'info');
  markPlannerStateCommitted();
};

const clearActivePlanRouteQuery = async () => {
  const currentRoutePlanId = String(route.query?.planId || '').trim();
  if (!currentRoutePlanId) {
    return;
  }

  await router.replace({ query: { ...route.query, planId: undefined } });
};

const initializeFreshCreatePlan = async ({ confirmUnsaved = true } = {}) => {
  if (confirmUnsaved && hasUnsavedPlannerChanges.value) {
    const confirmed = await showConfirmDialog('You have unsaved changes. Discard these changes and start a new plan?', {
      title: 'Discard Unsaved Changes?',
      confirmButtonText: 'Discard',
      cancelButtonText: 'Keep Editing',
    });
    if (!confirmed) {
      return false;
    }
  }

  plannerLoadRequestId.value += 1;
  viewEditMode.value = false;
  selectedWorkoutId.value = '';
  isCreatingWorkout.value = false;
  hasSavedWorkoutDetails.value = false;
  builderTab.value = 'create';
  resetPlannerDraft();
  await clearActivePlanRouteQuery();
  return true;
};

const handleCreatePlanTabClick = async () => {
  await initializeFreshCreatePlan({ confirmUnsaved: true });
};

const openViewPlansTab = () => {
  builderTab.value = 'view';
  viewEditMode.value = false;
};

const normalizeLoadedDayGroups = (planner = {}) => {
  const fromDays = Array.isArray(planner?.dayGroups) ? planner.dayGroups : [];
  const fromExercises = Array.isArray(planner?.exercises)
    ? planner.exercises.map((exercise) => String(exercise?.scheduleGroup || '').trim()).filter(Boolean)
    : [];

  const merged = [...fromDays, ...fromExercises]
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .filter((name, index, source) => source.findIndex((entry) => entry.toLowerCase() === name.toLowerCase()) === index);

  return merged;
};

const hydratePlanner = (planner = {}, {
  markSaved = true,
  targetTab = builderTab.value,
  enableViewEditMode = false,
} = {}) => {
  currentPlanId.value = String(planner?.planId || '').trim();
  persistedCoverImageReference.value = resolvePersistedCoverReferenceForPlan(planner);
  currentPlanHasCustomCover.value = !isDefaultWorkoutPlanCoverReference(persistedCoverImageReference.value);
  clearPendingCoverSelection();

  const incomingGoals = Array.isArray(planner?.metadata?.goals)
    ? planner.metadata.goals.map((goal) => String(goal || '').trim()).filter(Boolean)
    : [];

  planPublicationStatus.value = normalizePlanPublicationStatus(planner?.status);
  selectedPublicationStatus.value = planPublicationStatus.value;

  const loadedCategory = planner?.metadata?.category;
  const loadedRawPlanType = String(planner?.metadata?.planType || '').trim().toLowerCase();
  const loadedIsLegacyFeatured = loadedRawPlanType === 'featured';
  const loadedFeaturedFlag = planner?.metadata?.isFeatured ?? planner?.metadata?.featured;
  isGlobalPlanFeatured.value = Boolean(loadedFeaturedFlag ?? loadedIsLegacyFeatured);

  const resolvedPlanType = loadedIsLegacyFeatured
    ? PLAN_TYPE_GLOBAL
    : String(planner?.metadata?.planType || '').trim();

  metadata.value = {
    name: planner?.metadata?.name || '',
    description: planner?.metadata?.description || '',
    type: planner?.metadata?.type || 'Strength',
    category: loadedCategory == null ? null : String(loadedCategory || '').trim() || null,
    planType: resolvedPlanType,
    estimatedDuration: Number(planner?.metadata?.estimatedDuration || 45),
    planDurationWeeks: planner?.metadata?.planDurationWeeks == null || planner?.metadata?.planDurationWeeks === undefined || planner?.metadata?.planDurationWeeks === ''
      ? ''
      : Number(planner?.metadata?.planDurationWeeks),
    goalId: String(planner?.metadata?.goalId || '').trim(),
    goalTargetDate: planner?.metadata?.goalTargetDate == null || planner?.metadata?.goalTargetDate === undefined || planner?.metadata?.goalTargetDate === ''
      ? ''
      : String(planner?.metadata?.goalTargetDate || '').trim(),
    goalContext: planner?.metadata?.goalContext && typeof planner.metadata.goalContext === 'object'
      ? planner.metadata.goalContext
      : null,
    goals: incomingGoals,
    otherGoal: String(planner?.metadata?.otherGoal || '').trim(),
  };

  scheduleMode.value = 'day';
  const incomingDayGroups = normalizeLoadedDayGroups(planner);
  const incomingWeekGroups = Array.isArray(planner?.weekGroups) ? planner.weekGroups : [];

  const incomingDayOrders = Array.isArray(planner?.dayGroupOrders) ? planner.dayGroupOrders : [];
  const incomingWeekOrders = Array.isArray(planner?.weekGroupOrders) ? planner.weekGroupOrders : [];

  dayGroups.value = sortGroupsByOrder(incomingDayGroups, incomingDayOrders);
  weekGroups.value = sortGroupsByOrder(incomingWeekGroups, incomingWeekOrders);

  syncGroupOrders('day', dayGroups.value);
  syncGroupOrders('week', weekGroups.value);

  workoutExercises.value = Array.isArray(planner?.exercises)
    ? planner.exercises.map((exercise) => ({
        ...exercise,
        scheduleGroup: String(exercise?.scheduleGroup || '').trim(),
      }))
    : [];

  const assignedGroups = Array.from(
    new Set(workoutExercises.value.map((exercise) => String(exercise.scheduleGroup || '').trim()).filter(Boolean))
  );

  const appendMissingGroups = (groups) => {
    const next = [...groups];
    assignedGroups.forEach((label) => {
      const normalized = String(label || '').trim().toLowerCase();
      if (!normalized) {
        return;
      }
      if (!next.some((group) => String(group || '').trim().toLowerCase() === normalized)) {
        next.push(label);
      }
    });
    return next;
  };

  dayGroups.value = appendMissingGroups(dayGroups.value);
  syncGroupOrders('day', dayGroups.value);

  syncScheduleGroupIdentityMap('day', dayGroups.value);
  syncScheduleGroupIdentityMap('week', weekGroups.value);
  ensureAccordionSelectionForMode('day');
  ensureAccordionSelectionForMode('week');

  hasSavedWorkoutDetails.value = markSaved;
  inlineEditingDayName.value = '';
  inlineDayNameDraft.value = '';
  newScheduleGroupName.value = '';
  newScheduleGroupNameBottom.value = '';
  clearScheduleGroupEditorError('all');
  isWorkoutDetailsOpen.value = true;
  isSchedulePlannerOpen.value = markSaved;
  builderTab.value = targetTab;
  viewEditMode.value = targetTab === 'view' && Boolean(enableViewEditMode);
  markPlannerStateCommitted();
};

const clearSelection = async ({ nextTab = 'create', preserveSaveMessage = false } = {}) => {
  plannerLoadRequestId.value += 1;
  viewEditMode.value = false;
  selectedWorkoutId.value = '';
  currentPlanId.value = '';
  isCreatingWorkout.value = false;
  hasSavedWorkoutDetails.value = false;
  builderTab.value = nextTab;
  resetPlannerDraft({ preserveSaveMessage });
  await router.replace({ query: { ...route.query, planId: undefined } });
};

const exitViewEditMode = async ({ confirmUnsaved = true } = {}) => {
  if (!isViewEditMode.value) {
    return;
  }

  if (confirmUnsaved && hasUnsavedPlannerChanges.value) {
    const confirmed = await showConfirmDialog('You have unsaved changes. Discard these changes and return to plans?', {
      title: 'Discard Unsaved Changes?',
      confirmButtonText: 'Discard',
      cancelButtonText: 'Keep Editing',
    });
    if (!confirmed) {
      return;
    }
  }

  await clearSelection({ nextTab: 'view', preserveSaveMessage: true });
};

const syncEditorContextAfterSuccessfulSave = async () => {
  const activePlanId = String(currentPlanId.value || '').trim();
  if (!activePlanId) {
    return;
  }

  if (!isViewEditMode.value && builderTab.value !== 'create') {
    builderTab.value = 'create';
  }

  const currentQueryPlanId = String(route.query?.planId || '').trim();
  if (currentQueryPlanId !== activePlanId) {
    await router.replace({ query: { ...route.query, planId: activePlanId } });
  }
};

const openPicker = ({ insertPosition = 'bottom' } = {}) => {
  selectedExerciseInsertPosition.value = insertPosition === 'top' ? 'top' : 'bottom';
  pickerOpen.value = true;
};

const closePicker = () => {
  pickerOpen.value = false;
  selectedExerciseInsertPosition.value = 'bottom';
};

const createWorkoutPlan = async () => {
  saveMessage.value = '';
  if (!userId.value) {
    saveMessage.value = 'Unable to resolve user session. Please login again.';
    return;
  }

  // Always start a new draft from a clean planner state.
  dayGroups.value = [];
  weekGroups.value = [];
  syncGroupOrders('day', []);
  syncGroupOrders('week', []);
  selectedScheduleGroup.value = null;
  workoutExercises.value = [];
  plannerMessage.value = '';
  isGlobalPlanFeatured.value = false;

  loadingPlanner.value = true;
  try {
    const selectedPlanType = String(metadata.value?.planType || '').trim() || defaultWorkoutPlanTypeByRole.value;
    const response = await fetch(`${API_BASE}/api/workout-schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleMode: 'day',
        planType: selectedPlanType,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error || 'Failed to create workout plan.');
    }

    const data = await response.json();
    syncWorkoutPlannerCapabilities(data);
    const planner = data?.planner || {};
    const createdPlanId = String(planner?.planId || '').trim();

    if (!createdPlanId) {
      throw new Error('Workout plan was created but no plan ID was returned.');
    }

    syncWorkoutSchedules(data?.workoutLists);
    selectedWorkoutId.value = createdPlanId;
    currentPlanId.value = createdPlanId;
    currentPlanHasCustomCover.value = false;
    refreshCoverImages();
    isCreatingWorkout.value = true;
    hasSavedWorkoutDetails.value = false;

    const createdCategory = planner?.metadata?.category;
    const createdRawPlanType = String(planner?.metadata?.planType || '').trim().toLowerCase();
    const createdIsLegacyFeatured = createdRawPlanType === 'featured';
    const createdFeaturedFlag = planner?.metadata?.isFeatured ?? planner?.metadata?.featured;
    isGlobalPlanFeatured.value = Boolean(createdFeaturedFlag ?? createdIsLegacyFeatured);

    metadata.value = {
      name: '',
      description: '',
      type: planner?.metadata?.type || 'Strength',
      category: createdCategory == null ? null : String(createdCategory || '').trim() || null,
      planType: createdIsLegacyFeatured ? PLAN_TYPE_GLOBAL : (String(planner?.metadata?.planType || '').trim() || selectedPlanType),
      estimatedDuration: Number(planner?.metadata?.estimatedDuration || 45),
      planDurationWeeks: planner?.metadata?.planDurationWeeks == null || planner?.metadata?.planDurationWeeks === undefined || planner?.metadata?.planDurationWeeks === ''
        ? ''
        : Number(planner?.metadata?.planDurationWeeks),
      goalId: String(planner?.metadata?.goalId || '').trim(),
      goalTargetDate: planner?.metadata?.goalTargetDate == null || planner?.metadata?.goalTargetDate === undefined || planner?.metadata?.goalTargetDate === ''
        ? ''
        : String(planner?.metadata?.goalTargetDate || '').trim(),
      goalContext: planner?.metadata?.goalContext && typeof planner.metadata.goalContext === 'object'
        ? planner.metadata.goalContext
        : null,
      goals: Array.isArray(planner?.metadata?.goals)
        ? planner.metadata.goals.map((goal) => String(goal || '').trim()).filter(Boolean)
        : [],
      otherGoal: String(planner?.metadata?.otherGoal || '').trim(),
    };

    // New plans must begin with zero workout days regardless of backend defaults.
    scheduleMode.value = 'day';
    dayGroups.value = [];
    weekGroups.value = [];

    syncGroupOrders('day', []);
    syncGroupOrders('week', []);

    selectedScheduleGroup.value = null;
    
    workoutExercises.value = [];
    plannerMessage.value = '';
    isWorkoutDetailsOpen.value = true;
    isSchedulePlannerOpen.value = false;
    builderTab.value = 'create';

    if (pendingCoverFile.value) {
      await uploadPendingCoverAfterPlanCreate(createdPlanId);
    } else {
      updateCoverUiMessage('You can now upload a cover image for this plan.', 'info');
    }

    skipNextRoutePlannerLoad.value = true;
    await router.replace({ query: { ...route.query, planId: createdPlanId } });
    saveMessage.value = 'Draft workout plan created. Add details and save to continue.';
    markPlannerStateCommitted();
  } catch (error) {
    saveMessage.value = error.message || 'Failed to create workout plan.';
  } finally {
    loadingPlanner.value = false;
  }
};

const clearScheduleGroupEdit = () => {
  inlineEditingDayName.value = '';
  inlineDayNameDraft.value = '';
};

const canRemoveScheduleGroup = (groupName) => {
  const target = getGroupRefForMode().value;
  if (!target.length) {
    return false;
  }
  const normalized = String(groupName || '').trim().toLowerCase();
  return target.some((group) => String(group || '').trim().toLowerCase() === normalized);
};

const addScheduleGroupFromValue = ({
  rawName = '',
  source = 'top',
  collapsePreviousAndExpandNew = false,
} = {}) => {
  clearScheduleGroupEditorError(source);
  const validation = validateWorkoutDayName(rawName);
  if (!validation.ok) {
    if (source === 'bottom') {
      scheduleGroupBottomEditorError.value = validation.message;
    } else {
      scheduleGroupEditorError.value = validation.message;
    }
    return;
  }

  const name = validation.value;

  const mode = normalizeScheduleMode(scheduleMode.value);
  const target = getGroupRefForMode(mode);
  const normalizedName = normalizeGroupKey(name);

  if (target.value.some((group) => normalizeGroupKey(group) === normalizedName)) {
    const duplicateMessage = `${name} already exists.`;
    if (source === 'bottom') {
      scheduleGroupBottomEditorError.value = duplicateMessage;
    } else {
      scheduleGroupEditorError.value = duplicateMessage;
    }
    return;
  }

  target.value = [...target.value, name];
  syncGroupOrders(mode, target.value);
  syncScheduleGroupIdentityMap(mode, target.value);

  if (collapsePreviousAndExpandNew || !selectedScheduleGroup.value) {
    selectedScheduleGroup.value = name;
    const newGroupId = getScheduleGroupId(name, mode);
    if (newGroupId) {
      setExpandedGroupId(mode, newGroupId);
    }
  } else {
    ensureAccordionSelectionForMode(mode);
  }

  if (source === 'bottom') {
    newScheduleGroupNameBottom.value = '';
    scheduleGroupBottomEditorError.value = '';
  } else {
    newScheduleGroupName.value = '';
    scheduleGroupEditorError.value = '';
  }

  plannerMessage.value = '';
};

const addScheduleGroup = () => {
  addScheduleGroupFromValue({
    rawName: newScheduleGroupName.value,
    source: 'top',
    collapsePreviousAndExpandNew: false,
  });
};

const addScheduleGroupBottom = () => {
  addScheduleGroupFromValue({
    rawName: newScheduleGroupNameBottom.value,
    source: 'bottom',
    collapsePreviousAndExpandNew: true,
  });
};

const setActiveDay = (groupName) => {
  const mode = normalizeScheduleMode(scheduleMode.value);
  selectedScheduleGroup.value = groupName;
  const groupId = getScheduleGroupId(groupName, mode);
  if (groupId) {
    setExpandedGroupId(mode, groupId);
  }
  plannerMessage.value = '';
};

const startInlineDayNameEdit = (groupName) => {
  const name = String(groupName || '').trim();
  if (!name) {
    return;
  }

  selectedScheduleGroup.value = name;
  const groupId = getScheduleGroupId(name, scheduleMode.value);
  if (groupId) {
    setExpandedGroupId(scheduleMode.value, groupId);
  }
  inlineEditingDayName.value = name;
  inlineDayNameDraft.value = name;
  inlineDayNameError.value = '';
  plannerMessage.value = '';
};

const cancelInlineDayNameEdit = () => {
  inlineDayNameError.value = '';
  clearScheduleGroupEdit();
  plannerMessage.value = '';
};

const handleInlineDayNameInput = () => {
  if (!inlineDayNameError.value) {
    return;
  }

  const validation = validateWorkoutDayName(inlineDayNameDraft.value);
  if (validation.ok) {
    inlineDayNameError.value = '';
  }
};

const saveInlineDayNameEdit = () => {
  const mode = normalizeScheduleMode(scheduleMode.value);
  const target = getGroupRefForMode(mode);
  const oldName = String(inlineEditingDayName.value || '').trim();
  if (!oldName) {
    return;
  }

  const validation = validateWorkoutDayName(inlineDayNameDraft.value);
  if (!validation.ok) {
    inlineDayNameError.value = validation.message;
    return;
  }
  inlineDayNameError.value = '';

  const suggestedName = validation.value;

  if (!suggestedName || suggestedName === oldName) {
    clearScheduleGroupEdit();
    return;
  }

  const normalizedNew = normalizeGroupKey(suggestedName);
  const normalizedOld = normalizeGroupKey(oldName);
  if (target.value.some((group) => normalizeGroupKey(group) === normalizedNew)) {
    plannerMessage.value = `${suggestedName} already exists.`;
    return;
  }

  target.value = target.value.map((group) => (
    normalizeGroupKey(group) === normalizedOld ? suggestedName : group
  ));
  transferScheduleGroupIdentity(mode, oldName, suggestedName);
  syncGroupOrders(mode, target.value);

  workoutExercises.value = workoutExercises.value.map((exercise) => {
    if (normalizeGroupKey(exercise.scheduleGroup) === normalizedOld) {
      return { ...exercise, scheduleGroup: suggestedName };
    }
    return exercise;
  });

  if (normalizeGroupKey(selectedScheduleGroup.value) === normalizedOld) {
    selectedScheduleGroup.value = suggestedName;
  }

  ensureAccordionSelectionForMode(mode);

  clearScheduleGroupEdit();
  inlineDayNameError.value = '';
  plannerMessage.value = '';
};

const removeScheduleGroup = (groupName) => {
  if (!canRemoveScheduleGroup(groupName)) {
    plannerMessage.value = `Workout ${scheduleModeLabelLower.value} was not found.`;
    return;
  }

  const mode = normalizeScheduleMode(scheduleMode.value);
  const target = getGroupRefForMode(mode);
  const normalizedRemovedName = String(groupName || '').trim().toLowerCase();

  const nextGroups = target.value.filter(
    (group) => String(group || '').trim().toLowerCase() !== normalizedRemovedName
  );
  target.value = nextGroups;
  syncGroupOrders(mode, target.value);

  if (String(inlineEditingDayName.value || '').trim().toLowerCase() === normalizedRemovedName) {
    clearScheduleGroupEdit();
  }

  workoutExercises.value = workoutExercises.value.map((exercise) => {
    if (String(exercise.scheduleGroup || '').trim().toLowerCase() === normalizedRemovedName) {
      return { ...exercise, scheduleGroup: '' };
    }
    return exercise;
  });
  
  // Clear selection if the selected group was removed
  if (selectedScheduleGroup.value && String(selectedScheduleGroup.value).trim().toLowerCase() === normalizedRemovedName) {
    selectedScheduleGroup.value = target.value[0] || null;
  }

  ensureAccordionSelectionForMode(mode);

  plannerMessage.value = '';
};

const changeScheduleMode = (mode) => {
  const normalizedMode = normalizeScheduleMode(mode);
  scheduleMode.value = normalizedMode;
  clearScheduleGroupEdit();
  const targetGroups = getGroupRefForMode(normalizedMode);
  const targetOrders = getGroupOrderRefForMode(normalizedMode);
  targetGroups.value = sortGroupsByOrder(targetGroups.value, targetOrders.value);
  syncGroupOrders(normalizedMode, targetGroups.value);
  plannerMessage.value = '';
  ensureAccordionSelectionForMode(normalizedMode);
};

const toggleWorkoutDetails = () => {
  isWorkoutDetailsOpen.value = !isWorkoutDetailsOpen.value;
};

const toggleSchedulePlanner = () => {
  isSchedulePlannerOpen.value = !isSchedulePlannerOpen.value;
};

// Helper function to resolve exercise image path
const resolveExerciseImage = (exercise) => {
  return getExerciseImage(exercise);
};

const onPreviewExerciseImageError = (event) => {
  if (!event?.target) return;
  if (event.target.src === DEFAULT_EXERCISE_IMAGE) return;
  event.target.src = DEFAULT_EXERCISE_IMAGE;
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
    scheduleGroup: '',
  };
};

const findExerciseInsertIndexForEmptyGroup = (groupName) => {
  const normalizedTarget = normalizeGroupKey(groupName);
  const groups = activeGroups.value;
  const targetIndex = groups.findIndex((group) => normalizeGroupKey(group) === normalizedTarget);
  if (targetIndex < 0) {
    return workoutExercises.value.length;
  }

  for (let index = targetIndex + 1; index < groups.length; index += 1) {
    const nextGroupKey = normalizeGroupKey(groups[index]);
    const nextGroupExerciseIndex = workoutExercises.value.findIndex(
      (exercise) => normalizeGroupKey(exercise?.scheduleGroup) === nextGroupKey
    );
    if (nextGroupExerciseIndex >= 0) {
      return nextGroupExerciseIndex;
    }
  }

  return workoutExercises.value.length;
};

const insertExercisesIntoGroup = ({ groupName, blocks, insertPosition = 'bottom' } = {}) => {
  const normalizedTarget = normalizeGroupKey(groupName);
  const existingIndexes = workoutExercises.value
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => normalizeGroupKey(exercise?.scheduleGroup) === normalizedTarget)
    .map(({ index }) => index);

  const nextExercises = [...workoutExercises.value];

  if (!existingIndexes.length) {
    const insertAt = findExerciseInsertIndexForEmptyGroup(groupName);
    nextExercises.splice(insertAt, 0, ...blocks);
    workoutExercises.value = nextExercises;
    return;
  }

  const insertAt = insertPosition === 'top'
    ? existingIndexes[0]
    : existingIndexes[existingIndexes.length - 1] + 1;

  nextExercises.splice(insertAt, 0, ...blocks);
  workoutExercises.value = nextExercises;
};

const addExerciseToWorkout = (incoming) => {
  // Validate that a day/week is selected
  if (!selectedScheduleGroup.value) {
    plannerMessage.value = 'Select a workout day before adding exercises.';
    return;
  }
  
  // Verify the selected group still exists
  if (!activeGroups.value.includes(selectedScheduleGroup.value)) {
    plannerMessage.value = `Selected workout ${scheduleModeLabelLower.value} was not found.`;
    selectedScheduleGroup.value = null;
    return;
  }

  const selectedGroup = selectedScheduleGroup.value;
  const exercisesToAdd = Array.isArray(incoming) ? incoming : [incoming];
  const validExercises = exercisesToAdd.filter((exercise) => Number(exercise?.ExerciseID || 0) > 0);

  if (!validExercises.length) {
    plannerMessage.value = 'No valid exercises were selected.';
    return;
  }

  // Preserve the selected order from the picker when adding multiple exercises.
  const blocks = validExercises.map((exercise) => {
    const block = createBlock(exercise);
    block.scheduleGroup = selectedGroup;
    return block;
  });

  insertExercisesIntoGroup({
    groupName: selectedGroup,
    blocks,
    insertPosition: selectedExerciseInsertPosition.value,
  });
  
  saveMessage.value = '';
  plannerMessage.value = '';
  selectedExerciseInsertPosition.value = 'bottom';
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

const moveScheduleGroup = (groupName, direction = 'up') => {
  const mode = normalizeScheduleMode(scheduleMode.value);
  const targetRef = getGroupRefForMode(mode);
  const ordered = [...targetRef.value];
  const index = ordered.findIndex(
    (group) => String(group || '').trim().toLowerCase() === String(groupName || '').trim().toLowerCase()
  );

  if (index < 0) {
    return;
  }

  if (direction === 'up' && index > 0) {
    [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
  } else if (direction === 'down' && index < ordered.length - 1) {
    [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]];
  } else {
    return;
  }

  targetRef.value = ordered;
  syncGroupOrders(mode, ordered);
  ensureAccordionSelectionForMode(mode);
};

const moveScheduleGroupUp = (groupName) => moveScheduleGroup(groupName, 'up');
const moveScheduleGroupDown = (groupName) => moveScheduleGroup(groupName, 'down');

const resetScheduleGroupOrder = () => {
  const mode = normalizeScheduleMode(scheduleMode.value);
  const targetRef = getGroupRefForMode(mode);
  const ordered = [...targetRef.value];
  syncGroupOrders(mode, ordered);
  plannerMessage.value = '';
};

const duplicateScheduleGroup = (groupName) => {
  const mode = normalizeScheduleMode(scheduleMode.value);
  const targetRef = getGroupRefForMode(mode);
  const sourceName = String(groupName || '').trim();
  if (!sourceName) return;

  const sourceIndex = targetRef.value.findIndex(
    (name) => String(name || '').trim().toLowerCase() === sourceName.toLowerCase()
  );
  if (sourceIndex < 0) return;

  let suffix = 2;
  let duplicateName = `${sourceName} Copy`;
  const lowerSet = new Set(targetRef.value.map((name) => String(name || '').trim().toLowerCase()));
  while (lowerSet.has(duplicateName.toLowerCase())) {
    duplicateName = `${sourceName} Copy ${suffix}`;
    suffix += 1;
  }

  const nextGroups = [...targetRef.value];
  nextGroups.splice(sourceIndex + 1, 0, duplicateName);
  targetRef.value = nextGroups;
  syncGroupOrders(mode, targetRef.value);

  const sourceExercises = workoutExercises.value.filter(
    (exercise) => String(exercise.scheduleGroup || '').trim().toLowerCase() === sourceName.toLowerCase()
  );

  const clonedExercises = sourceExercises.map((exercise) => ({
    ...exercise,
    id: `${exercise.id || exercise.exerciseId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    scheduleGroup: duplicateName,
  }));

  workoutExercises.value = [...workoutExercises.value, ...clonedExercises];
  selectedScheduleGroup.value = duplicateName;
  ensureAccordionSelectionForMode(mode);
  const duplicateId = getScheduleGroupId(duplicateName, mode);
  if (duplicateId) {
    setExpandedGroupId(mode, duplicateId);
  }
  plannerMessage.value = '';
};

watch(
  dayGroups,
  (groups) => {
    syncScheduleGroupIdentityMap('day', groups);
    ensureAccordionSelectionForMode('day');
  },
  { immediate: true }
);

watch(
  weekGroups,
  (groups) => {
    syncScheduleGroupIdentityMap('week', groups);
    ensureAccordionSelectionForMode('week');
  },
  { immediate: true }
);

const isFirstScheduleGroup = (groupName) => {
  const normalized = String(groupName || '').trim().toLowerCase();
  return String(activeGroups.value[0] || '').trim().toLowerCase() === normalized;
};

const isLastScheduleGroup = (groupName) => {
  const normalized = String(groupName || '').trim().toLowerCase();
  return String(activeGroups.value[activeGroups.value.length - 1] || '').trim().toLowerCase() === normalized;
};

const plannerPayload = computed(() => ({
  planId: currentPlanId.value || undefined,
  metadata: {
    ...metadata.value,
    status: normalizePlanPublicationStatus(selectedPublicationStatus.value || planPublicationStatus.value),
  },
  scheduleMode: normalizeScheduleMode(scheduleMode.value),
  dayGroups: dayGroups.value,
  weekGroups: weekGroups.value,
  dayGroupOrders: buildOrderEntries(dayGroups.value),
  weekGroupOrders: buildOrderEntries(weekGroups.value),
  exercises: workoutExercises.value,
  status: normalizePlanPublicationStatus(selectedPublicationStatus.value || planPublicationStatus.value),
}));

const sendAiSuggestion = async () => {
  const trimmedPrompt = aiPrompt.value.trim();
  if (!trimmedPrompt) {
    clearAreaError('ai');
    aiError.value = 'Please enter a short message before sending.';
    return;
  }

  aiLoading.value = true;
  clearAreaError('ai');
  aiResponse.value = '';

  try {
    const response = await fetch(`${API_BASE}/api/ai/qa-message`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmedPrompt }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw {
        status: Number(response?.status || 0) || null,
        rawMessage: data?.error || data?.detail || 'The AI request could not be completed.',
        code: data?.code || data?.errorCode || '',
        requestId: data?.requestId || response.headers?.get('x-request-id') || '',
        service: data?.service || '',
      };
    }

    aiResponse.value = data?.response || 'The AI gateway returned an empty response.';
  } catch (error) {
    setFriendlyAreaError('ai', {
      status: error?.status,
      code: error?.code,
      requestId: error?.requestId,
      service: error?.service,
      rawMessage: error?.rawMessage || error?.message,
      category: 'ai',
      fallback: 'AI Assistant is temporarily unavailable. Please try again later.',
    });
  } finally {
    aiLoading.value = false;
  }
};

const runGatewayDebugTest = async () => {
  clearAreaError('ai');
  aiResponse.value = '';
  gatewayTestLoading.value = true;

  try {
    const response = await fetch(`${API_BASE}/api/ai/qa-message`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' }),
    });

    const rawText = await response.text();
    let parsedBody = rawText;
    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedBody = rawText;
    }

    if (!response.ok) {
      aiResponse.value = typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody, null, 2);
      return;
    }

    aiResponse.value = typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody, null, 2);
  } catch (error) {
    setFriendlyAreaError('ai', {
      rawMessage: error?.message || 'Gateway test failed.',
      category: 'ai',
      fallback: 'Gateway test failed.',
    });
    aiResponse.value = '';
  } finally {
    gatewayTestLoading.value = false;
  }
};

const requestDeleteDay = (dayName) => {
  dayToDelete.value = dayName;
  showDeleteModal.value = true;
};

const cancelDeleteDay = () => {
  showDeleteModal.value = false;
  dayToDelete.value = null;
};

const confirmDeleteDay = () => {
  if (!dayToDelete.value) {
    cancelDeleteDay();
    return;
  }
  removeScheduleGroup(dayToDelete.value);
  cancelDeleteDay();
};

const persistWorkout = async (status = 'draft') => {
  saveMessage.value = '';
  const previousStatus = normalizePlanPublicationStatus(planPublicationStatus.value);
  const normalizedTargetStatus = normalizePlanPublicationStatus(status);

  if (!metadata.value.name.trim()) {
    saveMessage.value = 'Please enter a workout name.';
    return;
  }

  if (!userId.value) {
    saveMessage.value = 'Unable to resolve user session. Please login again.';
    return;
  }

  const selectedPlanType = String(metadata.value?.planType || '').trim().toLowerCase();
  const isNewUnsavedGlobal = selectedPlanType === 'global' && !hasPersistedCurrentPlan.value;

  if (!isNewUnsavedGlobal && showGlobalFeaturedToggle.value && isGlobalPlanFeatured.value && !canToggleGlobalFeatured.value) {
    saveMessage.value = 'Featured can only be enabled when publication status is Published.';
    return;
  }

  if (selectedPlanType === 'global' && !isAdminUser.value) {
    saveMessage.value = 'Only administrators can create Global workout plans.';
    return;
  }

  if (selectedPlanType === 'featured' && !isAdminUser.value) {
    saveMessage.value = 'Only administrators can create Featured workout plans.';
    return;
  }

  if (selectedPlanType === 'community_shared' && !isAdminUser.value) {
    saveMessage.value = 'Only administrators can create Community Shared workout plans.';
    return;
  }

  const isPublishing = normalizedTargetStatus === 'active';
  const activePlanType = ['global', 'featured', 'community_shared'].includes(selectedPlanType);

  if (isPublishing && activePlanType) {
    const missingRequirements = [];
    if (!String(metadata.value.name || '').trim()) missingRequirements.push('Plan Name');
    if (!String(metadata.value.type || '').trim()) missingRequirements.push('Workout Type');
    if (!String(metadata.value.category || '').trim()) missingRequirements.push('Category');
    if (!activeGroups.value.length) missingRequirements.push('at least one workout day');
    if (!workoutExercises.value.length) missingRequirements.push('at least one exercise');

    if (missingRequirements.length) {
      saveMessage.value = `Publish failed. Missing required: ${missingRequirements.join(', ')}.`;
      return;
    }
  }

  const spinnerState = isPublishing ? 'publishing' : 'saving';
  if (spinnerState === 'saving') {
    saving.value = true;
  } else {
    publishing.value = true;
  }

  try {
    if (activePlanType) {
      const payloadPlanType = selectedPlanType === 'community_shared'
        ? 'community_shared'
        : selectedPlanType === 'featured'
          ? 'featured'
          : 'global';
      const payloadFeatured = isNewUnsavedGlobal ? false : Boolean(isGlobalPlanFeatured.value);
      const targetGlobalStatus = isNewUnsavedGlobal ? 'draft' : normalizedTargetStatus;
      const displayPlanLabel = payloadPlanType === 'featured' ? 'Featured' : (payloadPlanType === 'community_shared' ? 'Community Shared' : 'Global');
      const globalDraftPayload = buildGlobalPlanDraftPayload({
        title: metadata.value.name,
        description: metadata.value.description,
        estimatedDurationMinutes: Number(metadata.value.estimatedDuration || 45),
        category: metadata.value.category == null ? null : String(metadata.value.category || '').trim() || null,
        planType: payloadPlanType,
        goalType: resolveSelectedGoalTypeForGlobalPlan(),
        goalTargetDate: metadata.value.goalTargetDate == null || metadata.value.goalTargetDate === undefined || metadata.value.goalTargetDate === ''
          ? null
          : String(metadata.value.goalTargetDate || '').trim(),
        planDurationWeeks: metadata.value.planDurationWeeks == null || metadata.value.planDurationWeeks === undefined || metadata.value.planDurationWeeks === ''
          ? null
          : Number(metadata.value.planDurationWeeks),
        accessLevel: 'public',
        isFeatured: payloadFeatured,
        featured: payloadFeatured,
      });

      const existingGlobalPlanId = String(currentPlanId.value || selectedWorkoutId.value || '').trim();
      let targetPlanId = existingGlobalPlanId;

      if (!targetPlanId) {
        const createResponse = await fetch(`${API_BASE}/api/admin/global-workout-plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(globalDraftPayload),
          credentials: 'include',
        });

        const createData = await createResponse.json().catch(() => ({}));
        if (!createResponse.ok) {
          throw new Error(createData?.error || `Failed to create ${displayPlanLabel.toLowerCase()} workout plan.`);
        }

        targetPlanId = String(createData?.planner?.planId || '').trim();
        if (!targetPlanId) {
          throw new Error(`${displayPlanLabel} workout plan was created but no plan ID was returned.`);
        }
      } else {
        const metadataResponse = await fetch(`${API_BASE}/api/admin/global-workout-plans/${encodeURIComponent(targetPlanId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(globalDraftPayload),
          credentials: 'include',
        });

        const metadataData = await metadataResponse.json().catch(() => ({}));
        if (!metadataResponse.ok) {
          throw new Error(metadataData?.error || `Failed to update ${displayPlanLabel.toLowerCase()} workout plan metadata.`);
        }
      }

      const scheduleResponse = await fetch(`${API_BASE}/api/admin/global-workout-plans/${encodeURIComponent(targetPlanId)}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planner: plannerPayload.value,
          status: targetGlobalStatus,
        }),
        credentials: 'include',
      });

      const scheduleData = await scheduleResponse.json().catch(() => ({}));
      if (!scheduleResponse.ok) {
        throw new Error(scheduleData?.error || `Failed to ${isPublishing ? 'publish' : 'save draft'} ${displayPlanLabel.toLowerCase()} workout plan.`);
      }

      currentPlanId.value = targetPlanId;
      selectedWorkoutId.value = targetPlanId;
      isCreatingWorkout.value = false;
      hasSavedWorkoutDetails.value = true;
      isSchedulePlannerOpen.value = true;
      isGlobalPlanFeatured.value = payloadFeatured;
      const persistedGlobalStatus = normalizePlanPublicationStatus(scheduleData?.planner?.status || targetGlobalStatus);
      planPublicationStatus.value = persistedGlobalStatus;
      selectedPublicationStatus.value = persistedGlobalStatus;
      if (persistedGlobalStatus !== targetGlobalStatus) {
        saveMessage.value = `${displayPlanLabel} workout plan saved, but status remains ${publicationStatusDisplayLabel(persistedGlobalStatus)}.`;
      } else if (persistedGlobalStatus === 'active' && previousStatus === 'active') {
        saveMessage.value = `${displayPlanLabel} workout plan changes saved successfully.`;
      } else if (persistedGlobalStatus === 'active') {
        saveMessage.value = `${displayPlanLabel} workout plan published successfully.`;
      } else if (persistedGlobalStatus === 'archived') {
        saveMessage.value = `${displayPlanLabel} workout plan archived successfully.`;
      } else {
        saveMessage.value = `${displayPlanLabel} workout plan draft saved successfully.`;
      }
      markPlannerStateCommitted();
      await syncEditorContextAfterSuccessfulSave();
      return;
    }

    const response = await fetch(`${API_BASE}/api/workout-planner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planner: {
          ...plannerPayload.value,
          metadata: {
            ...plannerPayload.value.metadata,
            status: normalizedTargetStatus,
          },
        },
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to save workout planner.');
    }

    const data = await response.json();
    syncWorkoutPlannerCapabilities(data);
    currentPlanId.value = String(data?.planner?.planId || currentPlanId.value || '').trim();
    selectedWorkoutId.value = currentPlanId.value;
    isCreatingWorkout.value = false;
    hasSavedWorkoutDetails.value = true;
    isSchedulePlannerOpen.value = true;
    const persistedStatus = normalizePlanPublicationStatus(data?.planner?.status || normalizedTargetStatus);
    planPublicationStatus.value = persistedStatus;
    selectedPublicationStatus.value = persistedStatus;
    syncWorkoutSchedules(data?.workoutLists);
    hasSavedWorkoutExerciseList.value = Boolean(data?.hasSavedWorkoutExerciseList);
    setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);
    await refreshWorkoutStatus();
    if (persistedStatus !== normalizedTargetStatus) {
      saveMessage.value = `Workout plan saved, but publication status remains ${publicationStatusDisplayLabel(persistedStatus)}.`;
    } else if (persistedStatus === 'active') {
      saveMessage.value = 'Workout plan published successfully.';
    } else if (persistedStatus === 'archived') {
      saveMessage.value = 'Workout plan archived successfully.';
    } else {
      saveMessage.value = 'Workout plan draft saved successfully.';
    }
    markPlannerStateCommitted();
    await syncEditorContextAfterSuccessfulSave();
  } catch (error) {
    saveMessage.value = error.message || 'Failed to save workout planner.';
  } finally {
    saving.value = false;
    publishing.value = false;
  }
};

const saveWorkout = async () => {
  const shouldPersistAsPublished = isPublishedGlobalPlan.value;
  await persistWorkout(shouldPersistAsPublished ? 'active' : 'draft');
};

const saveGlobalWorkoutWithSelectedStatus = async () => {
  const selectedStatus = normalizePlanPublicationStatus(selectedPublicationStatus.value);

  if (!hasPersistedCurrentPlan.value) {
    await persistWorkout(selectedStatus);
    return;
  }

  const currentStatus = normalizePlanPublicationStatus(planPublicationStatus.value);
  const supportedTargets = backendSupportedPublicationTransitions[currentStatus] || [];

  if (!supportedTargets.includes(selectedStatus)) {
    const selectedOption = publicationStatusOptions.value.find((option) => option.value === selectedStatus);
    saveMessage.value = selectedOption?.reason || 'Selected publication status transition is not supported.';
    return;
  }

  if (currentStatus === selectedStatus) {
    await persistWorkout(currentStatus);
    return;
  }

  if (currentStatus === 'draft' && selectedStatus === 'active') {
    openPublishPlanConfirmation();
    return;
  }

  if (currentStatus === 'active' && selectedStatus === 'draft') {
    const confirmed = await showConfirmDialog('This plan will no longer be publicly discoverable. Continue unpublishing it?', {
      title: 'Unpublish Plan?',
      confirmButtonText: 'Unpublish',
      cancelButtonText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }
    await persistWorkout('draft');
    return;
  }

  if (currentStatus === 'active' && selectedStatus === 'archived') {
    const confirmed = await showConfirmDialog('Archive this published plan? It will no longer be publicly available until restored to draft.', {
      title: 'Archive Plan?',
      confirmButtonText: 'Archive',
      cancelButtonText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }
    await persistWorkout('archived');
    return;
  }

  if (currentStatus === 'archived' && selectedStatus === 'draft') {
    const confirmed = await showConfirmDialog('Restore this archived plan back to draft status? It will remain in its current plan record and be available for editing.', {
      title: 'Restore Plan to Draft?',
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }
    await persistWorkout('draft');
    return;
  }

  saveMessage.value = 'Selected publication status transition is not supported.';
};

const publishPlanSummary = computed(() => {
  const planTypeValue = String(metadata.value?.planType || '').trim().toLowerCase();
  const planTypeLabel = planTypeValue === 'featured'
    ? 'Featured'
    : planTypeValue === 'community_shared'
      ? 'Community Shared'
      : planTypeValue === 'global'
        ? 'Global'
        : 'Global';

  return {
    planName: String(metadata.value?.name || '').trim() || 'Untitled Workout',
    planType: planTypeLabel,
    workoutType: String(metadata.value?.type || '').trim() || 'Strength',
    category: String(metadata.value?.category || '').trim() || 'General Fitness',
    planDurationWeeks: metadata.value?.planDurationWeeks === '' || metadata.value?.planDurationWeeks === null || metadata.value?.planDurationWeeks === undefined
      ? '—'
      : String(metadata.value?.planDurationWeeks || '0'),
    estimatedSessionTime: `${Number(metadata.value?.estimatedDuration || 45)} min`,
    workoutDays: String(activeGroups.value.length),
    exerciseCount: String(countUniqueWorkoutPlanExercises(workoutExercises.value)),
    visibility: 'Public',
  };
});

const openPublishPlanConfirmation = () => {
  if (!isAdminGlobalPlanDraftFlow.value || publishing.value || saving.value) {
    return;
  }
  showPublishPlanModal.value = true;
};

const openSaveWorkoutPlanModal = () => {
  if (saving.value || publishing.value) {
    return;
  }
  showSaveWorkoutPlanModal.value = true;
};

const closeSaveWorkoutPlanModal = () => {
  if (saving.value || publishing.value) {
    return;
  }
  showSaveWorkoutPlanModal.value = false;
};

const saveGlobalPlanAsDraftFromModal = async () => {
  if (saving.value || publishing.value) {
    return;
  }

  const currentStatus = normalizePlanPublicationStatus(planPublicationStatus.value);

  if (currentStatus === 'active') {
    const confirmed = await showConfirmDialog('This plan will no longer be publicly discoverable. Continue unpublishing it?', {
      title: 'Unpublish Plan?',
      confirmButtonText: 'Unpublish',
      cancelButtonText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }
  }

  if (currentStatus === 'archived') {
    const confirmed = await showConfirmDialog('Restore this archived plan back to draft status? It will remain in its current plan record and be available for editing.', {
      title: 'Restore Plan to Draft?',
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }
  }

  closeSaveWorkoutPlanModal();
  await persistWorkout('draft');
};

const publishGlobalPlanFromModal = async () => {
  if (saving.value || publishing.value) {
    return;
  }

  const currentStatus = normalizePlanPublicationStatus(planPublicationStatus.value);
  if (currentStatus === 'archived') {
    saveMessage.value = 'Archived plans must be restored to Draft before publishing.';
    return;
  }

  closeSaveWorkoutPlanModal();
  await persistWorkout('active');
};

const closePublishPlanConfirmation = () => {
  showPublishPlanModal.value = false;
};

const confirmPublishWorkoutPlan = async () => {
  if (publishing.value || saving.value) {
    return;
  }

  closePublishPlanConfirmation();
  await persistWorkout('active');
};

const publishWorkoutPlan = async () => {
  await persistWorkout('active');
};

const unpublishGlobalPlan = async () => {
  if (!currentPlanId.value || !isAdminGlobalPlanDraftFlow.value || !isPublishedGlobalPlan.value) {
    return;
  }

  const confirmed = await showConfirmDialog('This plan will no longer be publicly discoverable. Continue unpublishing it?', {
    title: 'Unpublish Plan?',
    confirmButtonText: 'Unpublish',
    cancelButtonText: 'Cancel',
  });
  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/admin/global-workout-plans/${encodeURIComponent(currentPlanId.value)}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planner: plannerPayload.value,
        status: 'draft',
      }),
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to unpublish this global workout plan.');
    }

    planPublicationStatus.value = normalizePlanPublicationStatus(data?.planner?.status || 'draft');
    saveMessage.value = 'Global workout plan unpublished successfully.';
    await loadWorkoutPlanner(currentPlanId.value);
    await router.replace({ query: { ...route.query, planId: currentPlanId.value } });
  } catch (error) {
    saveMessage.value = error.message || 'Failed to unpublish this global workout plan.';
  }
};

const restoreGlobalPlanToDraft = async () => {
  if (!currentPlanId.value || !isAdminGlobalPlanDraftFlow.value || !isArchivedGlobalPlan.value) {
    return;
  }

  const confirmed = await showConfirmDialog('Restore this archived plan back to draft status? It will remain in its current plan record and remain available for editing.', {
    title: 'Restore Plan to Draft?',
    confirmButtonText: 'Restore',
    cancelButtonText: 'Cancel',
  });
  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/admin/global-workout-plans/${encodeURIComponent(currentPlanId.value)}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planner: plannerPayload.value,
        status: 'draft',
      }),
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to restore this global workout plan to draft.');
    }

    planPublicationStatus.value = normalizePlanPublicationStatus(data?.planner?.status || 'draft');
    saveMessage.value = 'Global workout plan restored to draft.';
    await loadWorkoutPlanner(currentPlanId.value);
    await router.replace({ query: { ...route.query, planId: currentPlanId.value } });
  } catch (error) {
    saveMessage.value = error.message || 'Failed to restore this global workout plan to draft.';
  }
};

const handlePrimarySave = async () => {
  if (canManagePublicationStatus.value) {
    if (isAdminGlobalPlanDraftFlow.value) {
      const selectedStatus = normalizePlanPublicationStatus(selectedPublicationStatus.value);
      if (selectedStatus === 'archived') {
        await saveGlobalWorkoutWithSelectedStatus();
        return;
      }
      openSaveWorkoutPlanModal();
      return;
    }

    await saveGlobalWorkoutWithSelectedStatus();
    return;
  }

  await saveWorkout();
};

const quickSaveCurrentPlan = async (targetStatus) => {
  const normalizedStatus = normalizePlanPublicationStatus(targetStatus);

  if (!currentPlanId.value && !selectedWorkoutId.value && !isCreatingWorkout.value) {
    await createWorkoutPlan();
  }

  if (!currentPlanId.value && !selectedWorkoutId.value) {
    saveMessage.value = 'Create a workout plan before saving changes.';
    return;
  }

  await persistWorkout(normalizedStatus);
};

const saveCurrentPlanAsDraft = async () => {
  await quickSaveCurrentPlan('draft');
};

const publishCurrentPlan = async () => {
  await quickSaveCurrentPlan('active');
};

const returnToPlansFromCreate = async () => {
  if (hasUnsavedPlannerChanges.value) {
    const confirmed = await showConfirmDialog('You have unsaved changes. Discard these changes and return to plans?', {
      title: 'Discard Unsaved Changes?',
      confirmButtonText: 'Discard',
      cancelButtonText: 'Keep Editing',
    });
    if (!confirmed) {
      return;
    }
  }

  await clearSelection({ nextTab: 'view', preserveSaveMessage: true });
};

const handleGlobalSaveModalEscape = (event) => {
  if (event.key !== 'Escape') {
    return;
  }

  if (showSaveWorkoutPlanModal.value) {
    closeSaveWorkoutPlanModal();
  }

  if (showPlanTypeConversionModal.value) {
    closePlanTypeConversionModal();
  }
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
    const response = await fetch(`${API_BASE}/api/session`, {
      credentials: 'include',
    });
    const data = await response.json();
    userId.value = data?.user?.id || null;
    const normalizedRole = String(data?.user?.role || data?.user?.roleSlug || '').trim().toLowerCase();
    currentRoleSlug.value = normalizedRole === 'administrator' ? 'admin' : normalizedRole;
    isAdminUser.value = ['administrator', 'admin'].includes(normalizedRole);
    if (!isAdminUser.value && builderTab.value === 'global') {
      builderTab.value = 'create';
    }
    canCreateFeaturedPlans.value = isAdminUser.value || Boolean(data?.canCreateFeaturedPlans || data?.user?.canCreateFeaturedPlans);
    ensureDraftPlanTypeDefault();
  } catch {
    userId.value = null;
    currentRoleSlug.value = '';
    isAdminUser.value = false;
    if (builderTab.value === 'global') {
      builderTab.value = 'create';
    }
    canCreateFeaturedPlans.value = false;
    ensureDraftPlanTypeDefault();
  }
};

const loadFeaturedWorkoutPlans = async () => {
  loadingFeaturedPlans.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/global-workout-plans`, {
      credentials: 'include',
    });

    if (!response.ok) {
      featuredWorkoutPlans.value = [];
      return;
    }

    const data = await response.json();
    featuredWorkoutPlans.value = Array.isArray(data?.workoutLists)
      ? data.workoutLists
          .map((plan) => ({
            planId: String(plan?.planId || '').trim(),
            name: String(plan?.name || '').trim(),
            description: String(plan?.description || '').trim(),
            type: String(plan?.type || plan?.category || '').trim(),
            category: String(plan?.category || plan?.type || '').trim(),
            workoutType: String(plan?.workoutType || '').trim(),
            source: String(plan?.source || plan?.planSource || '').trim(),
            pricing: String(plan?.pricing || '').trim(),
            isPaid: typeof plan?.isPaid === 'boolean' ? plan.isPaid : null,
            difficulty: String(plan?.difficulty || plan?.level || plan?.experienceLevel || '').trim(),
            planDurationWeeks: plan?.planDurationWeeks ?? plan?.durationWeeks ?? plan?.weeks ?? null,
            planType: String(plan?.planType || '').trim(),
            publicationStatusRaw: String(plan?.status ?? plan?.publicationStatus ?? plan?.planStatus ?? '').trim().toLowerCase(),
            status: String(plan?.status ?? plan?.publicationStatus ?? plan?.planStatus ?? '').trim().toLowerCase(),
            isFeatured: typeof plan?.isFeatured === 'boolean'
              ? plan.isFeatured
              : (typeof plan?.featured === 'boolean' ? plan.featured : String(plan?.planType || '').trim().toLowerCase() === 'featured'),
            estimatedDuration: Number(plan?.estimatedDuration || 0),
            exerciseCount: Number(plan?.exerciseCount || 0),
            coverImageUrl: buildPlanCoverImageUrl(plan?.planId),
          }))
      : [];
  } catch {
    featuredWorkoutPlans.value = [];
  } finally {
    loadingFeaturedPlans.value = false;
  }
};

const loadWorkoutPlanner = async (requestedPlanId = '', { targetTab = builderTab.value, enableViewEditMode = false } = {}) => {
  const requestId = ++plannerLoadRequestId.value;
  loadingPlanner.value = true;
  const normalizedRequestedPlanId = String(requestedPlanId || '').trim();

  if (normalizedRequestedPlanId) {
    currentPlanId.value = normalizedRequestedPlanId;
    selectedWorkoutId.value = normalizedRequestedPlanId;
  }

  try {
    if (normalizedRequestedPlanId && isAdminUser.value) {
      const adminGlobalResponse = await fetch(`${API_BASE}/api/admin/global-workout-plans/${encodeURIComponent(normalizedRequestedPlanId)}`, {
        credentials: 'include',
      });

      if (adminGlobalResponse.ok) {
        const adminGlobalData = await adminGlobalResponse.json().catch(() => ({}));
        if (requestId !== plannerLoadRequestId.value) {
          return;
        }
        const adminPlanner = adminGlobalData?.planner || {};
        const adminPlanType = String(adminPlanner?.metadata?.planType || '').trim().toLowerCase();

        if (['global', 'featured', 'community_shared'].includes(adminPlanType)) {
          syncWorkoutPlannerCapabilities(adminGlobalData);
          currentPlanId.value = String(adminPlanner?.planId || normalizedRequestedPlanId).trim();
          selectedWorkoutId.value = currentPlanId.value;
          isCreatingWorkout.value = false;
          hasSavedWorkoutExerciseList.value = Array.isArray(adminPlanner?.exercises) ? adminPlanner.exercises.length > 0 : false;
          setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);
          hydratePlanner(adminPlanner, {
            markSaved: true,
            targetTab,
            enableViewEditMode,
          });
          plannerMessage.value = '';
          return;
        }
      } else if (adminGlobalResponse.status === 401 || adminGlobalResponse.status === 403) {
        plannerMessage.value = 'Admin access is required to load this Global workout plan.';
      }
    }

    const query = normalizedRequestedPlanId
      ? `?planId=${encodeURIComponent(normalizedRequestedPlanId)}`
      : '';

    const response = await fetch(`${API_BASE}/api/workout-planner${query}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    if (requestId !== plannerLoadRequestId.value) {
      return;
    }
    syncWorkoutPlannerCapabilities(data);
    syncWorkoutSchedules(data?.workoutLists);

    hasSavedWorkoutExerciseList.value = Boolean(data?.hasSavedWorkoutExerciseList);
    setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);

    if (normalizedRequestedPlanId) {
      const planner = data?.planner || {};
      selectedWorkoutId.value = String(planner?.planId || normalizedRequestedPlanId).trim();
      currentPlanId.value = String(planner?.planId || normalizedRequestedPlanId).trim();
      isCreatingWorkout.value = false;
      const isPlannerReady = String(planner?.status || '').toLowerCase() !== 'draft';
      hydratePlanner(planner, {
        markSaved: isPlannerReady,
        targetTab,
        enableViewEditMode,
      });
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

const selectWorkoutSchedule = async (schedule, { targetTab = 'view', enableViewEditMode = false } = {}) => {
  const planId = String(schedule?.planId || '').trim();
  if (!planId) {
    return;
  }

  builderTab.value = targetTab;
  viewEditMode.value = targetTab === 'view' && enableViewEditMode;
  await router.replace({ query: { ...route.query, planId } });
  await loadWorkoutPlanner(planId, { targetTab, enableViewEditMode });
};

const editWorkoutSchedule = async (schedule) => {
  planSourceTab.value = 'my';
  await selectWorkoutSchedule(schedule, { targetTab: 'view', enableViewEditMode: true });
  isWorkoutDetailsOpen.value = true;
  isSchedulePlannerOpen.value = true;
};

const deleteWorkoutSchedule = async (schedule) => {
  const planId = String(schedule?.planId || '').trim();
  if (!planId) {
    return;
  }

  const planName = String(schedule?.name || 'this workout').trim();
  const confirmed = await showConfirmDialog(`Delete ${planName}? This will remove the saved workout schedule.`, {
    title: 'Delete Workout Schedule?',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
  });
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
      await clearSelection({ nextTab: 'view', preserveSaveMessage: true });
    }

    saveMessage.value = 'Workout schedule deleted.';
  } catch (error) {
    saveMessage.value = error.message || 'Failed to delete workout schedule.';
  } finally {
    deletingWorkoutId.value = '';
  }
};

onMounted(async () => {
  const restoredDraft = restoreUnsavedBuilderDraft();
  const requestedPlanId = String(route.query?.planId || '').trim();
  if (requestedPlanId) {
    builderTab.value = 'view';
    viewEditMode.value = false;
  }
  await Promise.all([loadExercises(), loadFeaturedWorkoutPlans(), loadActiveGoals()]);
  await loadUserId();
  if (!restoredDraft || requestedPlanId) {
    await loadWorkoutPlanner(requestedPlanId);
  }
  if (canAccessGlobalManagement.value) {
    await loadGlobalPlans();
  }
  document.addEventListener('click', closeDayMenu);
  document.addEventListener('keydown', handleGlobalSaveModalEscape);
});

onUnmounted(() => {
  document.removeEventListener('click', closeDayMenu);
  document.removeEventListener('keydown', handleGlobalSaveModalEscape);
  clearPendingCoverSelection();
});

watch(
  () => route.query?.planId,
  async (nextPlanId, prevPlanId) => {
    if (String(nextPlanId || '').trim() === String(prevPlanId || '').trim()) {
      return;
    }
    const normalizedNextPlanId = String(nextPlanId || '').trim();
    resetPlanTypeConversionState();
    showPlanTypeConversionModal.value = false;

    if (skipNextRoutePlannerLoad.value && normalizedNextPlanId === String(currentPlanId.value || '').trim()) {
      skipNextRoutePlannerLoad.value = false;
      return;
    }

    if (!normalizedNextPlanId) {
      if (!isCreatingWorkout.value) {
        viewEditMode.value = false;
        selectedWorkoutId.value = '';
        hasSavedWorkoutDetails.value = false;
        resetPlannerDraft();
        await loadWorkoutPlanner('', { targetTab: builderTab.value });
      }
      return;
    }

    if (builderTab.value === 'create' && !viewEditMode.value) {
      return;
    }

    await loadWorkoutPlanner(normalizedNextPlanId, {
      targetTab: builderTab.value,
      enableViewEditMode: isViewEditMode.value,
    });
  }
);

watch(
  () => activePlanId.value,
  () => {
    refreshCoverImages();
    coverUploadProgress.value = 0;
    updateCoverUiMessage('', 'info');
  }
);

watch(
  () => featuredWorkoutPlanSlides.value.length,
  (slideCount) => {
    if (!slideCount) {
      currentWorkoutPlanSlide.value = 0;
      selectedTemplatePlanId.value = '';
      selectedTemplatePlanName.value = '';
      return;
    }

    if (currentWorkoutPlanSlide.value > slideCount - 1) {
      currentWorkoutPlanSlide.value = 0;
    }
  }
);

watch(
  () => [builderTab.value, globalPlansSubTab.value, canAccessGlobalManagement.value, canViewAdminUserPlans.value],
  async ([tab, subTab, canAccessGlobal, canViewUserPlans]) => {
    if (!canAccessGlobal || tab !== 'global') {
      return;
    }
    if (subTab === 'global' && !globalPlans.value.length && !globalPlansLoading.value) {
      await loadGlobalPlans();
    }
    if (canViewUserPlans && subTab === 'user' && !adminUserPlans.value.length && !adminUserPlansLoading.value) {
      await loadAdminUserPlans();
    }
  }
);

watch(
  () => String(metadata.value?.planType || '').trim().toLowerCase(),
  (nextPlanType) => {
    if (nextPlanType !== 'global') {
      isGlobalPlanFeatured.value = false;
    }
  }
);

watch(
  () => canAccessGlobalManagement.value,
  (allowed) => {
    if (!allowed) {
      showManagedMarketplacePlans.value = false;
    }
  }
);

watch(
  () => showManagedMarketplacePlans.value,
  async (enabled) => {
    if (!enabled || !canAccessGlobalManagement.value) {
      return;
    }
    if (!globalPlans.value.length && !globalPlansLoading.value) {
      await loadGlobalPlans();
    }
  }
);
</script>

<template>
  <div :class="['app-page-shell', 'workout-builder-page', { 'workout-builder-page--create': builderTab === 'create' }]">
    <div class="app-page-canvas app-inner-shell workout-builder-canvas">
      <section class="builder-hero ff-page-header app-header-gradient">
        <div>
          <h2>Workout Planner</h2>
          <p>Build sessions quickly with an athlete-first workflow.</p>
        </div>

      </section>

      <section class="main-builder-accordion" aria-label="Workout Planner main sections">
        <section class="main-builder-accordion__item" :class="{ open: mainAccordion.build }">
          <button
            type="button"
            class="main-builder-accordion__header"
            :aria-expanded="mainAccordion.build"
            @click="openMainAccordion('build')"
          >
            <span class="main-builder-accordion__title">Workout Plan Workspace</span>
            <span class="main-builder-accordion__icon" aria-hidden="true">
              <i class="fa-solid" :class="mainAccordion.build ? 'fa-minus' : 'fa-plus'"></i>
            </span>
          </button>
          <div v-show="mainAccordion.build" class="main-builder-accordion__body">

      <!-- ── Tab Bar ──────────────────────────────────────────── -->
      <nav class="builder-tabs wa-h-tabs wa-h-tabs--tricolor" role="tablist" aria-label="Workout Planner sections">
        <button
          type="button"
          role="tab"
          :aria-selected="builderTab === 'view'"
          :class="['builder-tab', 'wa-h-tab', 'builder-tab--view-tone', { 'builder-tab--active': builderTab === 'view', 'wa-h-tab--active': builderTab === 'view' }]"
          @click="openViewPlansTab"
        >
          <i class="fa-solid fa-folder-open"></i>
          <span class="tab-label-full">View/Edit Plans</span>
          <span class="tab-label-short">View/Edit</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="builderTab === 'create'"
          :class="['builder-tab', 'wa-h-tab', 'builder-tab--create-tone', { 'builder-tab--active': builderTab === 'create', 'wa-h-tab--active': builderTab === 'create' }]"
          @click="handleCreatePlanTabClick"
        >
          <i class="fa-solid fa-dumbbell"></i>
          <span class="tab-label-full">Create Plan</span>
          <span class="tab-label-short">Create Plan</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="builderTab === 'ai'"
          :class="['builder-tab', 'wa-h-tab', 'builder-tab--ai-tone', { 'builder-tab--active': builderTab === 'ai', 'wa-h-tab--active': builderTab === 'ai' }]"
          @click="builderTab = 'ai'"
        >
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span class="tab-label-full">Create with AI</span>
          <span class="tab-label-short">Create with AI</span>
        </button>
      </nav>

      <!-- ── PLAN EDITOR: Create or View/Edit-hosted editing ───────────────────────── -->
      <section v-show="builderTab === 'create' || isViewEditMode" class="builder-section collapsible-panel">
        <div v-if="!canShowWorkoutDetails" class="builder-empty planner-empty" aria-live="polite">
          <div class="planner-empty__icon">📝</div>
          <h4>No plan selected</h4>
          <p>Start a new plan or select an existing one from the Select tab.</p>
          <label v-if="workoutPlanTypeOptions.length" class="builder-field builder-field--row" style="max-width: 340px; margin: 8px auto 0; text-align: left;">
            <span>Workout Plan Type</span>
            <select
              v-model="metadata.planType"
              :disabled="loadingPlanner"
            >
              <option
                v-for="option in workoutPlanTypeOptions"
                :key="`start-plan-type-${option.value}`"
                :value="option.value"
                :disabled="option.disabled"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <button type="button" class="btn-create-plan wa-blue-action-btn" style="margin-top:8px" @click="createWorkoutPlan" :disabled="loadingPlanner">
            {{ loadingPlanner ? 'Creating...' : 'Start New Workout Plan' }}
          </button>
        </div>
        <div v-else>
          <div class="collapsible-header" style="cursor:default; margin-bottom:0;">
            <span class="collapsible-header__text">
              <strong>{{ planDetailsHeaderText }}</strong>
              <small>{{ planDetailsSubtitleText }}</small>
            </span>
          </div>

          <div v-if="builderTab === 'create' && !isViewEditMode" class="plan-info-action-row plan-info-action-row--create" role="group" aria-label="Create mode navigation">
            <button
              type="button"
              class="plan-info-action-row__back"
              @click="returnToPlansFromCreate"
            >
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              <span>Back to Plans</span>
            </button>
          </div>

          <div class="collapsible-panel__body">

            
            <div v-if="isViewEditMode" class="plan-info-action-row" role="group" aria-label="Edit mode navigation and save actions">
              <button
                type="button"
                class="plan-info-action-row__back"
                @click="exitViewEditMode({ confirmUnsaved: true })"
              >
                <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
                <span>Back to Plans</span>
              </button>
              <button
                type="button"
                class="btn-save plan-info-action-row__save"
                :disabled="saving || publishing"
                @click="handlePrimarySave"
              >
                Save Changes
              </button>
            </div>

            <WorkoutMetadataForm
              :metadata="metadata"
              :plan-type-options="workoutPlanTypeOptions"
              :category-options="workoutPlanCategoryOptions"
              :can-edit-plan-type="canEditSelectedPlanType"
              :plan-type-display-label="selectedPlanTypeDisplayLabel"
              :show-convert-plan-type-button="!canEditSelectedPlanType"
              :convert-plan-type-disabled="conversionPreviewLoading || conversionCreateLoading || !canConvertExistingPlanType || !conversionTargetOptions.length"
              :convert-plan-type-disabled-reason="conversionUnavailableReason"
              :convert-plan-type-loading="conversionPreviewLoading || conversionCreateLoading"
              :goal-options="goalOptionsForSelect"
              :loading-goals="loadingGoals"
              @update:metadata="metadata = $event"
              @create-goal="openExistingGoalCreationFlow"
              @convert-plan-type="openPlanTypeConversionModal"
            >
              <template #plan-cover>
                <section class="plan-cover-panel" aria-label="Workout plan cover image">
                  <div class="plan-cover-panel__header">
                    <h4>Cover Image</h4>
                    <small>Shown in workout plan cards and detail views.</small>
                  </div>

                  <div class="plan-cover-panel__content">
                    <div class="plan-cover-main-row">
                      <div class="plan-cover-preview-wrap">
                        <img
                          :src="currentPlanCoverImageUrl"
                          class="plan-cover-preview"
                          alt="Workout plan cover preview"
                          loading="lazy"
                          decoding="async"
                          @error="onPlanCoverImageError"
                        />
                      </div>

                      <div class="plan-cover-actions">
                        <input
                          ref="coverUploadInputRef"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          class="plan-cover-upload-input"
                          @change="onCoverFileSelected"
                        />

                        <div class="plan-cover-actions-desktop" role="group" aria-label="Cover image actions">
                          <button
                            v-if="!hasPersistedCustomCover"
                            type="button"
                            class="wa-blue-action-btn plan-cover-action"
                            :disabled="!canEditCurrentPlanCover || isCoverActionBusy"
                            title="Upload Image"
                            aria-label="Upload Image"
                            @click="openCoverUploadPicker"
                          >
                            <i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>
                            <span class="plan-cover-action__text">{{ coverUploadInFlight ? 'Uploading...' : 'Upload Image' }}</span>
                          </button>

                          <div v-else class="plan-cover-action-row">
                            <button
                              type="button"
                              class="plan-cover-replace-btn"
                              :disabled="!canEditCurrentPlanCover || isCoverActionBusy"
                              title="Replace Image"
                              aria-label="Replace Image"
                              @click="openCoverUploadPicker"
                            >
                              <i class="fa-solid fa-pen" aria-hidden="true"></i>
                              <span class="plan-cover-action__text">Replace</span>
                            </button>

                            <button
                              type="button"
                              class="plan-cover-delete-btn"
                              :disabled="isCoverActionBusy || !showDeletePlanCoverButton"
                              title="Remove Image"
                              aria-label="Remove Image"
                              @click="deleteCoverImage"
                            >
                              <i class="fa-solid fa-trash" aria-hidden="true"></i>
                              <span class="plan-cover-action__text">{{ coverDeleteInFlight ? 'Removing...' : 'Remove' }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p v-if="coverUploadInFlight && coverUploadProgress > 0" class="plan-cover-progress" aria-live="polite">
                      Uploading: {{ coverUploadProgress }}%
                    </p>

                    <p
                      v-if="coverUiMessage"
                      :class="[
                        'plan-cover-feedback',
                        coverUiMessageType === 'error' ? 'plan-cover-feedback--error' :
                        coverUiMessageType === 'success' ? 'plan-cover-feedback--success' :
                        coverUiMessageType === 'warn' ? 'plan-cover-feedback--warn' :
                        'plan-cover-feedback--info',
                      ]"
                      aria-live="polite"
                    >
                      {{ coverUiMessage }}
                    </p>
                  </div>
                </section>
              </template>
            </WorkoutMetadataForm>
          </div>

          <section class="planner-shell">
          <div class="planner-header-row">
            <div class="planner-heading-group planner-heading-group--combined">
              <h3>Schedule Planner</h3>
              <p>Plan your training week, then add exercises to each day.</p>
            </div>
          </div>

          <div class="planner-tools">
            <div class="planner-header-actions planner-header-actions--schedule">
              <div class="planner-mode-pill-wrap" aria-label="Scheduling mode">
                <div class="planner-mode-toggle" role="tablist" aria-label="Schedule planner modes">
                  <button
                    type="button"
                    :class="['planner-mode-btn', { active: scheduleMode === 'day' }]"
                    :aria-pressed="scheduleMode === 'day'"
                    @click="changeScheduleMode('day')"
                  >
                    Day View
                  </button>
                  <button
                    type="button"
                    :class="['planner-mode-btn', { active: scheduleMode === 'week' }]"
                    :aria-pressed="scheduleMode === 'week'"
                    @click="changeScheduleMode('week')"
                  >
                    Week View
                  </button>
                </div>
              </div>

              <div class="planner-quick-save-actions" role="group" aria-label="Planner quick actions">
                <button
                  type="button"
                  class="planner-quick-save-btn planner-quick-save-btn--draft wa-blue-action-btn"
                  :disabled="saving || publishing || loadingPlanner"
                  @click="saveCurrentPlanAsDraft"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  class="planner-quick-save-btn planner-quick-save-btn--publish wa-green-action-btn"
                  :disabled="saving || publishing || loadingPlanner"
                  @click="publishCurrentPlan"
                >
                  Publish
                </button>
              </div>
            </div>

              <div class="planner-group-editor">
                <label class="planner-group-editor__label" for="planner-add-day-input">{{ scheduleGroupEditorLabel }}</label>
                <input
                  id="planner-add-day-input"
                  v-model="newScheduleGroupName"
                  type="text"
                  :maxlength="WORKOUT_DAY_NAME_MAX_LENGTH"
                  :placeholder="scheduleGroupInputPlaceholder"
                  @input="clearScheduleGroupEditorError('top')"
                />
                <button
                  type="button"
                  class="planner-group-add wa-blue-action-btn"
                  @click="addScheduleGroup"
                >
                  {{ scheduleGroupAddButtonLabel }}
                </button>
                <p v-if="scheduleGroupEditorError" class="planner-group-editor__error">
                  {{ scheduleGroupEditorError }}
                </p>
              </div>

              <div
                :class="[
                  'workout-day-accordion',
                  scheduleMode === 'week' ? 'workout-day-accordion--week' : 'workout-day-accordion--day',
                ]"
                role="list"
                aria-label="Workout days"
              >
                <transition-group name="day-order" tag="div" class="workout-day-accordion__list">
                  <div
                    v-for="day in accordionGroupsWithExercises"
                    :key="day.stableId"
                    :class="['workout-day-card', { active: day.isExpanded, 'is-menu-open': openMenuDay === day.name }]"
                    role="listitem"
                  >
                    <div
                      class="workout-day-header"
                      role="button"
                      :aria-expanded="day.isExpanded"
                      tabindex="0"
                      @click="toggleScheduleGroupAccordion(day.name)"
                      @keydown.enter.prevent="toggleScheduleGroupAccordion(day.name)"
                      @keydown.space.prevent="toggleScheduleGroupAccordion(day.name)"
                    >
                      <div class="day-title-group day-title-edit-wrap">
                        <input
                          v-if="inlineEditingDayName === day.name"
                          v-model="inlineDayNameDraft"
                          class="day-title-inline-input"
                          type="text"
                          :maxlength="WORKOUT_DAY_NAME_MAX_LENGTH"
                          @click.stop
                          @input="handleInlineDayNameInput"
                          @keydown.stop
                          @keydown.esc.prevent.stop="cancelInlineDayNameEdit"
                          @keydown.enter.prevent="saveInlineDayNameEdit"
                        />
                        <p
                          v-if="inlineEditingDayName === day.name && inlineDayNameError"
                          class="day-title-inline-error"
                        >
                          {{ inlineDayNameError }}
                        </p>
                        <strong
                          v-else
                          class="day-title-editable"
                          :title="day.name"
                          @click.stop="startInlineDayNameEdit(day.name)"
                        >
                          {{ formatPlannerDayNameForDisplay(day.name) }}
                        </strong>
                        <div v-if="inlineEditingDayName === day.name" class="day-title-inline-actions">
                          <button
                            type="button"
                            class="day-title-inline-btn day-title-inline-btn--save"
                            @mousedown.prevent
                            @click.stop="saveInlineDayNameEdit"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            class="day-title-inline-btn day-title-inline-btn--cancel"
                            @mousedown.prevent
                            @click.stop="cancelInlineDayNameEdit"
                          >
                            Cancel
                          </button>
                        </div>
                        <span v-if="day.exerciseCount > 0" class="exercise-count">{{ day.exerciseCount }} exercise{{ day.exerciseCount === 1 ? '' : 's' }}</span>
                      </div>

                      <div class="day-header-controls" @click.stop>
                        <div class="day-header-actions">
                          <button
                            type="button"
                            class="chevron-btn"
                            :aria-label="day.isExpanded ? 'Collapse section' : 'Expand section'"
                            :aria-expanded="day.isExpanded"
                            @click.stop="toggleScheduleGroupAccordion(day.name)"
                          >
                            <i :class="['fa-solid', 'fa-chevron-down', 'accordion-chevron', { 'accordion-chevron--expanded': day.isExpanded }]" aria-hidden="true"></i>
                          </button>
                          <button
                            v-if="canModifyScheduleDayActions"
                            type="button"
                            class="btn-add-exercise-day wa-blue-action-btn"
                            @click="setActiveDay(day.name); openPicker({ insertPosition: 'top' })"
                          >
                            <span class="btn-add-exercise__icon">＋</span>
                            <span>Add Exercise</span>
                          </button>
                        </div>

                        <div v-if="canModifyScheduleDayActions" class="day-kebab-wrap" @click.stop>
                          <button
                            type="button"
                            class="day-kebab-btn"
                            :aria-expanded="openMenuDay === day.name && openMenuAnchor === 'top'"
                            @click.stop="toggleDayMenu(day.name, $event, 'top')"
                          >
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                          </button>
                          <div
                            v-if="openMenuDay === day.name && openMenuAnchor === 'top'"
                            :class="['day-kebab-menu', `day-kebab-menu--${openMenuPlacement}`]"
                          >
                            <button
                              type="button"
                              class="day-kebab-item"
                              @click="startInlineDayNameEdit(day.name); openMenuDay = null"
                            >
                              <i class="fa-regular fa-pen-to-square"></i>
                              ✏️ Rename Day
                            </button>
                            <button
                              type="button"
                              class="day-kebab-item"
                              @click="duplicateScheduleGroup(day.name); openMenuDay = null"
                            >
                              <i class="fa-solid fa-copy"></i>
                              Duplicate Day
                            </button>
                            <button
                              v-if="hasMultipleScheduleGroups && !isFirstScheduleGroup(day.name)"
                              type="button"
                              class="day-kebab-item"
                              @click="moveScheduleGroupUp(day.name); openMenuDay = null"
                            >
                              <i class="fa-solid fa-arrow-up"></i>
                              Move Up
                            </button>
                            <button
                              v-if="hasMultipleScheduleGroups && !isLastScheduleGroup(day.name)"
                              type="button"
                              class="day-kebab-item"
                              @click="moveScheduleGroupDown(day.name); openMenuDay = null"
                            >
                              <i class="fa-solid fa-arrow-down"></i>
                              Move Down
                            </button>
                            <button
                              v-if="canRemoveScheduleGroup(day.name)"
                              type="button"
                              class="day-kebab-item day-kebab-item--delete"
                              @click="requestDeleteDay(day.name); openMenuDay = null"
                            >
                              <i class="fa-solid fa-trash"></i>
                              Delete Day
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <transition name="accordion-slide">
                      <div v-if="day.isExpanded" class="workout-day-panel">
                        <div v-if="day.exercises.length > 0" class="day-exercises-list">
                          <WorkoutExerciseBlock
                            v-for="(exercise, idx) in day.exercises"
                            :key="exercise.id"
                            :exercise="exercise"
                            :index="idx"
                            :total="day.exercises.length"
                            :schedule-groups="activeGroups"
                            :schedule-mode="scheduleMode"
                            @update-field="updateExerciseField"
                            @remove="removeExercise"
                            @move-up="moveExerciseUp"
                            @move-down="moveExerciseDown"
                          />
                        </div>

                        <div v-else class="empty-day-state">
                          <p>No exercises yet. Add an exercise to begin.</p>
                        </div>

                        <div class="day-panel-actions day-panel-actions--bottom">
                          <div class="day-footer-summary" @click.stop>
                            <span class="day-footer-summary__name" :title="day.name">{{ formatPlannerDayNameForDisplay(day.name) }}</span>
                            <span class="exercise-count">{{ day.exerciseCount }} exercise{{ day.exerciseCount === 1 ? '' : 's' }}</span>
                            <button
                              type="button"
                              class="chevron-btn"
                              :aria-label="day.isExpanded ? 'Collapse section' : 'Expand section'"
                              :aria-expanded="day.isExpanded"
                              @click.stop="toggleScheduleGroupAccordion(day.name)"
                            >
                              <i :class="['fa-solid', 'fa-chevron-down', 'accordion-chevron', { 'accordion-chevron--expanded': day.isExpanded }]" aria-hidden="true"></i>
                            </button>
                          </div>

                          <div v-if="canModifyScheduleDayActions" class="day-footer-actions" @click.stop>
                            <button
                              type="button"
                              class="btn-add-exercise-day btn-add-exercise-day--bottom wa-blue-action-btn"
                              @click="setActiveDay(day.name); openPicker({ insertPosition: 'bottom' })"
                            >
                              <span class="btn-add-exercise__icon">＋</span>
                              <span>Add Exercise</span>
                            </button>

                            <div class="day-kebab-wrap" @click.stop>
                              <button
                                type="button"
                                class="day-kebab-btn"
                                :aria-expanded="openMenuDay === day.name && openMenuAnchor === 'bottom'"
                                @click.stop="toggleDayMenu(day.name, $event, 'bottom')"
                              >
                                <i class="fa-solid fa-ellipsis-vertical"></i>
                              </button>
                              <div
                                v-if="openMenuDay === day.name && openMenuAnchor === 'bottom'"
                                :class="['day-kebab-menu', `day-kebab-menu--${openMenuPlacement}`]"
                              >
                                <button
                                  type="button"
                                  class="day-kebab-item"
                                  @click="startInlineDayNameEdit(day.name); openMenuDay = null"
                                >
                                  <i class="fa-regular fa-pen-to-square"></i>
                                  ✏️ Rename Day
                                </button>
                                <button
                                  type="button"
                                  class="day-kebab-item"
                                  @click="duplicateScheduleGroup(day.name); openMenuDay = null"
                                >
                                  <i class="fa-solid fa-copy"></i>
                                  Duplicate Day
                                </button>
                                <button
                                  v-if="hasMultipleScheduleGroups && !isFirstScheduleGroup(day.name)"
                                  type="button"
                                  class="day-kebab-item"
                                  @click="moveScheduleGroupUp(day.name); openMenuDay = null"
                                >
                                  <i class="fa-solid fa-arrow-up"></i>
                                  Move Up
                                </button>
                                <button
                                  v-if="hasMultipleScheduleGroups && !isLastScheduleGroup(day.name)"
                                  type="button"
                                  class="day-kebab-item"
                                  @click="moveScheduleGroupDown(day.name); openMenuDay = null"
                                >
                                  <i class="fa-solid fa-arrow-down"></i>
                                  Move Down
                                </button>
                                <button
                                  v-if="canRemoveScheduleGroup(day.name)"
                                  type="button"
                                  class="day-kebab-item day-kebab-item--delete"
                                  @click="requestDeleteDay(day.name); openMenuDay = null"
                                >
                                  <i class="fa-solid fa-trash"></i>
                                  Delete Day
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div>
                </transition-group>

                <div class="planner-bottom-group-actions">
                  <div class="planner-bottom-group-actions__editor">
                    <label class="planner-group-editor__label" for="planner-add-day-input-bottom">{{ scheduleGroupEditorLabel }}</label>
                    <input
                      id="planner-add-day-input-bottom"
                      v-model="newScheduleGroupNameBottom"
                      type="text"
                      :maxlength="WORKOUT_DAY_NAME_MAX_LENGTH"
                      :placeholder="scheduleGroupInputPlaceholder"
                      @input="clearScheduleGroupEditorError('bottom')"
                    />
                    <button
                      type="button"
                      class="planner-group-add wa-blue-action-btn planner-group-add--bottom"
                      @click="addScheduleGroupBottom"
                    >
                      {{ scheduleGroupAddButtonLabel }}
                    </button>
                    <p v-if="scheduleGroupBottomEditorError" class="planner-group-editor__error">
                      {{ scheduleGroupBottomEditorError }}
                    </p>
                  </div>
                </div>
              </div>

              <p v-if="plannerMessage" class="planner-feedback planner-feedback--error">
                {{ plannerMessage }}
              </p>

              <div v-if="activeGroups.length === 0" class="planner-helper-text">
                {{ scheduleGroupEmptyStateText }}
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

          </section>

          <section v-if="showPublicationStatusControls || showGlobalFeaturedToggle" class="planner-shell planner-shell--publication">
            <div class="planner-heading-group planner-heading-group--combined">
              <h3>Publishing &amp; Administration</h3>
              <p>{{ publicationStatusSectionDescription }}</p>
            </div>

            <div v-if="showPublicationStatusControls" class="publication-status-actions">
              <div class="publication-status-wrap publication-status-wrap--create">
                <label class="publication-status-field">
                  <span class="publication-status-field__label">Publication Status</span>
                  <select v-model="selectedPublicationStatus" :disabled="saving || publishing">
                    <option
                      v-for="option in publicationStatusOptions"
                      :key="`publication-status-${option.value}`"
                      :value="option.value"
                      :disabled="option.disabled"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <p class="publication-status-field__current" aria-live="polite">
                  Current status: <strong>{{ publicationStatusLabel }}</strong>
                </p>
              </div>
            </div>

            <p v-if="showPublicationStatusControls && selectedPublicationStatusDisabledReason" class="publication-status-help publication-status-help--warn">
              {{ selectedPublicationStatusDisabledReason }}
            </p>

            <div v-if="showGlobalFeaturedToggle" class="global-featured-toggle" role="group" aria-label="Featured global plan setting">
              <label class="global-featured-toggle__label">
                <input
                  v-model="isGlobalPlanFeatured"
                  type="checkbox"
                  :disabled="!canToggleGlobalFeatured || saving || publishing"
                />
                <span>Featured</span>
              </label>
              <p class="global-featured-toggle__note">
                Featured plans can be displayed during user registration. Available only to administrators for published Global Workout Plans.
              </p>
              <p v-if="!canToggleGlobalFeatured" class="global-featured-toggle__hint">
                Set Publication Status to Published before enabling Featured.
              </p>
            </div>

          </section>

          <div v-if="showSaveFooter" class="planner-primary-actions" role="group" aria-label="Primary workout plan actions">
            <div class="planner-primary-actions__status" aria-live="polite">
              <p
                v-if="saveMessage"
                :class="[
                  'save-message',
                  /failed|please|unable|missing|publish failed/i.test(saveMessage) ? 'err' : 'ok',
                ]"
              >
                {{ saveMessage }}
              </p>
            </div>

            <div class="planner-primary-actions__controls" :class="{ 'planner-primary-actions__controls--create': !isViewEditMode }">
              <button
                v-if="isViewEditMode"
                type="button"
                class="planner-primary-actions__cancel"
                @click="exitViewEditMode({ confirmUnsaved: true })"
              >
                <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
                <span>Cancel Editing</span>
              </button>

              <button
                type="button"
                class="btn-save planner-primary-actions__save"
                :disabled="saving || publishing"
                @click="handlePrimarySave"
              >
                {{ primarySaveLabel }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ── TAB 3: View/Edit Plans ─────────────────────────────── -->
      <section v-show="builderTab === 'view' && !isViewEditMode" class="builder-section collapsible-panel">
        <div class="existing-plans-panel" aria-live="polite">
          <div class="existing-plans-panel__head">
            <p class="existing-plans-panel__source-line">
              <strong>Filter Plan Sources</strong>
              <span>— Choose a source to view available plans.</span>
            </p>
          </div>

          <nav class="wa-h-tabs select-source-tabs" role="tablist" aria-label="Show plans sources">
            <button
              type="button"
              role="tab"
              :aria-selected="planSourceTab === 'my'"
              :class="['builder-subtab', 'wa-h-tab', 'select-source-tab', 'select-source-tab--my', { 'wa-h-tab--active': planSourceTab === 'my' }]"
              @click="planSourceTab = 'my'"
            >
              <i class="fa-solid fa-clipboard-list"></i>
              <span>My Plans</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="planSourceTab === 'marketplace'"
              :class="['builder-subtab', 'wa-h-tab', 'select-source-tab', 'select-source-tab--marketplace', { 'wa-h-tab--active': planSourceTab === 'marketplace' }]"
              @click="planSourceTab = 'marketplace'"
            >
              <i class="fa-solid fa-share-nodes"></i>
              <span class="marketplace-tab-label-full">Find Plans</span>
              <span class="marketplace-tab-label-short">Find Plans</span>
            </button>
          </nav>

          <div v-show="planSourceTab === 'my'" class="plan-source-panel" aria-live="polite">
            <div v-if="loadingPlanner" class="builder-empty planner-empty planner-empty--loading">
              <div class="planner-empty__icon">📋</div>
              <h4>Loading existing plans</h4>
              <p>Fetching your saved workout plans from the current database.</p>
            </div>

            <div v-else-if="!hasWorkoutSchedules" class="builder-empty schedule-hub-empty">
              <div class="planner-empty__icon">🗂️</div>
              <h4>No saved plans yet</h4>
              <p>Create a new plan using Add New Plan, then save it to see it here.</p>
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
          </div>

          <div v-show="planSourceTab === 'marketplace'" class="plan-source-panel" aria-live="polite">
            <section v-if="showGlobalLibraryViewModal" class="global-library-inline-preview" aria-label="Workout plan preview" aria-live="polite">
              <div class="global-library-inline-preview__actions global-library-inline-preview__actions--top">
                <button
                  type="button"
                  class="btn btn-sm global-plans-table__btn global-plans-table__btn--open"
                  @click="closeGlobalLibraryInlinePreview"
                >
                  <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
                  <span>Back to Plans</span>
                </button>

                <button
                  v-if="canUsePlanFromPreview"
                  type="button"
                  class="btn btn-sm global-plans-table__btn global-plans-table__btn--edit"
                  :disabled="cloningFeaturedPlanId === globalLibraryViewPlan?.planId"
                  @click="triggerUsePlanFromPreview"
                >
                  <i v-if="cloningFeaturedPlanId === globalLibraryViewPlan?.planId" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                  <i v-else class="fa-solid fa-copy" aria-hidden="true"></i>
                  <span>{{ cloningFeaturedPlanId === globalLibraryViewPlan?.planId ? 'Using...' : 'Use Plan' }}</span>
                </button>
              </div>

              <h3 class="global-library-inline-preview__title">Workout Plan Preview (Read-Only)</h3>

              <div v-if="globalLibraryViewError" class="global-library-inline-preview__error-wrap">
                <p class="global-library-inline-preview__error">{{ globalLibraryViewError }}</p>
                <div v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.globalLibraryView" class="wb-error-diag">
                  <button type="button" class="wb-error-diag__toggle" @click="toggleErrorDiagnostics('globalLibraryView')">
                    {{ diagnosticsExpandedByArea.globalLibraryView ? 'Hide details' : 'Show details' }}
                  </button>
                  <p v-if="diagnosticsExpandedByArea.globalLibraryView" class="wb-error-diag__text">
                    Status {{ errorDiagnosticsByArea.globalLibraryView.status }} | Code {{ errorDiagnosticsByArea.globalLibraryView.code }} | Request {{ errorDiagnosticsByArea.globalLibraryView.requestId }}
                  </p>
                </div>
              </div>

              <div v-else-if="globalLibraryViewLoading" class="builder-empty planner-empty planner-empty--loading global-library-inline-preview__loading">
                <div class="planner-empty__icon">📋</div>
                <h4>Loading workout plan preview</h4>
                <p>Fetching full read-only plan details now.</p>
              </div>

              <div v-else class="global-library-inline-preview__body">
                <section class="global-library-inline-preview__overview">
                  <img
                    :src="globalLibraryViewPlan?.coverImageUrl || buildPlanCoverImageUrl(globalLibraryViewPlan?.planId)"
                    class="global-library-inline-preview__cover"
                    :alt="`${globalLibraryViewPlan?.name || 'Workout plan'} cover`"
                    loading="lazy"
                    decoding="async"
                    @error="onPlanCoverImageError"
                  />

                  <div class="global-library-inline-preview__summary">
                    <h4 class="global-library-inline-preview__name">{{ globalLibraryViewPlan?.name || 'Untitled Workout' }}</h4>
                    <p class="global-library-inline-preview__description">{{ formatPreviewText(globalLibraryViewPlan?.description, 'No description provided.') }}</p>

                    <div class="global-library-inline-preview__meta-grid">
                      <div>
                        <span>Category / Goal</span>
                        <strong>{{ formatPreviewText(globalLibraryViewPlan?.category || globalLibraryViewPlan?.type) }}</strong>
                      </div>
                      <div>
                        <span>Difficulty</span>
                        <strong>{{ formatPreviewText(globalLibraryViewPlan?.difficulty) }}</strong>
                      </div>
                      <div>
                        <span>Estimated Duration</span>
                        <strong>{{ formatPreviewStat(globalLibraryViewPlan?.estimatedDuration, 'min') }}</strong>
                      </div>
                      <div>
                        <span>Total Exercises</span>
                        <strong>{{ formatPreviewStat(globalLibraryViewPlan?.exerciseCount) }}</strong>
                      </div>
                      <div>
                        <span>Workout Days</span>
                        <strong>{{ formatPreviewStat(globalLibraryViewPlan?.dayCount) }}</strong>
                      </div>
                    </div>

                    <div class="global-library-inline-preview__focus-block">
                      <div class="global-library-inline-preview__focus-item">
                        <h5>Objective</h5>
                        <p>{{ formatPreviewText(globalLibraryViewPlan?.objective) }}</p>
                      </div>
                      <div class="global-library-inline-preview__focus-item">
                        <h5>Goal</h5>
                        <p>{{ formatPreviewText(globalLibraryViewPlan?.goal) }}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="global-library-inline-preview__schedule">
                  <h4 class="global-library-inline-preview__schedule-title">Workout Schedule</h4>

                  <article
                    v-for="day in globalLibraryViewDaySchedules"
                    :key="`preview-day-${day.name}`"
                    class="global-library-inline-preview__day"
                  >
                    <header class="global-library-inline-preview__day-head">
                      <h5>{{ day.name || 'Unscheduled' }}</h5>
                      <span>{{ day.exercises.length }} exercise{{ day.exercises.length === 1 ? '' : 's' }}</span>
                    </header>

                    <div v-if="day.exercises.length" class="global-library-inline-preview__day-table-wrap">
                      <table class="table align-middle mb-0 global-library-inline-preview__day-table">
                        <thead>
                          <tr>
                            <th class="global-library-inline-preview__image-col">Image</th>
                            <th>Exercise</th>
                            <th v-if="previewDayHasStrengthFields(day.exercises)">Sets</th>
                            <th v-if="previewDayHasStrengthFields(day.exercises)">Reps</th>
                            <th v-if="previewDayHasStrengthFields(day.exercises)">Weight</th>
                            <th v-if="previewDayHasStrengthFields(day.exercises)">Rest</th>
                            <th v-if="previewDayHasCardioFields(day.exercises)">Duration</th>
                            <th v-if="previewDayHasCardioFields(day.exercises)">Distance</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(exercise, index) in day.exercises" :key="`preview-exercise-${day.name}-${exercise.id || exercise.exerciseId || index}`">
                            <td class="global-library-inline-preview__image-cell">
                              <img
                                :src="resolveExerciseImage(exercise)"
                                class="global-library-inline-preview__exercise-thumb"
                                :alt="`${exercise.name || exercise.ExerciseTitle || 'Exercise'} image`"
                                loading="lazy"
                                decoding="async"
                                @error="onPreviewExerciseImageError"
                              />
                            </td>
                            <td class="global-library-inline-preview__exercise-cell">
                              <span class="global-library-inline-preview__exercise-name">{{ exercise.name || exercise.ExerciseTitle || 'Unnamed Exercise' }}</span>
                            </td>
                            <td v-if="previewDayHasStrengthFields(day.exercises)">{{ resolvePreviewExerciseType(exercise) === 'strength' && hasValue(exercise.sets) ? Number(exercise.sets) : '—' }}</td>
                            <td v-if="previewDayHasStrengthFields(day.exercises)">{{ resolvePreviewExerciseType(exercise) === 'strength' && hasValue(exercise.reps) ? Number(exercise.reps) : '—' }}</td>
                            <td v-if="previewDayHasStrengthFields(day.exercises)">{{ resolvePreviewExerciseType(exercise) === 'strength' && hasValue(exercise.weight) ? `${Number(exercise.weight)} lb` : '—' }}</td>
                            <td v-if="previewDayHasStrengthFields(day.exercises)">{{ resolvePreviewExerciseType(exercise) === 'strength' && hasValue(exercise.restTime) ? `${Number(exercise.restTime)} sec` : '—' }}</td>
                            <td v-if="previewDayHasCardioFields(day.exercises)">{{ resolvePreviewExerciseType(exercise) === 'cardio' && hasValue(exercise.duration) ? `${Number(exercise.duration)} min` : '—' }}</td>
                            <td v-if="previewDayHasCardioFields(day.exercises)">{{ resolvePreviewExerciseType(exercise) === 'cardio' && hasValue(exercise.distance) ? `${Number(exercise.distance)} mi` : '—' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p v-else class="global-library-inline-preview__empty-day">No exercises assigned to this day.</p>

                    <div v-if="day.exercises.length" class="global-library-inline-preview__day-cards">
                      <article
                        v-for="(exercise, index) in day.exercises"
                        :key="`preview-card-${day.name}-${exercise.id || exercise.exerciseId || index}`"
                        class="global-library-inline-preview__exercise-card"
                      >
                        <div class="global-library-inline-preview__exercise-card-head">
                          <img
                            :src="resolveExerciseImage(exercise)"
                            class="global-library-inline-preview__exercise-thumb"
                            :alt="`${exercise.name || exercise.ExerciseTitle || 'Exercise'} image`"
                            loading="lazy"
                            decoding="async"
                            @error="onPreviewExerciseImageError"
                          />
                          <h6>{{ exercise.name || exercise.ExerciseTitle || 'Unnamed Exercise' }}</h6>
                        </div>
                        <div class="global-library-inline-preview__exercise-card-grid">
                          <span v-if="resolvePreviewExerciseType(exercise) === 'strength' && hasValue(exercise.sets)"><strong>Sets:</strong> {{ Number(exercise.sets) }}</span>
                          <span v-if="resolvePreviewExerciseType(exercise) === 'strength' && hasValue(exercise.reps)"><strong>Reps:</strong> {{ Number(exercise.reps) }}</span>
                          <span v-if="resolvePreviewExerciseType(exercise) === 'strength' && hasValue(exercise.weight)"><strong>Weight:</strong> {{ Number(exercise.weight) }} lb</span>
                          <span v-if="resolvePreviewExerciseType(exercise) === 'strength' && hasValue(exercise.restTime)"><strong>Rest:</strong> {{ Number(exercise.restTime) }} sec</span>
                          <span v-if="resolvePreviewExerciseType(exercise) === 'cardio' && hasValue(exercise.duration)"><strong>Duration:</strong> {{ Number(exercise.duration) }} min</span>
                          <span v-if="resolvePreviewExerciseType(exercise) === 'cardio' && hasValue(exercise.distance)"><strong>Distance:</strong> {{ Number(exercise.distance) }} mi</span>
                        </div>
                      </article>
                    </div>
                  </article>
                </section>

                <div class="global-library-inline-preview__actions global-library-inline-preview__actions--bottom">
                  <button
                    type="button"
                    class="btn btn-sm global-plans-table__btn global-plans-table__btn--open"
                    @click="closeGlobalLibraryInlinePreview"
                  >
                    <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
                    <span>Back to Plans</span>
                  </button>

                  <button
                    v-if="canUsePlanFromPreview"
                    type="button"
                    class="btn btn-sm global-plans-table__btn global-plans-table__btn--edit"
                    :disabled="cloningFeaturedPlanId === globalLibraryViewPlan?.planId"
                    @click="triggerUsePlanFromPreview"
                  >
                    <i v-if="cloningFeaturedPlanId === globalLibraryViewPlan?.planId" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                    <i v-else class="fa-solid fa-copy" aria-hidden="true"></i>
                    <span>{{ cloningFeaturedPlanId === globalLibraryViewPlan?.planId ? 'Using...' : 'Use Plan' }}</span>
                  </button>
                </div>
              </div>
            </section>

            <template v-else>
            <section v-if="canAccessGlobalManagement" class="marketplace-admin-tools" aria-label="Admin tools">
              <div class="marketplace-admin-tools__title">ADMIN TOOLS</div>
              <div class="marketplace-admin-tools__row">
                <div class="marketplace-admin-tools__label-wrap">
                  <span class="marketplace-admin-tools__label">Enable Plan Management</span>
                  <span class="marketplace-admin-tools__helper">View and manage plans you are authorized to edit.</span>
                </div>
                <button
                  type="button"
                  class="marketplace-admin-tools__toggle"
                  :class="{
                    'marketplace-admin-tools__toggle--on': showManagedMarketplacePlans,
                    'marketplace-admin-tools__toggle--off': !showManagedMarketplacePlans,
                  }"
                  role="switch"
                  :aria-checked="showManagedMarketplacePlans ? 'true' : 'false'"
                  @click="showManagedMarketplacePlans = !showManagedMarketplacePlans"
                >
                  <span
                    class="marketplace-admin-tools__toggle-track"
                    :class="{ 'marketplace-admin-tools__toggle-track--on': showManagedMarketplacePlans }"
                    aria-hidden="true"
                  >
                    <span class="marketplace-admin-tools__toggle-thumb"></span>
                  </span>
                  <span class="marketplace-admin-tools__toggle-value">{{ showManagedMarketplacePlans ? 'ON' : 'OFF' }}</span>
                </button>
              </div>
            </section>

            <div class="marketplace-toolbar">
              <label class="marketplace-search-field" aria-label="Search workout plans">
                <i class="fa-solid fa-magnifying-glass marketplace-search-field__icon" aria-hidden="true"></i>
                <input
                  v-model="marketplaceSearchQuery"
                  type="text"
                  class="marketplace-search-field__input"
                  placeholder="Search workout plans..."
                  autocomplete="off"
                />
                <button
                  v-if="marketplaceSearchQuery.trim()"
                  type="button"
                  class="marketplace-search-field__clear"
                  aria-label="Clear search"
                  @click="clearMarketplaceSearch"
                >
                  <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </label>

              <button
                type="button"
                class="marketplace-filters-toggle"
                :aria-expanded="marketplaceFiltersOpen"
                :aria-label="marketplaceFiltersOpen ? 'Hide advanced filters' : 'Show advanced filters'"
                @click="marketplaceFiltersOpen = !marketplaceFiltersOpen"
              >
                <i class="fa-solid fa-sliders marketplace-filters-toggle__icon" aria-hidden="true"></i>
                <span class="marketplace-filters-toggle__label">Filters</span>
                <span v-if="activeMarketplaceFilterCount > 0" class="marketplace-filters-toggle__count">{{ activeMarketplaceFilterCount }}</span>
              </button>
            </div>

            <div v-if="marketplaceFiltersOpen" class="marketplace-filters-panel" aria-live="polite">
              <div class="marketplace-filters-panel__header">
                <p class="marketplace-filters-panel__summary">
                  Showing {{ filteredMarketplacePlans.length }} of {{ activeMarketplacePlans.length }} plans
                </p>
                <button
                  type="button"
                  class="marketplace-filters-panel__clear"
                  :disabled="!hasMarketplaceActiveFilters"
                  @click="clearMarketplaceFilters"
                >
                  Clear Filters
                </button>
              </div>

              <div class="marketplace-filters-panel__grid">
                <label class="marketplace-filter-field">
                  <span>Source</span>
                  <select v-model="marketplaceFilters.source" :disabled="!marketplaceFilterCapabilities.source">
                    <option value="all">All Sources</option>
                    <option value="global">WorkoutAtlas Global</option>
                    <option value="trainer">Trainer</option>
                    <option value="community">Community</option>
                  </select>
                </label>

                <label class="marketplace-filter-field">
                  <span>Workout Type</span>
                  <select v-model="marketplaceFilters.workoutType" :disabled="!marketplaceFilterCapabilities.workoutType">
                    <option value="all">All</option>
                    <option value="strength">Strength</option>
                    <option value="cardio">Cardio</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label class="marketplace-filter-field">
                  <span>Fitness Goal / Category</span>
                  <select v-model="marketplaceFilters.category" :disabled="!marketplaceFilterCapabilities.category">
                    <option
                      v-for="option in categoryFilterOptions"
                      :key="`marketplace-category-filter-${option.value}`"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>
              </div>
            </div>
            <p v-if="!marketplacePlansLoading && hasActiveMarketplacePlans" class="marketplace-results-count" aria-live="polite">
              {{ filteredMarketplacePlans.length }} / {{ activeMarketplacePlans.length }} plans
            </p>

            <div v-if="marketplacePlansLoading" class="builder-empty planner-empty planner-empty--loading" aria-live="polite">
              <div class="planner-empty__icon">📋</div>
              <h4>{{ showManagedMarketplacePlans ? 'Loading Managed Plans' : 'Loading Published Plans' }}</h4>
              <p>{{ showManagedMarketplacePlans ? 'Pulling plans you are authorized to manage now.' : 'Pulling discoverable workout plans now.' }}</p>
            </div>

            <div v-else-if="marketplaceFiltersHaveNoMatches" class="builder-empty planner-empty" aria-live="polite">
              <div class="planner-empty__icon">🔎</div>
              <h4>No workout plans match your search.</h4>
              <p>Try another keyword or adjust filters to view available plans.</p>
              <div class="marketplace-search-empty__actions">
                <button
                  v-if="marketplaceSearchQuery.trim()"
                  type="button"
                  class="btn btn-sm marketplace-search-empty__clear"
                  @click="clearMarketplaceSearch"
                >
                  Clear Search
                </button>
                <button
                  v-if="hasMarketplaceActiveFilters"
                  type="button"
                  class="btn btn-sm marketplace-search-empty__clear"
                  @click="clearMarketplaceFilters"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div v-else-if="!hasActiveMarketplacePlans" class="builder-empty planner-empty" aria-live="polite">
              <div class="planner-empty__icon">📭</div>
              <h4>{{ showManagedMarketplacePlans ? 'No Managed Plans Available' : 'No Published Plans Available' }}</h4>
              <p>{{ showManagedMarketplacePlans ? 'Managed plans will appear here when your account is authorized for them.' : 'Discoverable workout plans will appear here.' }}</p>
            </div>

            <div v-else class="global-library-table-wrap" aria-live="polite">
              <div class="table-responsive global-library-table-scroll">
                <table class="table align-middle mb-0 global-library-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Category</th>
                      <th>Plan Type</th>
                      <th>Unique Exercises</th>
                      <th class="text-end global-library-table__actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="plan in filteredMarketplacePlans" :key="`library-${plan.planId || plan.name}`">
                      <td>
                        <div class="marketplace-plan-name-cell">
                          <img
                            :src="plan.coverImageUrl || buildPlanCoverImageUrl(plan.planId)"
                            class="marketplace-plan-thumb"
                            :alt="`${plan.name || 'Workout plan'} cover`"
                            loading="lazy"
                            decoding="async"
                            @error="onPlanCoverImageError"
                          />
                          <div class="marketplace-plan-name-content">
                            <span class="fw-semibold">{{ plan.name || 'Untitled Workout' }}</span>
                            <span class="marketplace-plan-inline-status">[Status - {{ formatMarketplaceStatusLabel(plan) }}]</span>
                          </div>
                        </div>
                      </td>
                      <td>{{ plan.type || 'General Fitness' }}</td>
                      <td>{{ formatMarketplacePlanTypeLabel(plan) }}</td>
                      <td>{{ Number(plan.exerciseCount || 0) }}</td>
                      <td class="text-end global-library-table__actions-cell">
                        <div class="global-plans-table__actions global-plans-table__actions--icon-only">
                          <button
                            type="button"
                            class="btn btn-sm global-plans-table__btn global-plans-table__btn--open"
                            title="View Plan"
                            aria-label="View Plan"
                            @click="openGlobalLibraryViewModal(plan)"
                          >
                            <i class="fa-solid fa-eye" aria-hidden="true"></i>
                          </button>
                          <template v-if="showManagedMarketplacePlans">
                            <button
                              type="button"
                              class="btn btn-sm global-plans-table__btn global-plans-table__btn--edit"
                              title="Edit Plan"
                              aria-label="Edit Plan"
                              @click="viewGlobalPlanSummary(plan)"
                            >
                              <i class="fa-solid fa-pen" aria-hidden="true"></i>
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm global-plans-table__btn global-plans-table__btn--delete"
                              title="Delete Plan"
                              aria-label="Delete Plan"
                              :disabled="globalPlansDeletingId === plan.planId"
                              @click="requestDeleteGlobalPlan(plan)"
                            >
                              <i v-if="globalPlansDeletingId === plan.planId" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                              <i v-else class="fa-solid fa-trash" aria-hidden="true"></i>
                            </button>
                          </template>
                          <button
                            v-else
                            type="button"
                            class="btn btn-sm global-plans-table__btn global-plans-table__btn--edit"
                            :title="cloningFeaturedPlanId === plan.planId ? 'Using Global Workout Plan' : 'Use Global Workout Plan (Create Personal Copy)'"
                            :aria-label="cloningFeaturedPlanId === plan.planId ? 'Using Global Workout Plan' : 'Use Global Workout Plan (Create Personal Copy)'"
                            :disabled="cloningFeaturedPlanId === plan.planId"
                            @click="selectTemplatePlan(plan)"
                          >
                            <i v-if="cloningFeaturedPlanId === plan.planId" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                            <i v-else class="fa-solid fa-copy" aria-hidden="true"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="global-library-mobile-list" aria-live="polite">
              <article
                v-for="plan in filteredMarketplacePlans"
                :key="`library-mobile-${plan.planId || plan.name}`"
                class="global-library-mobile-card"
              >
                <img
                  :src="plan.coverImageUrl || buildPlanCoverImageUrl(plan.planId)"
                  class="global-library-mobile-card__cover"
                  :alt="`${plan.name || 'Workout plan'} cover`"
                  loading="lazy"
                  decoding="async"
                  @error="onPlanCoverImageError"
                />
                <h5 class="global-library-mobile-card__name">{{ plan.name || 'Untitled Workout' }}</h5>

                <div v-if="getMarketplaceStatusBadges(plan).length" class="marketplace-status-badges marketplace-status-badges--mobile">
                  <span
                    v-for="badge in getMarketplaceStatusBadges(plan)"
                    :key="`mobile-status-${plan.planId || plan.name}-${badge.key}`"
                    :class="['marketplace-status-badge', `marketplace-status-badge--${badge.tone}`]"
                  >
                    {{ badge.label }}
                  </span>
                </div>

                <div class="global-library-mobile-card__meta">
                  <span>
                    <strong>Source:</strong>
                    {{ formatMarketplaceSourceLabel(plan) }}
                  </span>
                  <span v-if="plan.type || plan.category">
                    <strong>Category:</strong>
                    {{ plan.type || plan.category }}
                  </span>
                  <span>
                    <strong>Plan Type:</strong>
                    {{ formatMarketplacePlanTypeLabel(plan) }}
                  </span>
                  <span>
                    <strong>Unique Exercises:</strong>
                    {{ Number(plan.exerciseCount || 0) }}
                  </span>
                </div>

                <div :class="['global-library-mobile-card__actions', { 'global-library-mobile-card__actions--manage': showManagedMarketplacePlans }]">
                  <button
                    type="button"
                    class="btn btn-sm global-plans-table__btn global-plans-table__btn--open"
                    title="View Global Workout Plan (Read-Only)"
                    aria-label="View Global Workout Plan (Read-Only)"
                    @click="openGlobalLibraryViewModal(plan)"
                  >
                    <i class="fa-solid fa-eye" aria-hidden="true"></i>
                    <span>View</span>
                  </button>

                  <template v-if="showManagedMarketplacePlans">
                    <button
                      type="button"
                      class="btn btn-sm global-plans-table__btn global-plans-table__btn--edit"
                      title="Edit Global Workout Plan"
                      aria-label="Edit Global Workout Plan"
                      @click="viewGlobalPlanSummary(plan)"
                    >
                      <i class="fa-solid fa-pen" aria-hidden="true"></i>
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm global-plans-table__btn global-plans-table__btn--delete"
                      :disabled="globalPlansDeletingId === plan.planId"
                      @click="requestDeleteGlobalPlan(plan)"
                    >
                      <i v-if="globalPlansDeletingId === plan.planId" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                      <i v-else class="fa-solid fa-trash" aria-hidden="true"></i>
                      <span>{{ globalPlansDeletingId === plan.planId ? 'Deleting...' : 'Delete' }}</span>
                    </button>
                  </template>

                  <button
                    v-else
                    type="button"
                    class="btn btn-sm global-plans-table__btn global-plans-table__btn--edit"
                    :title="cloningFeaturedPlanId === plan.planId ? 'Using Global Workout Plan' : 'Use Global Workout Plan (Create Personal Copy)'"
                    :aria-label="cloningFeaturedPlanId === plan.planId ? 'Using Global Workout Plan' : 'Use Global Workout Plan (Create Personal Copy)'"
                    :disabled="cloningFeaturedPlanId === plan.planId"
                    @click="selectTemplatePlan(plan)"
                  >
                    <i v-if="cloningFeaturedPlanId === plan.planId" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                    <i v-else class="fa-solid fa-copy" aria-hidden="true"></i>
                    <span>{{ cloningFeaturedPlanId === plan.planId ? 'Using...' : 'Use Plan' }}</span>
                  </button>
                </div>
              </article>
            </div>
            </template>
          </div>

        </div>
      </section>

      <!-- ── TAB 4: Suggest with AI ─────────────────────────────── -->
      <section v-show="builderTab === 'ai'" class="builder-section ai-suggest-section">
        <div v-if="!isAdminUser" class="ai-suggest-body planner-empty">
          <div class="planner-empty__icon">🔒</div>
          <h4>Administrator access required</h4>
          <p>This AI tab is currently limited to administrators so the foundation stays secure and scoped.</p>
        </div>

        <div v-else class="ai-suggest-body ai-suggest-card">
          <div class="planner-empty__icon">🤖</div>
          <h4>Suggest with AI</h4>
          <p>Send a short prompt to the backend and receive a response from the AI gateway foundation.</p>

          <label class="ai-prompt-label" for="ai-prompt-input">Message</label>
          <textarea
            id="ai-prompt-input"
            v-model="aiPrompt"
            rows="4"
            maxlength="280"
            placeholder="Example: Suggest a simple beginner upper-body workout."
            class="ai-prompt-input"
          ></textarea>

          <div class="ai-actions">
            <button type="button" class="ai-generate-btn" :disabled="aiLoading" @click="sendAiSuggestion">
              {{ aiLoading ? 'Sending...' : 'Send' }}
            </button>
            <button type="button" class="ai-generate-btn ai-test-btn" :disabled="aiLoading || gatewayTestLoading" @click="runGatewayDebugTest">
              {{ gatewayTestLoading ? 'Testing...' : 'TEST GATEWAY' }}
            </button>
          </div>

          <div v-if="aiError" class="ai-feedback ai-feedback--error">
            {{ aiError }}
            <div v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.ai" class="wb-error-diag">
              <button type="button" class="wb-error-diag__toggle" @click="toggleErrorDiagnostics('ai')">
                {{ diagnosticsExpandedByArea.ai ? 'Hide details' : 'Show details' }}
              </button>
              <p v-if="diagnosticsExpandedByArea.ai" class="wb-error-diag__text">
                Status {{ errorDiagnosticsByArea.ai.status }} | Code {{ errorDiagnosticsByArea.ai.code }} | Request {{ errorDiagnosticsByArea.ai.requestId }}
              </p>
            </div>
          </div>
          <div v-else-if="aiResponse" class="ai-feedback ai-feedback--success">{{ aiResponse }}</div>
          <div v-else class="ai-feedback ai-feedback--hint">Your response will appear here once the request completes.</div>
        </div>
      </section>

      <!-- ── TAB 5: Manage Global Plans (Authorized Creators) ──── -->
      <section v-if="canAccessGlobalManagement" v-show="builderTab === 'global'" class="builder-section ai-suggest-section">
        <div class="ai-suggest-body ai-suggest-card global-plans-shell">
          <h4>Manage Global Plans</h4>
          <nav class="wa-h-tabs global-subtabs" role="tablist" aria-label="Global workout plans sub sections">
            <button
              type="button"
              role="tab"
              :aria-selected="globalPlansSubTab === 'global'"
              :class="['builder-subtab', 'wa-h-tab', 'builder-subtab--global', { 'wa-h-tab--active': globalPlansSubTab === 'global' }]"
              @click="globalPlansSubTab = 'global'"
            >
              <i class="fa-solid fa-layer-group"></i>
              <span>Global Plans</span>
            </button>
            <button
              v-if="canViewAdminUserPlans"
              type="button"
              role="tab"
              :aria-selected="globalPlansSubTab === 'user'"
              :class="['builder-subtab', 'wa-h-tab', 'builder-subtab--user', { 'wa-h-tab--active': globalPlansSubTab === 'user' }]"
              @click="globalPlansSubTab = 'user'"
            >
              <i class="fa-solid fa-users"></i>
              <span>User Plans</span>
            </button>
          </nav>

          <div v-show="globalPlansSubTab === 'global'" class="global-subtab-panel planner-empty" aria-live="polite">
            <div class="global-plans-embed">
              <div class="global-plans-embed__head">
                <button type="button" class="btn btn-sm global-plans-embed__add" @click="createGlobalPlanDraft">
                  <i class="fa-solid fa-plus"></i>
                  <span>Add Global Plan</span>
                </button>
              </div>

              <div v-if="globalPlansError" class="global-plans-embed__feedback global-plans-embed__feedback--error">
                {{ globalPlansError }}
                <div v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.globalPlans" class="wb-error-diag">
                  <button type="button" class="wb-error-diag__toggle" @click="toggleErrorDiagnostics('globalPlans')">
                    {{ diagnosticsExpandedByArea.globalPlans ? 'Hide details' : 'Show details' }}
                  </button>
                  <p v-if="diagnosticsExpandedByArea.globalPlans" class="wb-error-diag__text">
                    Status {{ errorDiagnosticsByArea.globalPlans.status }} | Code {{ errorDiagnosticsByArea.globalPlans.code }} | Request {{ errorDiagnosticsByArea.globalPlans.requestId }}
                  </p>
                </div>
              </div>
              <div v-if="globalPlansSuccess" class="global-plans-embed__feedback global-plans-embed__feedback--ok">{{ globalPlansSuccess }}</div>

              <div class="table-responsive">
                <table class="table align-middle mb-0 global-plans-table">
                  <thead>
                    <tr>
                      <th><i class="fa-solid fa-clipboard-list global-plans-table__th-icon" aria-hidden="true"></i>Plan Name</th>
                      <th>Category</th>
                      <th>Goal Type</th>
                      <th>Days</th>
                      <th>Exercises</th>
                      <th><i class="fa-solid fa-lock-open global-plans-table__th-icon" aria-hidden="true"></i>Access</th>
                      <th><i class="fa-solid fa-clock global-plans-table__th-icon" aria-hidden="true"></i>Updated</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="globalPlansLoading">
                      <td colspan="8" class="text-center text-muted py-3">Loading global workout plans...</td>
                    </tr>
                    <tr v-for="plan in globalPlans" :key="plan.planId">
                      <td class="fw-semibold">{{ plan.name }}</td>
                      <td>{{ plan.category }}</td>
                      <td>{{ formatGlobalGoalTypeLabel(plan.goalType) }}</td>
                      <td>{{ plan.dayCount }}</td>
                      <td>{{ plan.exerciseCount }}</td>
                      <td>{{ formatGlobalAccess(plan) }}</td>
                      <td>{{ formatGlobalUpdatedDate(plan.updatedAt) }}</td>
                      <td class="text-end">
                        <div class="global-plans-table__actions">
                          <button type="button" class="btn btn-sm global-plans-table__btn global-plans-table__btn--open" @click="viewGlobalPlanSummary(plan)">
                            <i class="fa-solid fa-eye" aria-hidden="true"></i>
                            <span>View</span>
                          </button>
                          <button type="button" class="btn btn-sm global-plans-table__btn global-plans-table__btn--delete" :disabled="globalPlansDeletingId === plan.planId" @click="requestDeleteGlobalPlan(plan)">
                            <i v-if="globalPlansDeletingId === plan.planId" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                            <i v-else class="fa-solid fa-trash" aria-hidden="true"></i>
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="!globalPlansLoading && !globalPlans.length">
                      <td colspan="8" class="text-center text-muted py-3">No global workout plans found.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div v-if="canViewAdminUserPlans" v-show="globalPlansSubTab === 'user'" class="global-subtab-panel planner-empty" aria-live="polite">
            <div class="global-plans-embed">
              <div v-if="adminUserPlansError" class="global-plans-embed__feedback global-plans-embed__feedback--error">
                {{ adminUserPlansError }}
                <div v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.adminUserPlans" class="wb-error-diag">
                  <button type="button" class="wb-error-diag__toggle" @click="toggleErrorDiagnostics('adminUserPlans')">
                    {{ diagnosticsExpandedByArea.adminUserPlans ? 'Hide details' : 'Show details' }}
                  </button>
                  <p v-if="diagnosticsExpandedByArea.adminUserPlans" class="wb-error-diag__text">
                    Status {{ errorDiagnosticsByArea.adminUserPlans.status }} | Code {{ errorDiagnosticsByArea.adminUserPlans.code }} | Request {{ errorDiagnosticsByArea.adminUserPlans.requestId }}
                  </p>
                </div>
              </div>
              <div class="table-responsive">
                <table class="table align-middle mb-0 global-plans-table user-plans-table">
                  <thead>
                    <tr>
                      <th><i class="fa-solid fa-user global-plans-table__th-icon" aria-hidden="true"></i>User</th>
                      <th><i class="fa-solid fa-clipboard-list global-plans-table__th-icon" aria-hidden="true"></i>Plan Name</th>
                      <th><i class="fa-solid fa-clock global-plans-table__th-icon" aria-hidden="true"></i>Duration</th>
                      <th><i class="fa-solid fa-dumbbell global-plans-table__th-icon" aria-hidden="true"></i>Exercises</th>
                      <th><i class="fa-solid fa-calendar-plus global-plans-table__th-icon" aria-hidden="true"></i>Created</th>
                      <th><i class="fa-solid fa-clock-rotate-left global-plans-table__th-icon" aria-hidden="true"></i>Updated</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="adminUserPlansLoading">
                      <td colspan="7" class="text-center text-muted py-3">Loading user workout plans...</td>
                    </tr>
                    <tr v-for="plan in adminUserPlans" :key="`user-${plan.planId}-${plan.userId || 0}`">
                      <td>{{ plan.displayName }}</td>
                      <td class="fw-semibold">{{ plan.planName }}</td>
                      <td>{{ Number(plan.duration || 0) }} min</td>
                      <td>{{ Number(plan.exerciseCount || 0) }}</td>
                      <td>{{ formatUserPlanCreatedAt(plan) }}</td>
                      <td>{{ formatUpdatedAt(plan.updatedAt) }}</td>
                      <td class="text-end">
                        <div class="global-plans-table__actions">
                          <button type="button" class="btn btn-sm global-plans-table__btn global-plans-table__btn--open" @click="viewUserPlanReadOnly(plan)">
                            <i class="fa-solid fa-eye" aria-hidden="true"></i>
                            <span>Open</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="!adminUserPlansLoading && !adminUserPlans.length">
                      <td colspan="7" class="text-center text-muted py-3">No user workout plans found.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
          </div>
        </section>

      </section>

    <ExercisePickerModal
      :is-open="pickerOpen"
      :exercises="allExercises"
      :user-id="userId"
      @close="closePicker"
      @add="addExerciseToWorkout"
    />

    <!-- Workout Plan Type Conversion Modal -->
    <transition name="modal-fade">
      <div v-if="showPlanTypeConversionModal" class="save-workout-modal-backdrop" @click.self="closePlanTypeConversionModal">
        <div class="save-workout-modal plan-type-conversion-modal" role="dialog" aria-modal="true" aria-labelledby="plan-type-conversion-modal-title">
          <div class="save-workout-modal__header">
            <div class="plan-type-conversion-modal__header-copy">
              <h3 id="plan-type-conversion-modal-title">Convert Workout Plan Type</h3>
              <p>Create a separate converted copy. Your current plan will remain unchanged.</p>
            </div>
            <button
              type="button"
              class="plan-type-conversion-modal__close"
              aria-label="Close conversion"
              :disabled="conversionPreviewLoading || conversionCreateLoading"
              @click="closePlanTypeConversionModal"
            >
              ×
            </button>
          </div>

          <div class="save-workout-modal__summary" aria-live="polite">
            <div class="save-workout-modal__row"><span>Original Plan Name</span><strong>{{ conversionSourcePlanName }}</strong></div>
            <div class="save-workout-modal__row"><span>Current Plan Type</span><strong>{{ selectedPlanTypeDisplayLabel }}</strong></div>
            <div class="save-workout-modal__row plan-type-conversion-modal__row--target">
              <span>Destination Plan Type</span>
              <select
                v-model="conversionTargetPlanType"
                :disabled="conversionPreviewLoading || conversionCreateLoading"
                @change="markConversionInputChanged"
              >
                <option value="" disabled>Select destination type</option>
                <option
                  v-for="option in conversionTargetOptions"
                  :key="`convert-target-${option.value}`"
                  :value="option.value"
                  :disabled="option.disabled"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="save-workout-modal__row plan-type-conversion-modal__row--target">
              <span>New Plan Name</span>
              <input
                v-model="conversionDestinationTitle"
                type="text"
                maxlength="150"
                :disabled="conversionPreviewLoading || conversionCreateLoading"
                placeholder="Workout Plan Copy"
                @input="normalizeConversionDestinationTitle(); markConversionInputChanged();"
              />
            </div>
          </div>

          <div v-if="conversionError" class="plan-type-conversion-modal__message plan-type-conversion-modal__message--error">
            <p>{{ conversionError }}</p>
            <div v-if="canShowTechnicalDiagnostics && errorDiagnosticsByArea.conversion" class="wb-error-diag wb-error-diag--conversion">
              <button type="button" class="wb-error-diag__toggle" @click="toggleErrorDiagnostics('conversion')">
                {{ diagnosticsExpandedByArea.conversion ? 'Hide details' : 'Show details' }}
              </button>
              <p v-if="diagnosticsExpandedByArea.conversion" class="wb-error-diag__text">
                Status {{ errorDiagnosticsByArea.conversion.status }} | Code {{ errorDiagnosticsByArea.conversion.code }} | Request {{ errorDiagnosticsByArea.conversion.requestId }}
              </p>
            </div>
          </div>
          <p v-else-if="conversionInfo" class="plan-type-conversion-modal__message">{{ conversionInfo }}</p>

          <div v-if="conversionPreview" class="plan-type-conversion-modal__preview" aria-live="polite">
            <div class="plan-type-conversion-modal__preview-row">
              <span>Compatibility</span>
              <strong>
                {{ Number(conversionPreview.compatibility?.totalExercises || 0) }} exercises,
                {{ Number(conversionPreview.compatibility?.incompatibleExerciseCount || 0) }} incompatible
              </strong>
            </div>
            <div class="plan-type-conversion-modal__preview-row">
              <span>Can Proceed</span>
              <strong>{{ conversionPreview.canProceed ? 'Yes' : 'No' }}</strong>
            </div>

            <div v-if="Array.isArray(conversionPreview.warnings) && conversionPreview.warnings.length" class="plan-type-conversion-modal__list-wrap">
              <h4>Warnings</h4>
              <ul>
                <li v-for="warning in conversionPreview.warnings" :key="`convert-warning-${warning}`">{{ warning }}</li>
              </ul>
            </div>

            <div v-if="Array.isArray(conversionPreview.blockers) && conversionPreview.blockers.length" class="plan-type-conversion-modal__list-wrap plan-type-conversion-modal__list-wrap--error">
              <h4>Blockers</h4>
              <ul>
                <li v-for="blocker in conversionPreview.blockers" :key="`convert-blocker-${blocker.code || blocker.message}`">
                  {{ blocker.message || blocker.code }}
                </li>
              </ul>
            </div>

            <div
              v-if="Array.isArray(conversionPreview.compatibility?.incompatibleExercises) && conversionPreview.compatibility.incompatibleExercises.length"
              class="plan-type-conversion-modal__list-wrap plan-type-conversion-modal__list-wrap--error"
            >
              <h4>Incompatible Exercises</h4>
              <ul>
                <li
                  v-for="exercise in conversionPreview.compatibility.incompatibleExercises"
                  :key="`convert-incompatible-${exercise.order}-${exercise.exerciseId}`"
                >
                  {{ exercise.name || `Exercise ${exercise.exerciseId || 'Unknown'}` }}
                  <span v-if="Array.isArray(exercise.issues) && exercise.issues.length">
                    - {{ exercise.issues.map((issue) => issue.message || issue.code).join('; ') }}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div class="save-workout-modal__actions">
            <button
              type="button"
              class="modal-btn modal-btn--cancel"
              :disabled="conversionCreateLoading || conversionPreviewLoading"
              @click="closePlanTypeConversionModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="modal-btn modal-btn--publish-blue"
              :disabled="conversionPreviewLoading || conversionCreateLoading || !conversionTargetPlanType"
              @click="requestPlanTypeConversionPreview"
            >
              {{ conversionPreviewLoading ? 'Previewing...' : 'Preview Conversion' }}
            </button>
            <button
              type="button"
              class="modal-btn modal-btn--draft"
              :disabled="conversionCreateLoading || conversionPreviewLoading || !conversionPreview || !conversionPreview.canProceed"
              @click="confirmPlanTypeConversion"
            >
              {{ conversionCreateLoading ? 'Converting...' : 'Convert & Copy Plan' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Save Workout Plan Modal -->
    <transition name="modal-fade">
      <div v-if="showSaveWorkoutPlanModal" class="save-workout-modal-backdrop" @click.self="closeSaveWorkoutPlanModal">
        <div class="save-workout-modal save-workout-modal--confirm" role="dialog" aria-modal="true" aria-labelledby="save-workout-modal-title">
          <div class="save-workout-modal__header">
            <div class="save-workout-modal__header-top">
              <h3 id="save-workout-modal-title">Save Workout Plan</h3>
              <button
                type="button"
                class="save-workout-modal__close"
                aria-label="Close Save Workout Plan"
                :disabled="saving || publishing"
                @click="closeSaveWorkoutPlanModal"
              >
                ×
              </button>
            </div>
            <p>Choose how to save this Global workout plan.</p>
          </div>

          <div class="save-workout-modal__summary" aria-live="polite">
            <div class="save-workout-modal__row"><span>Workout Plan Name</span><strong>{{ savePlanModalSummary.planName }}</strong></div>
            <div class="save-workout-modal__row"><span>Current Publication Status</span><strong>{{ savePlanModalSummary.currentStatusLabel }}</strong></div>
            <div class="save-workout-modal__row"><span>Selected Publication Status</span><strong>{{ savePlanModalSummary.selectedStatusLabel }}</strong></div>
          </div>

          <p v-if="savePlanModalSummary.selectedStatus === 'archived'" class="save-workout-modal__note">
            Archived status is managed by the existing archive workflow and confirmation steps.
          </p>

          <div class="save-workout-modal__actions save-workout-modal__actions--confirm">
            <button type="button" class="modal-btn modal-btn--cancel" :disabled="saving || publishing" @click="closeSaveWorkoutPlanModal">
              Cancel
            </button>
            <div class="save-workout-modal__actions-right">
              <button type="button" class="modal-btn modal-btn--draft" :disabled="saving || publishing" @click="saveGlobalPlanAsDraftFromModal">
                {{ saving && !publishing ? 'Saving Draft...' : 'Save as Draft' }}
              </button>
              <button type="button" class="modal-btn modal-btn--publish-blue" :disabled="saving || publishing" @click="publishGlobalPlanFromModal">
                {{ publishing ? 'Publishing...' : 'Publish' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Publish Plan Confirmation Modal -->
    <transition name="modal-fade">
      <div v-if="showPublishPlanModal" class="publish-confirmation-backdrop" @click.self="closePublishPlanConfirmation">
        <div class="publish-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="publish-plan-modal-title">
          <div class="publish-confirmation-modal__header">
            <div class="publish-confirmation-modal__icon" aria-hidden="true">✓</div>
            <div>
              <h3 id="publish-plan-modal-title">Publish Workout Plan?</h3>
              <p>This workout plan will become available to eligible WorkoutAtlas users according to its visibility settings.</p>
            </div>
          </div>

          <div class="publish-confirmation-modal__summary" aria-live="polite">
            <div class="publish-confirmation-modal__row"><span>Plan Name</span><strong>{{ publishPlanSummary.planName }}</strong></div>
            <div class="publish-confirmation-modal__row"><span>Plan Type</span><strong>{{ publishPlanSummary.planType }}</strong></div>
            <div class="publish-confirmation-modal__row"><span>Workout Type</span><strong>{{ publishPlanSummary.workoutType }}</strong></div>
            <div class="publish-confirmation-modal__row"><span>Category</span><strong>{{ publishPlanSummary.category }}</strong></div>
            <div class="publish-confirmation-modal__row"><span>Plan Duration (Weeks)</span><strong>{{ publishPlanSummary.planDurationWeeks }}</strong></div>
            <div class="publish-confirmation-modal__row"><span>Estimated Session Time</span><strong>{{ publishPlanSummary.estimatedSessionTime }}</strong></div>
            <div class="publish-confirmation-modal__row"><span>Number of Workout Days</span><strong>{{ publishPlanSummary.workoutDays }}</strong></div>
            <div class="publish-confirmation-modal__row"><span>Number of Exercises</span><strong>{{ publishPlanSummary.exerciseCount }}</strong></div>
            <div class="publish-confirmation-modal__row"><span>Visibility</span><strong>{{ publishPlanSummary.visibility }}</strong></div>
          </div>

          <div class="publish-confirmation-modal__actions">
            <button type="button" class="modal-btn modal-btn--cancel" @click="closePublishPlanConfirmation" :disabled="publishing">
              Cancel
            </button>
            <button type="button" class="modal-btn modal-btn--publish" :disabled="publishing" @click="confirmPublishWorkoutPlan">
              {{ publishing ? 'Publishing Plan...' : 'Publish Plan' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Delete Global Plan Confirmation Modal -->
    <transition name="modal-fade">
      <div
        v-if="showGlobalDeletePlanModal"
        class="global-delete-modal-backdrop"
        @click.self="closeGlobalDeletePlanModal"
      >
        <div
          class="global-delete-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-delete-modal-title"
        >
          <button
            type="button"
            class="global-delete-modal-close"
            aria-label="Close delete dialog"
            :disabled="Boolean(globalPlansDeletingId)"
            @click="closeGlobalDeletePlanModal"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>

          <div class="global-delete-modal-icon" aria-hidden="true">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>

          <h3 id="global-delete-modal-title" class="global-delete-modal-title">
            Delete Global Workout Plan?
          </h3>

          <p class="global-delete-modal-name">
            {{ selectedGlobalPlanForDelete?.name || 'Untitled Workout' }}
          </p>

          <p class="global-delete-modal-copy">
            Are you sure you want to permanently delete this workout plan? This action cannot be undone.
          </p>

          <p class="global-delete-modal-warning">
            This global workout plan may be available to other users.
          </p>

          <div class="global-delete-modal-actions">
            <button
              type="button"
              class="btn btn-secondary global-delete-modal-cancel"
              :disabled="Boolean(globalPlansDeletingId)"
              @click="closeGlobalDeletePlanModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-danger global-delete-modal-confirm"
              :disabled="globalPlansDeletingId === selectedGlobalPlanForDelete?.planId"
              @click="confirmDeleteGlobalPlan"
            >
              <span v-if="globalPlansDeletingId === selectedGlobalPlanForDelete?.planId">Deleting...</span>
              <span v-else>Delete Global Plan</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

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
  </div>
</template>

<style scoped>
.workout-builder-page { display: block; }

.workout-builder-canvas {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}

/* Stage 1: remove inherited right gutter that shows as a stray strip on Workout Builder */
.workout-builder-page .app-page-canvas.app-inner-shell.workout-builder-canvas {
  margin-right: 0;
  padding-right: 0;
  background: var(--wa-shell-surface, #121923);
}

/* ── Tab Bar ──────────────────────────────────────────────────── */
.builder-tabs {
  display: flex;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 5px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.builder-tab {
  flex: 1;
  border: 1px solid transparent;
  background: #1d4f9f;
  border-radius: 3px;
  min-height: 34px;
  padding: 7px 10px;
  font-weight: 700;
  font-size: 0.8rem;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: filter 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
  cursor: pointer;
  white-space: nowrap;
  min-width: 0;
  text-align: center;
}

/* Keep top builder tabs rectangular even when generic mobile button rules apply pill radii. */
.builder-tabs .builder-tab {
  border-radius: 3px !important;
}

.builder-tab i {
  font-size: 0.78rem;
  color: #ffffff;
}

.builder-tab--create-tone {
  background: #0d5b55;
}

.builder-tab--ai-tone {
  background: #8f1f2a;
}

.builder-tab--view-tone {
  background: #3b5b8a;
}

.builder-tab--global-tone {
  background: #D97706;
}

.builder-tab:hover:not(:disabled) {
  filter: brightness(1.08);
}

.builder-tab--active {
  color: #ffffff;
  box-shadow: inset 0 -2px 0 #c8ddff, 0 0 0 1px rgba(196, 220, 255, 0.28);
  filter: brightness(1.2);
}

.builder-tab:active:not(:disabled) {
  transform: translateY(1px);
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

.main-builder-accordion {
  width: 100%;
  display: grid;
  gap: 12px;
  min-width: 0;
}

.main-builder-accordion__item {
  width: 100%;
  border: 1px solid #dbe4ef;
  border-radius: 14px;
  background: #ffffff;
  overflow: hidden;
  min-width: 0;
  box-sizing: border-box;
}

.main-builder-accordion__item.open {
  border-color: #2563eb;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12);
}

.main-builder-accordion__header {
  width: 100%;
  border: none;
  background: #f8fafc;
  color: #0f172a;
  min-height: 56px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 800;
  text-align: left;
}

.main-builder-accordion__header:hover {
  background: #f1f5f9;
}

.main-builder-accordion__title {
  font-size: 0.97rem;
}

.main-builder-accordion__icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  color: #334155;
  flex: 0 0 auto;
}

.main-builder-accordion__body {
  padding: 12px;
  min-width: 0;
  overflow-x: hidden;
  box-sizing: border-box;
}

.main-builder-accordion__body > .builder-tabs {
  margin-bottom: 10px;
}

.main-builder-accordion__body > .builder-section {
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 2px 0 0;
  background: transparent;
}

.main-builder-accordion__body > .existing-plans-panel {
  width: 100%;
  min-width: 0;
}

.collapsible-panel {
  padding: 16px;
}

.publication-status-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 12px;
  margin: 10px 0 0;
}

.publication-status-wrap--create {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 0 4px 0 0;
}

.publication-status-wrap--create .publication-status-field {
  display: grid;
  gap: 6px;
  min-width: 0;
  max-width: 320px;
  width: 100%;
}

.publication-status-wrap--create .publication-status-field__label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #cbd5e1 !important;
  opacity: 1;
}

.publication-status-wrap--create .publication-status-field select {
  min-height: 36px;
  width: 100%;
  border: 1px solid #2e4a88;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.86rem;
  color: #f8fafc;
  background: #1e3a8a;
}

.publication-status-wrap--create .publication-status-field select:focus-visible {
  outline: 2px solid rgba(148, 163, 184, 0.55);
  outline-offset: 1px;
}

.publication-status-wrap--create .publication-status-field__current {
  margin: 2px 0 0;
  font-size: 0.76rem;
  color: #cbd5e1;
}

.publication-status-wrap--create .publication-status-field__current strong {
  color: #f8fafc;
}

.publication-status-help {
  margin: 8px 4px 0;
  font-size: 0.8rem;
  line-height: 1.45;
}

.publication-status-help--warn {
  color: #92400e;
}

.global-featured-toggle {
  margin: 10px 4px 0;
  padding: 8px 10px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.42);
  display: grid;
  gap: 5px;
}

.global-featured-toggle__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 700;
}

.global-featured-toggle__label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
}

.global-featured-toggle__note {
  margin: 0;
  color: #dbeafe;
  font-size: 0.76rem;
  line-height: 1.35;
}

.global-featured-toggle__hint {
  margin: 0;
  color: #bfdbfe;
  font-size: 0.74rem;
  line-height: 1.3;
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

.select-plan-accordion {
  display: grid;
  gap: 10px;
}

.select-plan-accordion__item {
  border: 1px solid #dbe4ef;
  border-radius: 14px;
  background: #ffffff;
  overflow: hidden;
}

.select-plan-accordion__item.open {
  border-color: #2563eb;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12);
}

.select-plan-accordion__header {
  width: 100%;
  border: none;
  background: #f8fafc;
  color: #0f172a;
  min-height: 52px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 800;
  text-align: left;
}

.select-plan-accordion__header:hover {
  background: #f1f5f9;
}

.select-plan-accordion__title {
  font-size: 0.95rem;
}

.select-plan-accordion__icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  color: #334155;
  flex: 0 0 auto;
}

.select-plan-accordion__body {
  padding: 12px;
  min-width: 0;
}

.existing-plans-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.existing-plans-panel > * {
  min-width: 0;
}

.existing-plans-panel__head h4 {
  margin: 0;
  color: #0f172a;
  font-size: 1.02rem;
  font-weight: 800;
}

.existing-plans-panel__head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.86rem;
}

.existing-plans-panel__source-line {
  margin: 0;
  color: var(--wb-text-secondary);
  font-size: 0.85rem;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: nowrap;
}

.existing-plans-panel__source-line strong {
  color: var(--wb-text);
  font-size: 1.02rem;
  font-weight: 800;
  line-height: 1.2;
}

.existing-plans-panel__source-line span {
  line-height: 1.35;
}

@media (max-width: 768px) {
  .existing-plans-panel__source-line {
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .publication-status-actions {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 8px;
  }

  .publication-status-wrap--create {
    padding-right: 0;
  }

  .publication-status-wrap--create .publication-status-field {
    max-width: none;
  }

}

@media (max-width: 360px) {
  .publication-status-actions {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
}

.plan-carousel {
  border: 1px solid #dce5f3;
  border-radius: 16px;
  background: linear-gradient(180deg, #fbfdff 0%, #f7fbff 100%);
  padding: 18px;
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.plan-carousel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.plan-carousel__header h4 {
  margin: 0;
  color: #0f172a;
  font-size: 1.04rem;
  font-weight: 800;
}

.plan-carousel__position {
  font-size: 0.82rem;
  color: #64748b;
  font-weight: 700;
}

.plan-carousel__body {
  display: grid;
  gap: 12px;
}

.plan-carousel__item {
  width: 100%;
  display: block;
  appearance: none;
  text-align: left;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 600;
  min-height: 44px;
  padding: 0 16px;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.plan-carousel__item:disabled {
  opacity: 0.75;
  cursor: wait;
}

.plan-carousel__item-content {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.plan-carousel__item-name {
  display: inline-block;
  text-align: left;
}

.plan-carousel__item-description {
  display: inline-block;
  text-align: left;
  font-size: 0.78rem;
  color: #64748b;
  white-space: normal;
}

.plan-carousel__item-meta {
  display: inline-block;
  font-size: 0.74rem;
  font-weight: 700;
  opacity: 0.72;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.plan-carousel__item:hover {
  background: #f8fbff;
  border-color: #93c5fd;
}

.plan-carousel__item--selected {
  background: #eff6ff;
  border-color: #2563eb;
  color: #1d4ed8;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.22);
}

.plan-carousel__footer {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.plan-carousel__nav {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  min-height: 34px;
  padding: 0 10px;
  background: #ffffff;
  color: #334155;
  font-weight: 600;
  font-size: 0.8rem;
  transition: background 0.18s ease, border-color 0.18s ease;
  white-space: nowrap;
}

.plan-carousel__nav:hover {
  background: #f8fafc;
  border-color: #93c5fd;
}

.plan-carousel__dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.plan-carousel__dot {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  border: 1px solid #94a3b8;
  background: #e2e8f0;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.plan-carousel__dot:hover {
  transform: scale(1.1);
}

.plan-carousel__dot--active {
  background: #2563eb;
  border-color: #2563eb;
  transform: scale(1.1);
}

.plan-carousel__selected {
  margin: 0;
  font-size: 0.9rem;
  color: #475569;
  font-weight: 600;
  padding-top: 2px;
}

.plan-carousel__selected strong {
  color: #0f172a;
  margin-left: 4px;
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

.plan-cover-panel {
  margin-top: 6px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 8px;
  background: rgba(11, 22, 34, 0.64);
  padding: 8px;
  display: grid;
  gap: 8px;
}

.plan-cover-panel__header {
  display: grid;
  gap: 2px;
}

.plan-cover-panel__header h4 {
  margin: 0;
  color: #ecf6ff;
  font-size: 0.88rem;
  font-weight: 800;
}

.plan-cover-panel__header small {
  color: #c8d8f3;
  font-size: 0.72rem;
}

.plan-cover-panel__content {
  display: grid;
  gap: 8px;
  justify-items: center;
  align-items: center;
  width: 100%;
  overflow: hidden;
}

.plan-cover-main-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.plan-cover-preview-wrap {
  width: 120px;
  flex: 0 0 120px;
}

.plan-cover-preview {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  object-fit: cover;
  background: rgba(15, 23, 42, 0.72);
  display: block;
}

.plan-cover-preview--placeholder {
  color: #c8d8f3;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 10px;
  font-size: 0.76rem;
  line-height: 1.35;
}

.plan-cover-actions {
  display: grid;
  gap: 8px;
  align-content: center;
  justify-items: stretch;
  width: min(156px, 100%);
  max-width: 100%;
  min-width: 0;
}

.plan-cover-actions-desktop {
  display: grid;
  gap: 8px;
  justify-content: start;
  width: 100%;
}

.plan-cover-action-row {
  display: grid;
  gap: 8px;
  width: 100%;
}

.plan-cover-upload-input {
  display: none;
}

.plan-cover-action,
.plan-cover-replace-btn,
.plan-cover-delete-btn {
  min-height: 34px;
  width: 100%;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  font-size: 0.78rem;
  font-weight: 700;
}

.plan-cover-replace-btn {
  border: 1px solid rgba(148, 163, 184, 0.62);
  background: rgba(71, 85, 105, 0.55);
  color: #ffffff;
}

.plan-cover-replace-btn:hover:not(:disabled) {
  border-color: rgba(148, 163, 184, 0.8);
  background: rgba(71, 85, 105, 0.72);
}

.plan-cover-delete-btn {
  border: 1px solid var(--wa-btn-danger-border, #dc2626);
  background: var(--wa-btn-danger, #3b1d2b);
  color: #ffffff;
}

.plan-cover-delete-btn:hover:not(:disabled) {
  border-color: var(--wa-btn-danger-border, #dc2626);
  background: var(--wa-btn-danger-hover, #512334);
}

.plan-cover-action:disabled,
.plan-cover-replace-btn:disabled,
.plan-cover-delete-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.plan-cover-icon-btn {
  width: 34px;
  min-width: 34px;
  height: 34px;
  min-height: 34px;
  padding: 0;
  justify-content: center;
}

.plan-cover-progress {
  margin: 0;
  color: #dbeafe;
  font-size: 0.76rem;
  font-weight: 700;
  text-align: center;
}

.plan-cover-feedback {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.35;
  font-weight: 700;
  text-align: center;
}

.plan-cover-feedback--success {
  color: #86efac;
}

.plan-cover-feedback--error {
  color: #fecaca;
}

.plan-cover-feedback--warn {
  color: #fcd34d;
}

.plan-cover-feedback--info {
  color: #dbeafe;
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

.planner-shell--publication {
  margin-top: 14px;
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
  color: #b7cde8;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.25;
}

.planner-heading-group p {
  margin: 2px 0 0;
  color: #dfeaf9;
  font-size: 0.76rem;
  line-height: 1.3;
}

.planner-shell {
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 8px 0 0;
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.planner-tools {
  display: grid;
  gap: 6px;
  margin-bottom: 4px;
  min-width: 0;
}

.planner-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 6px;
  min-width: 0;
}

.plan-info-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 12px;
  padding: 0;
}

.plan-info-action-row__back {
  min-height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #1d4ed8;
  background: #2563eb;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.74rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.plan-info-action-row__back:hover {
  background: #1d4ed8;
}

.plan-info-action-row__save {
  min-height: 32px;
  padding: 0 12px;
  font-size: 0.74rem;
  margin-left: 0;
}

.planner-primary-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  padding-top: 6px;
}

.planner-primary-actions__status {
  min-height: 20px;
}

.planner-primary-actions__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.planner-primary-actions__controls--create {
  justify-content: flex-end;
}

.planner-primary-actions__cancel {
  min-height: 40px;
  padding: 0 12px;
  border-radius: 4px !important;
  border: 1px solid #4B5563;
  background: #374151;
  color: #FFFFFF;
  font-weight: 700;
  font-size: 0.78rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: none !important;
}

.planner-primary-actions__cancel:hover {
  background: #1f2937;
}

.planner-primary-actions__save {
  white-space: nowrap;
  margin-left: auto;
}

.planner-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
}

.planner-header-actions--schedule {
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.planner-quick-save-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

.planner-quick-save-btn {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-weight: 700;
  font-size: 0.78rem;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: filter 0.18s ease, transform 0.18s ease;
}

.planner-quick-save-btn:hover:not(:disabled) {
  filter: brightness(1.04);
}

.planner-quick-save-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.planner-mode-pill-wrap {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
}

.planner-save-top {
  white-space: nowrap;
  flex-shrink: 0;
}

.planner-mode-toggle {
  width: min(260px, 100%);
  max-width: 100%;
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.28);
  padding: 4px;
  gap: 4px;
  min-width: 0;
  box-sizing: border-box;
}

.planner-mode-btn {
  border: 1px solid rgba(148, 163, 184, 0.34);
  background: rgba(30, 41, 59, 0.74);
  color: #ffffff;
  border-radius: 5px;
  min-height: 36px;
  width: 100%;
  min-width: 0;
  padding: 0 12px;
  font-weight: 700;
  font-size: 0.78rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.planner-mode-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #1d4ed8;
}

.planner-mode-btn:hover {
  background: rgba(51, 65, 85, 0.86);
}

.planner-mode-btn.active:hover {
  background: #1d4ed8;
}

.planner-group-editor {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 8px;
  row-gap: 6px;
  min-width: 0;
}

.planner-group-editor__error {
  grid-column: 2 / 4;
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.3;
  color: #fca5a5;
}

.planner-group-editor__label {
  color: #ecf6ff;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  flex: 0 0 auto;
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
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 6px;
  min-height: 36px;
  padding: 6px 10px;
  background: linear-gradient(180deg, rgba(15, 28, 46, 0.9), rgba(11, 22, 34, 0.92));
  width: 100%;
  max-width: none;
  min-width: 0;
  flex: initial;
  box-sizing: border-box;
  color: #ecf6ff;
  font-size: 0.82rem;
}

.planner-group-add {
  border: 1px solid #15803d;
  border-radius: 6px;
  min-height: 36px;
  padding: 0 12px;
  background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
  color: #fff;
  font-weight: 700;
  font-size: 0.78rem;
  line-height: 1;
  white-space: nowrap;
  flex: 0 0 auto;
  box-shadow: 0 8px 18px rgba(22, 163, 74, 0.18);
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
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(11, 22, 34, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.36);
  color: #dfeaf9;
  font-size: 0.78rem;
  font-weight: 600;
  margin-top: 6px;
}

.planner-helper-text i {
  font-size: 14px;
}

/* Workout Day Accordion System */
.workout-day-accordion {
  display: grid;
  gap: 10px;
}

.workout-day-accordion__list {
  display: grid;
  gap: 10px;
}

.planner-bottom-group-actions {
  display: grid;
  gap: 8px;
  margin-top: 2px;
}

.planner-bottom-group-actions__editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
}

.planner-bottom-group-actions__editor .planner-group-editor__label {
  grid-column: 1 / -1;
  margin-bottom: 0;
}

.planner-bottom-group-actions__editor input {
  border: 1px solid #1d4ed8;
  border-radius: 8px;
  min-height: 36px;
  padding: 0 10px;
  background: rgba(10, 20, 38, 0.82);
  color: #e2ecff;
  font-size: 0.84rem;
}

.planner-bottom-group-actions__editor .planner-group-editor__error {
  grid-column: 1 / -1;
  margin: 0;
}

.planner-group-add--bottom {
  max-width: 100%;
}

.workout-day-card {
  border: 1px solid #38517C;
  border-radius: 10px;
  background: transparent;
  overflow: visible;
  transition: all 0.2s ease;
  min-width: 0;
  box-sizing: border-box;
  position: relative;
  z-index: 0;
}

.workout-day-card.active {
  border-color: #4772BA;
  background: transparent;
  box-shadow: none;
}

.workout-day-card.is-menu-open {
  z-index: 25;
}

.workout-day-header {
  width: 100%;
  border: none;
  background: linear-gradient(90deg, #172D68 0%, #202F58 50%, #2D3957 100%);
  border-radius: 12px 12px 0 0;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease;
  min-width: 0;
  box-sizing: border-box;
}

.workout-day-header:hover {
  background: linear-gradient(90deg, #172D68 0%, #202F58 50%, #2D3957 100%);
}

.workout-day-card.active .workout-day-header {
  background: linear-gradient(90deg, #172D68 0%, #202F58 50%, #2D3957 100%);
}

.day-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
  flex: 1;
}

.day-title-group strong {
  font-size: 0.96rem;
  font-weight: 700;
  color: #ffffff;
  max-width: 100%;
  display: inline-block;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.day-title-editable {
  cursor: text;
  border-radius: 7px;
  padding: 2px 6px;
  margin-left: -6px;
  color: #ffffff;
  background: transparent;
  transition: background-color 0.15s ease;
  max-width: 100%;
  display: inline-block;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.day-title-editable:hover {
  background: transparent;
}

.day-title-editable:active,
.day-title-editable:focus,
.day-title-editable:focus-visible {
  background: transparent;
  color: #ffffff;
  outline: none;
}

.workout-builder-page .day-title-inline-input,
.day-title-inline-input {
  min-width: 132px;
  max-width: 220px;
  border: 1px solid #60a5fa !important;
  border-radius: 8px;
  min-height: 30px;
  padding: 4px 8px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #ffffff !important;
  background: #1b2444 !important;
}

.workout-builder-page .day-title-inline-input:focus,
.workout-builder-page .day-title-inline-input:focus-visible,
.day-title-inline-input:focus,
.day-title-inline-input:focus-visible {
  outline: none;
  border-color: #60a5fa !important;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.28) !important;
}

.day-title-inline-error {
  flex-basis: 100%;
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.3;
  color: #F87171;
}

.day-rename-btn {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 6px;
  background: rgba(248, 250, 252, 0.92);
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: border-color 0.16s ease, color 0.16s ease, background 0.16s ease;
}

.day-rename-btn:hover,
.day-rename-btn:focus-visible {
  border-color: #60a5fa;
  color: #1d4ed8;
  background: #eff6ff;
  outline: none;
}

.day-rename-btn i {
  font-size: 0.72rem;
}

.day-title-inline-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.day-title-inline-btn {
  min-height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  background: #f8fafc;
  color: #1f2937;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.day-title-inline-btn--save {
  border-color: #16a34a;
  background: #16a34a;
  color: #ffffff;
}

.day-title-inline-btn--cancel {
  border-color: #475569;
  background: #475569;
  color: #ffffff;
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
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 600;
}

.day-header-controls {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-shrink: 0;
  min-width: 0;
}

.day-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  flex-shrink: 0;
}

.day-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.day-action-btn {
  border-radius: 7px;
  min-height: 30px;
  padding: 0 9px;
  font-size: 0.76rem;
  font-weight: 700;
  transition: all 0.2s ease;
}

.day-action-btn--secondary {
  min-height: 28px;
  padding: 0 8px;
  font-size: 0.73rem;
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

.day-action-btn--move {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
}

.day-action-btn--move:hover:not(:disabled) {
  border-color: #94a3b8;
  background: #f1f5f9;
}

.day-action-btn--reset {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.day-action-btn--reset:hover:not(:disabled) {
  border-color: #facc15;
  background: #fef3c7;
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
  all: unset;
  width: 28px;
  height: 28px;
  min-width: 0;
  min-height: 0;
  border: none;
  border-radius: 4px !important;
  background: transparent;
  color: #ffffff;
  padding: 0;
  margin: 0;
  box-shadow: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  cursor: pointer;
}

.chevron-btn:hover {
  background: transparent;
}

.chevron-btn:focus,
.chevron-btn:focus-visible,
.chevron-btn:active {
  outline: none;
  box-shadow: none;
}

.chevron-btn:focus-visible {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.55);
}

.accordion-chevron {
  color: #ffffff;
  transition: transform 0.18s ease;
}

.accordion-chevron--expanded {
  transform: rotate(180deg);
}

/* Week view header polish (kept isolated from day view) */
.workout-builder-page .workout-day-accordion--week .workout-day-header {
  align-items: center;
  min-height: 44px;
}

.workout-builder-page .workout-day-accordion--week .day-title-group {
  align-items: center;
}

.workout-builder-page .workout-day-accordion--week .day-title-editable {
  background: transparent;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 7px;
  margin-left: 0;
  line-height: 1.2;
}

.workout-builder-page .workout-day-accordion--week .day-title-editable:hover {
  background: transparent;
}

/* ── Kebab menu (mobile only) ── */
.day-kebab-wrap {
  position: relative;
  display: flex;
  flex-shrink: 0;
  z-index: 2;
}

.day-kebab-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 1.05rem;
  cursor: pointer;
  transition: background 0.15s;
}
.day-kebab-btn:hover {
  background: #f1f5f9;
}

.day-kebab-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  min-width: 162px;
  width: max-content;
  max-width: min(240px, calc(100vw - 20px));
  z-index: 1000;
  overflow: hidden;
  white-space: nowrap;
}

.day-kebab-menu--up {
  top: auto;
  bottom: calc(100% + 8px);
}

.day-kebab-item {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 0 !important;
  border: none;
  border-bottom: 1px solid #f1f5f9;
  background: transparent;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.day-kebab-item:last-child {
  border-bottom: none;
}
.day-kebab-item:hover {
  background: #f8fafc;
}
.day-kebab-item i {
  width: 16px;
  text-align: center;
  color: #64748b;
}
.day-kebab-item--delete {
  color: #ffffff;
}
.day-kebab-item--delete i {
  color: #dc2626;
}
.day-kebab-item:disabled {
  background: rgba(148, 163, 184, 0.12);
  color: #ffffff;
  cursor: not-allowed;
}

.workout-day-panel {
  background: transparent;
  border-top: 1px solid #dbe4f0;
  padding: 8px 10px 10px;
  min-width: 0;
  box-sizing: border-box;
}

.workout-day-card.active .workout-day-panel {
  background: transparent;
}

.day-exercises-list {
  display: grid;
  gap: 10px;
  margin-bottom: 8px;
}

.day-panel-actions {
  display: flex;
}

.day-panel-actions--bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.day-footer-summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.day-footer-summary__name {
  font-size: 0.82rem;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.2;
  max-width: 100%;
  display: inline-block;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.day-footer-summary .exercise-count {
  color: #e2e8f0;
}

.day-footer-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

.empty-day-state {
  border: 1px dashed #c7d2e3;
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  background: #f8fafc;
}

.empty-day-state p {
  margin: 0;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 600;
}

.btn-add-exercise-day {
  border: 1px solid #15803d;
  border-radius: 9px;
  background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
  color: #fff;
  font-weight: 700;
  padding: 0 12px;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 8px 18px rgba(22, 163, 74, 0.18);
  transition: all 0.2s ease;
  font-size: 0.78rem;
}

.day-order-move,
.day-order-enter-active,
.day-order-leave-active {
  transition: transform 0.24s ease, opacity 0.24s ease;
}

.day-order-enter-from,
.day-order-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.day-order-leave-active {
  position: absolute;
  width: calc(100% - 2px);
}

.btn-add-exercise-day:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(22, 163, 74, 0.24);
  background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
}

.btn-add-exercise-day .btn-add-exercise__icon {
  font-size: 1rem;
  line-height: 1;
}

.btn-add-exercise-day--bottom {
  min-height: 32px;
  padding: 0 10px;
  font-size: 0.76rem;
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

.publish-confirmation-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}

.save-workout-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.74);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2100;
  padding: 16px;
}

.save-workout-modal {
  width: min(520px, 100%);
  background: #152238;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(2, 6, 23, 0.45);
  overflow: hidden;
  animation: modalSlideIn 0.25s ease;
}

.save-workout-modal__header {
  padding: 16px 18px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.save-workout-modal__header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.save-workout-modal__header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #f8fafc;
}

.save-workout-modal__header p {
  margin: 6px 0 0;
  font-size: 0.84rem;
  color: #cbd5e1;
}

.save-workout-modal__close {
  border: 0;
  background: transparent;
  color: #ef4444;
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
  padding: 0;
  min-width: 24px;
  min-height: 24px;
  cursor: pointer;
}

.save-workout-modal__close:hover {
  color: #f87171;
}

.save-workout-modal__close:focus-visible {
  outline: 2px solid rgba(239, 68, 68, 0.45);
  outline-offset: 3px;
}

.save-workout-modal__summary {
  padding: 10px 18px 0;
  display: grid;
  gap: 0;
}

.save-workout-modal__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  color: #dbeafe;
  font-size: 0.86rem;
}

.save-workout-modal__row:last-child {
  border-bottom: none;
}

.save-workout-modal__row span {
  color: #bfd2ef;
}

.save-workout-modal__row strong {
  color: #f8fafc;
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}

.save-workout-modal__note {
  margin: 8px 18px 0;
  color: #fde68a;
  font-size: 0.78rem;
  line-height: 1.4;
}

.save-workout-modal__actions {
  padding: 14px 18px 18px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.save-workout-modal--confirm .save-workout-modal__actions--confirm {
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;
}

.save-workout-modal__actions-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.modal-btn--draft {
  border: 1px solid #16a34a;
  background: #16a34a;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.24);
}

.modal-btn--draft:hover {
  background: #15803d;
}

.modal-btn--publish-blue {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.24);
}

.modal-btn--publish-blue:hover {
  background: #1d4ed8;
}

.plan-type-conversion-modal {
  width: min(640px, 100%);
}

.plan-type-conversion-modal .save-workout-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.plan-type-conversion-modal__header-copy {
  min-width: 0;
}

.plan-type-conversion-modal__close {
  border: 0;
  background: transparent;
  color: #ef4444;
  width: 32px;
  min-width: 32px;
  height: 32px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  line-height: 1;
  font-weight: 700;
}

.plan-type-conversion-modal__close:hover {
  background: rgba(239, 68, 68, 0.12);
}

.plan-type-conversion-modal__close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.28);
}

.plan-type-conversion-modal__row--target {
  align-items: center;
}

.plan-type-conversion-modal__row--target select {
  min-width: 220px;
  max-width: 320px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(15, 28, 46, 0.9), rgba(11, 22, 34, 0.92));
  color: #ecf6ff;
  min-height: 34px;
  padding: 6px 10px;
}

.plan-type-conversion-modal__row--target input {
  min-width: 220px;
  max-width: 320px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(15, 28, 46, 0.9), rgba(11, 22, 34, 0.92));
  color: #ecf6ff;
  min-height: 34px;
  padding: 6px 10px;
}

.plan-type-conversion-modal .save-workout-modal__actions {
  justify-content: flex-start;
}

.plan-type-conversion-modal .modal-btn--cancel {
  border: 1px solid #64748b;
  background: #64748b;
  color: #ffffff;
}

.plan-type-conversion-modal .modal-btn--cancel:hover {
  background: #475569;
  border-color: #475569;
}

.plan-type-conversion-modal__message {
  margin: 10px 18px 0;
  color: #bfdbfe;
  font-size: 0.82rem;
  line-height: 1.4;
}

.plan-type-conversion-modal__message--error {
  color: #fecaca;
}

.plan-type-conversion-modal__preview {
  margin: 10px 18px 0;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(10, 18, 30, 0.48);
  display: grid;
  gap: 8px;
}

.plan-type-conversion-modal__preview-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #dbeafe;
  font-size: 0.82rem;
}

.plan-type-conversion-modal__preview-row strong {
  color: #f8fafc;
  text-align: right;
}

.plan-type-conversion-modal__list-wrap {
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  padding-top: 8px;
}

.plan-type-conversion-modal__list-wrap h4 {
  margin: 0 0 6px;
  color: #e2e8f0;
  font-size: 0.8rem;
  font-weight: 700;
}

.plan-type-conversion-modal__list-wrap ul {
  margin: 0;
  padding-left: 18px;
  color: #cbd5e1;
  display: grid;
  gap: 4px;
  font-size: 0.77rem;
  line-height: 1.35;
}

.plan-type-conversion-modal__list-wrap--error h4 {
  color: #fecaca;
}

.plan-type-conversion-modal__list-wrap--error ul {
  color: #fee2e2;
}

.publish-confirmation-modal {
  width: min(540px, 100%);
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
  overflow: hidden;
  animation: modalSlideIn 0.3s ease;
}

.publish-confirmation-modal__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.publish-confirmation-modal__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
  font-size: 1.25rem;
  font-weight: 800;
  flex-shrink: 0;
}

.publish-confirmation-modal__header h3 {
  margin: 0 0 6px;
  font-size: 1.12rem;
  font-weight: 800;
  color: #0f172a;
}

.publish-confirmation-modal__header p {
  margin: 0;
  color: #475569;
  font-size: 0.92rem;
  line-height: 1.5;
}

.publish-confirmation-modal__summary {
  padding: 12px 22px 0;
  display: grid;
  gap: 0;
}

.publish-confirmation-modal__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #e2e8f0;
  color: #475569;
  font-size: 0.92rem;
}

.publish-confirmation-modal__row:last-child {
  border-bottom: none;
}

.publish-confirmation-modal__row span {
  color: #475569;
}

.publish-confirmation-modal__row strong {
  color: #0f172a;
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}

.publish-confirmation-modal__actions {
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

.modal-btn--publish {
  border: 1px solid #16a34a;
  background: #16a34a;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
}

.modal-btn--publish:hover {
  background: #15803d;
  box-shadow: 0 6px 16px rgba(22, 163, 74, 0.3);
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

.wb-error-diag {
  margin-top: 8px;
}

.wb-error-diag--conversion {
  margin-top: 10px;
}

.wb-error-diag__toggle {
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(15, 23, 42, 0.2);
  color: #e2e8f0;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 0.74rem;
  cursor: pointer;
}

.wb-error-diag__text {
  margin: 6px 0 0;
  font-size: 0.74rem;
  color: #f8fafc;
  overflow-wrap: anywhere;
}

@media (max-width: 560px) {
  .save-workout-modal {
    width: min(100%, 420px);
  }

  .save-workout-modal--confirm .save-workout-modal__actions--confirm {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .save-workout-modal--confirm .save-workout-modal__actions--confirm > .modal-btn {
    width: 100%;
  }

  .save-workout-modal--confirm .save-workout-modal__actions-right {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .save-workout-modal--confirm .save-workout-modal__actions-right .modal-btn {
    width: 100%;
    min-width: 0;
    padding-left: 10px;
    padding-right: 10px;
  }

  .save-workout-modal__close {
    min-width: 28px;
    min-height: 28px;
  }

  .plan-type-conversion-modal .modal-btn {
    min-height: 44px;
  }

  .plan-type-conversion-modal__close {
    width: 36px;
    min-width: 36px;
    height: 36px;
    font-size: 1.45rem;
  }
}

.global-delete-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2100;
  padding: 16px;
}

.global-delete-modal {
  position: relative;
  width: min(100%, 430px);
  background: #101d35;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 18px;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.42);
  padding: 28px 24px 20px;
  color: #edf4ff;
  box-sizing: border-box;
  animation: modalSlideIn 0.24s ease;
}

.global-delete-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px !important;
  min-width: 28px !important;
  max-width: 28px !important;
  height: 28px !important;
  min-height: 28px !important;
  max-height: 28px !important;
  flex: 0 0 28px;
  border: 1px solid rgba(248, 113, 113, 0.62);
  border-radius: 5px;
  background: rgba(127, 29, 29, 0.88);
  color: #ffe4e9;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  line-height: 1;
  cursor: pointer;
}

.global-delete-modal-close:hover:not(:disabled) {
  background: rgba(127, 29, 29, 0.96);
  color: #ffffff;
}

.global-delete-modal-close i {
  font-size: 0.82rem;
}

.global-delete-modal-icon {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  background: rgba(220, 53, 69, 0.14);
  color: #ff6b7d;
  font-size: 1.7rem;
}

.global-delete-modal-title {
  margin: 0;
  text-align: center;
  font-size: 1.65rem;
  font-weight: 700;
  color: #ffffff;
}

.global-delete-modal-name {
  margin: 12px 0 10px;
  text-align: center;
  font-size: 1.02rem;
  font-weight: 700;
  color: #f8fbff;
  word-break: break-word;
}

.global-delete-modal-copy,
.global-delete-modal-warning {
  margin: 0;
  text-align: center;
  color: #ffffff;
  line-height: 1.55;
  font-size: 0.97rem;
}

.global-delete-modal-warning {
  margin-top: 10px;
  color: #ffd9a8;
  font-weight: 600;
}

.global-delete-modal-actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.global-delete-modal-cancel {
  min-width: 98px;
  background: rgba(148, 163, 184, 0.18) !important;
  border-color: rgba(148, 163, 184, 0.28) !important;
  color: #f6f9ff !important;
}

.global-delete-modal-confirm {
  min-width: 172px;
}

/* Responsive adjustments */
@media (max-width: 639px) {
  .workout-builder-page :deep(input),
  .workout-builder-page :deep(select),
  .workout-builder-page :deep(textarea),
  .workout-builder-page .planner-group-editor input {
    font-size: 16px;
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
}

.planner-empty p {
  margin: 0;
  max-width: 420px;
  color: #64748b;
  font-size: 0.92rem;
}

.planner-empty--compact {
  padding: 14px;
  border-radius: 10px;
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
  min-width: 0;
  box-sizing: border-box;
  margin-top: 0;
  width: 100%;
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
  width: auto;
  justify-self: end;
  border: 1px solid #15803d;
  border-radius: 6px;
  background: #16A34A;
  color: #fff;
  font-weight: 700;
  font-size: 0.82rem;
  padding: 0 14px;
  min-height: 36px;
}

.btn-save:disabled {
  opacity: 0.55;
}

/* ── 0.84.39 Workout Builder dark-theme normalization (scoped) ─────────── */
.workout-builder-page {
  --wb-surface-1: var(--wa-shell-surface, #121923);
  --wb-surface-2: var(--wa-shell-surface-elevated, #17212d);
  --wb-surface-3: var(--wa-shell-surface-soft, #1d2a38);
  --wb-border: var(--wa-shell-border, rgba(120, 145, 175, 0.16));
  --wb-border-strong: var(--wa-shell-border-strong, rgba(120, 145, 175, 0.28));
/* Tab Bar */
  --wb-text: var(--wa-shell-text, #f8fafc);
  --wb-text-secondary: var(--wa-shell-text-secondary, #a4b0c0);
  --wb-text-muted: var(--wa-shell-text-muted, #738196);
  --wb-accent: var(--wa-shell-accent, var(--main-color, #3b82f6));
}

.workout-builder-page .builder-hero.ff-page-header.app-header-gradient {
  background: linear-gradient(135deg, #0f2561 0%, #112463 42%, #1b2444 100%) !important;
  border: 1px solid var(--wb-border);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}

.workout-builder-page .builder-hero h2,
.workout-builder-page .builder-section__head h3,
.workout-builder-page .planner-heading-group h3,
.workout-builder-page .day-title-group strong,
.workout-builder-page .collapsible-header__text strong {
  color: var(--wb-text);
}

.workout-builder-page .builder-hero p,
.workout-builder-page .builder-section__head p,
.workout-builder-page .planner-heading-group p,
.workout-builder-page .exercise-count,
.workout-builder-page .collapsible-header__text small {
  color: var(--wb-text-secondary);
}

.workout-builder-page .builder-hero__stats div {
  background: rgba(15, 23, 35, 0.74);
  border: 1px solid var(--wb-border);
}

.workout-builder-page .builder-hero__stats strong {
  color: var(--wb-text);
}

.workout-builder-page .builder-hero__stats span {
  color: var(--wb-text-secondary);
}

.workout-builder-page .builder-tabs {
  background: var(--wb-surface-1);
  border-color: var(--wb-border);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.workout-builder-page .builder-tab {
  color: #ffffff;
  border-radius: 3px;
}

.workout-builder-page .builder-tab:hover:not(:disabled) {
  filter: brightness(1.08);
}

.workout-builder-page .plan-carousel__item {
  border-radius: 10px !important;
}

.workout-builder-page .builder-tab--active {
  background: unset;
  color: #ffffff;
  box-shadow: inset 0 -2px 0 #c8ddff, 0 0 0 1px rgba(196, 220, 255, 0.28);
  filter: brightness(1.2);
}

.workout-builder-page .builder-tab--create-tone {
  background: #0d5b55;
}

.workout-builder-page .builder-tab--ai-tone {
  background: #8f1f2a;
}

.workout-builder-page .builder-tab--view-tone {
  background: #3b5b8a;
}

.workout-builder-page .builder-tab--global-tone {
  background: #D97706;
}

/* Override shared wa-h-tabs !important active backgrounds so builder tab tones stay fixed by intent. */
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--create-tone,
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--create-tone[aria-selected="true"],
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--create-tone.wa-h-tab--active,
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--create-tone.active {
  background: #0d5b55 !important;
  color: #ffffff !important;
}

.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--ai-tone,
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--ai-tone[aria-selected="true"],
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--ai-tone.wa-h-tab--active,
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--ai-tone.active {
  background: #8f1f2a !important;
  color: #ffffff !important;
}

.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--global-tone,
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--global-tone[aria-selected="true"],
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--global-tone.wa-h-tab--active,
.workout-builder-page .wa-h-tabs .builder-tab.builder-tab--global-tone.active {
  background: #D97706 !important;
  color: #ffffff !important;
}

.global-plans-shell {
  gap: 12px;
}

.global-subtabs {
  width: min(460px, 100%);
}

.select-source-tabs {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 10px;
}

.marketplace-tab-label-short {
  display: none;
}

.select-source-tabs .select-source-tab {
  width: 100%;
  min-height: 30px;
  padding: 5px 8px;
  font-size: 0.74rem;
  gap: 6px;
  border-radius: 3px !important;
  justify-content: center;
  text-align: center;
  color: #ffffff;
}

.select-source-tabs .select-source-tab i {
  font-size: 0.74rem;
  color: #ffffff;
}

.select-source-tabs .select-source-tab--my {
  background: #1d4f9f !important;
  border: 1px solid rgba(147, 197, 253, 0.55);
}

.select-source-tabs .select-source-tab--marketplace {
  background: #ea7a1f !important;
  border: 1px solid rgba(254, 215, 170, 0.65);
}

.select-source-tabs .select-source-tab[aria-selected="false"] {
  filter: saturate(0.88) brightness(0.84);
}

.select-source-tabs .select-source-tab[aria-selected="true"] {
  filter: saturate(1) brightness(1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12) inset;
}

.plan-source-panel {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  text-align: left;
}

.marketplace-admin-tools {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  margin-bottom: 10px;
  padding: 7px 9px;
  border: 1px solid rgba(88, 124, 186, 0.42);
  border-radius: 5px;
  background: linear-gradient(180deg, rgba(15, 33, 62, 0.92), rgba(12, 25, 46, 0.96));
}

.marketplace-admin-tools__title {
  margin: 0 0 6px;
  color: #9fc0f7;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.marketplace-admin-tools__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: nowrap;
}

.marketplace-admin-tools__label-wrap {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.marketplace-admin-tools__label {
  color: #e7eefc;
  font-size: 0.78rem;
  font-weight: 700;
}

.marketplace-admin-tools__helper {
  color: #a9bddf;
  font-size: 0.68rem;
  line-height: 1.2;
}

.marketplace-admin-tools__toggle {
  border: 1px solid rgba(117, 146, 198, 0.42);
  background: #152038;
  border-radius: 5px;
  min-height: 28px;
  padding: 4px 8px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #c6d5ee;
  font-size: 0.72rem;
  font-weight: 800;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.marketplace-admin-tools__toggle:hover,
.marketplace-admin-tools__toggle:focus-visible {
  border-color: rgba(144, 186, 255, 0.72);
  background: #162648;
  outline: none;
}

.marketplace-admin-tools__toggle--off {
  border-color: rgba(129, 145, 174, 0.46);
  background: #1a2338;
  color: #b9c8e2;
}

.marketplace-admin-tools__toggle--on {
  border-color: #14b8a6;
  background: #0f766e;
  color: #ffffff;
}

.marketplace-admin-tools__toggle-track {
  width: 32px;
  height: 18px;
  border-radius: 999px;
  background: #3b4d73;
  border: 1px solid rgba(148, 163, 184, 0.4);
  position: relative;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.marketplace-admin-tools__toggle-track--on {
  background: #0f766e;
  border-color: #14b8a6;
}

.marketplace-admin-tools__toggle-thumb {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #f8fafc;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.18s ease;
}

.marketplace-admin-tools__toggle-track--on .marketplace-admin-tools__toggle-thumb {
  transform: translateX(14px);
}

.marketplace-admin-tools__toggle-value {
  min-width: 24px;
  text-align: right;
}

.marketplace-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  margin-bottom: 10px;
}

.marketplace-search-field {
  position: relative;
  flex: 1 1 auto;
  max-width: none;
  min-width: 0;
  margin: 0;
}
.marketplace-results-count {
  margin: -2px 0 8px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #d2e2fb;
}

.marketplace-search-field__icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #95a8c8;
  font-size: 0.8rem;
  pointer-events: none;
}

.marketplace-search-field__input {
  width: 100%;
  min-height: 38px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: #17213a;
  color: #ffffff;
  padding: 8px 38px 8px 40px;
  font-size: 0.84rem;
  line-height: 1.2;
}

.marketplace-search-field__input::placeholder {
  color: #9eb1cf;
}

.marketplace-search-field__input:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.75);
  box-shadow: 0 0 0 0.18rem rgba(37, 99, 235, 0.2);
}

.marketplace-search-field__clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.18);
  color: #f8fafc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.marketplace-search-field__clear:hover,
.marketplace-search-field__clear:focus-visible {
  background: rgba(96, 165, 250, 0.3);
  outline: none;
}

.marketplace-search-empty__clear {
  background: #17213a;
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 5px;
  min-height: 30px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 700;
}

.marketplace-search-empty__clear:hover,
.marketplace-search-empty__clear:focus-visible {
  background: #1d2b4f;
  border-color: rgba(96, 165, 250, 0.6);
  color: #ffffff;
}

.marketplace-search-empty__actions {
  margin-top: 8px;
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.marketplace-filters-toggle {
  min-height: 38px;
  min-width: 98px;
  border-radius: 8px;
  border: 1px solid rgba(145, 160, 200, 0.28);
  background: #17213a;
  color: #dbe8ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: none;
  flex: 0 0 auto;
}

.marketplace-filters-toggle:hover,
.marketplace-filters-toggle:focus-visible {
  background: #1d2b4f;
  border-color: rgba(145, 160, 200, 0.4);
  color: #ffffff;
  outline: none;
}

.marketplace-filters-toggle[aria-expanded='true'] {
  background: #1d4f9f;
  border-color: rgba(160, 197, 255, 0.75);
  color: #ffffff;
}

.marketplace-filters-toggle__icon {
  font-size: 0.9rem;
}

.marketplace-filters-toggle__count {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.marketplace-filters-panel {
  margin-bottom: 10px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: #0f1b32;
}

.marketplace-filters-panel__header {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.marketplace-filters-panel__grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 8px;
}

.marketplace-filter-field {
  display: grid;
  gap: 4px;
}

.marketplace-filter-field > span {
  color: #e7eefc;
  font-size: 0.72rem;
  font-weight: 700;
}

.marketplace-filter-field select {
  min-height: 32px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: #17213a;
  color: #f8fafc;
  font-size: 0.76rem;
  padding: 5px 9px;
}

.marketplace-filter-field select:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.7);
  box-shadow: 0 0 0 0.16rem rgba(37, 99, 235, 0.18);
}

.marketplace-filter-field select:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.marketplace-filters-panel__summary {
  margin: 0;
  color: #c7d8f2;
  font-size: 0.72rem;
}

.marketplace-filters-panel__clear {
  min-height: 28px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: #17213a;
  color: #f8fafc;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 9px;
}

.marketplace-filters-panel__clear:hover,
.marketplace-filters-panel__clear:focus-visible {
  background: #1d2b4f;
  border-color: rgba(96, 165, 250, 0.6);
  color: #ffffff;
  outline: none;
}

.marketplace-filters-panel__clear:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.global-subtabs .builder-subtab {
  min-height: 30px;
  padding: 5px 8px;
  font-size: 0.74rem;
  gap: 6px;
  border-radius: 3px !important;
}

.global-subtabs .builder-subtab i {
  font-size: 0.74rem;
  color: #ffffff;
}

.global-subtabs .builder-subtab--global:not(.wa-h-tab--active):not(.active):not([aria-selected="true"]) {
  background: #1d4f9f !important;
}

.global-subtabs .builder-subtab--user:not(.wa-h-tab--active):not(.active):not([aria-selected="true"]) {
  background: #0d5b55 !important;
}

.global-subtab-panel {
  margin-top: 4px;
  text-align: left;
}

.global-subtab-panel p {
  margin: 0;
}

.global-plans-embed {
  display: grid;
  gap: 10px;
}

.global-plans-embed__head {
  display: flex;
  justify-content: flex-start;
}

.global-plans-embed__add {
  border-radius: 3px !important;
  background: #2563eb;
  border: 1px solid #1d4ed8;
  color: #ffffff;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 5px 10px;
}

.global-plans-embed__feedback {
  font-size: 0.8rem;
  padding: 6px 8px;
  border-radius: 3px;
}

.global-plans-embed__feedback--error {
  color: #7f1d1d;
  background: #fee2e2;
  border: 1px solid #fecaca;
}

.global-plans-embed__feedback--ok {
  color: #14532d;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
}

.global-plans-table th,
.global-plans-table td {
  font-size: 0.78rem;
  white-space: nowrap;
}

.global-plans-table__th-icon {
  margin-right: 6px;
}

.global-plans-table__actions {
  display: inline-flex;
  gap: 6px;
  max-width: 100%;
}

.global-library-table .global-plans-table__actions {
  flex-wrap: nowrap;
  justify-content: flex-end;
}

.global-library-table__actions-col,
.global-library-table__actions-cell {
  width: 130px;
}

.global-library-table .global-plans-table__actions--icon-only {
  gap: 5px;
  align-items: center;
}

.global-library-table .global-plans-table__actions--icon-only .global-plans-table__btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border-radius: 4px !important;
  justify-content: center;
  align-items: center;
  gap: 0;
}

.global-library-table .global-plans-table__actions--icon-only .global-plans-table__btn i {
  font-size: 0.8rem;
}

.global-plans-table__btn {
  border-radius: 3px !important;
  min-height: 28px;
  padding: 4px 8px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #ffffff;
  border: 1px solid transparent;
}

.global-plans-table__btn--open {
  background: #2563eb;
  border-color: #1d4ed8;
}

.global-plans-table__btn--edit {
  background: #0d5b55;
  border-color: #0f766e;
}

.global-plans-table__btn--delete {
  background: #8f1f2a;
  border-color: #b91c1c;
}

.global-library-table-wrap {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  background: #0f1b32;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 5px;
  padding: 10px;
}

.global-library-table-scroll {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
}

.global-library-table {
  --bs-table-bg: transparent;
  --bs-table-color: #e7eefc;
  --bs-table-border-color: rgba(148, 163, 184, 0.24);
  margin: 0;
  min-width: 720px;
}

.global-library-table thead th {
  color: #ffffff;
  border-bottom: 1px solid rgba(148, 163, 184, 0.32);
  font-size: 0.79rem;
  font-weight: 700;
  white-space: nowrap;
  padding: 8px 10px;
}

.global-library-table tbody td {
  color: #e7eefc;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 0.78rem;
  white-space: nowrap;
  padding: 8px 10px;
}

.marketplace-status-badges {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.marketplace-status-badges--table {
  justify-content: center;
}

.marketplace-status-badges--mobile {
  margin-top: -2px;
}

.marketplace-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 7px;
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.marketplace-status-badge--draft {
  background: #c97716;
}

.marketplace-status-badge--published {
  background: #0f766e;
}

.marketplace-status-badge--featured {
  background: #2563eb;
}

.marketplace-status-empty {
  color: #a9bddf;
  font-size: 0.74rem;
}

.marketplace-plan-name-cell {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.marketplace-plan-name-content {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.marketplace-plan-inline-status {
  color: #a9bddf;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.marketplace-plan-thumb {
  width: 52px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.36);
  object-fit: cover;
  background: #1f2937;
  flex: 0 0 auto;
}

.global-library-mobile-list {
  display: none;
  gap: 8px;
}

.global-library-mobile-card {
  background: #0f1b32;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 5px;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.global-library-mobile-card__cover {
  width: 100%;
  height: 142px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  object-fit: cover;
  background: #1f2937;
}

.global-library-mobile-card__name {
  margin: 0;
  color: #ffffff;
  font-weight: 800;
  font-size: 0.9rem;
  line-height: 1.3;
  word-break: break-word;
}

.global-library-mobile-card__meta {
  display: grid;
  gap: 3px;
  color: #e7eefc;
  font-size: 0.76rem;
}

.global-library-mobile-card__meta strong {
  color: #ffffff;
}

.global-library-mobile-card__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
}
.global-library-mobile-card__actions--manage {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.global-library-mobile-card__actions .global-plans-table__btn {
  justify-content: center;
}

.global-library-inline-preview {
  width: 100%;
  background: #0f1b32;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 6px;
  padding: 12px;
  display: grid;
  gap: 10px;
  overflow: hidden;
}

.global-library-inline-preview__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.global-library-inline-preview__title {
  margin: 0;
  color: #ffffff;
  font-size: 1.04rem;
  font-weight: 800;
}

.global-library-inline-preview__error {
  margin: 0;
  color: #fecaca;
  background: rgba(127, 29, 29, 0.34);
  border: 1px solid rgba(248, 113, 113, 0.45);
  border-radius: 6px;
  padding: 10px;
  font-size: 0.84rem;
}

.global-library-inline-preview__loading {
  margin: 0;
}

.global-library-inline-preview__body {
  display: grid;
  gap: 12px;
}

.global-library-inline-preview__overview {
  display: grid;
  grid-template-columns: minmax(0, 230px) minmax(0, 1fr);
  gap: 12px;
}

.global-library-inline-preview__cover {
  width: 100%;
  height: 168px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  object-fit: cover;
  background: #1f2937;
}

.global-library-inline-preview__summary {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.global-library-inline-preview__name {
  margin: 0;
  color: #f8fbff;
  font-size: 1.02rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.global-library-inline-preview__description {
  margin: 0;
  color: rgba(225, 234, 247, 0.9);
  line-height: 1.45;
  font-size: 0.84rem;
  overflow-wrap: anywhere;
}

.global-library-inline-preview__meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.global-library-inline-preview__meta-grid > div {
  background: rgba(15, 23, 42, 0.42);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 5px;
  padding: 7px 8px;
  display: grid;
  gap: 3px;
}

.global-library-inline-preview__meta-grid span {
  color: rgba(225, 234, 247, 0.74);
  font-size: 0.7rem;
  line-height: 1.2;
}

.global-library-inline-preview__meta-grid strong {
  color: #f8fbff;
  font-size: 0.83rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.global-library-inline-preview__focus-block {
  margin-top: 2px;
  display: grid;
  gap: 8px;
}

.global-library-inline-preview__focus-item {
  background: rgba(15, 23, 42, 0.42);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 5px;
  padding: 7px 8px;
  display: grid;
  gap: 4px;
}

.global-library-inline-preview__focus-item h5 {
  margin: 0;
  color: #d8e7ff;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.global-library-inline-preview__focus-item p {
  margin: 0;
  color: #f8fbff;
  font-size: 0.78rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.global-library-inline-preview__schedule {
  display: grid;
  gap: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.24);
  padding-top: 10px;
}

.global-library-inline-preview__schedule-title {
  margin: 0;
  color: #e8f0ff;
  font-size: 0.9rem;
  font-weight: 800;
}

.global-library-inline-preview__day {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 5px;
  background: #101f3a;
  padding: 9px;
  display: grid;
  gap: 8px;
}

.global-library-inline-preview__day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.global-library-inline-preview__day-head h5 {
  margin: 0;
  color: #f8fbff;
  font-size: 0.86rem;
  font-weight: 800;
}

.global-library-inline-preview__day-head span {
  color: #cbd9f4;
  font-size: 0.74rem;
  font-weight: 700;
}

.global-library-inline-preview__day-table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 5px;
}

.global-library-inline-preview__day-table {
  --bs-table-bg: transparent;
  --bs-table-color: #e7eefc;
  --bs-table-border-color: rgba(148, 163, 184, 0.2);
  margin: 0;
  min-width: 660px;
}

.global-library-inline-preview__day-table thead th {
  background: rgba(30, 58, 138, 0.22);
  color: #f8fbff;
  font-size: 0.74rem;
  white-space: nowrap;
  padding: 7px 8px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
}

.global-library-inline-preview__day-table tbody td {
  color: #e7eefc;
  font-size: 0.74rem;
  padding: 7px 8px;
  white-space: nowrap;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.global-library-inline-preview__image-col {
  width: 52px;
}

.global-library-inline-preview__image-cell {
  width: 52px;
  min-width: 52px;
  max-width: 52px;
}

.global-library-inline-preview__exercise-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: #1f2937;
  display: block;
}

.global-library-inline-preview__exercise-cell {
  min-width: 190px;
}

.global-library-inline-preview__exercise-name {
  display: inline-block;
  overflow-wrap: anywhere;
}

.global-library-inline-preview__empty-day {
  margin: 0;
  color: #c9d8f2;
  font-size: 0.78rem;
}

.global-library-inline-preview__day-cards {
  display: none;
}

.global-library-inline-preview__exercise-card {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 5px;
  background: rgba(15, 23, 42, 0.4);
  padding: 8px;
  display: grid;
  gap: 6px;
}

.global-library-inline-preview__exercise-card h6 {
  margin: 0;
  color: #f8fbff;
  font-size: 0.79rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.global-library-inline-preview__exercise-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.global-library-inline-preview__exercise-card-head h6 {
  min-width: 0;
}

.global-library-inline-preview__exercise-card-grid {
  display: grid;
  gap: 3px;
  color: #d7e4fb;
  font-size: 0.73rem;
}

.global-library-inline-preview__exercise-card-grid strong {
  color: #ffffff;
}

@media (max-width: 768px) {
  .existing-plans-panel {
    gap: 8px;
  }

  .existing-plans-panel__head {
    margin-bottom: 0;
  }

  .existing-plans-panel__source-line {
    font-size: 0.76rem;
    gap: 4px;
  }

  .select-source-tabs {
    width: 100%;
    margin-bottom: 6px;
    gap: 6px;
  }

  .select-source-tabs .select-source-tab {
    min-height: 28px;
    padding: 4px 6px;
    font-size: 0.7rem;
    min-width: 0;
  }

  .select-source-tabs .select-source-tab span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .marketplace-tab-label-full {
    display: none;
  }

  .marketplace-tab-label-short {
    display: inline;
  }

  .plan-source-panel {
    min-width: 0;
    overflow-x: clip;
  }

  .existing-plans-panel:has(.select-source-tab--marketplace[aria-selected="true"]) .existing-plans-panel__head {
    display: none;
  }

  .marketplace-toolbar {
    align-items: center;
    row-gap: 6px;
    flex-wrap: wrap;
  }

  .marketplace-search-field {
    order: 1;
    flex: 1 1 calc(100% - 108px);
    max-width: none;
    min-width: 0;
  }

  .marketplace-filters-toggle {
    order: 2;
    width: auto;
    min-width: 92px;
    min-height: 36px;
    margin-left: 0;
    padding: 7px 10px;
    flex: 0 0 auto;
  }

  .marketplace-admin-tools__row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .marketplace-admin-tools__label-wrap {
    width: 100%;
  }

  .marketplace-admin-tools__label {
    min-width: 0;
    font-size: 0.75rem;
    line-height: 1.25;
  }

  .marketplace-admin-tools__helper {
    font-size: 0.66rem;
  }

  .marketplace-admin-tools__toggle {
    flex: 0 0 auto;
  }

  .marketplace-search-field__input {
    min-height: 36px;
    padding-top: 7px;
    padding-bottom: 7px;
  }

  .marketplace-results-count {
    margin: -2px 0 6px;
    font-size: 0.72rem;
  }

  .marketplace-filters-panel__header {
    align-items: center;
  }

  .marketplace-filters-panel__clear {
    width: auto;
  }

  .global-library-table-wrap {
    display: none;
  }

  .global-library-mobile-list {
    display: grid;
  }

  .global-library-mobile-card {
    gap: 7px;
    padding: 9px;
  }

  .plan-cover-panel__content {
    gap: 8px;
  }

  .plan-cover-main-row {
    gap: 10px;
  }

  .plan-cover-preview {
    height: 120px;
  }

  .plan-cover-preview-wrap {
    width: 120px;
  }

  .plan-cover-actions {
    justify-items: stretch;
    width: min(156px, 100%);
  }

  .plan-cover-actions-desktop {
    display: grid;
  }

  .global-library-mobile-card__name {
    overflow-wrap: anywhere;
  }

  .global-library-mobile-card__actions .global-plans-table__btn {
    min-height: 30px;
    padding: 4px 6px;
    font-size: 0.72rem;
    gap: 4px;
  }

  .global-library-mobile-card__actions .global-plans-table__btn span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .global-library-inline-preview {
    padding: 9px;
    gap: 8px;
  }

  .global-library-inline-preview__actions {
    width: 100%;
  }

  .global-library-inline-preview__actions .global-plans-table__btn {
    flex: 1 1 calc(50% - 4px);
    justify-content: center;
    min-height: 32px;
  }

  .global-library-inline-preview__overview {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .global-library-inline-preview__cover {
    height: 158px;
  }

  .global-library-inline-preview__meta-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .global-library-inline-preview__day-table-wrap {
    display: none;
  }

  .global-library-inline-preview__day-cards {
    display: grid;
    gap: 7px;
  }

  .global-library-inline-preview__exercise-card-head {
    align-items: flex-start;
  }

  .global-library-inline-preview__exercise-thumb {
    flex: 0 0 auto;
  }
}

@media (min-width: 560px) and (max-width: 768px) {
  .marketplace-filters-panel__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 992px) {
  .marketplace-filters-panel__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1200px) {
  .main-builder-accordion__body {
    overflow-x: clip;
  }

  .marketplace-toolbar {
    flex-wrap: wrap;
  }

  .marketplace-search-field {
    flex: 1 1 260px;
  }

  .marketplace-filters-toggle {
    flex: 0 0 auto;
  }
}


.workout-builder-page .builder-tab:disabled {
  opacity: 0.5;
}

.workout-builder-page .builder-section,
.workout-builder-page .planner-section,
.workout-builder-page .collapsible-panel,
.workout-builder-page .ai-suggest-section,
.workout-builder-page .plan-carousel,
.workout-builder-page .planner-shell,
.workout-builder-page .main-builder-accordion__item,
.workout-builder-page .main-builder-accordion__header,
.workout-builder-page .main-builder-accordion__icon,
.workout-builder-page .main-builder-accordion__body,
.workout-builder-page .select-plan-accordion__item,
.workout-builder-page .select-plan-accordion__header,
.workout-builder-page .select-plan-accordion__icon,
.workout-builder-page .builder-footer,
.workout-builder-page .planner-empty,
.workout-builder-page .builder-empty,
.workout-builder-page .schedule-hub-empty,
.workout-builder-page .workout-day-panel,
.workout-builder-page .collapsible-header,
.workout-builder-page .planner-mode-toggle,
.workout-builder-page .planner-group-editor input,
.workout-builder-page .planner-helper-text,
.workout-builder-page .delete-modal {
  background: var(--wb-surface-1);
  border-color: var(--wb-border);
  color: var(--wb-text);
}

.workout-builder-page .collapsible-header,
.workout-builder-page .planner-mode-toggle,
.workout-builder-page .workout-day-header:hover,
.workout-builder-page .planner-helper-text,
.workout-builder-page .builder-footer {
  background: var(--wb-surface-2);
}

.workout-builder-page .workout-day-card {
  border-color: #38517C;
}

.workout-builder-page .workout-day-card.active {
  border-color: #4772BA;
  box-shadow: none;
}

.workout-builder-page .main-builder-accordion__header:hover {
  background: var(--wb-surface-3);
}

.workout-builder-page .planner-empty__icon,
.workout-builder-page .collapsible-header__icon {
  background: var(--wb-surface-3);
  border-color: var(--wb-border);
  color: var(--wb-text-secondary);
}

.workout-builder-page .planner-empty h4,
.workout-builder-page .save-message,
.workout-builder-page .planner-group-editor input,
.workout-builder-page .planner-mode-btn,
.workout-builder-page .planner-group-add,
.workout-builder-page .planner-group-save,
.workout-builder-page .planner-helper-text,
.workout-builder-page .empty-day-state p,
.workout-builder-page .modal-btn--cancel,
.workout-builder-page .delete-modal__body p,
.workout-builder-page .delete-modal__body strong,
.workout-builder-page .delete-modal__header h3 {
  color: var(--wb-text);
}

.workout-builder-page .planner-empty p,
.workout-builder-page .planner-feedback,
.workout-builder-page .exercise-count {
  color: var(--wb-text-secondary);
}

.workout-builder-page .plan-carousel__header h4,
.workout-builder-page .plan-carousel__selected strong {
  color: var(--wb-text);
}

.workout-builder-page .workout-day-header,
.workout-builder-page .workout-day-header:hover,
.workout-builder-page .workout-day-card.active .workout-day-header {
  background: linear-gradient(90deg, #172D68 0%, #202F58 50%, #2D3957 100%);
}
.workout-builder-page .existing-plans-panel__head h4 {
  color: var(--wb-text);
}

.workout-builder-page .plan-carousel__position,
.workout-builder-page .plan-carousel__selected,
.workout-builder-page .existing-plans-panel__head p {
  color: var(--wb-text-secondary);
}

.workout-builder-page .planner-feedback--error,
.workout-builder-page .save-message.err {
  color: #fca5a5;
}

.workout-builder-page .save-message.ok {
  color: #86efac;
}

.workout-builder-page .btn-create-plan,
.workout-builder-page .btn-create-plan {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-color: #1d4ed8;
  color: #ffffff;
  box-shadow: 0 6px 12px rgba(37, 99, 235, 0.2);
}

.workout-builder-page .btn-save {
  background: linear-gradient(135deg, #16A34A, #15803D);
  border-color: #15803d;
  color: #ffffff;
  box-shadow: 0 6px 12px rgba(22, 163, 74, 0.24);
}

.workout-builder-page .btn-create-plan:hover,
.workout-builder-page .btn-save:hover:not(:disabled) {
  background: linear-gradient(135deg, #15803D, #166534);
}

.workout-builder-page .btn-create-plan:hover {
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
}

.workout-builder-page .btn-ai-suggest {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  border-color: #b91c1c;
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(220, 38, 38, 0.22);
}

.workout-builder-page .btn-ai-suggest:hover {
  background: linear-gradient(135deg, #b91c1c, #991b1b);
}

.workout-builder-page .btn-add-exercise-day {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-color: #1d4ed8;
  color: #ffffff;
}

.workout-builder-page .btn-add-exercise-day:hover {
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
}

.workout-builder-page .day-action-btn--move,
.workout-builder-page .day-action-btn--reset,
.workout-builder-page .day-action-btn--select,
.workout-builder-page .plan-carousel__item,
.workout-builder-page .plan-carousel__nav,
.workout-builder-page .planner-mode-btn,
.workout-builder-page .modal-btn--cancel,
.workout-builder-page .day-kebab-btn,
.workout-builder-page .day-kebab-menu,
.workout-builder-page .day-kebab-item {
  background: var(--wb-surface-2);
  border-color: var(--wb-border);
  color: var(--wb-text-secondary);
}

.workout-builder-page .day-action-btn--move:hover:not(:disabled),
.workout-builder-page .day-action-btn--reset:hover:not(:disabled),
.workout-builder-page .day-action-btn--select:hover,
.workout-builder-page .modal-btn--cancel:hover,
.workout-builder-page .day-kebab-btn:hover,
.workout-builder-page .day-kebab-item:hover {
  background: var(--wb-surface-3);
  color: var(--wb-text);
}

.workout-builder-page .planner-mode-btn.active,
.workout-builder-page .day-action-btn--selected,
.workout-builder-page .plan-carousel__item--selected,
.workout-builder-page .plan-carousel__dot--active,
.workout-builder-page .selected-badge {
  background: color-mix(in srgb, var(--wb-accent) 24%, transparent 76%);
  border-color: color-mix(in srgb, var(--wb-accent) 50%, transparent 50%);
  color: color-mix(in srgb, var(--wb-accent) 78%, #ffffff 22%);
}

.workout-builder-page .plan-carousel__dot {
  background: var(--wb-surface-3);
  border-color: var(--wb-border);
}

.workout-builder-page .day-action-btn--edit {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-color: #1d4ed8;
  color: #ffffff;
}

.workout-builder-page .day-action-btn--edit:hover {
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
}

.workout-builder-page .day-action-btn--delete,
.workout-builder-page .day-kebab-item--delete,
.workout-builder-page .modal-btn--delete {
  background: rgba(127, 29, 29, 0.2);
  border-color: rgba(248, 113, 113, 0.55);
  color: #fca5a5;
}

.workout-builder-page .day-action-btn--delete:hover:not(:disabled),
.workout-builder-page .day-kebab-item--delete:hover,
.workout-builder-page .modal-btn--delete:hover {
  background: rgba(127, 29, 29, 0.3);
  color: #fecaca;
}

.workout-builder-page .day-kebab-item,
.workout-builder-page .day-kebab-item:hover,
.workout-builder-page .day-kebab-item--delete,
.workout-builder-page .day-kebab-item--delete:hover,
.workout-builder-page .day-kebab-item:disabled {
  border-radius: 0 !important;
  color: #ffffff;
}

.workout-builder-page .delete-modal__header,
.workout-builder-page .delete-modal__actions,
.workout-builder-page .workout-day-panel,
.workout-builder-page .delete-modal {
  border-color: var(--wb-border);
}

.workout-builder-page .empty-day-state {
  background: var(--wb-surface-2);
  border-color: var(--wb-border-strong);
}

.workout-builder-page :deep(.schedule-card),
.workout-builder-page :deep(.planner-card),
.workout-builder-page :deep(.exercise-block),
.workout-builder-page :deep(.workout-goal-panel),
.workout-builder-page :deep(.workout-goal-panel__header),
.workout-builder-page :deep(.workout-goal-panel__icon),
.workout-builder-page :deep(.exercise-block__actions button),
.workout-builder-page :deep(.exercise-block__fields input),
.workout-builder-page :deep(.exercise-block__fields select),
.workout-builder-page :deep(.builder-field input),
.workout-builder-page :deep(.builder-field select),
.workout-builder-page :deep(.builder-field textarea),
.workout-builder-page :deep(.schedule-btn--ghost),
.workout-builder-page :deep(.schedule-btn--danger) {
  background: var(--wb-surface-2);
  border-color: var(--wb-border);
  color: var(--wb-text-secondary);
}

.workout-builder-page :deep(.schedule-card.selected) {
  border-color: color-mix(in srgb, var(--wb-accent) 60%, var(--wb-border) 40%);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--wb-accent) 20%, transparent 80%);
}

.workout-builder-page :deep(.schedule-card__title-row h4),
.workout-builder-page :deep(.exercise-block__identity h4),
.workout-builder-page :deep(.builder-field span),
.workout-builder-page :deep(.workout-goal-panel__title),
.workout-builder-page :deep(.schedule-card__meta strong),
.workout-builder-page :deep(.exercise-block__fields span) {
  color: var(--wb-text);
}

.workout-builder-page :deep(.schedule-card__meta),
.workout-builder-page :deep(.exercise-block__identity p),
.workout-builder-page :deep(.workout-goal-panel__title-icon),
.workout-builder-page :deep(.workout-goal-panel__icon),
.workout-builder-page :deep(.exercise-block__badge),
.workout-builder-page :deep(.type-badge--other) {
  color: var(--wb-text-secondary);
}

.workout-builder-page :deep(.exercise-block__identity img) {
  border-color: var(--wb-border);
  background: var(--wb-surface-3);
}

.workout-builder-page :deep(.schedule-btn--ghost) {
  color: var(--wb-text);
}

.workout-builder-page :deep(.schedule-btn--ghost:hover) {
  background: var(--wb-surface-3);
}

.workout-builder-page :deep(.schedule-btn--primary) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-color: #1d4ed8;
  color: #ffffff;
}

.workout-builder-page :deep(.schedule-btn--danger) {
  background: rgba(127, 29, 29, 0.2);
  border-color: rgba(248, 113, 113, 0.55);
  color: #fca5a5;
}

.workout-builder-page :deep(.schedule-btn--danger:hover:not(:disabled)) {
  background: rgba(127, 29, 29, 0.3);
}

.workout-builder-page :deep(.exercise-block__actions .btn-remove) {
  background: rgba(127, 29, 29, 0.2);
  border-color: rgba(248, 113, 113, 0.55);
  color: #fca5a5;
}

.workout-builder-page :deep(.builder-field input:focus),
.workout-builder-page :deep(.builder-field select:focus),
.workout-builder-page :deep(.builder-field textarea:focus),
.workout-builder-page :deep(.exercise-block__fields input:focus),
.workout-builder-page :deep(.exercise-block__fields select:focus),
.workout-builder-page .builder-tab:focus-visible,
.workout-builder-page .btn-create-plan:focus-visible,
.workout-builder-page .btn-ai-suggest:focus-visible,
.workout-builder-page .btn-save:focus-visible,
.workout-builder-page .day-action-btn:focus-visible,
.workout-builder-page :deep(.schedule-btn:focus-visible) {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--wb-accent) 30%, transparent 70%);
}

@media (max-width: 768px) {
  .workout-builder-page :deep(input),
  .workout-builder-page :deep(select),
  .workout-builder-page :deep(textarea),
  .workout-builder-page .planner-group-editor input {
    font-size: 16px;
  }

  .planner-header-row {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
  }

  .planner-header-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .planner-primary-actions {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .planner-primary-actions__status,
  .planner-primary-actions__cancel,
  .planner-primary-actions__save {
    width: 100%;
    justify-content: center;
  }

  .planner-primary-actions__controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .plan-info-action-row {
    margin: 0 0 12px;
    justify-content: stretch;
    flex-wrap: wrap;
  }

  .plan-info-action-row__back,
  .plan-info-action-row__save {
    width: 100%;
    justify-content: center;
  }

  .planner-mode-pill-wrap {
    margin-left: 0;
    justify-content: flex-start;
  }

  .planner-group-editor {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 6px;
  }

  .planner-group-editor__label {
    grid-column: 1 / -1;
  }

  .planner-group-editor input {
    grid-column: 1;
  }

  .planner-group-add {
    grid-column: 2;
    width: auto;
  }
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
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
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
    min-width: 160px;
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

/* ── Tab label responsive toggle ────────────────────────────────── */
.tab-label-short { display: none; }

.workout-builder-page .select-plan-accordion__item.open {
  border-color: color-mix(in srgb, var(--wb-accent) 55%, var(--wb-border) 45%);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
}

@media (max-width: 639px) {
  .tab-label-full  { display: none; }
  .tab-label-short { display: inline; }

  .main-builder-accordion {
    gap: 8px;
  }

  .main-builder-accordion__header {
    min-height: 48px;
    padding: 0 12px;
  }

  .main-builder-accordion__title {
    font-size: 0.9rem;
  }

  .main-builder-accordion__body {
    padding: 10px;
  }
}

/* ── AI Suggest section ──────────────────────────────────────────── */
.ai-suggest-section {
  min-height: 220px;
  display: block;
}

.ai-suggest-body {
  width: 100%;
  display: grid;
  gap: 10px;
}

.ai-suggest-card {
  background: var(--wb-surface-2);
  border: 1px solid var(--wb-border);
  border-radius: 16px;
  padding: 14px;
  display: grid;
  gap: 10px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}

.ai-prompt-label {
  font-weight: 700;
  color: var(--wb-text);
  font-size: 0.9rem;
}

.ai-prompt-input {
  width: 100%;
  border: 1px solid var(--wb-border);
  border-radius: 12px;
  padding: 10px 12px;
  min-height: 96px;
  resize: vertical;
  font: inherit;
  color: var(--wb-text);
  background: var(--wb-surface-1);
}

.ai-actions {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.ai-test-btn {
  background: linear-gradient(135deg, #0f766e, #115e59);
  border-color: #99f6e4;
}

.ai-feedback {
  background: var(--wb-surface-2);
  border: 1px solid var(--wb-border);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 0.92rem;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--wb-text-secondary);
}

.ai-feedback--error {
  border-color: rgba(248, 113, 113, 0.55);
  color: #fecaca;
}

.ai-feedback--success {
  border-color: rgba(134, 239, 172, 0.42);
  color: #bbf7d0;
}

.ai-feedback--hint {
  border-color: color-mix(in srgb, var(--wb-accent) 45%, transparent 55%);
  color: var(--wb-text-secondary);
}

.ai-generate-btn {
  border: 1px solid #93c5fd;
  border-radius: 12px;
  min-height: 46px;
  padding: 0 16px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.9rem;
  margin-top: 6px;
  cursor: pointer;
  box-shadow: none;
}

.ai-generate-btn:disabled {
  opacity: 0.7;
  cursor: wait;
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
    grid-template-columns: repeat(auto-fit, minmax(156px, 1fr));
    gap: 8px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .main-builder-accordion,
  .main-builder-accordion__item,
  .main-builder-accordion__body,
  .select-plan-accordion,
  .select-plan-accordion__body,
  .plan-carousel,
  .existing-plans-panel,
  .schedule-hub-list {
    min-width: 0;
    width: 100%;
    overflow-x: hidden;
  }

  .plan-carousel__footer {
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    align-items: center;
  }

  .plan-carousel__nav {
    width: auto;
    min-width: 78px;
    padding: 0 8px;
    min-height: 32px;
    font-size: 0.76rem;
  }

  .plan-carousel__dots {
    gap: 6px;
  }

  .plan-carousel__dot {
    width: 9px;
    height: 9px;
  }

  .btn-create-plan,
  .btn-ai-suggest {
    width: 100%;
    min-height: 42px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: 13px;
    line-height: 1;
  }

  /* Tab bar: 3 tabs fit without scrolling */
  .builder-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    overflow: visible;
    width: 100%;
  }
  .builder-tab {
    min-width: 0;
    font-size: 0.82rem;
    padding: 0 8px;
    white-space: normal;
    line-height: 1.15;
  }

  /* Hero stats: stay within the viewport */
  .builder-hero__stats {
    grid-template-columns: repeat(3, minmax(80px, 1fr));
  }
  .builder-hero__stats div,
  .builder-hero__stats span,
  .builder-hero__stats strong {
    min-width: 0;
    overflow-wrap: anywhere;
  }

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
  .workout-builder-page--create .main-builder-accordion,
  .workout-builder-page--create .main-builder-accordion__item,
  .workout-builder-page--create .main-builder-accordion__body,
  .workout-builder-page--create .planner-shell,
  .workout-builder-page--create .collapsible-panel {
    overflow: visible !important;
  }

  .workout-builder-page {
    padding-bottom: calc(128px + env(safe-area-inset-bottom));
    overflow-x: clip;
  }

  /* ── Canvas ── */
  .workout-builder-canvas {
    gap: 8px;
  }

  .main-builder-accordion {
    gap: 8px;
  }

  .main-builder-accordion__item {
    border-radius: 12px;
  }

  .main-builder-accordion__header {
    min-height: 44px;
    padding: 0 10px;
  }

  .main-builder-accordion__icon {
    width: 24px;
    height: 24px;
  }

  .main-builder-accordion__body {
    padding: 8px;
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
    border-radius: 3px;
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
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
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
    padding: 1px 7px;
    border: 1px solid rgba(96, 165, 250, 0.28);
    background: rgba(59, 130, 246, 0.16);
    color: #93c5fd;
  }

  .exercise-count {
    font-size: 11px;
  }

  /* Day actions — kebab on mobile */
  .day-actions {
    display: none;
  }

  .workout-day-header {
    flex-wrap: nowrap;
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

  .day-panel-actions--bottom {
    justify-content: stretch;
  }

  .day-panel-actions--bottom .btn-add-exercise-day {
    width: 100%;
  }

  .planner-bottom-group-actions__editor {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .planner-bottom-group-actions__editor input,
  .planner-bottom-group-actions__editor .planner-group-add {
    width: 100%;
  }

  /* ── Planner tools ── */
  .planner-tools {
    gap: 8px;
    margin-bottom: 10px;
  }

  .planner-mode-toggle,
  .planner-group-editor {
    max-width: 100%;
    min-width: 0;
  }

  .planner-header-row {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
  }

  .planner-mode-pill-wrap {
    margin-left: 0;
    justify-content: flex-start;
  }

  .planner-group-editor {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .planner-mode-btn {
    min-height: 36px;
    font-size: 0.82rem;
    padding: 4px 8px;
    min-width: 0;
  }

  .planner-group-editor input {
    min-height: 38px;
    padding: 7px 10px;
    font-size: 0.82rem;
    border-radius: 6px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    flex: initial;
  }

  .planner-group-editor__label {
    font-size: 0.72rem;
    grid-column: 1 / -1;
  }

  .planner-group-add,
  .planner-group-save {
    min-height: 38px;
    font-size: 0.82rem;
    padding: 0 12px;
    border-radius: 6px;
    max-width: 100%;
    min-width: 0;
  }

  .planner-group-add {
    width: auto;
    grid-column: 2;
  }

  /* ── Schedule list ── */
  .schedule-hub-list {
    gap: 8px;
  }

  /* ── Create/AI buttons ── */
  .btn-create-plan,
  .btn-ai-suggest {
    min-height: 42px;
    font-size: 13px;
    padding: 0 12px;
    border-radius: 999px;
    box-shadow: none;
  }

  /* ── Empty states ── */
  .planner-empty {
    padding: 16px 12px;
    min-height: 120px;
    gap: 6px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
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
    min-height: 42px;
    font-size: 13px;
    padding: 0 14px;
    width: 100%;
    justify-self: stretch;
  }

  /* ── Heading groups ── */
  .planner-header-row {
    display: grid;
    gap: 8px;
  }

  .planner-header-actions {
    display: grid;
    gap: 6px;
    width: 100%;
    justify-content: stretch;
  }

  .planner-mode-pill-wrap {
    display: grid;
    gap: 5px;
    justify-items: start;
  }

  .planner-save-top {
    width: 100%;
  }

  .planner-mode-label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #dfeaf9;
  }

  .planner-mode-toggle {
    display: inline-flex;
    padding: 4px;
    background: rgba(11, 22, 34, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 6px;
    gap: 4px;
    width: 100%;
  }

  .planner-mode-btn {
    border: 1px solid rgba(148, 163, 184, 0.34);
    border-radius: 5px;
    background: transparent;
    color: #ffffff;
    min-height: 34px;
    padding: 0 12px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .planner-mode-btn.active {
    background: #2563eb;
    color: #ffffff;
    border-color: #1d4ed8;
    box-shadow: none;
  }

  .planner-mode-btn:hover {
    color: #ffffff;
  }

  .planner-mode-btn.active:hover {
    color: #ffffff;
  }

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
    width: 100%;
    max-width: 100%;
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

.workout-builder-page--create .planner-shell {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.workout-builder-page--create .main-builder-accordion__body {
  overflow: visible;
}

@media (max-width: 600px) {
  .workout-builder-page {
    padding-bottom: calc(100px + var(--wa-mobile-bottom-nav-clearance, 0px));
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

  .day-action-btn,
  .btn-add-exercise-day,
  .planner-group-add,
  .planner-group-save,
  .btn-create-plan,
  .btn-ai-suggest,
  .btn-save {
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
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

/* 0.85.162-F final footer override: defeat legacy pill styles */
.workout-builder-page section[v-show="builderTab === 'create'"] + .builder-footer,
.workout-builder-page .builder-footer {
  border-radius: 0 !important;
}

.workout-builder-page .builder-footer .btn-save,
.workout-builder-page .btn-save {
  border-radius: 6px !important;
}

@media (max-width: 390px) {
  .workout-builder-page .builder-footer .btn-save,
  .workout-builder-page .btn-save {
    border-radius: 6px !important;
  }
}

/* 0.85.162-F Stage 1: compact segmented Day/Week toggle (Create tab only) */
.workout-builder-page .planner-mode-pill-wrap {
  gap: 3px;
}

.workout-builder-page .planner-mode-toggle {
  width: 220px;
  max-width: 100%;
  min-height: 36px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px;
  padding: 2px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 5px;
  background: #0f172a;
}

.workout-builder-page .planner-mode-btn {
  width: 100%;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: #0f172a;
  color: #ffffff;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: none;
}

.workout-builder-page .planner-mode-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
  box-shadow: none;
  outline: none;
}

.workout-builder-page .planner-mode-btn:focus,
.workout-builder-page .planner-mode-btn.active:focus {
  outline: none;
}

.workout-builder-page .planner-mode-btn:focus-visible,
.workout-builder-page .planner-mode-btn.active:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.65);
  outline-offset: 1px;
}

@media (max-width: 390px) {
  .workout-builder-page .planner-mode-toggle {
    width: min(220px, 100%);
  }

  .workout-builder-page .planner-mode-btn {
    min-height: 32px;
    font-size: 0.72rem;
  }
}

/* 0.85.162-F Stage 2: compact save footer layout (Create tab only) */
.workout-builder-page .builder-footer {
  width: 100%;
  margin-top: 4px;
  padding: 4px 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
  align-items: start;
  gap: 10px;
}

.workout-builder-page .builder-footer__status {
  min-width: 0;
}

.workout-builder-page .builder-footer__action {
  min-width: 0;
  display: flex;
  justify-content: flex-end;
}

.workout-builder-page .save-message {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.35;
}

.workout-builder-page .btn-save {
  min-height: 36px;
  border-radius: 6px;
  padding: 0 14px;
  width: auto;
  justify-self: end;
}

@media (max-width: 390px) {
  .workout-builder-page .builder-footer {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 6px 0;
    margin-bottom: calc(68px + env(safe-area-inset-bottom));
  }

  .workout-builder-page .builder-footer__action {
    justify-content: stretch;
  }

  .workout-builder-page .btn-save {
    width: 100%;
    min-height: 38px;
  }
}

/* 0.85.162-G: shared Select Goal blue standard for Workout Builder actions */
.workout-builder-page .wa-blue-action-btn {
  background: var(--wa-btn-primary);
  border-color: var(--wa-btn-primary-border);
  color: #ffffff;
}

.workout-builder-page .wa-blue-action-btn:hover:not(:disabled),
.workout-builder-page .wa-blue-action-btn:focus:not(:disabled),
.workout-builder-page .wa-blue-action-btn:active:not(:disabled) {
  background: var(--wa-btn-primary-hover);
  border-color: var(--wa-btn-primary-border);
  color: #ffffff;
}

.workout-builder-page .wa-blue-action-btn:focus-visible {
  box-shadow: var(--wa-btn-primary-focus);
}

.workout-builder-page .wa-green-action-btn {
  background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
  border-color: #15803d;
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(22, 163, 74, 0.18);
}

.workout-builder-page .wa-green-action-btn:hover:not(:disabled),
.workout-builder-page .wa-green-action-btn:focus:not(:disabled),
.workout-builder-page .wa-green-action-btn:active:not(:disabled) {
  background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
  border-color: #15803d;
  color: #ffffff;
}

.workout-builder-page .wa-green-action-btn:focus-visible {
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.28);
}

.workout-builder-page .planner-group-add,
.workout-builder-page .btn-add-exercise-day {
  background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
  border-color: #15803d;
  box-shadow: 0 8px 18px rgba(22, 163, 74, 0.18);
}

.workout-builder-page .planner-group-add:hover:not(:disabled),
.workout-builder-page .btn-add-exercise-day:hover:not(:disabled),
.workout-builder-page .planner-group-add:focus:not(:disabled),
.workout-builder-page .btn-add-exercise-day:focus:not(:disabled),
.workout-builder-page .planner-group-add:active:not(:disabled),
.workout-builder-page .btn-add-exercise-day:active:not(:disabled) {
  background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
  border-color: #15803d;
  color: #ffffff;
}

.workout-builder-page .planner-group-add:focus-visible,
.workout-builder-page .btn-add-exercise-day:focus-visible {
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.28);
}
</style>
