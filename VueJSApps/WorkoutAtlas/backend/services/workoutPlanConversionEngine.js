const {
  WORKOUTATLAS_PLAN_FORMAT,
  WORKOUTATLAS_PLAN_SCHEMA_VERSION,
  KNOWN_PERSISTENCE_GAPS,
  toCanonicalWorkoutPlanTemplate,
  validateWorkoutPlanTemplate,
  toInternalWorkoutPlannerPayload,
} = require('../utils/workoutPlanTemplate');

const {
  canReadExerciseForUser,
  getExerciseAccessProfile,
} = require('../api/excerises');

const TARGET_PLAN_TYPES = Object.freeze({
  PERSONAL: 'personal',
  TRAINER_SHARED: 'trainer_shared',
  COMMUNITY: 'community',
  GLOBAL: 'global',
});

const SUPPORTED_TARGET_PLAN_TYPES = new Set([
  TARGET_PLAN_TYPES.PERSONAL,
  TARGET_PLAN_TYPES.TRAINER_SHARED,
  TARGET_PLAN_TYPES.COMMUNITY,
  TARGET_PLAN_TYPES.GLOBAL,
]);

const PLAN_TYPE_ALIASES = Object.freeze({
  personal: TARGET_PLAN_TYPES.PERSONAL,
  private: TARGET_PLAN_TYPES.PERSONAL,
  trainer_shared: TARGET_PLAN_TYPES.TRAINER_SHARED,
  'trainer shared': TARGET_PLAN_TYPES.TRAINER_SHARED,
  trainer: TARGET_PLAN_TYPES.TRAINER_SHARED,
  community: TARGET_PLAN_TYPES.COMMUNITY,
  global: TARGET_PLAN_TYPES.GLOBAL,
  featured: TARGET_PLAN_TYPES.GLOBAL,
  community_shared: TARGET_PLAN_TYPES.GLOBAL,
  marketplace: 'marketplace',
});

const EXERCISE_SCOPE = Object.freeze({
  SYSTEM: 'SYSTEM',
  SHARED: 'SHARED',
  CUSTOM: 'CUSTOM',
  PRIVATE: 'PRIVATE',
  TRAINER_SHARED: 'TRAINER_SHARED',
});

function normalizeRole(roleValue) {
  const normalized = String(roleValue || '').trim().toLowerCase();
  if (normalized === 'administrator') return 'admin';
  return normalized;
}

function normalizeTargetPlanType(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';
  return PLAN_TYPE_ALIASES[raw] || raw;
}

function buildMockReqFromAuthContext(authContext = {}) {
  const userId = Number(authContext.userId || 0);
  const role = normalizeRole(authContext.role || authContext.roleSlug);
  return {
    session: {
      user: {
        id: userId,
        role,
        roleSlug: role,
      },
    },
  };
}

function getDefaultVisibilityForTargetType(targetPlanType) {
  if (targetPlanType === TARGET_PLAN_TYPES.GLOBAL) {
    return 'private';
  }
  if (targetPlanType === TARGET_PLAN_TYPES.COMMUNITY) {
    return 'private';
  }
  return 'private';
}

function checkTargetTypePermission({ authContext = {}, targetPlanType }) {
  const normalizedTargetType = normalizeTargetPlanType(targetPlanType);
  const role = normalizeRole(authContext.role || authContext.roleSlug);

  if (!Number(authContext.userId || 0)) {
    return {
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Authenticated user is required for workout plan conversion.',
    };
  }

  if (!SUPPORTED_TARGET_PLAN_TYPES.has(normalizedTargetType)) {
    if (normalizedTargetType === 'marketplace') {
      return {
        ok: false,
        code: 'TARGET_TYPE_UNSUPPORTED',
        message: 'Marketplace plan conversion is not implemented yet.',
      };
    }

    return {
      ok: false,
      code: 'TARGET_TYPE_INVALID',
      message: 'Unsupported target workout plan type.',
    };
  }

  if (normalizedTargetType === TARGET_PLAN_TYPES.GLOBAL && role !== 'admin') {
    return {
      ok: false,
      code: 'TARGET_TYPE_FORBIDDEN',
      message: 'Only administrators can convert plans to Global.',
    };
  }

  if (normalizedTargetType === TARGET_PLAN_TYPES.TRAINER_SHARED && role !== 'trainer') {
    return {
      ok: false,
      code: 'TARGET_TYPE_FORBIDDEN',
      message: 'Only trainer accounts can convert plans to Trainer Shared.',
    };
  }

  return { ok: true, value: normalizedTargetType };
}

