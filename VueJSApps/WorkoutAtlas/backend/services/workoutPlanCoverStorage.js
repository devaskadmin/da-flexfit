const {
  resolveStorageBucketName,
} = require('./aiGatewayService');

const WORKOUT_PLAN_STORAGE_ROOT = 'APP/workout-plans';
const WORKOUT_PLAN_IMAGES_FOLDER = 'images';
const WORKOUT_PLAN_CANONICAL_COVER_FILE = 'cover.jpg';
const WORKOUT_PLAN_CANONICAL_COVER_CONTENT_TYPE = 'image/jpeg';
const WORKOUT_PLAN_DEFAULT_IMAGE_FILE = 'default.JPG';
const WORKOUT_PLAN_DEFAULT_IMAGE_STORAGE_KEY = `${WORKOUT_PLAN_STORAGE_ROOT}/${WORKOUT_PLAN_DEFAULT_IMAGE_FILE}`;

function normalizePositivePlanId(planId) {
  const numericId = Number(planId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error('PlanID must be a positive integer.');
  }

  return numericId;
}

function buildWorkoutPlanImagesPrefix(planId) {
  const safePlanId = normalizePositivePlanId(planId);
  return `${WORKOUT_PLAN_STORAGE_ROOT}/${safePlanId}/${WORKOUT_PLAN_IMAGES_FOLDER}`;
}

function buildWorkoutPlanCanonicalCoverStorageKey(planId) {
  return `${buildWorkoutPlanImagesPrefix(planId)}/${WORKOUT_PLAN_CANONICAL_COVER_FILE}`;
}

function isCanonicalWorkoutPlanCoverStorageKeyForPlan(planId, candidateStorageKey) {
  const safePlanId = normalizePositivePlanId(planId);
  const expected = buildWorkoutPlanCanonicalCoverStorageKey(safePlanId);
  const provided = String(candidateStorageKey || '').trim().replace(/\\/g, '/');
  return provided === expected;
}

function assertCanonicalWorkoutPlanCoverStorageKeyForPlan(planId, candidateStorageKey) {
  if (!isCanonicalWorkoutPlanCoverStorageKeyForPlan(planId, candidateStorageKey)) {
    throw new Error('Cover image storage key does not match the canonical key for this plan.');
  }

  return buildWorkoutPlanCanonicalCoverStorageKey(planId);
}

function resolveWorkoutPlanCoverImageReference(row = {}) {
  const legacyCoverImage = String(row.cover_image || '').trim();
  if (legacyCoverImage) {
    return legacyCoverImage;
  }

  // Stage 0.85.167-B compatibility behavior:
  // recognize incoming storage-key metadata but do not surface it to clients
  // until a dedicated workout-plan cover media endpoint is introduced.
  const _coverStorageKey = String(row.cover_image_storage_key || '').trim();
  const _coverContentType = String(row.cover_image_content_type || '').trim();
  const _coverUpdatedAt = row.cover_image_updated_at || null;

  void _coverStorageKey;
  void _coverContentType;
  void _coverUpdatedAt;

  return '';
}

function getWorkoutPlanCoverStorageConfig(planId, env = process.env) {
  const safePlanId = normalizePositivePlanId(planId);
  return {
    planId: safePlanId,
    bucket: resolveStorageBucketName(env),
    contentType: WORKOUT_PLAN_CANONICAL_COVER_CONTENT_TYPE,
    prefix: buildWorkoutPlanImagesPrefix(safePlanId),
    storageKey: buildWorkoutPlanCanonicalCoverStorageKey(safePlanId),
  };
}

module.exports = {
  WORKOUT_PLAN_STORAGE_ROOT,
  WORKOUT_PLAN_IMAGES_FOLDER,
  WORKOUT_PLAN_CANONICAL_COVER_FILE,
  WORKOUT_PLAN_CANONICAL_COVER_CONTENT_TYPE,
  WORKOUT_PLAN_DEFAULT_IMAGE_FILE,
  WORKOUT_PLAN_DEFAULT_IMAGE_STORAGE_KEY,
  normalizePositivePlanId,
  buildWorkoutPlanImagesPrefix,
  buildWorkoutPlanCanonicalCoverStorageKey,
  isCanonicalWorkoutPlanCoverStorageKeyForPlan,
  assertCanonicalWorkoutPlanCoverStorageKeyForPlan,
  resolveWorkoutPlanCoverImageReference,
  getWorkoutPlanCoverStorageConfig,
};
