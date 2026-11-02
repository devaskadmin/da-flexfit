const WORKOUTATLAS_PLAN_FORMAT = 'workoutatlas.plan';
const WORKOUTATLAS_PLAN_SCHEMA_VERSION = 1;

const PLAN_TYPES = new Set([
  'featured',
  'community_shared',
  'global',
  'personal',
  'trainer_shared',
  'community',
  'marketplace',
]);

const PUBLICATION_STATUSES = new Set(['draft', 'active', 'archived', 'published', 'completed']);
const SCHEDULE_MODES = new Set(['day', 'week']);
const COVER_ASSET_REF_TYPES = new Set(['none', 'public_url', 'external_id']);

const FORBIDDEN_EXPORT_KEYS = new Set([
  'userId',
  'user_id',
  'password',
  'token',
  'session',
  'sessionId',
  'session_id',
  'cover_image_storage_key',
  'coverImageStorageKey',
]);

const KNOWN_PERSISTENCE_GAPS = Object.freeze([
  {
    path: 'template.schedule.exercises[].targets.calories',
    reason: 'No target_calories column in workout_schedule_exercises; value is currently UI-level only.',
  },
  {
    path: 'template.coverImage',
    reason: 'Current planner API does not persist/export a portable public cover reference; backend intentionally hides storage keys.',
  },
]);

function toTrimmedString(value) {
  return String(value == null ? '' : value).trim();
}

function toNullableString(value) {
  const normalized = toTrimmedString(value);
  return normalized || null;
}

function toFiniteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveIntegerOrNull(value) {
  const parsed = toFiniteNumberOrNull(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeScheduleMode(value) {
  return toTrimmedString(value).toLowerCase() === 'week' ? 'week' : 'day';
}

function normalizePlanType(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (!normalized) {
    return null;
  }
  return PLAN_TYPES.has(normalized) ? normalized : normalized;
}

function normalizePublicationStatus(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (!normalized) {
    return 'draft';
  }
  return PUBLICATION_STATUSES.has(normalized) ? normalized : 'draft';
}

function normalizeGroupLabel(value, fallbackLabel) {
  const normalized = toTrimmedString(value);
  return normalized || fallbackLabel;
}

function normalizeGroupList(groups, fallbackLabel) {
  const source = Array.isArray(groups) ? groups : [];
  const deduped = [];
  const seen = new Set();

  for (const item of source) {
    const label = toTrimmedString(item);
    if (!label) {
      continue;
    }
    const lower = label.toLowerCase();
    if (seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    deduped.push(label);
  }

  if (!deduped.length) {
    return [fallbackLabel];
  }

  return deduped;
}

function normalizeOrderedGroups(groupLabels, orderEntries) {
  const fallbackOrder = new Map();
  groupLabels.forEach((label, index) => {
    fallbackOrder.set(label.toLowerCase(), index + 1);
  });

  const explicitOrder = new Map();
  if (Array.isArray(orderEntries)) {
    orderEntries.forEach((entry, index) => {
      const label = toTrimmedString(entry && entry.label);
      if (!label) {
        return;
      }
      const parsedOrder = toPositiveIntegerOrNull(entry.sortOrder);
      explicitOrder.set(label.toLowerCase(), parsedOrder || index + 1);
    });
  }

  const sortedLabels = [...groupLabels].sort((left, right) => {
    const leftOrder = explicitOrder.get(left.toLowerCase()) || fallbackOrder.get(left.toLowerCase()) || Number.MAX_SAFE_INTEGER;
    const rightOrder = explicitOrder.get(right.toLowerCase()) || fallbackOrder.get(right.toLowerCase()) || Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return (fallbackOrder.get(left.toLowerCase()) || 0) - (fallbackOrder.get(right.toLowerCase()) || 0);
  });

  return sortedLabels.map((label, index) => ({
    label,
    order: index + 1,
  }));
}

function inferRecordingType(exercise = {}) {
  const workoutType = toTrimmedString(exercise.workoutType || exercise.WorkoutType).toLowerCase();
  const rawRecordingType = toTrimmedString(exercise.recordingType || exercise.RecordingType).toLowerCase();

  if (rawRecordingType.includes('time') || rawRecordingType.includes('distance')) {
    return 'time_distance';
  }
  if (rawRecordingType.includes('sets') || rawRecordingType.includes('reps')) {
    return 'sets_reps';
  }

  if (workoutType === 'cardio') {
    return 'time_distance';
  }

  const hasTimeOrDistance =
    toFiniteNumberOrNull(exercise.duration) != null ||
    toFiniteNumberOrNull(exercise.distance) != null ||
    toFiniteNumberOrNull(exercise.calories) != null;

  if (hasTimeOrDistance) {
    return 'time_distance';
  }

  return 'sets_reps';
}

function toPortableCoverImage(source = {}) {
  const directCover = toTrimmedString(source.coverImage);
  const metadataCover = toTrimmedString(source.metadata && source.metadata.coverImage);
  const candidate = directCover || metadataCover;

  if (!candidate) {
    return {
      assetRefType: 'none',
      uri: null,
      mediaType: null,
    };
  }

  const isPublicUrl = /^https?:\/\//i.test(candidate);
  if (isPublicUrl) {
    return {
      assetRefType: 'public_url',
      uri: candidate,
      mediaType: 'image',
    };
  }

  return {
    assetRefType: 'external_id',
    uri: candidate,
    mediaType: 'image',
  };
}

function collectForbiddenKeyViolations(input, path = 'root', out = []) {
  if (!input || typeof input !== 'object') {
    return out;
  }

  if (Array.isArray(input)) {
    input.forEach((entry, index) => collectForbiddenKeyViolations(entry, `${path}[${index}]`, out));
    return out;
  }

  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_EXPORT_KEYS.has(key)) {
      out.push(`${path}.${key}`);
    }
    collectForbiddenKeyViolations(value, `${path}.${key}`, out);
  }

  return out;
}

function toCanonicalWorkoutPlanTemplate(sourcePlanner = {}) {
  const planner = sourcePlanner && typeof sourcePlanner === 'object' ? sourcePlanner : {};
  const scheduleMode = normalizeScheduleMode(planner.scheduleMode);

  const dayGroupsBase = normalizeGroupList(planner.dayGroups, 'Any Day');
  const weekGroupsBase = normalizeGroupList(planner.weekGroups, 'Week 1');

  const dayGroups = normalizeOrderedGroups(dayGroupsBase, planner.dayGroupOrders);
  const weekGroups = normalizeOrderedGroups(weekGroupsBase, planner.weekGroupOrders);

  const activeGroupFallback = scheduleMode === 'week'
    ? weekGroups[0].label
    : dayGroups[0].label;

  const exercises = (Array.isArray(planner.exercises) ? planner.exercises : []).map((exercise, index) => {
    const recordingType = inferRecordingType(exercise);
    return {
      order: toPositiveIntegerOrNull(exercise.sortOrder) || index + 1,
      groupLabel: normalizeGroupLabel(exercise.scheduleGroup, activeGroupFallback),
      exercise: {
        referenceId: toPositiveIntegerOrNull(exercise.exerciseId),
        name: toTrimmedString(exercise.name),
        imageUrl: toNullableString(exercise.image),
        workoutType: toTrimmedString(exercise.workoutType || exercise.WorkoutType) || 'Strength',
        muscleGroup: toNullableString(exercise.muscleGroup),
        equipment: toNullableString(exercise.equipment),
        recordingType,
      },
      targets: {
        sets: toFiniteNumberOrNull(exercise.sets),
        reps: toFiniteNumberOrNull(exercise.reps),
        weightLbs: toFiniteNumberOrNull(exercise.weight),
        durationMinutes: toFiniteNumberOrNull(exercise.duration),
        distanceMiles: toFiniteNumberOrNull(exercise.distance),
        calories: toFiniteNumberOrNull(exercise.calories),
        restSeconds: toFiniteNumberOrNull(exercise.restTime),
      },
      notes: toNullableString(exercise.notes),
      extensions: {},
    };
  });

  const planType = normalizePlanType(planner.metadata && planner.metadata.planType);
  const featuredFromType = planType === 'featured';
  const featuredOverride = planner.metadata && Object.prototype.hasOwnProperty.call(planner.metadata, 'isFeatured')
    ? Boolean(planner.metadata.isFeatured)
    : null;

  return {
    format: WORKOUTATLAS_PLAN_FORMAT,
    schemaVersion: WORKOUTATLAS_PLAN_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    template: {
      metadata: {
        name: toTrimmedString(planner.metadata && planner.metadata.name),
        description: toTrimmedString(planner.metadata && planner.metadata.description),
        workoutType: toTrimmedString(planner.metadata && planner.metadata.type) || 'Strength',
        category: toNullableString(planner.metadata && planner.metadata.category),
        planType,
        estimatedSessionMinutes: toFiniteNumberOrNull(planner.metadata && planner.metadata.estimatedDuration),
        planDurationWeeks: toPositiveIntegerOrNull(planner.metadata && planner.metadata.planDurationWeeks),
      },
      publication: {
        status: normalizePublicationStatus(planner.status),
        visibility: toTrimmedString(planner.visibility || 'private') || 'private',
        featured: featuredOverride == null ? featuredFromType : featuredOverride,
      },
      goals: {
        goalType: toNullableString(planner.metadata && planner.metadata.goalType),
        goalId: toNullableString(planner.metadata && planner.metadata.goalId),
        targetDate: toNullableString(planner.metadata && planner.metadata.goalTargetDate),
        context: planner.metadata && planner.metadata.goalContext && typeof planner.metadata.goalContext === 'object'
          ? {
              goalType: toNullableString(planner.metadata.goalContext.goalType),
              exerciseId: toPositiveIntegerOrNull(planner.metadata.goalContext.exerciseId),
              exerciseName: toNullableString(planner.metadata.goalContext.exerciseName),
              targetValue: toFiniteNumberOrNull(planner.metadata.goalContext.targetValue),
              targetUnit: toNullableString(planner.metadata.goalContext.targetUnit),
              targetDate: toNullableString(planner.metadata.goalContext.targetDate),
              status: toNullableString(planner.metadata.goalContext.status),
            }
          : null,
      },
      coverImage: toPortableCoverImage(planner),
      schedule: {
        mode: scheduleMode,
        dayGroups,
        weekGroups,
        exercises,
      },
      extensions: {},
    },
  };
}

function validateWorkoutPlanTemplate(input) {
  const errors = [];
  const warnings = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['Template must be a JSON object.'], warnings };
  }

  if (input.format !== WORKOUTATLAS_PLAN_FORMAT) {
    errors.push(`format must be "${WORKOUTATLAS_PLAN_FORMAT}".`);
  }

  if (!Number.isInteger(input.schemaVersion)) {
    errors.push('schemaVersion must be an integer.');
  } else if (input.schemaVersion !== WORKOUTATLAS_PLAN_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${input.schemaVersion}.`);
  }

  const template = input.template;
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    errors.push('template object is required.');
    return { ok: false, errors, warnings };
  }

  const forbiddenMatches = collectForbiddenKeyViolations(template, 'template');
  if (forbiddenMatches.length) {
    errors.push(`Template contains forbidden internal fields: ${forbiddenMatches.join(', ')}`);
  }

  const metadata = template.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push('template.metadata object is required.');
  } else {
    if (!toTrimmedString(metadata.name)) {
      errors.push('template.metadata.name is required.');
    }

    const planType = normalizePlanType(metadata.planType);
    if (planType && !PLAN_TYPES.has(planType)) {
      errors.push(`template.metadata.planType is not supported: ${metadata.planType}`);
    }
  }

  const publication = template.publication;
  if (!publication || typeof publication !== 'object' || Array.isArray(publication)) {
    errors.push('template.publication object is required.');
  } else if (!PUBLICATION_STATUSES.has(normalizePublicationStatus(publication.status))) {
    errors.push('template.publication.status is invalid.');
  }

  const coverImage = template.coverImage;
  if (!coverImage || typeof coverImage !== 'object' || Array.isArray(coverImage)) {
    errors.push('template.coverImage object is required.');
  } else {
    const refType = toTrimmedString(coverImage.assetRefType).toLowerCase();
    if (!COVER_ASSET_REF_TYPES.has(refType)) {
      errors.push('template.coverImage.assetRefType must be one of none, public_url, external_id.');
    }

    const uri = toTrimmedString(coverImage.uri);
    if (uri && /^app\//i.test(uri)) {
      errors.push('template.coverImage.uri must not expose private storage keys.');
    }
  }

  const schedule = template.schedule;
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    errors.push('template.schedule object is required.');
  } else {
    const mode = toTrimmedString(schedule.mode).toLowerCase();
    if (!SCHEDULE_MODES.has(mode)) {
      errors.push('template.schedule.mode must be day or week.');
    }

    const dayGroups = Array.isArray(schedule.dayGroups) ? schedule.dayGroups : [];
    const weekGroups = Array.isArray(schedule.weekGroups) ? schedule.weekGroups : [];

    if (!dayGroups.length) {
      errors.push('template.schedule.dayGroups must contain at least one group.');
    }
    if (!weekGroups.length) {
      errors.push('template.schedule.weekGroups must contain at least one group.');
    }

    const activeGroups = mode === 'week' ? weekGroups : dayGroups;
    const activeLabels = new Set(
      activeGroups
        .map((group) => toTrimmedString(group && group.label).toLowerCase())
        .filter(Boolean)
    );

    const exercises = Array.isArray(schedule.exercises) ? schedule.exercises : [];
    exercises.forEach((entry, index) => {
      const path = `template.schedule.exercises[${index}]`;
      const groupLabel = toTrimmedString(entry && entry.groupLabel).toLowerCase();
      if (!groupLabel) {
        errors.push(`${path}.groupLabel is required.`);
      } else if (!activeLabels.has(groupLabel)) {
        errors.push(`${path}.groupLabel does not exist in active schedule groups.`);
      }

      const exerciseName = toTrimmedString(entry && entry.exercise && entry.exercise.name);
      if (!exerciseName) {
        errors.push(`${path}.exercise.name is required.`);
      }

      const order = toPositiveIntegerOrNull(entry && entry.order);
      if (!order) {
        errors.push(`${path}.order must be a positive integer.`);
      }
    });
  }

  for (const gap of KNOWN_PERSISTENCE_GAPS) {
    warnings.push(`${gap.path}: ${gap.reason}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

function toInternalWorkoutPlannerPayload(templateDocument) {
  const validation = validateWorkoutPlanTemplate(templateDocument);
  if (!validation.ok) {
    const details = validation.errors.join(' | ');
    throw new Error(`Invalid workout template: ${details}`);
  }

  const template = templateDocument.template;
  const schedule = template.schedule;
  const mode = normalizeScheduleMode(schedule.mode);
  const activeGroups = mode === 'week' ? schedule.weekGroups : schedule.dayGroups;
  const fallbackGroup = toTrimmedString(activeGroups[0] && activeGroups[0].label) || (mode === 'week' ? 'Week 1' : 'Any Day');

  const mapOrderEntries = (groups) => groups.map((group, index) => ({
    label: toTrimmedString(group && group.label),
    sortOrder: toPositiveIntegerOrNull(group && group.order) || index + 1,
  }));

  const normalizeExerciseForPlanner = (entry, index) => {
    const exercise = entry.exercise || {};
    const targets = entry.targets || {};

    return {
      id: `tpl-${index + 1}`,
      exerciseId: toPositiveIntegerOrNull(exercise.referenceId) || 0,
      name: toTrimmedString(exercise.name),
      image: toTrimmedString(exercise.imageUrl),
      workoutType: toTrimmedString(exercise.workoutType) || 'Strength',
      muscleGroup: toTrimmedString(exercise.muscleGroup),
      equipment: toTrimmedString(exercise.equipment),
      recordingType: toTrimmedString(exercise.recordingType),
      sets: toFiniteNumberOrNull(targets.sets) || 0,
      reps: toFiniteNumberOrNull(targets.reps) || 0,
      weight: toFiniteNumberOrNull(targets.weightLbs) || 0,
      duration: toFiniteNumberOrNull(targets.durationMinutes) || 0,
      distance: toFiniteNumberOrNull(targets.distanceMiles) || 0,
      calories: toFiniteNumberOrNull(targets.calories) || 0,
      restTime: toFiniteNumberOrNull(targets.restSeconds) || 0,
      notes: toTrimmedString(entry.notes),
      scheduleGroup: toTrimmedString(entry.groupLabel) || fallbackGroup,
      sortOrder: toPositiveIntegerOrNull(entry.order) || index + 1,
    };
  };

  return {
    version: 1,
    planId: '',
    scheduleMode: mode,
    dayGroups: schedule.dayGroups.map((group) => toTrimmedString(group.label)).filter(Boolean),
    weekGroups: schedule.weekGroups.map((group) => toTrimmedString(group.label)).filter(Boolean),
    dayGroupOrders: mapOrderEntries(schedule.dayGroups),
    weekGroupOrders: mapOrderEntries(schedule.weekGroups),
    metadata: {
      name: toTrimmedString(template.metadata && template.metadata.name),
      description: toTrimmedString(template.metadata && template.metadata.description),
      type: toTrimmedString(template.metadata && template.metadata.workoutType) || 'Strength',
      category: toNullableString(template.metadata && template.metadata.category),
      planType: normalizePlanType(template.metadata && template.metadata.planType),
      goalType: toNullableString(template.goals && template.goals.goalType),
      goalTargetDate: toNullableString(template.goals && template.goals.targetDate),
      planDurationWeeks: toPositiveIntegerOrNull(template.metadata && template.metadata.planDurationWeeks),
      goalId: toNullableString(template.goals && template.goals.goalId) || '',
      goalContext: template.goals && template.goals.context ? {
        goalType: toNullableString(template.goals.context.goalType),
        exerciseId: toPositiveIntegerOrNull(template.goals.context.exerciseId),
        exerciseName: toNullableString(template.goals.context.exerciseName),
        targetValue: toFiniteNumberOrNull(template.goals.context.targetValue),
        targetUnit: toNullableString(template.goals.context.targetUnit),
        targetDate: toNullableString(template.goals.context.targetDate),
        status: toNullableString(template.goals.context.status),
      } : null,
      estimatedDuration: toFiniteNumberOrNull(template.metadata && template.metadata.estimatedSessionMinutes) || 0,
      isFeatured: Boolean(template.publication && template.publication.featured),
    },
    exercises: (Array.isArray(schedule.exercises) ? schedule.exercises : [])
      .slice()
      .sort((left, right) => {
        const leftOrder = toPositiveIntegerOrNull(left && left.order) || Number.MAX_SAFE_INTEGER;
        const rightOrder = toPositiveIntegerOrNull(right && right.order) || Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder;
      })
      .map(normalizeExerciseForPlanner),
  };
}

module.exports = {
  WORKOUTATLAS_PLAN_FORMAT,
  WORKOUTATLAS_PLAN_SCHEMA_VERSION,
  KNOWN_PERSISTENCE_GAPS,
  toCanonicalWorkoutPlanTemplate,
  validateWorkoutPlanTemplate,
  toInternalWorkoutPlannerPayload,
};