function buildExerciseLookupMap(source = []) {
  const map = new Map();
  for (const record of Array.isArray(source) ? source : []) {
    const exerciseId = Number(record && record.ExerciseID);
    if (!exerciseId) continue;
    map.set(exerciseId, record);
  }
  return map;
}

function checkExerciseScopeCompatibility({
  targetPlanType,
  exercise,
  exerciseRecord,
  destinationUserId,
  destinationReq,
}) {
  const issues = [];
  const profile = getExerciseAccessProfile(exerciseRecord || {});
  const scope = String(profile.explicitScope || '').trim().toUpperCase() || 'UNKNOWN';

  const canRead = canReadExerciseForUser({ req: destinationReq, exercise: exerciseRecord || {} });
  if (!canRead) {
    issues.push({
      code: 'EXERCISE_NOT_VISIBLE_TO_DESTINATION',
      severity: 'error',
      message: `Exercise ${exercise.exerciseId || 'unknown'} is not visible to the destination user.`,
    });
  }

  if (targetPlanType === TARGET_PLAN_TYPES.PERSONAL) {
    const isOwner = Number(profile.ownerUserId || 0) === Number(destinationUserId || 0);

    if ((scope === EXERCISE_SCOPE.PRIVATE || scope === EXERCISE_SCOPE.TRAINER_SHARED) && !isOwner) {
      issues.push({
        code: 'PERSONAL_TARGET_PRIVATE_SCOPE_MISMATCH',
        severity: 'warning',
        message: `Exercise ${exercise.exerciseId || 'unknown'} uses ${scope} scope and is not owned by destination user.`,
      });
    }
  }

  if (
    targetPlanType === TARGET_PLAN_TYPES.TRAINER_SHARED
    || targetPlanType === TARGET_PLAN_TYPES.COMMUNITY
    || targetPlanType === TARGET_PLAN_TYPES.GLOBAL
  ) {
    const disallowedScopes = new Set([
      EXERCISE_SCOPE.CUSTOM,
      EXERCISE_SCOPE.PRIVATE,
      EXERCISE_SCOPE.TRAINER_SHARED,
    ]);

    if (disallowedScopes.has(scope)) {
      issues.push({
        code: 'TARGET_TYPE_DISALLOWS_EXERCISE_SCOPE',
        severity: 'error',
        message: `Exercise ${exercise.exerciseId || 'unknown'} has scope ${scope}, which is not allowed in ${targetPlanType} plans.`,
      });
    }
  }

  return {
    scope,
    profile,
    issues,
  };
}

function collectExerciseIdsFromPlanner(sourcePlanner = {}) {
  const ids = [];
  const seen = new Set();
  const sourceExercises = Array.isArray(sourcePlanner.exercises) ? sourcePlanner.exercises : [];

  for (const exercise of sourceExercises) {
    const exerciseId = Number(exercise && exercise.exerciseId);
    if (!exerciseId || seen.has(exerciseId)) continue;
    seen.add(exerciseId);
    ids.push(exerciseId);
  }

  return ids;
}

function createConversionPreview({
  sourcePlan,
  sourceTemplate,
  targetPlanType,
  destinationUserId,
  exerciseCompatibility = [],
  warnings = [],
  blockers = [],
}) {
  const totalExercises = Array.isArray(sourceTemplate?.template?.schedule?.exercises)
    ? sourceTemplate.template.schedule.exercises.length
    : 0;

  const incompatibleExercises = exerciseCompatibility
    .filter((entry) => Array.isArray(entry.issues) && entry.issues.length)
    .map((entry) => ({
      order: entry.order,
      exerciseId: entry.exerciseId,
      name: entry.name,
      scope: entry.scope,
      issues: entry.issues,
    }));

  return {
    source: {
      planId: String(sourcePlan && sourcePlan.planId ? sourcePlan.planId : ''),
      planType: String(sourcePlan && sourcePlan.metadata && sourcePlan.metadata.planType ? sourcePlan.metadata.planType : ''),
      name: String(sourcePlan && sourcePlan.metadata && sourcePlan.metadata.name ? sourcePlan.metadata.name : ''),
    },
    target: {
      planType: targetPlanType,
      ownerUserId: destinationUserId,
      defaults: {
        status: 'draft',
        visibility: getDefaultVisibilityForTargetType(targetPlanType),
        featured: false,
      },
    },
    compatibility: {
      totalExercises,
      incompatibleExerciseCount: incompatibleExercises.length,
      incompatibleExercises,
      requiresExplicitApproval: incompatibleExercises.length > 0,
    },
    warnings,
    blockers,
    canProceed: blockers.length === 0 && incompatibleExercises.length === 0,
  };
}

function normalizeTemplateForTargetType(sourceTemplate, targetPlanType, destinationTitle = null) {
  const cloned = JSON.parse(JSON.stringify(sourceTemplate || {}));
  const metadata = cloned.template && cloned.template.metadata ? cloned.template.metadata : {};
  const publication = cloned.template && cloned.template.publication ? cloned.template.publication : {};

  metadata.planType = targetPlanType;
  if (destinationTitle) {
    metadata.name = String(destinationTitle).trim();
  }

  publication.status = 'draft';
  publication.featured = false;
  publication.visibility = getDefaultVisibilityForTargetType(targetPlanType);

  if (!cloned.template) {
    cloned.template = {};
  }
  cloned.template.metadata = metadata;
  cloned.template.publication = publication;

  return cloned;
}

function hasTemplateCoverReference(template) {
  const cover = template?.template?.coverImage;
  if (!cover || typeof cover !== 'object') return false;

  const refType = String(cover.assetRefType || '').trim().toLowerCase();
  const uri = String(cover.uri || '').trim();
  if (!uri) return false;
  return refType !== 'none';
}

function templateHasCalories(template) {
  const entries = Array.isArray(template?.template?.schedule?.exercises)
    ? template.template.schedule.exercises
    : [];

  return entries.some((entry) => {
    const calories = entry && entry.targets ? entry.targets.calories : null;
    return calories !== null && calories !== undefined && calories !== '';
  });
}

async function buildWorkoutPlanConversionPreview({
  sourcePlan,
  targetPlanType,
  authContext,
  resolveExercisesByIds,
  options = {},
}) {
  if (!sourcePlan || typeof sourcePlan !== 'object' || Array.isArray(sourcePlan)) {
    throw new Error('sourcePlan object is required.');
  }

  const permission = checkTargetTypePermission({ authContext, targetPlanType });
  if (!permission.ok) {
    return {
      ok: false,
      permission,
      preview: null,
      template: null,
      payload: null,
    };
  }

  const normalizedTargetType = permission.value;
  const destinationUserId = Number(authContext && authContext.userId ? authContext.userId : 0);
  const destinationReq = buildMockReqFromAuthContext(authContext);
  const destinationTitle = String(options?.destinationTitle || '').trim();

  const sourceTemplate = toCanonicalWorkoutPlanTemplate(sourcePlan);
  const sourceTemplateValidation = validateWorkoutPlanTemplate(sourceTemplate);
  if (!sourceTemplateValidation.ok) {
    return {
      ok: false,
      permission,
      template: sourceTemplate,
      preview: null,
      payload: null,
      validation: sourceTemplateValidation,
    };
  }

  const exerciseIds = collectExerciseIdsFromPlanner(sourcePlan);
  const exercisesFromResolver = typeof resolveExercisesByIds === 'function'
    ? await resolveExercisesByIds(exerciseIds)
    : [];
  const exerciseById = buildExerciseLookupMap(exercisesFromResolver);

  const compatibilityEntries = [];
  const templateExercises = Array.isArray(sourceTemplate?.template?.schedule?.exercises)
    ? sourceTemplate.template.schedule.exercises
    : [];

  for (const exerciseEntry of templateExercises) {
    const exerciseId = Number(exerciseEntry?.exercise?.referenceId || 0);
    const exerciseRecord = exerciseById.get(exerciseId);

    if (!exerciseId || !exerciseRecord) {
      compatibilityEntries.push({
        order: Number(exerciseEntry?.order || 0),
        exerciseId,
        name: String(exerciseEntry?.exercise?.name || '').trim(),
        scope: 'UNKNOWN',
        issues: [{
          code: 'EXERCISE_RECORD_MISSING',
          severity: 'error',
          message: `Exercise record ${exerciseId || 'unknown'} is missing from compatibility lookup.`,
        }],
      });
      continue;
    }

    const compatibility = checkExerciseScopeCompatibility({
      targetPlanType: normalizedTargetType,
      exercise: {
        exerciseId,
      },
      exerciseRecord,
      destinationUserId,
      destinationReq,
    });

    compatibilityEntries.push({
      order: Number(exerciseEntry?.order || 0),
      exerciseId,
      name: String(exerciseEntry?.exercise?.name || '').trim(),
      scope: compatibility.scope,
      issues: compatibility.issues,
    });
  }

  const warnings = [...sourceTemplateValidation.warnings];
  const blockers = [];

  if (hasTemplateCoverReference(sourceTemplate) && !options.allowUnsafeCoverReferenceCarryForward) {
    blockers.push({
      code: 'COVER_COPY_REQUIRED',
      message: 'Source plan contains a cover image reference. Safe destination media copy is required before conversion can proceed.',
    });
  }

  if (templateHasCalories(sourceTemplate)) {
    warnings.push('Template contains cardio target calories; current schedule persistence does not have a dedicated target_calories column.');
  }

  for (const gap of KNOWN_PERSISTENCE_GAPS) {
    if (gap.path === 'template.schedule.exercises[].targets.calories' && templateHasCalories(sourceTemplate)) {
      continue;
    }
    warnings.push(`${gap.path}: ${gap.reason}`);
  }

  const convertedTemplate = normalizeTemplateForTargetType(
    sourceTemplate,
    normalizedTargetType,
    destinationTitle || null
  );
  const convertedTemplateValidation = validateWorkoutPlanTemplate(convertedTemplate);
  if (!convertedTemplateValidation.ok) {
    return {
      ok: false,
      permission,
      template: convertedTemplate,
      payload: null,
      preview: null,
      validation: convertedTemplateValidation,
    };
  }

  const dedupedWarnings = [...new Set(warnings.filter(Boolean))];

  const preview = createConversionPreview({
    sourcePlan,
    sourceTemplate: convertedTemplate,
    targetPlanType: normalizedTargetType,
    destinationUserId,
    exerciseCompatibility: compatibilityEntries,
    warnings: dedupedWarnings,
    blockers,
  });

  let payload = null;
  if (preview.canProceed) {
    payload = toInternalWorkoutPlannerPayload(convertedTemplate);
    payload.planId = '';

    payload.metadata = {
      ...payload.metadata,
      planType: normalizedTargetType,
      isFeatured: false,
      sourceGlobalPlanId: null,
      sourceGlobalPlanName: null,
      globalPlanAdoptedAt: null,
    };
  }

  return {
    ok: true,
    permission,
    template: convertedTemplate,
    payload,
    preview,
    validation: convertedTemplateValidation,
  };
}

function assertConversionCanProceed(conversionResult) {
  const canProceed = Boolean(conversionResult && conversionResult.ok && conversionResult.preview && conversionResult.preview.canProceed);
  if (canProceed) return;

  const blockers = Array.isArray(conversionResult?.preview?.blockers)
    ? conversionResult.preview.blockers.map((entry) => entry.message).join(' | ')
    : '';
  const compatibilityIssues = Array.isArray(conversionResult?.preview?.compatibility?.incompatibleExercises)
    ? conversionResult.preview.compatibility.incompatibleExercises.length
    : 0;

  throw new Error(
    blockers
      || (compatibilityIssues > 0
        ? `Conversion requires explicit approval due to ${compatibilityIssues} incompatible exercise(s).`
        : 'Conversion cannot proceed.')
  );
}

module.exports = {
  WORKOUTATLAS_PLAN_FORMAT,
  WORKOUTATLAS_PLAN_SCHEMA_VERSION,
  TARGET_PLAN_TYPES,
  SUPPORTED_TARGET_PLAN_TYPES,
  normalizeTargetPlanType,
  checkTargetTypePermission,
  buildWorkoutPlanConversionPreview,
  assertConversionCanProceed,
};
