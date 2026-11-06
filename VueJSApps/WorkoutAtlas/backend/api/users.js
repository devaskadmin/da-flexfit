const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');
const { canReadExerciseForUser, getExerciseAccessProfile } = require('./excerises');
const { copyCustomExerciseForRecipient } = require('../services/customExerciseCopyService');
const { deleteObjectViaGateway } = require('../services/aiGatewayService');
const { resolveWorkoutPlanCoverImageReference } = require('../services/workoutPlanCoverStorage');
const {
  getWorkoutPlanCoverRow,
  canManageWorkoutPlanCover,
  uploadWorkoutPlanCover,
  cloneWorkoutPlanCoverToPlan,
  deleteWorkoutPlanCover,
  WORKOUT_PLAN_COVER_ALLOWED_MIME_TYPES,
  DEFAULT_WORKOUT_PLAN_COVER_MAX_FILE_SIZE_BYTES,
} = require('../services/workoutPlanCoverService');
const {
  buildWorkoutPlanConversionPreview,
  assertConversionCanProceed,
} = require('../services/workoutPlanConversionEngine');

// ✅ DB Connect
const pool = require('../db');

const workoutPlanCoverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEFAULT_WORKOUT_PLAN_COVER_MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mimeType = String(file?.mimetype || '').trim().toLowerCase();
    if (WORKOUT_PLAN_COVER_ALLOWED_MIME_TYPES.includes(mimeType)) {
      cb(null, true);
      return;
    }
    cb(new Error('Unsupported image type. Allowed types: jpg, jpeg, png, gif, webp.'));
  },
}).fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

function deepMerge(target, source) {
  const out = { ...(target || {}) };
  for (const key of Object.keys(source || {})) {
    const sourceValue = source[key];
    const targetValue = out[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      out[key] = deepMerge(targetValue, sourceValue);
    } else {
      out[key] = sourceValue;
    }
  }
  return out;
}

const readSettingsObject = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch (_) {
      return {};
    }
  }
  return {};
};

const buildPlanId = () => {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const workoutPlannerSchemaState = {
  checked: false,
  hasUseCustomWorkoutLogOrder: false,
  hasWorkoutLogDisplayOrder: false,
  hasWorkoutPlanType: false,
  hasGoalType: false,
  hasGoalTargetDate: false,
  hasPlanDurationWeeks: false,
  hasLinkedGoalId: false,
  hasSourceGlobalPlanId: false,
  hasGlobalPlanAdoptedAt: false,
  hasTargetDistanceMiles: false,
};

let workoutPlanTypeEnumCache = {
  checkedAt: 0,
  values: null,
};

const FEATURED_WORKOUT_PLAN_TYPE = 'featured';
const COMMUNITY_SHARED_WORKOUT_PLAN_TYPE = 'community_shared';
const GLOBAL_WORKOUT_PLAN_TYPE = 'global';
const PERSONAL_WORKOUT_PLAN_TYPE = 'personal';
const TRAINER_SHARED_WORKOUT_PLAN_TYPE = 'trainer_shared';
const COMMUNITY_WORKOUT_PLAN_TYPE = 'community';
const MARKETPLACE_WORKOUT_PLAN_TYPE = 'marketplace';

const GLOBAL_WORKOUT_PLAN_TYPE_VALUES = Object.freeze([
  GLOBAL_WORKOUT_PLAN_TYPE,
  FEATURED_WORKOUT_PLAN_TYPE,
  COMMUNITY_SHARED_WORKOUT_PLAN_TYPE,
]);

const WORKOUT_BUILDER_PLAN_TYPE_VALUES = Object.freeze([
  PERSONAL_WORKOUT_PLAN_TYPE,
  TRAINER_SHARED_WORKOUT_PLAN_TYPE,
  COMMUNITY_WORKOUT_PLAN_TYPE,
  MARKETPLACE_WORKOUT_PLAN_TYPE,
]);

const ALL_WORKOUT_PLAN_TYPE_VALUES = Object.freeze([
  ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES,
  ...WORKOUT_BUILDER_PLAN_TYPE_VALUES,
]);

const GLOBAL_WORKOUT_PLAN_TYPES = new Set(GLOBAL_WORKOUT_PLAN_TYPE_VALUES);
const WORKOUT_BUILDER_PLAN_TYPES = new Set(WORKOUT_BUILDER_PLAN_TYPE_VALUES);
const GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS = GLOBAL_WORKOUT_PLAN_TYPE_VALUES.map(() => '?').join(', ');
const PUBLISHED_GLOBAL_STATUSES = ['active', 'published', 'completed'];
const GLOBAL_WORKOUT_MIN_EXERCISES = 1;
const GLOBAL_WORKOUT_EXERCISE_VALIDATION_ERROR = 'Add at least one exercise before saving this workout.';
const GLOBAL_WORKOUT_COMPLETENESS_PREFIX = 'This global starter workout is incomplete. Missing:';
const PLAN_TYPE_SURFACE_WORKOUT_BUILDER = 'workout_builder';
const PLAN_TYPE_SURFACE_ADMIN_GLOBAL = 'admin_global';
const ADMIN_ROLE_VALUES = ['admin', 'administrator'];
const TRAINER_ROLE_VALUES = ['trainer'];
const WORKOUT_GOAL_TYPE_NONE = 'none';
const WORKOUT_GOAL_TYPE_BODY_WEIGHT = 'body_weight';
const WORKOUT_GOAL_TYPE_EXERCISE_WEIGHT = 'exercise_weight';
const WORKOUT_PLAN_CATEGORY_VALUES = Object.freeze([
  'Weight Loss',
  'Strength',
  'Muscle Building',
  'Cardio',
  'General Fitness',
  'Beginner',
]);
const WORKOUT_PLAN_TITLE_MAX_LENGTH = 150;
const WORKOUT_PLAN_CATEGORY_LOOKUP = Object.freeze(
  Object.fromEntries(
    WORKOUT_PLAN_CATEGORY_VALUES.map((value) => [String(value).trim().toLowerCase(), value])
  )
);

const normalizeWorkoutPlanCategory = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return { isSet: false, isValid: true, value: null };
  }

  const normalized = String(rawValue).trim();
  if (!normalized) {
    return { isSet: false, isValid: true, value: null };
  }

  const lookupKey = normalized.toLowerCase();
  const canonicalValue = WORKOUT_PLAN_CATEGORY_LOOKUP[lookupKey];
  if (canonicalValue) {
    return { isSet: true, isValid: true, value: canonicalValue };
  }

  return {
    isSet: true,
    isValid: false,
    value: null,
    error: `Invalid workout plan category. Allowed values: ${WORKOUT_PLAN_CATEGORY_VALUES.join(', ')}.`,
  };
};

const getWorkoutPlanCategoryValidationError = () => {
  return `Invalid workout plan category. Allowed values: ${WORKOUT_PLAN_CATEGORY_VALUES.join(', ')}.`;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDateValue = (value) => {
  const candidate = typeof value === 'string' ? value.trim() : value;
  if (candidate === null || candidate === undefined || candidate === '') {
    return true;
  }

  const text = candidate instanceof Date
    ? candidate.toISOString().slice(0, 10)
    : String(candidate).trim();

  if (!ISO_DATE_RE.test(text)) {
    return false;
  }

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const normalizeWorkoutGoalTargetDate = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return { isSet: false, isValid: true, value: null };
  }

  const text = rawValue instanceof Date
    ? rawValue.toISOString().slice(0, 10)
    : String(rawValue).trim();

  if (!ISO_DATE_RE.test(text) || !isValidIsoDateValue(text)) {
    return {
      isSet: true,
      isValid: false,
      value: null,
      error: 'Invalid goal target date. Use YYYY-MM-DD.',
    };
  }

  return { isSet: true, isValid: true, value: text };
};

const normalizePlanDurationWeeks = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return { isSet: false, isValid: true, value: null };
  }

  const text = String(rawValue).trim();
  if (!text) {
    return { isSet: false, isValid: true, value: null };
  }

  if (!/^\d+$/.test(text)) {
    return {
      isSet: true,
      isValid: false,
      value: null,
      error: 'Invalid plan duration in weeks. Use a positive integer or leave blank.',
    };
  }

  const parsedValue = Number(text);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return {
      isSet: true,
      isValid: false,
      value: null,
      error: 'Invalid plan duration in weeks. Use a positive integer or leave blank.',
    };
  }

  return { isSet: true, isValid: true, value: parsedValue };
};

const serializePlanDurationWeeks = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const text = String(rawValue).trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }

  const parsedValue = Number(text);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const serializeGoalTargetDate = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const text = rawValue instanceof Date
    ? rawValue.toISOString().slice(0, 10)
    : String(rawValue).trim();

  if (!ISO_DATE_RE.test(text) || !isValidIsoDateValue(text)) {
    return null;
  }

  return text;
};

// Current release policy (v0.85.gb.5): only administrators can create Community Shared plans.
// Future expansion can add 'trainer' and 'member' here without endpoint rewrites.
const COMMUNITY_SHARED_ALLOWED_CREATOR_ROLES = new Set(['admin']);

const normalizeSessionRoleSlug = (req) => {
  const roleSlug = String(req?.session?.user?.roleSlug || '').trim().toLowerCase();
  if (roleSlug === 'administrator') return 'admin';
  if (roleSlug) return roleSlug;

  const role = String(req?.session?.user?.role || '').trim().toLowerCase();
  if (role === 'administrator') return 'admin';
  return role;
};

const isAdminUser = (req) => {
  return normalizeSessionRoleSlug(req) === 'admin';
};

const isTrainerUser = (req) => {
  return normalizeSessionRoleSlug(req) === 'trainer';
};

const canCreateCommunitySharedPlan = (req) => {
  const roleSlug = normalizeSessionRoleSlug(req);
  return COMMUNITY_SHARED_ALLOWED_CREATOR_ROLES.has(roleSlug);
};

const canCreateTrainerSharedPlan = (req) => {
  return isTrainerUser(req);
};

const parseWorkoutPlanType = (rawValue) => {
  const normalized = String(rawValue ?? '').trim().toLowerCase();
  if (!normalized) {
    return { isSet: false, isValid: true, value: null };
  }

  if (normalized === FEATURED_WORKOUT_PLAN_TYPE) {
    return { isSet: true, isValid: true, value: FEATURED_WORKOUT_PLAN_TYPE };
  }

  if (['community_shared', 'community-shared', 'community shared'].includes(normalized)) {
    return { isSet: true, isValid: true, value: COMMUNITY_SHARED_WORKOUT_PLAN_TYPE };
  }

  if (normalized === GLOBAL_WORKOUT_PLAN_TYPE) {
    return { isSet: true, isValid: true, value: GLOBAL_WORKOUT_PLAN_TYPE };
  }

  if (normalized === PERSONAL_WORKOUT_PLAN_TYPE) {
    return { isSet: true, isValid: true, value: PERSONAL_WORKOUT_PLAN_TYPE };
  }

  if (['trainer_shared', 'trainer-shared', 'trainer shared'].includes(normalized)) {
    return { isSet: true, isValid: true, value: TRAINER_SHARED_WORKOUT_PLAN_TYPE };
  }

  if (normalized === COMMUNITY_WORKOUT_PLAN_TYPE) {
    return { isSet: true, isValid: true, value: COMMUNITY_WORKOUT_PLAN_TYPE };
  }

  if (normalized === MARKETPLACE_WORKOUT_PLAN_TYPE) {
    return { isSet: true, isValid: true, value: MARKETPLACE_WORKOUT_PLAN_TYPE };
  }

  return { isSet: true, isValid: false, value: null };
};

const getWorkoutPlanTypeValidationError = () => {
  return `Invalid workout plan type. Allowed values: ${ALL_WORKOUT_PLAN_TYPE_VALUES.join(', ')}.`;
};

const resolveImmutableWorkoutPlanType = ({ existingValue, requestedValue }) => {
  const existingParsed = parseWorkoutPlanType(existingValue);
  const requestedParsed = parseWorkoutPlanType(requestedValue);

  const existing = existingParsed.isSet && existingParsed.isValid ? existingParsed.value : null;
  const requested = requestedParsed.isSet && requestedParsed.isValid ? requestedParsed.value : null;

  if (existing && requested && existing !== requested) {
    return {
      ok: false,
      status: 409,
      error: 'Workout Plan Type is immutable after creation and cannot be changed.',
      value: existing,
    };
  }

  if (existing) {
    return { ok: true, status: 200, error: null, value: existing };
  }

  if (requested) {
    return { ok: true, status: 200, error: null, value: requested };
  }

  return { ok: true, status: 200, error: null, value: null };
};

const parseEnumValuesFromColumnType = (columnType = '') => {
  const raw = String(columnType || '').trim();
  const values = [];
  const enumValuePattern = /'((?:[^'\\]|\\.)*)'/g;
  let match = enumValuePattern.exec(raw);

  while (match) {
    values.push(String(match[1] || '').replace(/\\'/g, "'"));
    match = enumValuePattern.exec(raw);
  }

  return values;
};

const getSupportedWorkoutPlanTypesFromSchema = async (db = pool) => {
  const now = Date.now();
  if (Array.isArray(workoutPlanTypeEnumCache.values) && now - workoutPlanTypeEnumCache.checkedAt < 30000) {
    return workoutPlanTypeEnumCache.values;
  }

  const [rows] = await db.query(
    `SELECT COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'workout_schedules'
       AND COLUMN_NAME = 'workout_plan_type'
     LIMIT 1`
  );

  const columnType = String(rows?.[0]?.COLUMN_TYPE || '').trim();
  const enumValues = parseEnumValuesFromColumnType(columnType);

  workoutPlanTypeEnumCache = {
    checkedAt: now,
    values: enumValues,
  };

  return enumValues;
};

const ensureWorkoutPlanTypeSupportedBySchema = async (planTypeValue, db = pool) => {
  const normalized = String(planTypeValue || '').trim();
  if (!normalized) {
    return { ok: true };
  }

  const supportedValues = await getSupportedWorkoutPlanTypesFromSchema(db);
  if (!supportedValues.includes(normalized)) {
    return {
      ok: false,
      status: 400,
      error: `Database migration required before using workout plan type "${normalized}". Run 20261017_085131a_workout_plan_type_classification_forward.sql via phpMyAdmin.`,
    };
  }

  return { ok: true };
};

const parseWorkoutGoalType = (rawValue, options = {}) => {
  const allowNull = Boolean(options?.allowNull);
  const normalized = String(rawValue ?? '').trim().toLowerCase();

  if (!normalized) {
    return {
      isSet: false,
      isValid: true,
      value: allowNull ? null : WORKOUT_GOAL_TYPE_NONE,
    };
  }

  if (['none', 'no_specific_goal', 'no-specific-goal', 'no specific goal'].includes(normalized)) {
    return { isSet: true, isValid: true, value: WORKOUT_GOAL_TYPE_NONE };
  }

  if (normalized === WORKOUT_GOAL_TYPE_BODY_WEIGHT) {
    return { isSet: true, isValid: true, value: WORKOUT_GOAL_TYPE_BODY_WEIGHT };
  }

  if (normalized === WORKOUT_GOAL_TYPE_EXERCISE_WEIGHT) {
    return { isSet: true, isValid: true, value: WORKOUT_GOAL_TYPE_EXERCISE_WEIGHT };
  }

  return { isSet: true, isValid: false, value: null };
};

const parseLinkedGoalId = (rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.trunc(parsed);
};

const resolveLinkedGoalIdForUser = async (db, userId, rawGoalId) => {
  const goalId = parseLinkedGoalId(rawGoalId);
  if (!goalId) {
    return null;
  }

  const [rows] = await db.query(
    `SELECT id
     FROM user_goals
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [goalId, userId]
  );

  if (!rows.length) {
    return null;
  }

  return goalId;
};

const validateRequestedWorkoutPlanType = (req, rawValue, options = {}) => {
  const surface = String(options?.surface || PLAN_TYPE_SURFACE_WORKOUT_BUILDER).trim() || PLAN_TYPE_SURFACE_WORKOUT_BUILDER;
  const requirePlanType = Boolean(options?.requirePlanType);
  const parsed = parseWorkoutPlanType(rawValue);

  if (!parsed.isValid) {
    return {
      ok: false,
      status: 400,
      error: getWorkoutPlanTypeValidationError(),
      value: null,
      isSet: parsed.isSet,
    };
  }

  if (!parsed.isSet) {
    if (requirePlanType) {
      return {
        ok: false,
        status: 400,
        error: 'Workout Plan Type is required.',
        value: null,
        isSet: false,
      };
    }
    return { ok: true, value: null, isSet: false };
  }

  if (surface === PLAN_TYPE_SURFACE_ADMIN_GLOBAL) {
    if (!GLOBAL_WORKOUT_PLAN_TYPES.has(parsed.value)) {
      return {
        ok: false,
        status: 400,
        error: 'Workout Plan Type must be one of: global, featured, community_shared.',
        value: null,
        isSet: true,
      };
    }

    if (!isAdminUser(req)) {
      return {
        ok: false,
        status: 403,
        error: 'Only administrators can create or manage GLOBAL workout plans.',
        value: null,
        isSet: true,
      };
    }

    if (parsed.value === COMMUNITY_SHARED_WORKOUT_PLAN_TYPE && !canCreateCommunitySharedPlan(req)) {
      return {
        ok: false,
        status: 403,
        error: 'Only administrators can create Community Shared workout plans right now.',
        value: null,
        isSet: true,
      };
    }

    return { ok: true, value: parsed.value, isSet: true };
  }

  if (GLOBAL_WORKOUT_PLAN_TYPES.has(parsed.value)) {
    return {
      ok: false,
      status: 403,
      error: 'GLOBAL workout plans must be created and managed from Admin Global Plans.',
      value: null,
      isSet: true,
    };
  }

  if (!WORKOUT_BUILDER_PLAN_TYPES.has(parsed.value)) {
    return {
      ok: false,
      status: 400,
      error: getWorkoutPlanTypeValidationError(),
      value: null,
      isSet: true,
    };
  }

  if (parsed.value === TRAINER_SHARED_WORKOUT_PLAN_TYPE && !canCreateTrainerSharedPlan(req)) {
    return {
      ok: false,
      status: 403,
      error: 'Only trainer accounts can create TRAINER_SHARED workout plans.',
      value: null,
      isSet: true,
    };
  }

  return { ok: true, value: parsed.value, isSet: true };
};

const parseGlobalWorkoutPlanTypeForAdmin = (req, rawValue) => {
  const parsed = validateRequestedWorkoutPlanType(req, rawValue, {
    surface: PLAN_TYPE_SURFACE_ADMIN_GLOBAL,
    requirePlanType: true,
  });

  if (!parsed.ok || !parsed.isSet || !GLOBAL_WORKOUT_PLAN_TYPES.has(parsed.value)) {
    return {
      ok: false,
      status: parsed.status || 400,
      error: parsed.error || 'Workout Plan Type must be one of: global, featured, community_shared.',
      value: null,
    };
  }

  return {
    ok: true,
    status: 200,
    error: null,
    value: parsed.value,
  };
};

const isRawGlobalWorkoutPlanType = (planType) => {
  const parsed = parseWorkoutPlanType(planType);
  return Boolean(parsed?.isSet && parsed?.isValid && GLOBAL_WORKOUT_PLAN_TYPES.has(parsed.value));
};

const requireAdminSessionUser = (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'User not logged in' });
    return null;
  }

  if (!isAdminUser(req)) {
    res.status(403).json({ error: 'Administrator access required' });
    return null;
  }

  return userId;
};

const hasAdminRoleInDb = async (userId) => {
  const [rbacRows] = await pool.query(
    `SELECT 1
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?
       AND LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) IN (?, ?)
       AND r.is_active = 1
     LIMIT 1`,
    [userId, ADMIN_ROLE_VALUES[0], ADMIN_ROLE_VALUES[1]]
  );

  if (rbacRows.length > 0) {
    return true;
  }

  // Legacy fallback: some environments still rely on user_profiles.user_role.
  const [profileRows] = await pool.query(
    `SELECT 1
     FROM user_profiles up
     WHERE up.user_id = ?
       AND LOWER(TRIM(COALESCE(up.user_role, ''))) IN (?, ?)
     LIMIT 1`,
    [userId, ADMIN_ROLE_VALUES[0], ADMIN_ROLE_VALUES[1]]
  );

  return profileRows.length > 0;
};

const hasTrainerRoleInDb = async (userId) => {
  const [rbacRows] = await pool.query(
    `SELECT 1
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?
       AND LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) IN (?)
       AND r.is_active = 1
     LIMIT 1`,
    [userId, TRAINER_ROLE_VALUES[0]]
  );

  if (rbacRows.length > 0) {
    return true;
  }

  const [profileRows] = await pool.query(
    `SELECT 1
     FROM user_profiles up
     WHERE up.user_id = ?
       AND LOWER(TRIM(COALESCE(up.user_role, ''))) IN (?)
     LIMIT 1`,
    [userId, TRAINER_ROLE_VALUES[0]]
  );

  return profileRows.length > 0;
};

const isGlobalPlanManagerUser = async (req, userId) => {
  if (isAdminUser(req)) {
    return 'admin';
  }
  if (isTrainerUser(req)) {
    return 'trainer';
  }

  const hasAdminRole = await hasAdminRoleInDb(userId);
  if (hasAdminRole) {
    return 'admin';
  }

  const hasTrainerRole = await hasTrainerRoleInDb(userId);
  if (hasTrainerRole) {
    return 'trainer';
  }

  return null;
};

const normalizeGlobalAccessVisibility = (rawValue, fallback = 'public') => {
  const value = String(rawValue || '').trim().toLowerCase();
  if (['premium', 'private', 'unlisted'].includes(value)) {
    return 'private';
  }
  if (['free', 'public'].includes(value)) {
    return 'public';
  }
  return fallback;
};

const requireAdminSessionUserForGlobalPlans = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'User not logged in' });
    return null;
  }

  if (isAdminUser(req) || isTrainerUser(req)) {
    return userId;
  }

  try {
    const managerRole = await isGlobalPlanManagerUser(req, userId);
    if (!managerRole) {
      res.status(403).json({ error: 'Administrator or approved trainer access required' });
      return null;
    }

    req.session.user.roleSlug = managerRole;
    return userId;
  } catch (err) {
    console.error('❌ Admin authorization check failed for global workout plans:', err);
    res.status(500).json({ error: 'Authorization check failed for global workout plans' });
    return null;
  }
};

const getGlobalPlanOwnerUserId = async (scheduleId) => {
  const [rows] = await pool.query(
    `SELECT user_id
     FROM workout_schedules
     WHERE id = ?
       AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
     LIMIT 1`,
    [scheduleId, ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
  );

  if (!rows.length) {
    return 0;
  }

  return Number(rows[0]?.user_id || 0);
};

const enforceTrainerOwnsGlobalPlan = async (req, res, userId, scheduleId) => {
  if (isAdminUser(req)) {
    return true;
  }

  const ownerUserId = await getGlobalPlanOwnerUserId(scheduleId);
  if (!ownerUserId) {
    res.status(404).json({ error: 'Global workout plan not found' });
    return false;
  }

  if (ownerUserId !== Number(userId)) {
    res.status(403).json({ error: 'You can only manage global workout plans that you created.' });
    return false;
  }

  return true;
};

const isGlobalPlanSchemaCompatibilityError = (err) => {
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(String(err?.code || '').trim());
};

const refreshWorkoutPlannerSchemaState = async (db = pool) => {
  const [columnRows] = await db.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND (
         (table_name = 'workout_schedules' AND column_name = 'use_custom_workout_log_order')
         OR
         (table_name = 'workout_schedules' AND column_name = 'workout_plan_type')
         OR
         (table_name = 'workout_schedules' AND column_name = 'goal_type')
         OR
         (table_name = 'workout_schedules' AND column_name = 'goal_target_date')
         OR
         (table_name = 'workout_schedules' AND column_name = 'plan_duration_weeks')
         OR
         (table_name = 'workout_schedules' AND column_name = 'linked_goal_id')
         OR
         (table_name = 'workout_schedules' AND column_name = 'source_global_plan_id')
         OR
         (table_name = 'workout_schedules' AND column_name = 'global_plan_adopted_at')
         OR
         (table_name = 'workout_schedules' AND column_name = 'cover_image_storage_key')
         OR
         (table_name = 'workout_schedules' AND column_name = 'cover_image_content_type')
         OR
         (table_name = 'workout_schedules' AND column_name = 'cover_image_updated_at')
         OR
         (table_name = 'workout_schedule_exercises' AND column_name = 'target_distance_miles')
         OR
         (table_name = 'workout_schedule_groups' AND column_name = 'workout_log_display_order')
       )`
  );

  workoutPlannerSchemaState.checked = true;
  workoutPlannerSchemaState.hasUseCustomWorkoutLogOrder = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'use_custom_workout_log_order'
  );
  workoutPlannerSchemaState.hasWorkoutLogDisplayOrder = columnRows.some(
    (row) => row?.table_name === 'workout_schedule_groups' && row?.column_name === 'workout_log_display_order'
  );
  workoutPlannerSchemaState.hasWorkoutPlanType = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'workout_plan_type'
  );
  workoutPlannerSchemaState.hasGoalType = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'goal_type'
  );
  workoutPlannerSchemaState.hasGoalTargetDate = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'goal_target_date'
  );
  workoutPlannerSchemaState.hasPlanDurationWeeks = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'plan_duration_weeks'
  );
  workoutPlannerSchemaState.hasLinkedGoalId = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'linked_goal_id'
  );
  workoutPlannerSchemaState.hasSourceGlobalPlanId = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'source_global_plan_id'
  );
  workoutPlannerSchemaState.hasGlobalPlanAdoptedAt = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'global_plan_adopted_at'
  );
  workoutPlannerSchemaState.hasCoverImageStorageKey = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'cover_image_storage_key'
  );
  workoutPlannerSchemaState.hasCoverImageContentType = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'cover_image_content_type'
  );
  workoutPlannerSchemaState.hasCoverImageUpdatedAt = columnRows.some(
    (row) => row?.table_name === 'workout_schedules' && row?.column_name === 'cover_image_updated_at'
  );
  workoutPlannerSchemaState.hasTargetDistanceMiles = columnRows.some(
    (row) => row?.table_name === 'workout_schedule_exercises' && row?.column_name === 'target_distance_miles'
  );

  return { ...workoutPlannerSchemaState };
};

const getWorkoutPlannerSchemaState = async (db = pool, options = {}) => {
  const forceRefresh = Boolean(options?.forceRefresh);
  if (forceRefresh || !workoutPlannerSchemaState.checked) {
    return refreshWorkoutPlannerSchemaState(db);
  }
  return { ...workoutPlannerSchemaState };
};

const ensureWorkoutPlannerOrderingColumns = async (db = pool) => {
  let schemaState = await getWorkoutPlannerSchemaState(db);

  const alterations = [];
  if (!schemaState.hasUseCustomWorkoutLogOrder) {
    alterations.push(
      `ALTER TABLE workout_schedules
       ADD COLUMN use_custom_workout_log_order TINYINT(1) NOT NULL DEFAULT 0 AFTER schedule_mode`
    );
  }
  if (!schemaState.hasWorkoutLogDisplayOrder) {
    alterations.push(
      `ALTER TABLE workout_schedule_groups
       ADD COLUMN workout_log_display_order INT(11) NULL DEFAULT NULL AFTER sort_order`
    );
  }
  if (!schemaState.hasLinkedGoalId) {
    alterations.push(
      `ALTER TABLE workout_schedules
       ADD COLUMN linked_goal_id BIGINT UNSIGNED NULL AFTER workout_plan_type`
    );
  }
  if (!schemaState.hasGoalType) {
    alterations.push(
      `ALTER TABLE workout_schedules
       ADD COLUMN goal_type ENUM('none', 'body_weight', 'exercise_weight') NULL DEFAULT NULL AFTER workout_plan_type`
    );
  }
  if (!schemaState.hasSourceGlobalPlanId) {
    alterations.push(
      `ALTER TABLE workout_schedules
       ADD COLUMN source_global_plan_id BIGINT UNSIGNED NULL AFTER workout_plan_type`
    );
  }
  if (!schemaState.hasGlobalPlanAdoptedAt) {
    alterations.push(
      `ALTER TABLE workout_schedules
       ADD COLUMN global_plan_adopted_at DATETIME NULL AFTER source_global_plan_id`
    );
  }

  for (const statement of alterations) {
    try {
      await db.query(statement);
      console.log('✅ Applied workout planner ordering schema patch.');
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME') {
        console.error('⚠️ Unable to auto-apply workout planner ordering schema patch:', err?.message || err);
      }
    }
  }

  if (!schemaState.hasLinkedGoalId) {
    try {
      await db.query('ALTER TABLE workout_schedules ADD KEY idx_workout_schedules_goal_id (linked_goal_id)');
    } catch (err) {
      if (!['ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(String(err?.code || '').trim())) {
        console.error('⚠️ Unable to add workout goal link index:', err?.message || err);
      }
    }

    try {
      await db.query(
        `ALTER TABLE workout_schedules
         ADD CONSTRAINT fk_workout_schedules_goal
         FOREIGN KEY (linked_goal_id) REFERENCES user_goals(id)
         ON DELETE SET NULL ON UPDATE CASCADE`
      );
    } catch (err) {
      if (!['ER_FK_DUP_NAME', 'ER_CANT_CREATE_TABLE'].includes(String(err?.code || '').trim())) {
        console.error('⚠️ Unable to add workout goal link foreign key:', err?.message || err);
      }
    }
  }

  if (!schemaState.hasSourceGlobalPlanId) {
    try {
      await db.query('ALTER TABLE workout_schedules ADD KEY idx_workout_schedules_source_global (source_global_plan_id)');
    } catch (err) {
      if (!['ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(String(err?.code || '').trim())) {
        console.error('⚠️ Unable to add source global plan index:', err?.message || err);
      }
    }

    try {
      await db.query(
        `ALTER TABLE workout_schedules
         ADD CONSTRAINT fk_workout_schedules_source_global
         FOREIGN KEY (source_global_plan_id) REFERENCES workout_schedules(id)
         ON DELETE SET NULL ON UPDATE CASCADE`
      );
    } catch (err) {
      if (!['ER_FK_DUP_NAME', 'ER_CANT_CREATE_TABLE'].includes(String(err?.code || '').trim())) {
        console.error('⚠️ Unable to add source global plan foreign key:', err?.message || err);
      }
    }
  }

  if (alterations.length > 0) {
    schemaState = await getWorkoutPlannerSchemaState(db, { forceRefresh: true });
  }

  return schemaState;
};

const normalizeGroupLabels = (groups = []) => {
  return (Array.isArray(groups) ? groups : [])
    .map((group) => String(group || '').trim())
    .filter(Boolean);
};

const WORKOUT_DAY_NAME_MAX_LENGTH = 60;
const WORKOUT_DAY_NAME_ALLOWED_PATTERN = /^[A-Za-z0-9&'() -]+$/;

const buildBadRequestError = (message) => {
  const error = new Error(String(message || 'Invalid request.'));
  error.statusCode = 400;
  return error;
};

const validateWorkoutGroupLabel = (rawValue, options = {}) => {
  const label = String(options?.label || 'Workout day name').trim() || 'Workout day name';
  const typedValue = String(rawValue ?? '');

  if (typedValue.length > WORKOUT_DAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `${label} can be at most ${WORKOUT_DAY_NAME_MAX_LENGTH} characters.`,
    };
  }

  const trimmedValue = typedValue.trim();
  if (!trimmedValue) {
    return {
      ok: false,
      message: `${label} cannot be empty.`,
    };
  }

  if (!WORKOUT_DAY_NAME_ALLOWED_PATTERN.test(trimmedValue)) {
    return {
      ok: false,
      message: `${label} may only contain letters, numbers, spaces, ampersands, apostrophes, hyphens, and parentheses.`,
    };
  }

  return { ok: true, value: trimmedValue };
};

const collectGlobalPlanCompletenessErrors = (planner = {}) => {
  const metadata = planner?.metadata || {};
  const scheduleMode = String(planner?.scheduleMode || 'day').trim() === 'week' ? 'week' : 'day';
  const dayGroups = normalizeGroupLabels(planner?.dayGroups || []);
  const weekGroups = normalizeGroupLabels(planner?.weekGroups || []);
  const exercises = Array.isArray(planner?.exercises) ? planner.exercises : [];

  const missing = [];

  if (!String(metadata?.name || '').trim()) {
    missing.push('plan name');
  }

  if (!String(metadata?.type || '').trim()) {
    missing.push('workout type');
  }

  if (!String(metadata?.category || '').trim()) {
    missing.push('category');
  }

  const activeGroups = scheduleMode === 'week' ? weekGroups : dayGroups;
  if (activeGroups.length < 1) {
    missing.push('at least one workout day');
  }

  if (exercises.length < GLOBAL_WORKOUT_MIN_EXERCISES) {
    missing.push('at least one exercise');
  }

  return missing;
};

const buildGlobalPlanCompletenessErrorMessage = (missing = []) => {
  if (!Array.isArray(missing) || !missing.length) {
    return `${GLOBAL_WORKOUT_COMPLETENESS_PREFIX} validation details are unavailable.`;
  }
  return `${GLOBAL_WORKOUT_COMPLETENESS_PREFIX} ${missing.join(', ')}.`;
};

const extractWorkoutPlans = (settings) => {
  const planner = settings?.workoutPlanner || {};
  const plans = Array.isArray(planner?.plans) ? planner.plans.filter(Boolean) : [];
  const currentPlan = planner?.currentPlan && typeof planner.currentPlan === 'object'
    ? planner.currentPlan
    : null;

  if (!currentPlan) {
    return plans;
  }

  const currentPlanId = String(currentPlan?.planId || '').trim();
  if (currentPlanId && !plans.some((plan) => String(plan?.planId || '').trim() === currentPlanId)) {
    return [...plans, currentPlan];
  }

  return plans;
};

const normalizeExerciseNameForCounting = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return normalized.replace(/\s+/g, ' ');
};

const toUniqueExerciseKey = (exercise = {}) => {
  const exerciseIdCandidates = [
    exercise?.exerciseId,
    exercise?.ExerciseID,
  ];

  for (const candidate of exerciseIdCandidates) {
    const numericId = Number(candidate || 0);
    if (Number.isFinite(numericId) && numericId > 0) {
      return `id:${numericId}`;
    }
  }

  const normalizedName = normalizeExerciseNameForCounting(
    exercise?.name || exercise?.exerciseName || exercise?.ExerciseTitle || exercise?.title || ''
  );

  if (!normalizedName) {
    return '';
  }

  return `name:${normalizedName}`;
};

const countUniqueExercises = (exercises = []) => {
  if (!Array.isArray(exercises) || !exercises.length) {
    return 0;
  }

  const unique = new Set();
  exercises.forEach((exercise) => {
    const key = toUniqueExerciseKey(exercise);
    if (key) {
      unique.add(key);
    }
  });
  return unique.size;
};

const serializeWorkoutListItem = (plan) => {
  const exercises = Array.isArray(plan?.exercises) ? plan.exercises : [];
  const firstExerciseWithImage = exercises.find((exercise) => {
    const candidate = String(exercise?.image || exercise?.ImageURL || '').trim();
    return Boolean(candidate);
  });

  return {
    planId: String(plan?.planId || '').trim(),
    name: String(plan?.metadata?.name || '').trim() || 'Untitled Workout',
    type: String(plan?.metadata?.type || 'Strength').trim() || 'Strength',
    estimatedDuration: Number(plan?.metadata?.estimatedDuration || 0),
    planDurationWeeks: serializePlanDurationWeeks(plan?.metadata?.planDurationWeeks),
    exerciseCount: countUniqueExercises(exercises),
    coverImage: String(firstExerciseWithImage?.image || firstExerciseWithImage?.ImageURL || '').trim(),
    updatedAt: plan?.updatedAt || null,
  };
};

const hasSavedWorkoutExerciseList = (settings) => {
  const plans = extractWorkoutPlans(settings);
  return plans.some((plan) => Array.isArray(plan?.exercises) && plan.exercises.length > 0);
};

const normalizePlannerPayload = (planner = {}) => {
  const defaultDayGroups = ['Any Day'];
  const defaultWeekGroups = ['Week 1'];

  const normalizeOrderEntries = (entries, fallbackGroups) => {
    const source = Array.isArray(entries) ? entries : [];
    const byLabel = new Map();

    source.forEach((entry, index) => {
      const label = String(entry?.label || '').trim();
      if (!label) {
        return;
      }
      const numericOrder = Number(entry?.sortOrder);
      byLabel.set(
        label.toLowerCase(),
        Number.isFinite(numericOrder) && numericOrder > 0 ? numericOrder : index + 1
      );
    });

    const normalizedGroups = fallbackGroups.map((label) => String(label || '').trim()).filter(Boolean);
    const orderedGroups = [...normalizedGroups].sort((left, right) => {
      const leftOrder = byLabel.get(left.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = byLabel.get(right.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return normalizedGroups.indexOf(left) - normalizedGroups.indexOf(right);
    });

    return {
      orderedGroups,
      orderEntries: orderedGroups.map((label, index) => ({ label, sortOrder: index + 1 })),
    };
  };

  const incomingDayGroups = Array.isArray(planner.dayGroups)
    ? planner.dayGroups.map((v, index) => {
      const validation = validateWorkoutGroupLabel(v, { label: `Workout day ${index + 1}` });
      if (!validation.ok) {
        throw buildBadRequestError(validation.message);
      }
      return validation.value;
    })
    : defaultDayGroups;

  const incomingWeekGroups = Array.isArray(planner.weekGroups)
    ? planner.weekGroups.map((v, index) => {
      const validation = validateWorkoutGroupLabel(v, { label: `Workout week ${index + 1}` });
      if (!validation.ok) {
        throw buildBadRequestError(validation.message);
      }
      return validation.value;
    })
    : defaultWeekGroups;

  const normalizedDayGroupsBase = incomingDayGroups.length > 0 ? incomingDayGroups : defaultDayGroups;
  const normalizedWeekGroupsBase = incomingWeekGroups.length > 0 ? incomingWeekGroups : defaultWeekGroups;

  const dayOrderInfo = normalizeOrderEntries(planner.dayGroupOrders, normalizedDayGroupsBase);
  const weekOrderInfo = normalizeOrderEntries(planner.weekGroupOrders, normalizedWeekGroupsBase);

  const normalizedDayGroups = dayOrderInfo.orderedGroups.length ? dayOrderInfo.orderedGroups : defaultDayGroups;
  const normalizedWeekGroups = weekOrderInfo.orderedGroups.length ? weekOrderInfo.orderedGroups : defaultWeekGroups;
  const mode = planner.scheduleMode === 'week' ? 'week' : 'day';
  const fallbackGroup = mode === 'week' ? normalizedWeekGroups[0] : normalizedDayGroups[0];

  const exercises = Array.isArray(planner.exercises)
    ? planner.exercises.map((exercise, index) => ({
        id: String(exercise?.id || ''),
        exerciseId: Number(exercise?.exerciseId || 0),
        name: String(exercise?.name || '').trim(),
        image: String(exercise?.image || '').trim(),
        workoutType: String(exercise?.workoutType || '').trim(),
        muscleGroup: String(exercise?.muscleGroup || '').trim(),
        equipment: String(exercise?.equipment || '').trim(),
        sets: Number(exercise?.sets || 0),
        reps: Number(exercise?.reps || 0),
        weight: Number(exercise?.weight || 0),
        duration: Number(exercise?.duration || 0),
        distance: Number(exercise?.distance || 0),
        restTime: Number(exercise?.restTime || 0),
        notes: String(exercise?.notes || '').trim(),
        scheduleGroup: (() => {
          const validation = validateWorkoutGroupLabel(exercise?.scheduleGroup || fallbackGroup, {
            label: `Workout ${mode === 'week' ? 'week' : 'day'} for exercise ${index + 1}`,
          });
          if (!validation.ok) {
            throw buildBadRequestError(validation.message);
          }
          return validation.value;
        })(),
      }))
    : [];

  const metadata = {
    name: String(planner?.metadata?.name || '').trim(),
    description: String(planner?.metadata?.description || '').trim(),
    type: String(planner?.metadata?.type || 'Strength').trim() || 'Strength',
    category: normalizeWorkoutPlanCategory(planner?.metadata?.category).value,
    planType: parseWorkoutPlanType(planner?.metadata?.planType).value,
    goalType: parseWorkoutGoalType(planner?.metadata?.goalType).value,
    goalTargetDate: serializeGoalTargetDate(planner?.metadata?.goalTargetDate),
    planDurationWeeks: serializePlanDurationWeeks(planner?.metadata?.planDurationWeeks),
    goalId: String(parseLinkedGoalId(planner?.metadata?.goalId) || ''),
    estimatedDuration: Number(planner?.metadata?.estimatedDuration || 0),
    accessLevel: String(planner?.metadata?.accessLevel || '').trim(),
  };

  const incomingPlanId = String(planner?.planId || '').trim();

  const categoryValidation = normalizeWorkoutPlanCategory(planner?.metadata?.category);

  return {
    version: 1,
    planId: incomingPlanId || buildPlanId(),
    scheduleMode: mode,
    dayGroups: normalizedDayGroups,
    weekGroups: normalizedWeekGroups,
    dayGroupOrders: dayOrderInfo.orderEntries,
    weekGroupOrders: weekOrderInfo.orderEntries,
    metadata: {
      ...metadata,
      category: categoryValidation.isSet ? categoryValidation.value : null,
    },
    exercises,
    updatedAt: new Date().toISOString(),
  };
};

//Gets user ID
router.get('/user-id', (req, res) => {
    if (req.session?.user?.id) {
      return res.json({ userId: req.session.user.id });
    }
    res.status(401).json({ error: 'User not logged in' });
  });

//Get Users
  router.get('/users', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM users');
      res.status(200).json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users', details: err.message });
    }
  });

// Get current user's profile settings JSON
router.get('/user-profile-settings', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);

    let userRows = [];
    try {
      // Preferred shape when Email column exists.
      [userRows] = await pool.query(
        'SELECT FirstName, LastName, username, Email FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
    } catch (err) {
      // Backward-compatible fallback for schemas where only username exists.
      if (err?.code === 'ER_BAD_FIELD_ERROR') {
        [userRows] = await pool.query(
          'SELECT FirstName, LastName, username FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
      } else {
        throw err;
      }
    }

    const user = userRows?.[0] || {};
    
    // Apply default avatar if none exists
    const avatarPath = user?.avatarPath || '/images/avatar/default.png';
    const avatarName = user?.avatarName || 'default.png';
    
    const profile = {
      firstName: user?.FirstName || '',
      lastName: user?.LastName || '',
      username: user?.username || '',
      email: user?.Email || user?.email || user?.username || '',
      avatarPath: avatarPath,
      avatarName: avatarName,
    };

    if (!rows.length) {
      return res.json({ settings: {}, profile });
    }

    let parsed = {};
    const raw = rows[0]?.settings;
    if (typeof raw === 'string' && raw.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        parsed = {};
      }
    } else if (raw && typeof raw === 'object') {
      parsed = raw;
    }

    return res.json({ settings: parsed || {}, profile });
  } catch (err) {
    console.error('❌ Failed to get user profile settings:', err);
    return res.status(500).json({ error: 'Failed to load user profile settings' });
  }
});

// Save/merge current user's profile settings JSON
router.put('/user-profile-settings', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const incoming = req.body?.settings;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'settings object is required' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    let currentSettings = {};
    if (rows.length > 0) {
      const raw = rows[0]?.settings;
      if (typeof raw === 'string' && raw.trim()) {
        try {
          currentSettings = JSON.parse(raw) || {};
        } catch (_) {
          currentSettings = {};
        }
      } else if (raw && typeof raw === 'object') {
        currentSettings = raw;
      }
    }

    const mergedSettings = deepMerge(currentSettings, incoming);

    await pool.query(
      `INSERT INTO user_profiles (user_id, user_role, tier, settings)
       VALUES (?, 'member', 1, ?)
       ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
      [userId, JSON.stringify(mergedSettings)]
    );

    return res.json({ message: 'Profile settings saved', settings: mergedSettings });
  } catch (err) {
    console.error('❌ Failed to save user profile settings:', err);
    return res.status(500).json({ error: 'Failed to save user profile settings' });
  }
});

const serializeScheduleListItem = (row = {}) => ({
  planId: String(row.id || ''),
  name: String(row.title || '').trim() || 'Untitled Workout',
  description: String(row.description || '').trim(),
  type: String(row.workout_type || 'Strength').trim() || 'Strength',
  category: normalizeWorkoutPlanCategory(row.category).value,
  planType: parseWorkoutPlanType(row.workout_plan_type).value,
  goalType: parseWorkoutGoalType(row.goal_type).value,
  goalTargetDate: serializeGoalTargetDate(row.goal_target_date),
  planDurationWeeks: serializePlanDurationWeeks(row.plan_duration_weeks),
  sourceGlobalPlanId: row.source_global_plan_id != null ? Number(row.source_global_plan_id) : null,
  sourceGlobalPlanName: String(row.source_global_plan_name || '').trim() || '',
  globalPlanAdoptedAt: row.global_plan_adopted_at || null,
  estimatedDuration: Number(row.estimated_duration_minutes || 0),
  dayCount: Number(row.day_count || 0),
  exerciseCount: Number(row.exercise_count || 0),
  coverImage: resolveWorkoutPlanCoverImageReference(row),
  hasCustomCoverImage: Boolean(String(row.cover_image_storage_key || '').trim()),
  status: String(row.status || 'draft').trim() || 'draft',
  visibility: String(row.visibility || 'private').trim() || 'private',
  updatedAt: row.updated_at || null,
});

const loadSchedulesForUser = async (userId) => {
  const schemaState = await getWorkoutPlannerSchemaState();
  const planTypeSelect = schemaState.hasWorkoutPlanType
    ? 'ws.workout_plan_type,'
    : 'NULL AS workout_plan_type,';
  const categorySelect = 'ws.category,';
  const goalTypeSelect = schemaState.hasGoalType
    ? 'ws.goal_type,'
    : 'NULL AS goal_type,';
  const goalTargetDateSelect = schemaState.hasGoalTargetDate
    ? 'ws.goal_target_date,'
    : 'NULL AS goal_target_date,';
  const planDurationWeeksSelect = schemaState.hasPlanDurationWeeks
    ? 'ws.plan_duration_weeks,'
    : 'NULL AS plan_duration_weeks,';
  const sourceGlobalPlanIdSelect = schemaState.hasSourceGlobalPlanId
    ? 'ws.source_global_plan_id,'
    : 'NULL AS source_global_plan_id,';
  const globalPlanAdoptedAtSelect = schemaState.hasGlobalPlanAdoptedAt
    ? 'ws.global_plan_adopted_at,'
    : 'NULL AS global_plan_adopted_at,';
  const sourceGlobalPlanNameSelect = schemaState.hasSourceGlobalPlanId
    ? 'COALESCE(source_global.title, \"\") AS source_global_plan_name,'
    : 'NULL AS source_global_plan_name,';
  const coverImageStorageKeySelect = schemaState.hasCoverImageStorageKey
    ? 'ws.cover_image_storage_key,'
    : 'NULL AS cover_image_storage_key,';
  const sourceGlobalJoin = schemaState.hasSourceGlobalPlanId
    ? 'LEFT JOIN workout_schedules source_global ON source_global.id = ws.source_global_plan_id'
    : '';
  const personalPlanWhere = schemaState.hasWorkoutPlanType
    ? `
      AND (
        ws.workout_plan_type IS NULL
        OR ws.workout_plan_type NOT IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
      )`
    : '';
  const queryParams = schemaState.hasWorkoutPlanType
    ? [userId, ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
    : [userId];

  const [rows] = await pool.query(
    `SELECT
      ws.id,
      ws.title,
      ws.description,
      ws.workout_type,
      ${categorySelect}
      ${planTypeSelect}
      ${goalTypeSelect}
      ${goalTargetDateSelect}
      ${planDurationWeeksSelect}
      ${sourceGlobalPlanIdSelect}
      ${globalPlanAdoptedAtSelect}
      ${sourceGlobalPlanNameSelect}
      ${coverImageStorageKeySelect}
      ws.estimated_duration_minutes,
      ws.status,
      ws.visibility,
      ws.updated_at,
      COALESCE(exercise_agg.exercise_count, 0) AS exercise_count,
      exercise_agg.cover_image
    FROM workout_schedules ws
    ${sourceGlobalJoin}
    LEFT JOIN (
      SELECT
        wse.workout_schedule_id,
        COUNT(DISTINCT
          CASE
            WHEN COALESCE(wse.exercise_id, 0) > 0
              THEN CONCAT('id:', CAST(wse.exercise_id AS CHAR))
            WHEN COALESCE(NULLIF(TRIM(wse.exercise_name), ''), '') <> ''
              THEN CONCAT('name:', LOWER(TRIM(wse.exercise_name)))
            ELSE NULL
          END
        ) AS exercise_count,
        MIN(
          CASE
            WHEN COALESCE(wse.exercise_image_url, e.ImageURL, '') <> ''
            THEN COALESCE(wse.exercise_image_url, e.ImageURL)
            ELSE NULL
          END
        ) AS cover_image
      FROM workout_schedule_exercises wse
      LEFT JOIN exercises e ON e.ExerciseID = wse.exercise_id
      GROUP BY wse.workout_schedule_id
    ) exercise_agg ON exercise_agg.workout_schedule_id = ws.id
    WHERE ws.user_id = ?
      ${personalPlanWhere}
    ORDER BY ws.updated_at DESC, ws.id DESC`,
    queryParams
  );

  return rows.map(serializeScheduleListItem);
};

const resolveWorkoutPlanConversionPermissionStatus = (permission = {}) => {
  const code = String(permission?.code || '').trim().toUpperCase();
  if (code === 'AUTH_REQUIRED') return 401;
  if (code === 'TARGET_TYPE_FORBIDDEN') return 403;
  if (code === 'TARGET_TYPE_UNSUPPORTED') return 422;
  return 400;
};

const resolveDestinationTitleForConversion = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return { ok: true, isSet: false, value: null };
  }

  const asText = String(rawValue);
  const trimmed = asText.trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 400,
      error: 'Destination plan name is required when destinationTitle is provided.',
      isSet: true,
      value: null,
    };
  }

  if (trimmed.length > WORKOUT_PLAN_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Destination plan name must be ${WORKOUT_PLAN_TITLE_MAX_LENGTH} characters or fewer.`,
      isSet: true,
      value: null,
    };
  }

  const sanitized = sanitizeText(trimmed, WORKOUT_PLAN_TITLE_MAX_LENGTH);
  if (!sanitized) {
    return {
      ok: false,
      status: 400,
      error: 'Destination plan name is invalid.',
      isSet: true,
      value: null,
    };
  }

  return { ok: true, isSet: true, value: sanitized };
};

const loadExerciseRowsForConversion = async (connection, exerciseIds = []) => {
  const normalizedExerciseIds = [...new Set(
    (Array.isArray(exerciseIds) ? exerciseIds : [])
      .map((value) => Number(value || 0))
      .filter((value) => value > 0)
  )];

  if (!normalizedExerciseIds.length) {
    return [];
  }

  const [rows] = await connection.query(
    `SELECT
      ExerciseID,
      ExerciseTitle,
      ImageURL,
      ImageGallery,
      PrimaryImage,
      CreatedByUserID,
      OwnerTrainerID,
      SourceExerciseID,
      ExerciseScope,
      ExercisePublicationState,
      IsGlobalExercise,
      COALESCE(IsSystemExercise, 0) AS IsSystemExercise
     FROM exercises
     WHERE ExerciseID IN (${normalizedExerciseIds.map(() => '?').join(', ')})`,
    normalizedExerciseIds
  );

  return Array.isArray(rows) ? rows : [];
};

const loadOwnedScheduleRowWithCover = async (connection, scheduleId, userId) => {
  const [rows] = await connection.query(
    `SELECT
      id,
      user_id,
      workout_plan_type,
      cover_image_storage_key,
      cover_image_content_type,
      cover_image_updated_at
     FROM workout_schedules
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [scheduleId, userId]
  );

  return rows?.[0] || null;
};

const serializeAdminUserWorkoutPlanListItem = (row = {}) => {
  const firstName = String(row.first_name || '').trim();
  const lastName = String(row.last_name || '').trim();
  const username = String(row.username || '').trim();
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Unknown User';

  return {
    planId: String(row.id || ''),
    userId: Number(row.user_id || 0) || null,
    username,
    displayName,
    planName: String(row.title || '').trim() || 'Untitled Workout',
    duration: Number(row.estimated_duration_minutes || 0),
    planDurationWeeks: serializePlanDurationWeeks(row.plan_duration_weeks),
    exerciseCount: Number(row.exercise_count || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const loadAdminUserWorkoutPlans = async () => {
  const schemaState = await getWorkoutPlannerSchemaState();
  const personalPlanWhere = schemaState.hasWorkoutPlanType
    ? `
      AND (
        ws.workout_plan_type IS NULL
        OR ws.workout_plan_type NOT IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
      )`
    : '';
  const queryParams = schemaState.hasWorkoutPlanType
    ? [...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
    : [];

  const [rows] = await pool.query(
    `SELECT
      ws.id,
      ws.user_id,
      ws.title,
      ws.estimated_duration_minutes,
      ws.created_at,
      ws.updated_at,
      u.username,
      u.FirstName AS first_name,
      u.LastName AS last_name,
      COALESCE(exercise_agg.exercise_count, 0) AS exercise_count
    FROM workout_schedules ws
    INNER JOIN users u ON u.id = ws.user_id
    LEFT JOIN (
      SELECT
        wse.workout_schedule_id,
        COUNT(DISTINCT
          CASE
            WHEN COALESCE(wse.exercise_id, 0) > 0
              THEN CONCAT('id:', CAST(wse.exercise_id AS CHAR))
            WHEN COALESCE(NULLIF(TRIM(wse.exercise_name), ''), '') <> ''
              THEN CONCAT('name:', LOWER(TRIM(wse.exercise_name)))
            ELSE NULL
          END
        ) AS exercise_count
      FROM workout_schedule_exercises wse
      GROUP BY wse.workout_schedule_id
    ) exercise_agg ON exercise_agg.workout_schedule_id = ws.id
    WHERE 1=1
      ${personalPlanWhere}
    ORDER BY ws.updated_at DESC, ws.id DESC`,
    queryParams
  );

  return rows.map(serializeAdminUserWorkoutPlanListItem);
};

const normalizeGlobalPlanTypes = (planTypes = []) => {
  const input = Array.isArray(planTypes) ? planTypes : [planTypes];
  return input
    .map((value) => parseWorkoutPlanType(value))
    .filter((entry) => entry.isValid && entry.isSet && GLOBAL_WORKOUT_PLAN_TYPES.has(entry.value))
    .map((entry) => entry.value)
    .filter((value, index, source) => source.indexOf(value) === index);
};

const loadGlobalWorkoutPlans = async ({
  planTypes = [...GLOBAL_WORKOUT_PLAN_TYPE_VALUES],
  onlyPublished = false,
  publishedVisibility = 'public',
} = {}) => {
  const schemaState = await getWorkoutPlannerSchemaState();
  if (!schemaState.hasWorkoutPlanType) {
    return [];
  }

  const normalizedPlanTypes = normalizeGlobalPlanTypes(planTypes);
  if (!normalizedPlanTypes.length) {
    return [];
  }

  const goalTypeSelect = schemaState.hasGoalType
    ? 'ws.goal_type,'
    : 'NULL AS goal_type,';
  const goalTargetDateSelect = schemaState.hasGoalTargetDate
    ? 'ws.goal_target_date,'
    : 'NULL AS goal_target_date,';
  const planDurationWeeksSelect = schemaState.hasPlanDurationWeeks
    ? 'ws.plan_duration_weeks,'
    : 'NULL AS plan_duration_weeks,';

  const typePlaceholders = normalizedPlanTypes.map(() => '?').join(', ');
  const statusPlaceholders = PUBLISHED_GLOBAL_STATUSES.map(() => '?').join(', ');
  const enforcePublicVisibility = publishedVisibility !== 'all';
  const publishedWhere = onlyPublished
    ? `
      AND LOWER(COALESCE(ws.status, '')) IN (${statusPlaceholders})
      ${enforcePublicVisibility ? "AND LOWER(COALESCE(ws.visibility, '')) = 'public'" : ''}
      AND COALESCE(NULLIF(TRIM(ws.title), ''), '') <> ''
      AND COALESCE(NULLIF(TRIM(ws.workout_type), ''), '') <> ''
      AND COALESCE(group_agg.group_count, 0) >= 1
      AND COALESCE(exercise_agg.exercise_count, 0) >= ${GLOBAL_WORKOUT_MIN_EXERCISES}`
    : '';
  const queryParams = onlyPublished
    ? [...normalizedPlanTypes, ...PUBLISHED_GLOBAL_STATUSES]
    : normalizedPlanTypes;

  let rows = [];
  try {
    const [queryRows] = await pool.query(
      `SELECT
        ws.id,
        ws.user_id,
        ws.title,
        ws.description,
        ws.workout_type,
        ws.category,
        ws.workout_plan_type,
        ${goalTypeSelect}
        ${goalTargetDateSelect}
        ${planDurationWeeksSelect}
        ws.estimated_duration_minutes,
        ws.status,
        ws.visibility,
        ws.updated_at,
        CASE
          WHEN owner_role.role_rank = 2 OR LOWER(TRIM(COALESCE(owner_profile.user_role, ''))) IN ('admin', 'administrator') THEN 'Admin'
          WHEN owner_role.role_rank = 1 OR LOWER(TRIM(COALESCE(owner_profile.user_role, ''))) IN ('trainer') THEN 'Trainer'
          ELSE 'Admin'
        END AS created_by_role,
        COALESCE(group_agg.group_count, 0) AS day_count,
        COALESCE(exercise_agg.exercise_count, 0) AS exercise_count,
        exercise_agg.cover_image
      FROM workout_schedules ws
      LEFT JOIN (
        SELECT
          ur.user_id,
          MAX(
            CASE
              WHEN LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) IN ('admin', 'administrator') THEN 2
              WHEN LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) IN ('trainer') THEN 1
              ELSE 0
            END
          ) AS role_rank
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.is_active = 1
        GROUP BY ur.user_id
      ) owner_role ON owner_role.user_id = ws.user_id
      LEFT JOIN user_profiles owner_profile ON owner_profile.user_id = ws.user_id
      LEFT JOIN (
        SELECT
          wse.workout_schedule_id,
          COUNT(DISTINCT
            CASE
              WHEN COALESCE(wse.exercise_id, 0) > 0
                THEN CONCAT('id:', CAST(wse.exercise_id AS CHAR))
              WHEN COALESCE(NULLIF(TRIM(wse.exercise_name), ''), '') <> ''
                THEN CONCAT('name:', LOWER(TRIM(wse.exercise_name)))
              ELSE NULL
            END
          ) AS exercise_count,
          MIN(
            CASE
              WHEN COALESCE(wse.exercise_image_url, e.ImageURL, '') <> ''
              THEN COALESCE(wse.exercise_image_url, e.ImageURL)
              ELSE NULL
            END
          ) AS cover_image
        FROM workout_schedule_exercises wse
        LEFT JOIN exercises e ON e.ExerciseID = wse.exercise_id
        GROUP BY wse.workout_schedule_id
      ) exercise_agg ON exercise_agg.workout_schedule_id = ws.id
      LEFT JOIN (
        SELECT
          wsg.workout_schedule_id,
          COUNT(wsg.id) AS group_count
        FROM workout_schedule_groups wsg
        WHERE COALESCE(NULLIF(TRIM(wsg.label), ''), '') <> ''
        GROUP BY wsg.workout_schedule_id
      ) group_agg ON group_agg.workout_schedule_id = ws.id
      WHERE ws.workout_plan_type IN (${typePlaceholders})
      ${publishedWhere}
      ORDER BY ws.updated_at DESC, ws.id DESC`,
      queryParams
    );
    rows = queryRows;
  } catch (err) {
    if (isGlobalPlanSchemaCompatibilityError(err)) {
      // Graceful compatibility fallback: treat missing legacy schema parts as no global plans.
      return [];
    }
    throw err;
  }

  return rows.map((row) => ({
    ...serializeScheduleListItem(row),
    ownerUserId: Number(row.user_id || 0) || null,
    createdByRole: String(row.created_by_role || '').trim() || 'Admin',
  }));
};

const normalizeGlobalPlanAccess = (visibility = '') => {
  const normalizedVisibility = String(visibility || '').trim().toLowerCase();
  if (normalizedVisibility === 'private' || normalizedVisibility === 'unlisted') {
    return 'Premium';
  }
  return 'Free';
};

const buildGlobalWorkoutPlanById = async (scheduleId) => {
  const schemaState = await getWorkoutPlannerSchemaState();
  if (!schemaState.hasWorkoutPlanType) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id, user_id, workout_plan_type
     FROM workout_schedules
     WHERE id = ?
       AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
     LIMIT 1`,
    [scheduleId, ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
  );

  if (!rows.length) {
    return null;
  }

  const ownerUserId = Number(rows[0].user_id || 0);
  if (!ownerUserId) {
    return null;
  }

  return buildPlannerFromSchedule(scheduleId, ownerUserId);
};

const hasSavedExercisesForUser = async (userId) => {
  const schemaState = await getWorkoutPlannerSchemaState();
  const personalPlanWhere = schemaState.hasWorkoutPlanType
    ? `
       AND (
         ws.workout_plan_type IS NULL
         OR ws.workout_plan_type NOT IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
       )`
    : '';
  const queryParams = schemaState.hasWorkoutPlanType
    ? [userId, ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
    : [userId];

  const [rows] = await pool.query(
    `SELECT 1
     FROM workout_schedules ws
     INNER JOIN workout_schedule_exercises wse ON wse.workout_schedule_id = ws.id
     WHERE ws.user_id = ?
     ${personalPlanWhere}
     LIMIT 1`,
    queryParams
  );
  return rows.length > 0;
};

const ADOPTION_ALLOWED_SCOPE = Object.freeze({
  SYSTEM: 'SYSTEM',
  SHARED: 'SHARED',
  CUSTOM: 'CUSTOM',
});

const cleanupAdoptionCopiedMedia = async (storageKeys = []) => {
  const uniqueStorageKeys = [...new Set((Array.isArray(storageKeys) ? storageKeys : []).filter(Boolean))];
  for (const storageKey of uniqueStorageKeys) {
    try {
      await deleteObjectViaGateway({
        storageKey,
        appName: 'Workout-Atlas',
      });
    } catch (cleanupErr) {
      console.error('⚠️ Adoption rollback media cleanup failed:', cleanupErr?.message || cleanupErr);
    }
  }
};

const cleanupWorkoutPlanCoverForSchedule = async (scheduleRowOrId) => {
  const scheduleId = Number(
    typeof scheduleRowOrId === 'object'
      ? scheduleRowOrId?.id
      : scheduleRowOrId
  );

  if (!scheduleId) {
    return { hadCover: false, deleted: false };
  }

  const planRow = (scheduleRowOrId && typeof scheduleRowOrId === 'object' && scheduleRowOrId.id)
    ? scheduleRowOrId
    : await getWorkoutPlanCoverRow(pool, scheduleId);

  if (!planRow) {
    return { hadCover: false, deleted: false };
  }

  return deleteWorkoutPlanCover({
    pool,
    plan: {
      id: planRow.id,
      cover_image_storage_key: planRow.cover_image_storage_key,
    },
  });
};

const mapPlannerExercisesForAdoption = async ({
  connection,
  req,
  recipientUserId,
  sourcePlanner,
  copiedMediaStorageKeys,
}) => {
  const plannerExercises = Array.isArray(sourcePlanner?.exercises) ? sourcePlanner.exercises : [];
  if (!plannerExercises.length) {
    const error = new Error('The selected workout plan does not contain adoptable exercises.');
    error.statusCode = 409;
    throw error;
  }

  const normalizedSourceExerciseIds = [...new Set(
    plannerExercises.map((exercise, index) => {
      const sourceExerciseId = Number(exercise?.exerciseId || 0);
      if (!sourceExerciseId) {
        const invalidError = new Error(`The source workout contains an invalid exercise reference at position ${index + 1}.`);
        invalidError.statusCode = 409;
        throw invalidError;
      }
      return sourceExerciseId;
    })
  )];

  const [sourceExerciseRows] = await connection.query(
    `SELECT
      ExerciseID,
      ExerciseTitle,
      ImageURL,
      ImageGallery,
      PrimaryImage,
      CreatedByUserID,
      OwnerTrainerID,
      SourceExerciseID,
      ExerciseScope,
      ExercisePublicationState,
      IsGlobalExercise,
      COALESCE(IsSystemExercise, 0) AS IsSystemExercise
     FROM exercises
     WHERE ExerciseID IN (${normalizedSourceExerciseIds.map(() => '?').join(', ')})`,
    normalizedSourceExerciseIds
  );

  const sourceExerciseById = new Map();
  for (const row of Array.isArray(sourceExerciseRows) ? sourceExerciseRows : []) {
    sourceExerciseById.set(Number(row.ExerciseID || 0), row);
  }

  const missingSourceExerciseIds = normalizedSourceExerciseIds.filter((sourceExerciseId) => !sourceExerciseById.has(sourceExerciseId));
  if (missingSourceExerciseIds.length) {
    const missingError = new Error(`Plan adoption failed. Missing source exercise(s): ${missingSourceExerciseIds.join(', ')}.`);
    missingError.statusCode = 409;
    throw missingError;
  }

  const copiedCustomBySourceExerciseId = new Map();
  const mappedExercises = [];

  for (let index = 0; index < plannerExercises.length; index += 1) {
    const plannerExercise = plannerExercises[index] || {};
    const sourceExerciseId = Number(plannerExercise.exerciseId || 0);
    const sourceExercise = sourceExerciseById.get(sourceExerciseId);

    if (!canReadExerciseForUser({ req, exercise: sourceExercise })) {
      const accessError = new Error(`Plan adoption failed. Exercise ${sourceExerciseId} is not visible to the recipient.`);
      accessError.statusCode = 403;
      throw accessError;
    }

    const sourceProfile = getExerciseAccessProfile(sourceExercise);
    const sourceScope = String(sourceProfile?.explicitScope || '').trim().toUpperCase();
    let adoptedExerciseId = sourceExerciseId;
    let adoptedExerciseImage = String(plannerExercise?.image || sourceExercise?.ImageURL || '').trim();

    if (sourceScope === ADOPTION_ALLOWED_SCOPE.CUSTOM) {
      if (!copiedCustomBySourceExerciseId.has(sourceExerciseId)) {
        const copiedExerciseId = await copyCustomExerciseForRecipient({
          sourceExerciseId,
          recipientUserId,
          connection,
          onCopyCreated: ({ copiedStorageKeys = [] }) => {
            for (const storageKey of copiedStorageKeys) {
              copiedMediaStorageKeys.push(storageKey);
            }
          },
        });

        const [copiedRows] = await connection.query(
          `SELECT ExerciseID, ImageURL
           FROM exercises
           WHERE ExerciseID = ?
           LIMIT 1`,
          [copiedExerciseId]
        );

        const copiedRow = copiedRows?.[0] || null;
        if (!copiedRow) {
          const copyMissingError = new Error(`Plan adoption failed. Copied exercise ${copiedExerciseId} is unavailable.`);
          copyMissingError.statusCode = 500;
          throw copyMissingError;
        }

        copiedCustomBySourceExerciseId.set(sourceExerciseId, {
          exerciseId: Number(copiedRow.ExerciseID || 0),
          imageUrl: String(copiedRow.ImageURL || '').trim(),
        });
      }

      const copiedExercise = copiedCustomBySourceExerciseId.get(sourceExerciseId);
      adoptedExerciseId = Number(copiedExercise?.exerciseId || 0);
      if (!adoptedExerciseId) {
        const copyInvalidError = new Error(`Plan adoption failed. Invalid copied exercise ID for source ${sourceExerciseId}.`);
        copyInvalidError.statusCode = 500;
        throw copyInvalidError;
      }
      adoptedExerciseImage = String(copiedExercise?.imageUrl || adoptedExerciseImage).trim();
    } else if (sourceScope === ADOPTION_ALLOWED_SCOPE.SYSTEM || sourceScope === ADOPTION_ALLOWED_SCOPE.SHARED) {
      adoptedExerciseId = sourceExerciseId;
    } else {
      const unsupportedScopeError = new Error(`Plan adoption failed. Unsupported exercise scope "${sourceScope || 'UNKNOWN'}" for exercise ${sourceExerciseId}.`);
      unsupportedScopeError.statusCode = 409;
      throw unsupportedScopeError;
    }

    mappedExercises.push({
      ...plannerExercise,
      exerciseId: adoptedExerciseId,
      image: adoptedExerciseImage,
    });
  }

  return {
    ...sourcePlanner,
    exercises: mappedExercises,
  };
};

const buildPlannerFromSchedule = async (scheduleId, userId) => {
  const schemaState = await getWorkoutPlannerSchemaState();

  const [scheduleRows] = await pool.query(
    `SELECT *
     FROM workout_schedules
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [scheduleId, userId]
  );

  if (!scheduleRows.length) {
    return null;
  }

  const schedule = scheduleRows[0];
  let sourceGlobalPlanName = '';
  let linkedGoal = null;

  if (schemaState.hasSourceGlobalPlanId) {
    const sourceGlobalPlanId = Number(schedule?.source_global_plan_id || 0);
    if (sourceGlobalPlanId > 0) {
      const [[sourceRow]] = await pool.query(
        `SELECT title
         FROM workout_schedules
         WHERE id = ?
         LIMIT 1`,
        [sourceGlobalPlanId]
      );
      sourceGlobalPlanName = String(sourceRow?.title || '').trim();
    }
  }

  if (schemaState.hasLinkedGoalId) {
    const linkedGoalId = parseLinkedGoalId(schedule?.linked_goal_id);
    if (linkedGoalId) {
      const [goalRows] = await pool.query(
        `SELECT
          ug.id,
          ug.goal_type,
          ug.exercise_id,
          COALESCE(ug.exercise_name, e.ExerciseTitle, '') AS exercise_name,
          ug.target_value,
          ug.target_unit,
          ug.target_date,
          ug.status
         FROM user_goals ug
         LEFT JOIN exercises e ON e.ExerciseID = ug.exercise_id
         WHERE ug.id = ? AND ug.user_id = ?
         LIMIT 1`,
        [linkedGoalId, userId]
      );

      if (goalRows.length) {
        const row = goalRows[0] || {};
        linkedGoal = {
          id: Number(row.id || 0),
          goalType: String(row.goal_type || '').trim(),
          exerciseId: Number(row.exercise_id || 0) || null,
          exerciseName: String(row.exercise_name || '').trim(),
          targetValue: Number(row.target_value || 0),
          targetUnit: String(row.target_unit || 'lb').trim() || 'lb',
          targetDate: row.target_date ? String(row.target_date) : '',
          status: String(row.status || '').trim(),
        };
      }
    }
  }

  const groupSelectFields = schemaState.hasWorkoutLogDisplayOrder
    ? 'id, label, group_type, sort_order, workout_log_display_order'
    : 'id, label, group_type, sort_order, NULL AS workout_log_display_order';

  const [groupRows] = await pool.query(
    `SELECT ${groupSelectFields}
     FROM workout_schedule_groups
     WHERE workout_schedule_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [schedule.id]
  );

  const [exerciseRows] = await pool.query(
    `SELECT
      wse.id,
      wse.workout_schedule_id,
      wse.workout_schedule_group_id,
      wse.exercise_id,
      wse.exercise_name,
      wse.exercise_image_url,
      wse.workout_type,
      wse.muscle_group,
      wse.equipment,
      wse.sort_order,
      wse.notes,
      wse.target_sets,
      wse.target_reps,
      wse.target_weight,
      wse.target_duration_minutes,
      wse.target_rest_seconds,
      ${schemaState.hasTargetDistanceMiles ? 'wse.target_distance_miles' : 'NULL AS target_distance_miles'},
      wsg.label AS group_label,
      e.ExerciseTitle,
      e.ImageURL,
      e.WorkoutType AS ExerciseWorkoutType,
      e.MuscleGroup AS ExerciseMuscleGroup,
      e.Equipment AS ExerciseEquipment
     FROM workout_schedule_exercises wse
     LEFT JOIN workout_schedule_groups wsg ON wsg.id = wse.workout_schedule_group_id
     LEFT JOIN exercises e ON e.ExerciseID = wse.exercise_id
     WHERE wse.workout_schedule_id = ?
     ORDER BY wse.sort_order ASC, wse.id ASC`,
    [schedule.id]
  );

  const scheduleMode = String(schedule.schedule_mode || 'day').trim() === 'week' ? 'week' : 'day';

  const normalizedGroupRows = Array.isArray(groupRows) ? groupRows : [];
  const dayGroupRows = normalizedGroupRows.filter((g) => ['day', 'any', 'section'].includes(String(g?.group_type || '').trim()));
  const weekGroupRows = normalizedGroupRows.filter((g) => String(g?.group_type || '').trim() === 'week');

  const dayGroups = dayGroupRows
    .map((g) => String(g.label || '').trim())
    .filter(Boolean);
  const weekGroups = weekGroupRows
    .map((g) => String(g.label || '').trim())
    .filter(Boolean);

  const dayGroupOrders = dayGroupRows
    .map((g, index) => ({
      label: String(g.label || '').trim(),
      sortOrder: Number(g.sort_order || index + 1) || index + 1,
    }))
    .filter((entry) => entry.label);

  const weekGroupOrders = weekGroupRows
    .map((g, index) => ({
      label: String(g.label || '').trim(),
      sortOrder: Number(g.sort_order || index + 1) || index + 1,
    }))
    .filter((entry) => entry.label);

  const fallbackGroup = scheduleMode === 'week'
    ? (weekGroups[0] || 'Week 1')
    : (dayGroups[0] || 'Any Day');

  const normalizedExerciseRows = Array.isArray(exerciseRows) ? exerciseRows : [];
  const exercises = normalizedExerciseRows.map((row) => ({
    id: `wse-${row.id}`,
    exerciseId: Number(row.exercise_id || 0),
    name: String(row.exercise_name || row.ExerciseTitle || '').trim(),
    image: String(row.exercise_image_url || row.ImageURL || '').trim(),
    workoutType: String(row.workout_type || row.ExerciseWorkoutType || schedule.workout_type || '').trim(),
    muscleGroup: String(row.muscle_group || row.ExerciseMuscleGroup || '').trim(),
    equipment: String(row.equipment || row.ExerciseEquipment || '').trim(),
    sets: Number(row.target_sets || 0),
    reps: Number(row.target_reps || 0),
    weight: Number(row.target_weight || 0),
    duration: Number(row.target_duration_minutes || 0),
    distance: Number(row.target_distance_miles || 0),
    restTime: Number(row.target_rest_seconds || 0),
    notes: String(row.notes || '').trim(),
    scheduleGroup: String(row.group_label || fallbackGroup).trim() || fallbackGroup,
    sortOrder: Number(row.sort_order || 0),
  }));

  return {
    version: 2,
    planId: String(schedule.id),
    scheduleMode,
    useCustomWorkoutLogOrder: schemaState.hasUseCustomWorkoutLogOrder
      ? Number(schedule.use_custom_workout_log_order || 0) === 1
      : false,
    dayGroups: dayGroups.length ? dayGroups : ['Any Day'],
    weekGroups: weekGroups.length ? weekGroups : ['Week 1'],
    dayGroupOrders: dayGroupOrders.length ? dayGroupOrders : [{ label: 'Any Day', sortOrder: 1 }],
    weekGroupOrders: weekGroupOrders.length ? weekGroupOrders : [{ label: 'Week 1', sortOrder: 1 }],
    metadata: {
      name: String(schedule.title || '').trim(),
      description: String(schedule.description || '').trim(),
      type: String(schedule.workout_type || 'Strength').trim() || 'Strength',
      category: normalizeWorkoutPlanCategory(schedule.category).value,
      planType: parseWorkoutPlanType(schedule.workout_plan_type).value,
      goalType: parseWorkoutGoalType(schedule.goal_type).value,
      goalTargetDate: serializeGoalTargetDate(schedule.goal_target_date),
      planDurationWeeks: serializePlanDurationWeeks(schedule.plan_duration_weeks),
      sourceGlobalPlanId: schedule.source_global_plan_id != null ? Number(schedule.source_global_plan_id) : null,
      sourceGlobalPlanName,
      globalPlanAdoptedAt: schedule.global_plan_adopted_at || null,
      goalId: String(linkedGoal?.id || ''),
      goalContext: linkedGoal,
      estimatedDuration: Number(schedule.estimated_duration_minutes || 0),
      hasCustomCoverImage: Boolean(String(schedule.cover_image_storage_key || '').trim()),
    },
    exercises,
    status: String(schedule.status || 'draft').trim() || 'draft',
    visibility: String(schedule.visibility || 'private').trim() || 'private',
    updatedAt: schedule.updated_at,
  };
};

const replaceScheduleGroupsAndExercises = async (connection, scheduleId, planner) => {
  const schemaState = await getWorkoutPlannerSchemaState(connection);

  const mode = planner?.scheduleMode === 'week' ? 'week' : 'day';
  const inputDayGroups = Array.isArray(planner?.dayGroups) ? planner.dayGroups : [];
  const inputWeekGroups = Array.isArray(planner?.weekGroups) ? planner.weekGroups : [];

  const dayGroups = inputDayGroups.map((v) => String(v || '').trim()).filter(Boolean);
  const weekGroups = inputWeekGroups.map((v) => String(v || '').trim()).filter(Boolean);

  const normalizedDayGroups = dayGroups.length ? dayGroups : ['Any Day'];
  const normalizedWeekGroups = weekGroups.length ? weekGroups : ['Week 1'];

  const incomingDayOrders = Array.isArray(planner?.dayGroupOrders) ? planner.dayGroupOrders : [];
  const incomingWeekOrders = Array.isArray(planner?.weekGroupOrders) ? planner.weekGroupOrders : [];

  const findSortOrder = (entries, label, fallbackIndex) => {
    const normalizedLabel = String(label || '').trim().toLowerCase();
    const found = entries.find((entry) => String(entry?.label || '').trim().toLowerCase() === normalizedLabel);
    const parsed = Number(found?.sortOrder);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackIndex + 1;
  };

  const groupEntries = mode === 'week'
    ? normalizedWeekGroups
      .map((label, index) => ({
        label,
        groupType: 'week',
        sortOrder: findSortOrder(incomingWeekOrders, label, index),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    : normalizedDayGroups
      .map((label, index) => ({
        label,
        groupType: label.toLowerCase() === 'any day' ? 'any' : 'day',
        sortOrder: findSortOrder(incomingDayOrders, label, index),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

  let scheduleRow = null;
  if (schemaState.hasUseCustomWorkoutLogOrder) {
    const [rows] = await connection.query(
      `SELECT use_custom_workout_log_order
       FROM workout_schedules
       WHERE id = ?
       LIMIT 1`,
      [scheduleId]
    );
    scheduleRow = rows?.[0] || null;
  }

  const preserveCustomWorkoutLogOrder = schemaState.hasUseCustomWorkoutLogOrder
    ? Number(scheduleRow?.use_custom_workout_log_order || 0) === 1
    : false;
  const existingWorkoutLogOrderByLabel = new Map();

  if (preserveCustomWorkoutLogOrder && schemaState.hasWorkoutLogDisplayOrder) {
    const [existingGroupRows] = await connection.query(
      `SELECT label, workout_log_display_order
       FROM workout_schedule_groups
       WHERE workout_schedule_id = ?
         AND workout_log_display_order IS NOT NULL`,
      [scheduleId]
    );

    for (const row of existingGroupRows) {
      const normalizedLabel = String(row?.label || '').trim().toLowerCase();
      const orderValue = Number(row?.workout_log_display_order);
      if (!normalizedLabel || !Number.isFinite(orderValue) || orderValue <= 0) {
        continue;
      }
      existingWorkoutLogOrderByLabel.set(normalizedLabel, orderValue);
    }
  }

  await connection.query('DELETE FROM workout_schedule_exercises WHERE workout_schedule_id = ?', [scheduleId]);
  await connection.query('DELETE FROM workout_schedule_groups WHERE workout_schedule_id = ?', [scheduleId]);

  const groupIdByLabel = new Map();
  for (const groupEntry of groupEntries) {
    const normalizedLabel = String(groupEntry?.label || '').trim().toLowerCase();
    const preservedWorkoutLogDisplayOrder = preserveCustomWorkoutLogOrder
      ? (existingWorkoutLogOrderByLabel.get(normalizedLabel) ?? null)
      : null;

    let insertGroup;
    if (schemaState.hasWorkoutLogDisplayOrder) {
      [insertGroup] = await connection.query(
        `INSERT INTO workout_schedule_groups
          (workout_schedule_id, label, group_type, sort_order, workout_log_display_order)
         VALUES (?, ?, ?, ?, ?)`,
        [
          scheduleId,
          groupEntry.label,
          groupEntry.groupType,
          groupEntry.sortOrder,
          preservedWorkoutLogDisplayOrder,
        ]
      );
    } else {
      [insertGroup] = await connection.query(
        `INSERT INTO workout_schedule_groups
          (workout_schedule_id, label, group_type, sort_order)
         VALUES (?, ?, ?, ?)`,
        [
          scheduleId,
          groupEntry.label,
          groupEntry.groupType,
          groupEntry.sortOrder,
        ]
      );
    }
    groupIdByLabel.set(groupEntry.label, insertGroup.insertId);
  }

  const fallbackGroupLabel = mode === 'week' ? normalizedWeekGroups[0] : normalizedDayGroups[0];
  const exercises = Array.isArray(planner?.exercises) ? planner.exercises : [];

  for (let i = 0; i < exercises.length; i += 1) {
    const ex = exercises[i] || {};
    const label = String(ex.scheduleGroup || fallbackGroupLabel || '').trim();
    const groupId = groupIdByLabel.get(label) || null;

    const insertColumns = [
      'workout_schedule_id',
      'workout_schedule_group_id',
      'exercise_id',
      'exercise_name',
      'exercise_image_url',
      'workout_type',
      'muscle_group',
      'equipment',
      'sort_order',
      'notes',
      'target_sets',
      'target_reps',
      'target_weight',
      'target_duration_minutes',
      'target_rest_seconds',
    ];

    const insertValues = [
      scheduleId,
      groupId,
      Number(ex.exerciseId || 0) || null,
      sanitizeText(ex.name || '', 150),
      sanitizeText(ex.image || '', 255),
      sanitizeText(ex.workoutType || '', 50),
      sanitizeText(ex.muscleGroup || '', 80),
      sanitizeText(ex.equipment || '', 80),
      i + 1,
      sanitizeText(ex.notes || '', 500),
      parseNumber(ex.sets),
      parseNumber(ex.reps),
      parseNumber(ex.weight, true),
      parseNumber(ex.duration),
      parseNumber(ex.restTime),
    ];

    if (schemaState.hasTargetDistanceMiles) {
      insertColumns.push('target_distance_miles');
      insertValues.push(parseNumber(ex.distance, true));
    }

    await connection.query(
      `INSERT INTO workout_schedule_exercises
        (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertValues
    );
  }
};

// New API: create draft schedule immediately (supports zero exercises)
router.post('/workout-schedules', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const payload = req.body || {};
    const hasCategoryOverride = Object.prototype.hasOwnProperty.call(payload, 'category');
    const categoryValidation = hasCategoryOverride
      ? normalizeWorkoutPlanCategory(payload?.category)
      : { isSet: false, isValid: true, value: null };
    if (hasCategoryOverride && !categoryValidation.isValid) {
      return res.status(400).json({ error: categoryValidation.error || getWorkoutPlanCategoryValidationError() });
    }
    const hasGoalTargetDateOverride = Object.prototype.hasOwnProperty.call(payload, 'goalTargetDate');
    const goalTargetDateValidation = hasGoalTargetDateOverride
      ? normalizeWorkoutGoalTargetDate(payload?.goalTargetDate)
      : { isSet: false, isValid: true, value: null };
    if (hasGoalTargetDateOverride && !goalTargetDateValidation.isValid) {
      return res.status(400).json({ error: goalTargetDateValidation.error || 'Invalid goal target date. Use YYYY-MM-DD.' });
    }
    const hasPlanDurationWeeksOverride = Object.prototype.hasOwnProperty.call(payload, 'planDurationWeeks');
    const planDurationWeeksValidation = hasPlanDurationWeeksOverride
      ? normalizePlanDurationWeeks(payload?.planDurationWeeks)
      : { isSet: false, isValid: true, value: null };
    if (hasPlanDurationWeeksOverride && !planDurationWeeksValidation.isValid) {
      return res.status(400).json({ error: planDurationWeeksValidation.error || 'Invalid plan duration in weeks. Use a positive integer or leave blank.' });
    }
    const title = sanitizeText(payload?.title || 'Untitled Workout', 150) || 'Untitled Workout';
    const description = sanitizeText(payload?.description || '', 1000);
    const workoutType = sanitizeText(payload?.workoutType || 'Strength', 50) || 'Strength';
    const estimatedDuration = parseNumber(payload?.estimatedDurationMinutes) || 0;
    const scheduleMode = String(payload?.scheduleMode || 'day').trim() === 'week' ? 'week' : 'day';
    const requestedPlanType = validateRequestedWorkoutPlanType(req, payload?.planType);
    if (!requestedPlanType.ok) {
      return res.status(requestedPlanType.status).json({ error: requestedPlanType.error });
    }
    const draftPlanType = requestedPlanType.isSet ? requestedPlanType.value : PERSONAL_WORKOUT_PLAN_TYPE;
    const schemaState = await getWorkoutPlannerSchemaState();

    if (schemaState.hasWorkoutPlanType) {
      const typeSupport = await ensureWorkoutPlanTypeSupportedBySchema(draftPlanType);
      if (!typeSupport.ok) {
        return res.status(typeSupport.status).json({ error: typeSupport.error });
      }
    }

    let result;
    const insertColumns = ['user_id', 'title', 'description', 'workout_type'];
    const insertValues = [userId, title, description, workoutType];

    if (hasCategoryOverride) {
      insertColumns.push('category');
      insertValues.push(categoryValidation.value);
    }
    if (schemaState.hasGoalTargetDate) {
      insertColumns.push('goal_target_date');
      insertValues.push(goalTargetDateValidation.value);
    }
    if (schemaState.hasPlanDurationWeeks) {
      insertColumns.push('plan_duration_weeks');
      insertValues.push(planDurationWeeksValidation.value);
    }

    if (schemaState.hasWorkoutPlanType) {
      insertColumns.push('workout_plan_type');
      insertValues.push(draftPlanType);
    }

    insertColumns.push('estimated_duration_minutes', 'status', 'visibility', 'schedule_mode');
    insertValues.push(estimatedDuration, 'draft', 'private', scheduleMode);

    [result] = await pool.query(
      `INSERT INTO workout_schedules
        (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertValues
    );

    const scheduleId = result.insertId;

    const fallbackLabel = scheduleMode === 'week' ? 'Week 1' : 'Any Day';
    const fallbackType = scheduleMode === 'week' ? 'week' : 'any';

    await pool.query(
      `INSERT INTO workout_schedule_groups (workout_schedule_id, label, group_type, sort_order)
       VALUES (?, ?, ?, 1)`,
      [scheduleId, fallbackLabel, fallbackType]
    );

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    const workoutLists = await loadSchedulesForUser(userId);

    return res.status(201).json({
      message: 'Workout draft created',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
      canCreateFeaturedPlans: isAdminUser(req),
    });
  } catch (err) {
    console.error('❌ Failed to create workout schedule draft:', err);
    return res.status(500).json({ error: 'Failed to create workout schedule draft' });
  }
});

router.get('/workout-schedules', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    return res.json({
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
      canCreateFeaturedPlans: isAdminUser(req),
    });
  } catch (err) {
    console.error('❌ Failed to list workout schedules:', err);
    return res.status(500).json({ error: 'Failed to list workout schedules' });
  }
});

router.get('/workout-schedules/:id', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    if (!planner) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    return res.json({ planner, canCreateFeaturedPlans: isAdminUser(req) });
  } catch (err) {
    console.error('❌ Failed to load workout schedule:', err);
    return res.status(500).json({ error: 'Failed to load workout schedule' });
  }
});

router.post('/workout-schedules/:id/plan-type-conversion-preview', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const sourcePlanId = Number(req.params?.id || 0);
    if (!sourcePlanId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const schemaState = await getWorkoutPlannerSchemaState(connection);
    if (!schemaState.hasWorkoutPlanType) {
      return res.status(400).json({ error: 'Database migration required: workout_plan_type column is missing.' });
    }

    const sourceSchedule = await loadOwnedScheduleRowWithCover(connection, sourcePlanId, userId);
    if (!sourceSchedule) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    if (isRawGlobalWorkoutPlanType(sourceSchedule.workout_plan_type)) {
      return res.status(403).json({
        error: 'Global workout templates must be managed from Admin/Trainer Global Workout Plans.',
      });
    }

    const sourcePlanner = await buildPlannerFromSchedule(sourcePlanId, userId);
    if (!sourcePlanner) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const destinationTitle = resolveDestinationTitleForConversion(req.body?.destinationTitle);
    if (!destinationTitle.ok) {
      return res.status(destinationTitle.status).json({ error: destinationTitle.error });
    }

    sourcePlanner.coverImage = resolveWorkoutPlanCoverImageReference(sourceSchedule);

    const conversionResult = await buildWorkoutPlanConversionPreview({
      sourcePlan: sourcePlanner,
      targetPlanType: req.body?.targetPlanType,
      authContext: {
        userId,
        role: normalizeSessionRoleSlug(req),
      },
      resolveExercisesByIds: async (exerciseIds) => {
        return loadExerciseRowsForConversion(connection, exerciseIds);
      },
      options: {
        // Cover image data is cloned from source to destination during create.
        allowUnsafeCoverReferenceCarryForward: true,
        destinationTitle: destinationTitle.isSet ? destinationTitle.value : null,
      },
    });

    if (!conversionResult?.ok) {
      if (!conversionResult?.permission?.ok) {
        return res.status(resolveWorkoutPlanConversionPermissionStatus(conversionResult.permission)).json({
          error: conversionResult.permission.message || 'Workout plan type conversion is not allowed.',
          code: conversionResult.permission.code || 'TARGET_TYPE_INVALID',
        });
      }

      if (!conversionResult?.validation?.ok) {
        return res.status(422).json({
          error: 'Workout plan conversion preview failed validation.',
          validationErrors: conversionResult.validation.errors || [],
        });
      }

      return res.status(400).json({ error: 'Unable to create conversion preview.' });
    }

    return res.json({
      sourcePlanId: String(sourcePlanId),
      preview: conversionResult.preview,
      destinationTitle: conversionResult?.payload?.metadata?.name || conversionResult?.preview?.source?.name || null,
      warnings: conversionResult.validation?.warnings || [],
      backendReady: true,
      canCreateConvertedPlan: Boolean(conversionResult.preview?.canProceed),
    });
  } catch (err) {
    console.error('❌ Failed to build workout plan conversion preview:', err);
    return res.status(500).json({ error: 'Failed to build workout plan conversion preview' });
  } finally {
    connection.release();
  }
});

router.post('/workout-schedules/:id/plan-type-conversion', async (req, res) => {
  const connection = await pool.getConnection();
  let didCommit = false;
  let coverCloneResult = null;
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const sourcePlanId = Number(req.params?.id || 0);
    if (!sourcePlanId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const schemaState = await getWorkoutPlannerSchemaState(connection);
    if (!schemaState.hasWorkoutPlanType) {
      return res.status(400).json({ error: 'Database migration required: workout_plan_type column is missing.' });
    }

    const sourceSchedule = await loadOwnedScheduleRowWithCover(connection, sourcePlanId, userId);
    if (!sourceSchedule) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    if (isRawGlobalWorkoutPlanType(sourceSchedule.workout_plan_type)) {
      return res.status(403).json({
        error: 'Global workout templates must be managed from Admin/Trainer Global Workout Plans.',
      });
    }

    const sourcePlanner = await buildPlannerFromSchedule(sourcePlanId, userId);
    if (!sourcePlanner) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const destinationTitle = resolveDestinationTitleForConversion(req.body?.destinationTitle);
    if (!destinationTitle.ok) {
      return res.status(destinationTitle.status).json({ error: destinationTitle.error });
    }

    sourcePlanner.coverImage = resolveWorkoutPlanCoverImageReference(sourceSchedule);

    const conversionResult = await buildWorkoutPlanConversionPreview({
      sourcePlan: sourcePlanner,
      targetPlanType: req.body?.targetPlanType,
      authContext: {
        userId,
        role: normalizeSessionRoleSlug(req),
      },
      resolveExercisesByIds: async (exerciseIds) => {
        return loadExerciseRowsForConversion(connection, exerciseIds);
      },
      options: {
        allowUnsafeCoverReferenceCarryForward: true,
        destinationTitle: destinationTitle.isSet ? destinationTitle.value : null,
      },
    });

    if (!conversionResult?.ok) {
      if (!conversionResult?.permission?.ok) {
        return res.status(resolveWorkoutPlanConversionPermissionStatus(conversionResult.permission)).json({
          error: conversionResult.permission.message || 'Workout plan type conversion is not allowed.',
          code: conversionResult.permission.code || 'TARGET_TYPE_INVALID',
        });
      }

      if (!conversionResult?.validation?.ok) {
        return res.status(422).json({
          error: 'Workout plan conversion failed validation.',
          validationErrors: conversionResult.validation.errors || [],
        });
      }

      return res.status(400).json({ error: 'Unable to convert workout plan type.' });
    }

    try {
      assertConversionCanProceed(conversionResult);
    } catch (assertError) {
      return res.status(409).json({
        error: assertError?.message || 'Conversion cannot proceed.',
        preview: conversionResult.preview,
        canCreateConvertedPlan: false,
      });
    }

    const convertedPlannerPayload = conversionResult.payload;
    if (!convertedPlannerPayload || typeof convertedPlannerPayload !== 'object') {
      return res.status(422).json({
        error: 'Converted planner payload is unavailable.',
        canCreateConvertedPlan: false,
      });
    }

    const targetPlanTypeSupport = await ensureWorkoutPlanTypeSupportedBySchema(
      convertedPlannerPayload?.metadata?.planType,
      connection
    );
    if (!targetPlanTypeSupport.ok) {
      return res.status(targetPlanTypeSupport.status).json({ error: targetPlanTypeSupport.error });
    }

    await connection.beginTransaction();

    const linkedGoalId = schemaState.hasLinkedGoalId
      ? await resolveLinkedGoalIdForUser(connection, userId, convertedPlannerPayload?.metadata?.goalId)
      : null;

    const destinationVisibilityRaw = String(conversionResult?.preview?.target?.defaults?.visibility || 'private').trim().toLowerCase();
    const destinationVisibility = ['private', 'unlisted', 'public'].includes(destinationVisibilityRaw)
      ? destinationVisibilityRaw
      : 'private';
    const destinationStatusRaw = String(conversionResult?.preview?.target?.defaults?.status || 'draft').trim().toLowerCase();
    const destinationStatus = ['draft', 'active', 'archived'].includes(destinationStatusRaw)
      ? destinationStatusRaw
      : 'draft';

    const insertColumns = ['user_id', 'title', 'description', 'workout_type'];
    const insertValues = [
      userId,
      sanitizeText(convertedPlannerPayload?.metadata?.name || '', WORKOUT_PLAN_TITLE_MAX_LENGTH) || 'Untitled Workout',
      sanitizeText(convertedPlannerPayload?.metadata?.description || '', 1000),
      sanitizeText(convertedPlannerPayload?.metadata?.type || 'Strength', 50) || 'Strength',
    ];

    insertColumns.push('category');
    insertValues.push(normalizeWorkoutPlanCategory(convertedPlannerPayload?.metadata?.category).value);

    if (schemaState.hasWorkoutPlanType) {
      insertColumns.push('workout_plan_type');
      insertValues.push(String(convertedPlannerPayload?.metadata?.planType || '').trim() || PERSONAL_WORKOUT_PLAN_TYPE);
    }
    if (schemaState.hasLinkedGoalId) {
      insertColumns.push('linked_goal_id');
      insertValues.push(linkedGoalId);
    }
    if (schemaState.hasGoalType) {
      insertColumns.push('goal_type');
      insertValues.push(parseWorkoutGoalType(convertedPlannerPayload?.metadata?.goalType).value);
    }
    if (schemaState.hasGoalTargetDate) {
      insertColumns.push('goal_target_date');
      insertValues.push(serializeGoalTargetDate(convertedPlannerPayload?.metadata?.goalTargetDate));
    }
    if (schemaState.hasPlanDurationWeeks) {
      insertColumns.push('plan_duration_weeks');
      insertValues.push(serializePlanDurationWeeks(convertedPlannerPayload?.metadata?.planDurationWeeks));
    }

    insertColumns.push('estimated_duration_minutes', 'status', 'visibility', 'schedule_mode');
    insertValues.push(
      parseNumber(convertedPlannerPayload?.metadata?.estimatedDuration) || 0,
      destinationStatus,
      destinationVisibility,
      convertedPlannerPayload?.scheduleMode === 'week' ? 'week' : 'day'
    );

    const [insertResult] = await connection.query(
      `INSERT INTO workout_schedules
        (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertValues
    );

    const convertedPlanId = Number(insertResult.insertId || 0);
    if (!convertedPlanId) {
      await connection.rollback();
      return res.status(500).json({ error: 'Failed to create converted workout plan.' });
    }

    await replaceScheduleGroupsAndExercises(connection, convertedPlanId, {
      ...convertedPlannerPayload,
      planId: String(convertedPlanId),
    });

    coverCloneResult = await cloneWorkoutPlanCoverToPlan({
      pool: connection,
      sourcePlan: {
        id: sourcePlanId,
        cover_image_storage_key: sourceSchedule?.cover_image_storage_key,
        cover_image_content_type: sourceSchedule?.cover_image_content_type,
      },
      destinationPlanId: convertedPlanId,
    });

    await connection.commit();
    didCommit = true;

    const planner = await buildPlannerFromSchedule(convertedPlanId, userId);
    const workoutLists = await loadSchedulesForUser(userId);
    const hasSavedExerciseList = await hasSavedExercisesForUser(userId);

    return res.status(201).json({
      message: 'Workout plan type converted by creating a new plan copy.',
      sourcePlanId: String(sourcePlanId),
      convertedPlanId: String(convertedPlanId),
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: hasSavedExerciseList,
      canCreateConvertedPlan: true,
    });
  } catch (err) {
    if (!didCommit) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback errors
      }

      if (coverCloneResult?.copied && coverCloneResult?.destinationStorageKey) {
        try {
          await deleteObjectViaGateway({
            storageKey: coverCloneResult.destinationStorageKey,
            appName: 'Workout-Atlas',
          });
        } catch (cleanupErr) {
          console.error('⚠️ Failed to clean up destination cover object after conversion rollback:', cleanupErr?.message || cleanupErr);
        }
      }
    }
    console.error('❌ Failed to convert workout plan type:', err);
    return res.status(Number(err?.statusCode || 500)).json({
      error: err?.message || 'Failed to convert workout plan type',
      canCreateConvertedPlan: false,
    });
  } finally {
    connection.release();
  }
});

const extractWorkoutPlanCoverUploadFile = (req) => {
  const files = req?.files || {};
  if (Array.isArray(files)) {
    return files[0] || null;
  }

  if (Array.isArray(files.coverImage) && files.coverImage.length > 0) {
    return files.coverImage[0];
  }

  if (Array.isArray(files.image) && files.image.length > 0) {
    return files.image[0];
  }

  return null;
};

router.post('/workout-schedules/:id/cover', (req, res) => {
  workoutPlanCoverUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      const statusCode = uploadErr?.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(statusCode).json({ error: uploadErr.message || 'Invalid cover image upload.' });
    }

    try {
      const scheduleId = Number(req.params?.id || 0);
      if (!scheduleId) {
        return res.status(400).json({ error: 'Invalid schedule id' });
      }

      const plan = await getWorkoutPlanCoverRow(pool, scheduleId);
      if (!plan) {
        return res.status(404).json({ error: 'Workout schedule not found' });
      }

      const access = await canManageWorkoutPlanCover({ req, pool, plan });
      if (!access.ok) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      const file = extractWorkoutPlanCoverUploadFile(req);
      if (!file) {
        return res.status(400).json({ error: 'Cover image file is required.' });
      }

      const uploadResult = await uploadWorkoutPlanCover({
        req,
        pool,
        plan,
        file,
      });

      return res.status(201).json({
        message: 'Workout plan cover uploaded',
        cover: {
          storageKey: uploadResult.storageKey,
          contentType: uploadResult.contentType,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const status = Number(error?.statusCode || 500);
      console.error('❌ Failed to upload workout plan cover:', error);
      return res.status(status).json({
        error: error?.message || 'Failed to upload workout plan cover',
      });
    }
  });
});

router.delete('/workout-schedules/:id/cover', async (req, res) => {
  try {
    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const plan = await getWorkoutPlanCoverRow(pool, scheduleId);
    if (!plan) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const access = await canManageWorkoutPlanCover({ req, pool, plan });
    if (!access.ok) {
      return res.status(access.statusCode).json({ error: access.error });
    }

    const deleteResult = await deleteWorkoutPlanCover({
      pool,
      plan,
      deleteObject: deleteObjectViaGateway,
    });

    if (!deleteResult.hadCover) {
      return res.json({ message: 'Workout plan cover already empty' });
    }

    return res.json({
      message: 'Workout plan cover deleted',
      storageKey: deleteResult.storageKey,
    });
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error('❌ Failed to delete workout plan cover:', error);
    return res.status(status).json({
      error: error?.message || 'Failed to delete workout plan cover',
    });
  }
});

router.patch('/workout-schedules/:id', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const body = req.body || {};
    const hasCategoryOverride = Object.prototype.hasOwnProperty.call(body, 'category');
    const categoryValidation = hasCategoryOverride
      ? normalizeWorkoutPlanCategory(body?.category)
      : { isSet: false, isValid: true, value: null };
    if (hasCategoryOverride && !categoryValidation.isValid) {
      return res.status(400).json({ error: categoryValidation.error || getWorkoutPlanCategoryValidationError() });
    }
    const hasGoalTargetDateOverride = Object.prototype.hasOwnProperty.call(body, 'goalTargetDate');
    const goalTargetDateValidation = hasGoalTargetDateOverride
      ? normalizeWorkoutGoalTargetDate(body?.goalTargetDate)
      : { isSet: false, isValid: true, value: null };
    if (hasGoalTargetDateOverride && !goalTargetDateValidation.isValid) {
      return res.status(400).json({ error: goalTargetDateValidation.error || 'Invalid goal target date. Use YYYY-MM-DD.' });
    }
    const hasPlanDurationWeeksOverride = Object.prototype.hasOwnProperty.call(body, 'planDurationWeeks');
    const planDurationWeeksValidation = hasPlanDurationWeeksOverride
      ? normalizePlanDurationWeeks(body?.planDurationWeeks)
      : { isSet: false, isValid: true, value: null };
    if (hasPlanDurationWeeksOverride && !planDurationWeeksValidation.isValid) {
      return res.status(400).json({ error: planDurationWeeksValidation.error || 'Invalid plan duration in weeks. Use a positive integer or leave blank.' });
    }
    const title = sanitizeText(body?.title || '', 150);
    const description = sanitizeText(body?.description || '', 1000);
    const workoutType = sanitizeText(body?.workoutType || '', 50);
    const estimatedDuration = parseNumber(body?.estimatedDurationMinutes);
    const status = sanitizeText(body?.status || '', 20);
    const visibility = sanitizeText(body?.visibility || '', 20);
    const scheduleMode = String(body?.scheduleMode || '').trim();
    const requestedPlanType = validateRequestedWorkoutPlanType(req, body?.planType);
    if (!requestedPlanType.ok) {
      return res.status(requestedPlanType.status).json({ error: requestedPlanType.error });
    }
    const schemaState = await getWorkoutPlannerSchemaState();

    const [ownedRows] = await pool.query(
      'SELECT id, workout_plan_type FROM workout_schedules WHERE id = ? AND user_id = ? LIMIT 1',
      [scheduleId, userId]
    );

    if (!ownedRows.length) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const immutablePlanType = resolveImmutableWorkoutPlanType({
      existingValue: ownedRows[0]?.workout_plan_type,
      requestedValue: requestedPlanType.isSet ? requestedPlanType.value : null,
    });
    if (!immutablePlanType.ok) {
      return res.status(immutablePlanType.status).json({ error: immutablePlanType.error });
    }

    if (schemaState.hasWorkoutPlanType && requestedPlanType.isSet) {
      const typeSupport = await ensureWorkoutPlanTypeSupportedBySchema(immutablePlanType.value);
      if (!typeSupport.ok) {
        return res.status(typeSupport.status).json({ error: typeSupport.error });
      }
    }

    const normalizedRequestedVisibility = String(visibility || '').trim().toLowerCase();
    if (normalizedRequestedVisibility) {
      const effectivePlanType = String(immutablePlanType.value || '').trim().toLowerCase();
      if (effectivePlanType === MARKETPLACE_WORKOUT_PLAN_TYPE && normalizedRequestedVisibility !== 'private') {
        return res.status(403).json({
          error: 'MARKETPLACE plans support classification only right now. Publishing is disabled.',
        });
      }

      if (effectivePlanType === COMMUNITY_WORKOUT_PLAN_TYPE && normalizedRequestedVisibility === 'public') {
        return res.status(403).json({
          error: 'COMMUNITY plans can only be published through the authorized community publishing workflow.',
        });
      }
    }

    const updateFields = [
      "title = COALESCE(NULLIF(?, ''), title)",
      'description = COALESCE(?, description)',
      "workout_type = COALESCE(NULLIF(?, ''), workout_type)",
      'estimated_duration_minutes = COALESCE(?, estimated_duration_minutes)',
      "status = CASE WHEN ? IN ('draft','active','archived') THEN ? ELSE status END",
      "visibility = CASE WHEN ? IN ('private','unlisted','public') THEN ? ELSE visibility END",
      "schedule_mode = CASE WHEN ? IN ('day','week') THEN ? ELSE schedule_mode END",
    ];
    const updateParams = [
      title,
      description,
      workoutType,
      estimatedDuration,
      status,
      status,
      visibility,
      visibility,
      scheduleMode,
      scheduleMode,
    ];

    if (schemaState.hasWorkoutPlanType && requestedPlanType.isSet) {
      updateFields.push('workout_plan_type = ?');
      updateParams.push(immutablePlanType.value);
    }
    if (hasCategoryOverride) {
      updateFields.push('category = ?');
      updateParams.push(categoryValidation.value);
    }
    if (schemaState.hasGoalTargetDate && hasGoalTargetDateOverride) {
      updateFields.push('goal_target_date = ?');
      updateParams.push(goalTargetDateValidation.value);
    }
    if (schemaState.hasPlanDurationWeeks && hasPlanDurationWeeksOverride) {
      updateFields.push('plan_duration_weeks = ?');
      updateParams.push(planDurationWeeksValidation.value);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const [result] = await pool.query(
      `UPDATE workout_schedules
       SET
         ${updateFields.join(',\n         ')}
       WHERE id = ? AND user_id = ?`,
      [...updateParams, scheduleId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.json({ message: 'Workout schedule updated', planner, canCreateFeaturedPlans: isAdminUser(req) });
  } catch (err) {
    console.error('❌ Failed to update workout schedule:', err);
    return res.status(500).json({ error: 'Failed to update workout schedule' });
  }
});

router.put('/workout-schedules/:id/groups', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const scheduleMode = String(req.body?.scheduleMode || 'day').trim() === 'week' ? 'week' : 'day';
    const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];
    const normalizedGroups = groups
      .map((g, index) => ({
        label: (() => {
          const validation = validateWorkoutGroupLabel(g?.label || '', {
            label: `Workout ${scheduleMode === 'week' ? 'week' : 'day'} ${index + 1}`,
          });
          if (!validation.ok) {
            throw buildBadRequestError(validation.message);
          }
          return validation.value;
        })(),
        groupType: sanitizeText(g?.groupType || (scheduleMode === 'week' ? 'week' : 'day'), 20),
        sortOrder: parseNumber(g?.sortOrder) || index + 1,
      }))
      .filter((g) => g.label);

    const [ownedRows] = await pool.query(
      'SELECT id FROM workout_schedules WHERE id = ? AND user_id = ? LIMIT 1',
      [scheduleId, userId]
    );
    if (!ownedRows.length) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query('DELETE FROM workout_schedule_groups WHERE workout_schedule_id = ?', [scheduleId]);

      const finalGroups = normalizedGroups.length
        ? normalizedGroups
        : [{ label: scheduleMode === 'week' ? 'Week 1' : 'Any Day', groupType: scheduleMode === 'week' ? 'week' : 'any', sortOrder: 1 }];

      for (const group of finalGroups) {
        await connection.query(
          `INSERT INTO workout_schedule_groups (workout_schedule_id, label, group_type, sort_order)
           VALUES (?, ?, ?, ?)`,
          [scheduleId, group.label, group.groupType, group.sortOrder]
        );
      }

      await connection.query(
        `UPDATE workout_schedules SET schedule_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [scheduleMode, scheduleId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.json({ message: 'Workout schedule groups saved', planner });
  } catch (err) {
    if (Number(err?.statusCode || 0) === 400) {
      return res.status(400).json({ error: err?.message || 'Invalid workout schedule group name.' });
    }
    console.error('❌ Failed to save workout schedule groups:', err);
    return res.status(500).json({ error: 'Failed to save workout schedule groups' });
  }
});

router.post('/workout-schedules/:id/exercises', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const [ownedRows] = await pool.query(
      'SELECT id FROM workout_schedules WHERE id = ? AND user_id = ? LIMIT 1',
      [scheduleId, userId]
    );
    if (!ownedRows.length) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const body = req.body || {};
    const exerciseId = parseNumber(body.exerciseId);
    const groupId = parseNumber(body.workoutScheduleGroupId);

    let fallback = {};
    if (exerciseId) {
      const [exerciseRows] = await pool.query(
        'SELECT ExerciseTitle, ImageURL, WorkoutType, MuscleGroup, Equipment FROM exercises WHERE ExerciseID = ? LIMIT 1',
        [exerciseId]
      );
      fallback = exerciseRows?.[0] || {};
    }

    const schemaState = await getWorkoutPlannerSchemaState();

    const insertColumns = [
      'workout_schedule_id',
      'workout_schedule_group_id',
      'exercise_id',
      'exercise_name',
      'exercise_image_url',
      'workout_type',
      'muscle_group',
      'equipment',
      'sort_order',
      'notes',
      'target_sets',
      'target_reps',
      'target_weight',
      'target_duration_minutes',
      'target_rest_seconds',
    ];

    const insertValues = [
      scheduleId,
      groupId || null,
      exerciseId || null,
      sanitizeText(body.name || fallback.ExerciseTitle || '', 150),
      sanitizeText(body.image || fallback.ImageURL || '', 255),
      sanitizeText(body.workoutType || fallback.WorkoutType || '', 50),
      sanitizeText(body.muscleGroup || fallback.MuscleGroup || '', 80),
      sanitizeText(body.equipment || fallback.Equipment || '', 80),
      parseNumber(body.sortOrder) || 9999,
      sanitizeText(body.notes || '', 500),
      parseNumber(body.targetSets),
      parseNumber(body.targetReps),
      parseNumber(body.targetWeight, true),
      parseNumber(body.targetDurationMinutes),
      parseNumber(body.targetRestSeconds),
    ];

    if (schemaState.hasTargetDistanceMiles) {
      insertColumns.push('target_distance_miles');
      insertValues.push(parseNumber(body.targetDistanceMiles, true));
    }

    const [insertResult] = await pool.query(
      `INSERT INTO workout_schedule_exercises
        (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertValues
    );

    await pool.query('UPDATE workout_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scheduleId]);
    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.status(201).json({ message: 'Exercise added to schedule', id: insertResult.insertId, planner });
  } catch (err) {
    console.error('❌ Failed to add schedule exercise:', err);
    return res.status(500).json({ error: 'Failed to add schedule exercise' });
  }
});

router.patch('/workout-schedules/:id/exercises/:scheduleExerciseId', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    const scheduleExerciseId = Number(req.params?.scheduleExerciseId || 0);
    if (!scheduleId || !scheduleExerciseId) {
      return res.status(400).json({ error: 'Invalid schedule or exercise id' });
    }

    const body = req.body || {};
    const schemaState = await getWorkoutPlannerSchemaState();
    const setClauses = [
      'wse.workout_schedule_group_id = COALESCE(?, wse.workout_schedule_group_id)',
      'wse.sort_order = COALESCE(?, wse.sort_order)',
      'wse.notes = COALESCE(?, wse.notes)',
      'wse.target_sets = COALESCE(?, wse.target_sets)',
      'wse.target_reps = COALESCE(?, wse.target_reps)',
      'wse.target_weight = COALESCE(?, wse.target_weight)',
      'wse.target_duration_minutes = COALESCE(?, wse.target_duration_minutes)',
      'wse.target_rest_seconds = COALESCE(?, wse.target_rest_seconds)',
    ];
    const queryParams = [
      parseNumber(body.workoutScheduleGroupId),
      parseNumber(body.sortOrder),
      sanitizeText(body.notes || '', 500) || null,
      parseNumber(body.targetSets),
      parseNumber(body.targetReps),
      parseNumber(body.targetWeight, true),
      parseNumber(body.targetDurationMinutes),
      parseNumber(body.targetRestSeconds),
    ];

    if (schemaState.hasTargetDistanceMiles) {
      setClauses.push('wse.target_distance_miles = COALESCE(?, wse.target_distance_miles)');
      queryParams.push(parseNumber(body.targetDistanceMiles, true));
    }

    queryParams.push(scheduleExerciseId, scheduleId, userId);

    const [result] = await pool.query(
      `UPDATE workout_schedule_exercises wse
       INNER JOIN workout_schedules ws ON ws.id = wse.workout_schedule_id
       SET
         ${setClauses.join(',\n         ')},
         wse.updated_at = CURRENT_TIMESTAMP
       WHERE wse.id = ? AND ws.id = ? AND ws.user_id = ?`,
      queryParams
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Schedule exercise not found' });
    }

    await pool.query('UPDATE workout_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scheduleId]);
    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.json({ message: 'Schedule exercise updated', planner });
  } catch (err) {
    console.error('❌ Failed to update schedule exercise:', err);
    return res.status(500).json({ error: 'Failed to update schedule exercise' });
  }
});

router.delete('/workout-schedules/:id/exercises/:scheduleExerciseId', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    const scheduleExerciseId = Number(req.params?.scheduleExerciseId || 0);
    if (!scheduleId || !scheduleExerciseId) {
      return res.status(400).json({ error: 'Invalid schedule or exercise id' });
    }

    const [result] = await pool.query(
      `DELETE wse
       FROM workout_schedule_exercises wse
       INNER JOIN workout_schedules ws ON ws.id = wse.workout_schedule_id
       WHERE wse.id = ? AND ws.id = ? AND ws.user_id = ?`,
      [scheduleExerciseId, scheduleId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Schedule exercise not found' });
    }

    await pool.query('UPDATE workout_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scheduleId]);
    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.json({ message: 'Exercise removed from schedule', planner });
  } catch (err) {
    console.error('❌ Failed to remove schedule exercise:', err);
    return res.status(500).json({ error: 'Failed to remove schedule exercise' });
  }
});

router.delete('/workout-schedules/:id', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const [scheduleRows] = await pool.query(
      'SELECT id, user_id, workout_plan_type FROM workout_schedules WHERE id = ? LIMIT 1',
      [scheduleId]
    );

    if (!scheduleRows.length) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const schedule = scheduleRows[0] || {};
    if (Number(schedule.user_id || 0) !== Number(userId)) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const parsedPlanType = parseWorkoutPlanType(schedule.workout_plan_type);
    const isGlobalPlanType = Boolean(
      parsedPlanType?.isSet && parsedPlanType?.isValid && GLOBAL_WORKOUT_PLAN_TYPES.has(parsedPlanType.value)
    );

    if (isGlobalPlanType && !isAdminUser(req)) {
      return res.status(403).json({ error: 'You are not allowed to delete global workout templates.' });
    }

    await cleanupWorkoutPlanCoverForSchedule(schedule);

    const [result] = await pool.query(
      'DELETE FROM workout_schedules WHERE id = ? AND user_id = ?',
      [scheduleId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    return res.json({
      message: 'Workout schedule deleted',
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
    });
  } catch (err) {
    console.error('❌ Failed to delete workout schedule:', err);
    return res.status(500).json({ error: 'Failed to delete workout schedule' });
  }
});

router.get('/featured-workout-plans', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const workoutLists = await loadGlobalWorkoutPlans({
      planTypes: [FEATURED_WORKOUT_PLAN_TYPE],
      onlyPublished: true,
    });

    return res.json({
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to load featured workout plans:', err);
    return res.status(500).json({ error: 'Failed to load featured workout plans' });
  }
});

router.get('/global-workout-plans', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const searchQuery = String(req.query?.q || '').trim().toLowerCase();
    const requestedCategory = String(req.query?.category || '').trim().toLowerCase();
    const requestedAccess = String(req.query?.access || '').trim().toLowerCase();

    const workoutLists = await loadGlobalWorkoutPlans({
      onlyPublished: true,
      publishedVisibility: 'all',
    });

    const filteredWorkoutLists = workoutLists.filter((plan) => {
      const category = String(plan?.type || '').trim();
      const name = String(plan?.name || '').trim();
      const description = String(plan?.description || '').trim();
      const accessLabel = normalizeGlobalPlanAccess(plan?.visibility);

      if (requestedCategory && requestedCategory !== 'all') {
        if (category.toLowerCase() !== requestedCategory) {
          return false;
        }
      }

      if (requestedAccess && requestedAccess !== 'all') {
        if (accessLabel.toLowerCase() !== requestedAccess) {
          return false;
        }
      }

      if (searchQuery) {
        const haystack = `${name} ${description} ${category}`.toLowerCase();
        if (!haystack.includes(searchQuery)) {
          return false;
        }
      }

      return true;
    });

    return res.json({
      workoutLists: filteredWorkoutLists,
      hasWorkoutLists: filteredWorkoutLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to load global workout plans library:', err);
    return res.status(500).json({ error: 'Failed to load global workout plans library' });
  }
});

router.get('/global-workout-plans/:id', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid global workout plan id' });
    }

    const planner = await buildGlobalWorkoutPlanById(scheduleId);
    if (!planner) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    const status = String(planner?.status || '').trim().toLowerCase();
    const visibility = String(planner?.visibility || '').trim().toLowerCase();
    const publishedStatusAllowed = PUBLISHED_GLOBAL_STATUSES.includes(status);
    const isDiscoverableVisibility = ['public', 'private', 'unlisted'].includes(visibility);

    const completenessMissing = collectGlobalPlanCompletenessErrors(planner);
    if (!publishedStatusAllowed || !isDiscoverableVisibility || completenessMissing.length) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    return res.json({
      planner,
      accessLevel: normalizeGlobalPlanAccess(planner?.visibility),
    });
  } catch (err) {
    console.error('❌ Failed to load global workout plan detail:', err);
    return res.status(500).json({ error: 'Failed to load global workout plan detail' });
  }
});

router.post('/global-workout-plans/:id/use', async (req, res) => {
  const connection = await pool.getConnection();
  const copiedMediaStorageKeys = [];
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const sourcePlanId = Number(req.params?.id || 0);
    if (!sourcePlanId) {
      return res.status(400).json({ error: 'Invalid global workout plan id' });
    }

    const schemaState = await getWorkoutPlannerSchemaState(connection);
    if (!schemaState.hasWorkoutPlanType) {
      return res.status(400).json({ error: 'Database migration required: workout_plan_type column is missing.' });
    }

    const [sourceRows] = await connection.query(
      `SELECT id, user_id, cover_image_storage_key, cover_image_content_type
       FROM workout_schedules
       WHERE id = ?
         AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
         AND LOWER(COALESCE(status, '')) IN (?, ?, ?)
         AND LOWER(COALESCE(visibility, '')) IN ('public', 'private', 'unlisted')
         AND EXISTS (
           SELECT 1
           FROM workout_schedule_exercises wse
           WHERE wse.workout_schedule_id = workout_schedules.id
         )
       LIMIT 1`,
      [
        sourcePlanId,
        ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES,
        ...PUBLISHED_GLOBAL_STATUSES,
      ]
    );

    if (!sourceRows.length) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    const sourceOwnerUserId = Number(sourceRows[0]?.user_id || 0);
    if (!sourceOwnerUserId) {
      return res.status(404).json({ error: 'Global workout plan owner not found' });
    }

    const sourcePlanner = await buildPlannerFromSchedule(sourcePlanId, sourceOwnerUserId);
    if (!sourcePlanner) {
      return res.status(404).json({ error: 'Global workout plan details not found' });
    }

    const sourceMetadata = sourcePlanner?.metadata || {};
    const sourceName = sanitizeText(sourceMetadata?.name || 'Global Workout Plan', 150) || 'Global Workout Plan';
    const sourceDescription = sanitizeText(sourceMetadata?.description || '', 1000);
    const sourceType = sanitizeText(sourceMetadata?.type || 'Strength', 50) || 'Strength';
    const sourceCategory = normalizeWorkoutPlanCategory(sourceMetadata?.category).value;
    const sourceDuration = parseNumber(sourceMetadata?.estimatedDuration) || 0;
    const sourceGoalType = parseWorkoutGoalType(sourceMetadata?.goalType).value;
    const sourceScheduleMode = sourcePlanner?.scheduleMode === 'week' ? 'week' : 'day';

    await connection.beginTransaction();

    const cloneColumns = [
      'user_id',
      'title',
      'description',
      'workout_type',
      'category',
      'workout_plan_type',
      'estimated_duration_minutes',
      'status',
      'visibility',
      'schedule_mode',
    ];
    const cloneValues = [
      userId,
      sourceName,
      sourceDescription,
      sourceType,
      sourceCategory,
      null,
      sourceDuration,
      'draft',
      'private',
      sourceScheduleMode,
    ];

    if (schemaState.hasGoalType) {
      cloneColumns.splice(6, 0, 'goal_type');
      cloneValues.splice(6, 0, sourceGoalType);
    }
    if (schemaState.hasSourceGlobalPlanId) {
      const insertAt = cloneColumns.indexOf('workout_plan_type') + 1;
      cloneColumns.splice(insertAt, 0, 'source_global_plan_id');
      cloneValues.splice(insertAt, 0, sourcePlanId);
    }
    if (schemaState.hasGlobalPlanAdoptedAt) {
      const insertAt = cloneColumns.indexOf('source_global_plan_id') >= 0
        ? cloneColumns.indexOf('source_global_plan_id') + 1
        : cloneColumns.indexOf('workout_plan_type') + 1;
      cloneColumns.splice(insertAt, 0, 'global_plan_adopted_at');
      cloneValues.splice(insertAt, 0, new Date());
    }

    const [insertResult] = await connection.query(
      `INSERT INTO workout_schedules (${cloneColumns.join(', ')})
       VALUES (${cloneColumns.map(() => '?').join(', ')})`,
      cloneValues
    );

    const clonedScheduleId = Number(insertResult.insertId || 0);
    if (!clonedScheduleId) {
      await connection.rollback();
      return res.status(500).json({ error: 'Failed to create personal workout copy' });
    }

    const mappedPlanner = await mapPlannerExercisesForAdoption({
      connection,
      req,
      recipientUserId: userId,
      sourcePlanner,
      copiedMediaStorageKeys,
    });

    const plannerForClone = {
      ...mappedPlanner,
      planId: String(clonedScheduleId),
      metadata: {
        ...sourceMetadata,
        category: sourceCategory,
        planType: null,
        goalType: sourceGoalType,
        goalId: '',
        goalContext: null,
      },
    };

    await replaceScheduleGroupsAndExercises(connection, clonedScheduleId, plannerForClone);

    await cloneWorkoutPlanCoverToPlan({
      pool: connection,
      sourcePlan: {
        id: sourcePlanId,
        cover_image_storage_key: sourceRows[0]?.cover_image_storage_key,
        cover_image_content_type: sourceRows[0]?.cover_image_content_type,
      },
      destinationPlanId: clonedScheduleId,
    });

    await connection.commit();

    const planner = await buildPlannerFromSchedule(clonedScheduleId, userId);
    const workoutLists = await loadSchedulesForUser(userId);
    const hasSavedExerciseList = await hasSavedExercisesForUser(userId);

    return res.status(201).json({
      message: 'Global workout plan copied to your Workout Builder.',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: hasSavedExerciseList,
      canCreateFeaturedPlans: isAdminUser(req),
      sourcePlanId: String(sourcePlanId),
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    await cleanupAdoptionCopiedMedia(copiedMediaStorageKeys);
    console.error('❌ Failed to copy global workout plan:', err);
    return res.status(Number(err?.statusCode || 500)).json({ error: err?.message || 'Failed to copy global workout plan' });
  } finally {
    connection.release();
  }
});

router.post('/featured-workout-plans/:id/clone', async (req, res) => {
  const connection = await pool.getConnection();
  const copiedMediaStorageKeys = [];
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const sourcePlanId = Number(req.params?.id || 0);
    if (!sourcePlanId) {
      return res.status(400).json({ error: 'Invalid featured workout plan id' });
    }

    const schemaState = await getWorkoutPlannerSchemaState(connection);
    if (!schemaState.hasWorkoutPlanType) {
      return res.status(400).json({ error: 'Database migration required: workout_plan_type column is missing.' });
    }

    const [sourceRows] = await connection.query(
      `SELECT id, user_id, cover_image_storage_key, cover_image_content_type
       FROM workout_schedules
       WHERE id = ?
         AND workout_plan_type = ?
         AND LOWER(COALESCE(status, '')) IN (?, ?, ?)
         AND LOWER(COALESCE(visibility, '')) = 'public'
         AND EXISTS (
           SELECT 1
           FROM workout_schedule_exercises wse
           WHERE wse.workout_schedule_id = workout_schedules.id
         )
       LIMIT 1`,
      [sourcePlanId, FEATURED_WORKOUT_PLAN_TYPE, ...PUBLISHED_GLOBAL_STATUSES]
    );

    if (!sourceRows.length) {
      return res.status(404).json({ error: 'Featured workout plan not found' });
    }

    const sourceOwnerUserId = Number(sourceRows[0]?.user_id || 0);
    if (!sourceOwnerUserId) {
      return res.status(404).json({ error: 'Featured workout plan owner not found' });
    }

    const sourcePlanner = await buildPlannerFromSchedule(sourcePlanId, sourceOwnerUserId);
    if (!sourcePlanner) {
      return res.status(404).json({ error: 'Featured workout plan details not found' });
    }

    const sourceMetadata = sourcePlanner?.metadata || {};
    const sourceName = sanitizeText(sourceMetadata?.name || 'Featured Workout', 150) || 'Featured Workout';
    const sourceDescription = sanitizeText(sourceMetadata?.description || '', 1000);
    const sourceType = sanitizeText(sourceMetadata?.type || 'Strength', 50) || 'Strength';
    const sourceCategory = normalizeWorkoutPlanCategory(sourceMetadata?.category).value;
    const sourceDuration = parseNumber(sourceMetadata?.estimatedDuration) || 0;
    const sourceGoalType = parseWorkoutGoalType(sourceMetadata?.goalType).value;
    const sourceScheduleMode = sourcePlanner?.scheduleMode === 'week' ? 'week' : 'day';

    await connection.beginTransaction();

    const cloneColumns = [
      'user_id',
      'title',
      'description',
      'workout_type',
      'category',
      'workout_plan_type',
      'estimated_duration_minutes',
      'status',
      'visibility',
      'schedule_mode',
    ];
    const cloneValues = [
      userId,
      sourceName,
      sourceDescription,
      sourceType,
      sourceCategory,
      null,
      sourceDuration,
      'draft',
      'private',
      sourceScheduleMode,
    ];

    if (schemaState.hasGoalType) {
      cloneColumns.splice(6, 0, 'goal_type');
      cloneValues.splice(6, 0, sourceGoalType);
    }
    if (schemaState.hasSourceGlobalPlanId) {
      const insertAt = cloneColumns.indexOf('workout_plan_type') + 1;
      cloneColumns.splice(insertAt, 0, 'source_global_plan_id');
      cloneValues.splice(insertAt, 0, sourcePlanId);
    }
    if (schemaState.hasGlobalPlanAdoptedAt) {
      const insertAt = cloneColumns.indexOf('source_global_plan_id') >= 0
        ? cloneColumns.indexOf('source_global_plan_id') + 1
        : cloneColumns.indexOf('workout_plan_type') + 1;
      cloneColumns.splice(insertAt, 0, 'global_plan_adopted_at');
      cloneValues.splice(insertAt, 0, new Date());
    }

    const [insertResult] = await connection.query(
      `INSERT INTO workout_schedules (${cloneColumns.join(', ')})
       VALUES (${cloneColumns.map(() => '?').join(', ')})`,
      cloneValues
    );

    const clonedScheduleId = Number(insertResult.insertId || 0);
    if (!clonedScheduleId) {
      await connection.rollback();
      return res.status(500).json({ error: 'Failed to create personal workout copy' });
    }

    const mappedPlanner = await mapPlannerExercisesForAdoption({
      connection,
      req,
      recipientUserId: userId,
      sourcePlanner,
      copiedMediaStorageKeys,
    });

    const plannerForClone = {
      ...mappedPlanner,
      planId: String(clonedScheduleId),
      metadata: {
        ...sourceMetadata,
        category: sourceCategory,
        planType: null,
        goalType: sourceGoalType,
        goalId: '',
        goalContext: null,
      },
    };

    await replaceScheduleGroupsAndExercises(connection, clonedScheduleId, plannerForClone);

    await cloneWorkoutPlanCoverToPlan({
      pool: connection,
      sourcePlan: {
        id: sourcePlanId,
        cover_image_storage_key: sourceRows[0]?.cover_image_storage_key,
        cover_image_content_type: sourceRows[0]?.cover_image_content_type,
      },
      destinationPlanId: clonedScheduleId,
    });

    await connection.commit();

    const planner = await buildPlannerFromSchedule(clonedScheduleId, userId);
    const workoutLists = await loadSchedulesForUser(userId);
    const hasSavedExerciseList = await hasSavedExercisesForUser(userId);

    return res.status(201).json({
      message: 'Featured workout plan copied to your Workout Builder.',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: hasSavedExerciseList,
      canCreateFeaturedPlans: isAdminUser(req),
      sourcePlanId: String(sourcePlanId),
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    await cleanupAdoptionCopiedMedia(copiedMediaStorageKeys);
    console.error('❌ Failed to clone featured workout plan:', err);
    return res.status(Number(err?.statusCode || 500)).json({ error: err?.message || 'Failed to clone featured workout plan' });
  } finally {
    connection.release();
  }
});

router.get('/admin/global-workout-plans', async (req, res) => {
  try {
    const userId = await requireAdminSessionUserForGlobalPlans(req, res);
    if (!userId) {
      return;
    }

    await ensureWorkoutPlannerOrderingColumns();

    const workoutLists = await loadGlobalWorkoutPlans();
    const visibleLists = isAdminUser(req)
      ? workoutLists
      : workoutLists.filter((plan) => Number(plan?.ownerUserId || 0) === Number(userId));
    return res.json({
      workoutLists: visibleLists,
      hasWorkoutLists: visibleLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to load global workout plans:', err);
    return res.status(500).json({ error: 'Failed to load global workout plans' });
  }
});

router.get('/admin/user-workout-plans', async (req, res) => {
  try {
    const userId = requireAdminSessionUser(req, res);
    if (!userId) {
      return;
    }

    await ensureWorkoutPlannerOrderingColumns();

    const workoutLists = await loadAdminUserWorkoutPlans();
    return res.json({
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to load admin user workout plans:', err);
    return res.status(500).json({ error: 'Failed to load admin user workout plans' });
  }
});

router.get('/admin/global-workout-plans/:id', async (req, res) => {
  try {
    const userId = await requireAdminSessionUserForGlobalPlans(req, res);
    if (!userId) {
      return;
    }

    await ensureWorkoutPlannerOrderingColumns();

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const planner = await buildGlobalWorkoutPlanById(scheduleId);
    if (!planner) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    return res.json({ planner });
  } catch (err) {
    console.error('❌ Failed to load global workout plan:', err);
    return res.status(500).json({ error: 'Failed to load global workout plan' });
  }
});

router.post('/admin/global-workout-plans', async (req, res) => {
  try {
    const userId = await requireAdminSessionUserForGlobalPlans(req, res);
    if (!userId) {
      return;
    }

    const schemaState = await ensureWorkoutPlannerOrderingColumns();
    if (!schemaState.hasWorkoutPlanType) {
      return res.status(400).json({ error: 'Database migration required: workout_plan_type column is missing.' });
    }

    const payload = req.body || {};
    const requestedGlobalPlanType = payload?.planType == null ? GLOBAL_WORKOUT_PLAN_TYPE : payload?.planType;
    const parsedPlanType = parseGlobalWorkoutPlanTypeForAdmin(req, requestedGlobalPlanType);
    if (!parsedPlanType.ok) {
      return res.status(parsedPlanType.status).json({ error: parsedPlanType.error });
    }
    const createTypeSupport = await ensureWorkoutPlanTypeSupportedBySchema(parsedPlanType.value);
    if (!createTypeSupport.ok) {
      return res.status(createTypeSupport.status).json({ error: createTypeSupport.error });
    }
    const parsedGoalType = parseWorkoutGoalType(payload?.goalType);
    if (!parsedGoalType.isValid) {
      return res.status(400).json({ error: 'Invalid Goal Type. Allowed values: No Specific Goal, Body Weight, Exercise Weight.' });
    }
    const hasCategoryOverride = Object.prototype.hasOwnProperty.call(payload, 'category');
    const categoryValidation = hasCategoryOverride
      ? normalizeWorkoutPlanCategory(payload?.category)
      : { isSet: false, isValid: true, value: null };
    if (hasCategoryOverride && !categoryValidation.isValid) {
      return res.status(400).json({ error: categoryValidation.error || getWorkoutPlanCategoryValidationError() });
    }
    const hasGoalTargetDateOverride = Object.prototype.hasOwnProperty.call(payload, 'goalTargetDate');
    const goalTargetDateValidation = hasGoalTargetDateOverride
      ? normalizeWorkoutGoalTargetDate(payload?.goalTargetDate)
      : { isSet: false, isValid: true, value: null };
    if (hasGoalTargetDateOverride && !goalTargetDateValidation.isValid) {
      return res.status(400).json({ error: goalTargetDateValidation.error || 'Invalid goal target date. Use YYYY-MM-DD.' });
    }
    const hasPlanDurationWeeksOverride = Object.prototype.hasOwnProperty.call(payload, 'planDurationWeeks');
    const planDurationWeeksValidation = hasPlanDurationWeeksOverride
      ? normalizePlanDurationWeeks(payload?.planDurationWeeks)
      : { isSet: false, isValid: true, value: null };
    if (hasPlanDurationWeeksOverride && !planDurationWeeksValidation.isValid) {
      return res.status(400).json({ error: planDurationWeeksValidation.error || 'Invalid plan duration in weeks. Use a positive integer or leave blank.' });
    }

    const title = sanitizeText(payload?.title || 'Untitled Workout', 150) || 'Untitled Workout';
    const description = sanitizeText(payload?.description || '', 1000);
    const estimatedDuration = parseNumber(payload?.estimatedDurationMinutes) || 0;
    const visibility = normalizeGlobalAccessVisibility(payload?.accessLevel, 'private');

    const insertColumns = [
      'user_id',
      'title',
      'description',
      'workout_type',
    ];
    const insertValues = [
      userId,
      title,
      description,
      'Strength',
    ];
    if (hasCategoryOverride) {
      insertColumns.push('category');
      insertValues.push(categoryValidation.value);
    }
    insertColumns.push('workout_plan_type', 'estimated_duration_minutes', 'status', 'visibility', 'schedule_mode');
    insertValues.push(parsedPlanType.value, estimatedDuration, 'draft', visibility, 'day');

    if (schemaState.hasGoalType) {
      insertColumns.splice(5, 0, 'goal_type');
      insertValues.splice(5, 0, parsedGoalType.value);
    }
    if (schemaState.hasGoalTargetDate) {
      insertColumns.push('goal_target_date');
      insertValues.push(goalTargetDateValidation.value);
    }
    if (schemaState.hasPlanDurationWeeks) {
      insertColumns.push('plan_duration_weeks');
      insertValues.push(planDurationWeeksValidation.value);
    }

    const [result] = await pool.query(
      `INSERT INTO workout_schedules (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertValues
    );

    const scheduleId = Number(result.insertId || 0);
    if (!scheduleId) {
      return res.status(500).json({ error: 'Failed to create global workout plan' });
    }

    await pool.query(
      `INSERT INTO workout_schedule_groups (workout_schedule_id, label, group_type, sort_order)
       VALUES (?, 'Any Day', 'any', 1)`,
      [scheduleId]
    );

    const planner = await buildGlobalWorkoutPlanById(scheduleId);
    const workoutLists = await loadGlobalWorkoutPlans();

    return res.status(201).json({
      message: 'Global workout plan draft created',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to create global workout plan:', err);
    return res.status(500).json({ error: 'Failed to create global workout plan' });
  }
});

router.patch('/admin/global-workout-plans/:id', async (req, res) => {
  try {
    const userId = await requireAdminSessionUserForGlobalPlans(req, res);
    if (!userId) {
      return;
    }

    const schemaState = await ensureWorkoutPlannerOrderingColumns();
    if (!schemaState.hasWorkoutPlanType) {
      return res.status(400).json({ error: 'Database migration required: workout_plan_type column is missing.' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const body = req.body || {};
    const parsedGoalType = parseWorkoutGoalType(body?.goalType);
    if (!parsedGoalType.isValid) {
      return res.status(400).json({ error: 'Invalid Goal Type. Allowed values: No Specific Goal, Body Weight, Exercise Weight.' });
    }
    const hasCategoryOverride = Object.prototype.hasOwnProperty.call(body, 'category');
    const categoryValidation = hasCategoryOverride
      ? normalizeWorkoutPlanCategory(body?.category)
      : { isSet: false, isValid: true, value: null };
    if (hasCategoryOverride && !categoryValidation.isValid) {
      return res.status(400).json({ error: categoryValidation.error || getWorkoutPlanCategoryValidationError() });
    }
    const hasGoalTargetDateOverride = Object.prototype.hasOwnProperty.call(body, 'goalTargetDate');
    const goalTargetDateValidation = hasGoalTargetDateOverride
      ? normalizeWorkoutGoalTargetDate(body?.goalTargetDate)
      : { isSet: false, isValid: true, value: null };
    if (hasGoalTargetDateOverride && !goalTargetDateValidation.isValid) {
      return res.status(400).json({ error: goalTargetDateValidation.error || 'Invalid goal target date. Use YYYY-MM-DD.' });
    }
    const hasPlanDurationWeeksOverride = Object.prototype.hasOwnProperty.call(body, 'planDurationWeeks');
    const planDurationWeeksValidation = hasPlanDurationWeeksOverride
      ? normalizePlanDurationWeeks(body?.planDurationWeeks)
      : { isSet: false, isValid: true, value: null };
    if (hasPlanDurationWeeksOverride && !planDurationWeeksValidation.isValid) {
      return res.status(400).json({ error: planDurationWeeksValidation.error || 'Invalid plan duration in weeks. Use a positive integer or leave blank.' });
    }

    const [currentRows] = await pool.query(
      `SELECT id, workout_plan_type
       FROM workout_schedules
       WHERE id = ?
         AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
       LIMIT 1`,
      [scheduleId, ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
    );

    if (!currentRows.length) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    const requestedPlanType = validateRequestedWorkoutPlanType(req, body?.planType, {
      surface: PLAN_TYPE_SURFACE_ADMIN_GLOBAL,
    });
    if (!requestedPlanType.ok) {
      return res.status(requestedPlanType.status).json({ error: requestedPlanType.error });
    }

    const immutablePlanType = resolveImmutableWorkoutPlanType({
      existingValue: currentRows[0]?.workout_plan_type,
      requestedValue: requestedPlanType.isSet ? requestedPlanType.value : null,
    });
    if (!immutablePlanType.ok) {
      return res.status(immutablePlanType.status).json({ error: immutablePlanType.error });
    }
    const updateTypeSupport = await ensureWorkoutPlanTypeSupportedBySchema(immutablePlanType.value);
    if (!updateTypeSupport.ok) {
      return res.status(updateTypeSupport.status).json({ error: updateTypeSupport.error });
    }

    const title = sanitizeText(body?.title || '', 150);
    const description = sanitizeText(body?.description || '', 1000);
    const estimatedDuration = parseNumber(body?.estimatedDurationMinutes);
    const visibility = normalizeGlobalAccessVisibility(body?.accessLevel, 'public');

    const updateFields = [
      "title = COALESCE(NULLIF(?, ''), title)",
      'description = COALESCE(?, description)',
      'workout_plan_type = ?',
      'estimated_duration_minutes = COALESCE(?, estimated_duration_minutes)',
      'visibility = ?',
    ];
    const updateParams = [
      title,
      description,
      immutablePlanType.value,
      estimatedDuration,
      visibility,
    ];

    if (schemaState.hasGoalType) {
      updateFields.push('goal_type = ?');
      updateParams.push(parsedGoalType.value);
    }
    if (schemaState.hasGoalTargetDate && hasGoalTargetDateOverride) {
      updateFields.push('goal_target_date = ?');
      updateParams.push(goalTargetDateValidation.value);
    }
    if (schemaState.hasPlanDurationWeeks && hasPlanDurationWeeksOverride) {
      updateFields.push('plan_duration_weeks = ?');
      updateParams.push(planDurationWeeksValidation.value);
    }
    if (hasCategoryOverride) {
      updateFields.push('category = ?');
      updateParams.push(categoryValidation.value);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const [result] = await pool.query(
      `UPDATE workout_schedules
       SET
         ${updateFields.join(',\n         ')}
       WHERE id = ?
         AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})`,
      [
        ...updateParams,
        scheduleId,
        ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    const planner = await buildGlobalWorkoutPlanById(scheduleId);
    const workoutLists = await loadGlobalWorkoutPlans();

    return res.json({
      message: 'Global workout plan updated',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to update global workout plan:', err);
    return res.status(500).json({ error: 'Failed to update global workout plan' });
  }
});

const validateGlobalPlanStatusTransition = (currentStatus, nextStatus) => {
  const current = String(currentStatus || 'draft').trim().toLowerCase();
  const next = String(nextStatus || 'draft').trim().toLowerCase();

  if (!['draft', 'active', 'archived'].includes(next)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid status "${next}". Allowed values: draft, active, archived.`,
    };
  }

  const allowedTransitions = {
    draft: ['draft', 'active'],
    active: ['active', 'draft'],
    archived: ['draft'],
  };

  const allowed = allowedTransitions[current] || [];
  if (!allowed.includes(next)) {
    return {
      ok: false,
      status: 400,
      error: `Status transition from "${current}" to "${next}" is not allowed for global workout plans.`,
    };
  }

  return { ok: true, current, next };
};

router.patch('/admin/global-workout-plans/:id/schedule', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = await requireAdminSessionUserForGlobalPlans(req, res);
    if (!userId) {
      connection.release();
      return;
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      connection.release();
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const schemaState = await ensureWorkoutPlannerOrderingColumns(connection);

    const currentPlanner = await buildGlobalWorkoutPlanById(scheduleId);
    if (!currentPlanner) {
      connection.release();
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    const incomingPlanner = req.body?.planner;
    if (!incomingPlanner || typeof incomingPlanner !== 'object') {
      connection.release();
      return res.status(400).json({ error: 'planner object is required' });
    }

    const normalizedPlanner = normalizePlannerPayload({
      ...incomingPlanner,
      planId: String(scheduleId),
      metadata: {
        ...(incomingPlanner?.metadata || {}),
        category: incomingPlanner?.metadata?.category ?? currentPlanner?.metadata?.category ?? null,
        // Preserve global plan classification during schedule edits.
        planType: currentPlanner?.metadata?.planType,
        goalType: parseWorkoutGoalType(incomingPlanner?.metadata?.goalType).isValid
          ? parseWorkoutGoalType(incomingPlanner?.metadata?.goalType).value
          : currentPlanner?.metadata?.goalType,
        goalTargetDate: incomingPlanner?.metadata?.goalTargetDate ?? currentPlanner?.metadata?.goalTargetDate ?? null,
        planDurationWeeks: incomingPlanner?.metadata?.planDurationWeeks ?? currentPlanner?.metadata?.planDurationWeeks ?? null,
      },
    });
    const normalizedCategory = normalizeWorkoutPlanCategory(normalizedPlanner?.metadata?.category);
    if (normalizedPlanner?.metadata && Object.prototype.hasOwnProperty.call(normalizedPlanner.metadata, 'category') && normalizedCategory.isSet && !normalizedCategory.isValid) {
      return res.status(400).json({ error: normalizedCategory.error || getWorkoutPlanCategoryValidationError() });
    }
    const normalizedGoalType = parseWorkoutGoalType(normalizedPlanner?.metadata?.goalType).value;
    const hasGoalTargetDateOverride = Object.prototype.hasOwnProperty.call(normalizedPlanner?.metadata || {}, 'goalTargetDate');
    const goalTargetDateValidation = hasGoalTargetDateOverride
      ? normalizeWorkoutGoalTargetDate(normalizedPlanner?.metadata?.goalTargetDate)
      : { isSet: false, isValid: true, value: null };
    if (hasGoalTargetDateOverride && !goalTargetDateValidation.isValid) {
      connection.release();
      return res.status(400).json({ error: goalTargetDateValidation.error || 'Invalid goal target date. Use YYYY-MM-DD.' });
    }
    const hasPlanDurationWeeksOverride = Object.prototype.hasOwnProperty.call(normalizedPlanner?.metadata || {}, 'planDurationWeeks');
    const planDurationWeeksValidation = hasPlanDurationWeeksOverride
      ? normalizePlanDurationWeeks(normalizedPlanner?.metadata?.planDurationWeeks)
      : { isSet: false, isValid: true, value: null };
    if (hasPlanDurationWeeksOverride && !planDurationWeeksValidation.isValid) {
      connection.release();
      return res.status(400).json({ error: planDurationWeeksValidation.error || 'Invalid plan duration in weeks. Use a positive integer or leave blank.' });
    }
    const accessVisibility = normalizeGlobalAccessVisibility(
      normalizedPlanner?.metadata?.accessLevel,
      normalizeGlobalAccessVisibility(currentPlanner?.visibility, 'public')
    );

    const requestedStatus = String(req.body?.status ?? incomingPlanner?.metadata?.status ?? 'draft').trim().toLowerCase();
    const statusTransition = validateGlobalPlanStatusTransition(currentPlanner?.status || 'draft', requestedStatus);
    if (!statusTransition.ok) {
      connection.release();
      return res.status(statusTransition.status).json({ error: statusTransition.error });
    }
    const normalizedStatus = statusTransition.next;
    const requirePublishCompleteness = normalizedStatus === 'active';

    if (requirePublishCompleteness) {
      const completenessMissing = collectGlobalPlanCompletenessErrors(incomingPlanner);
      if (completenessMissing.length) {
        connection.release();
        return res.status(422).json({
          error: buildGlobalPlanCompletenessErrorMessage(completenessMissing),
          missingRequirements: completenessMissing,
        });
      }
    }

    await connection.beginTransaction();

    const scheduleUpdateFields = [
      'title = ?',
      'description = ?',
      'workout_type = ?',
      'estimated_duration_minutes = ?',
      'status = ?',
      'visibility = ?',
      'schedule_mode = ?',
    ];
    const scheduleUpdateParams = [
      sanitizeText(normalizedPlanner?.metadata?.name || '', 150) || 'Untitled Workout',
      sanitizeText(normalizedPlanner?.metadata?.description || '', 1000),
      sanitizeText(normalizedPlanner?.metadata?.type || 'Strength', 50) || 'Strength',
      parseNumber(normalizedPlanner?.metadata?.estimatedDuration) || 0,
      normalizedStatus,
      accessVisibility,
      normalizedPlanner?.scheduleMode === 'week' ? 'week' : 'day',
    ];
    scheduleUpdateFields.push('category = ?');
    scheduleUpdateParams.push(normalizedCategory.isSet ? normalizedCategory.value : null);

    if (schemaState.hasGoalType) {
      scheduleUpdateFields.push('goal_type = ?');
      scheduleUpdateParams.push(normalizedGoalType);
    }
    if (schemaState.hasGoalTargetDate && hasGoalTargetDateOverride) {
      scheduleUpdateFields.push('goal_target_date = ?');
      scheduleUpdateParams.push(goalTargetDateValidation.value);
    }
    if (schemaState.hasPlanDurationWeeks && hasPlanDurationWeeksOverride) {
      scheduleUpdateFields.push('plan_duration_weeks = ?');
      scheduleUpdateParams.push(planDurationWeeksValidation.value);
    }

    scheduleUpdateFields.push('updated_at = CURRENT_TIMESTAMP');

    const [updateResult] = await connection.query(
      `UPDATE workout_schedules
       SET
         ${scheduleUpdateFields.join(',\n         ')}
       WHERE id = ?
         AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})`,
      [
        ...scheduleUpdateParams,
        scheduleId,
        ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES,
      ]
    );

    if (!updateResult.affectedRows) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    await replaceScheduleGroupsAndExercises(connection, scheduleId, normalizedPlanner);
    await connection.commit();

    const planner = await buildGlobalWorkoutPlanById(scheduleId);
    const workoutLists = await loadGlobalWorkoutPlans();

    connection.release();
    return res.json({
      message: 'Global workout plan schedule updated',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    connection.release();
    console.error('❌ Failed to update global workout plan schedule:', err);
    return res.status(500).json({ error: 'Failed to update global workout plan schedule' });
  }
});

router.post('/admin/global-workout-plans/:id/exercises', async (req, res) => {
  try {
    const userId = await requireAdminSessionUserForGlobalPlans(req, res);
    if (!userId) {
      return;
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const body = req.body || {};
    const exerciseId = parseNumber(body.exerciseId);

    if (!exerciseId) {
      return res.status(400).json({ error: 'exerciseId is required' });
    }

    const [scheduleRows] = await pool.query(
      `SELECT id, workout_type
       FROM workout_schedules
       WHERE id = ?
         AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
       LIMIT 1`,
      [scheduleId, ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
    );

    if (!scheduleRows.length) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    const [exerciseRows] = await pool.query(
      'SELECT ExerciseID, ExerciseTitle, ImageURL, WorkoutType, MuscleGroup, Equipment FROM exercises WHERE ExerciseID = ? LIMIT 1',
      [exerciseId]
    );

    const exerciseRow = exerciseRows?.[0] || null;
    if (!exerciseRow) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const [groupRows] = await pool.query(
      `SELECT id
       FROM workout_schedule_groups
       WHERE workout_schedule_id = ?
       ORDER BY sort_order ASC, id ASC
       LIMIT 1`,
      [scheduleId]
    );

    const defaultGroupId = Number(groupRows?.[0]?.id || 0) || null;

    const [sortRows] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM workout_schedule_exercises WHERE workout_schedule_id = ?',
      [scheduleId]
    );
    const nextSortOrder = Number(sortRows?.[0]?.max_sort_order || 0) + 1;

    const schemaState = await getWorkoutPlannerSchemaState();
    const insertColumns = [
      'workout_schedule_id',
      'workout_schedule_group_id',
      'exercise_id',
      'exercise_name',
      'exercise_image_url',
      'workout_type',
      'muscle_group',
      'equipment',
      'sort_order',
      'notes',
      'target_sets',
      'target_reps',
      'target_weight',
      'target_duration_minutes',
      'target_rest_seconds',
    ];

    const insertValues = [
      scheduleId,
      defaultGroupId,
      Number(exerciseRow.ExerciseID || 0) || null,
      sanitizeText(body.name || exerciseRow.ExerciseTitle || '', 150),
      sanitizeText(body.image || exerciseRow.ImageURL || '', 255),
      sanitizeText(body.workoutType || exerciseRow.WorkoutType || scheduleRows[0]?.workout_type || 'Strength', 50),
      sanitizeText(body.muscleGroup || exerciseRow.MuscleGroup || '', 80),
      sanitizeText(body.equipment || exerciseRow.Equipment || '', 80),
      nextSortOrder,
      sanitizeText(body.notes || '', 500),
      parseNumber(body.targetSets),
      parseNumber(body.targetReps),
      parseNumber(body.targetWeight, true),
      parseNumber(body.targetDurationMinutes),
      parseNumber(body.targetRestSeconds),
    ];

    if (schemaState.hasTargetDistanceMiles) {
      insertColumns.push('target_distance_miles');
      insertValues.push(parseNumber(body.targetDistanceMiles, true));
    }

    const [insertResult] = await pool.query(
      `INSERT INTO workout_schedule_exercises
        (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertValues
    );

    await pool.query('UPDATE workout_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scheduleId]);

    const planner = await buildGlobalWorkoutPlanById(scheduleId);
    const workoutLists = await loadGlobalWorkoutPlans();

    return res.status(201).json({
      message: 'Exercise added to global workout plan',
      scheduleExerciseId: Number(insertResult.insertId || 0) || null,
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to add exercise to global workout plan:', err);
    return res.status(500).json({ error: 'Failed to add exercise to global workout plan' });
  }
});

router.delete('/admin/global-workout-plans/:id/exercises/:scheduleExerciseId', async (req, res) => {
  try {
    const userId = await requireAdminSessionUserForGlobalPlans(req, res);
    if (!userId) {
      return;
    }

    const scheduleId = Number(req.params?.id || 0);
    const scheduleExerciseId = Number(req.params?.scheduleExerciseId || 0);
    if (!scheduleId || !scheduleExerciseId) {
      return res.status(400).json({ error: 'Invalid schedule or exercise id' });
    }

    const [result] = await pool.query(
      `DELETE wse
       FROM workout_schedule_exercises wse
       INNER JOIN workout_schedules ws ON ws.id = wse.workout_schedule_id
       WHERE wse.id = ?
         AND ws.id = ?
         AND ws.workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})`,
      [
        scheduleExerciseId,
        scheduleId,
        ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Global workout plan exercise not found' });
    }

    await pool.query('UPDATE workout_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scheduleId]);

    const planner = await buildGlobalWorkoutPlanById(scheduleId);
    const workoutLists = await loadGlobalWorkoutPlans();

    return res.json({
      message: 'Exercise removed from global workout plan',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to remove exercise from global workout plan:', err);
    return res.status(500).json({ error: 'Failed to remove exercise from global workout plan' });
  }
});

router.delete('/admin/global-workout-plans/:id', async (req, res) => {
  try {
    const userId = await requireAdminSessionUserForGlobalPlans(req, res);
    if (!userId) {
      return;
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const [scheduleRows] = await pool.query(
      `SELECT id, cover_image_storage_key
       FROM workout_schedules
       WHERE id = ?
         AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})
       LIMIT 1`,
      [scheduleId, ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
    );

    if (!scheduleRows.length) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    await cleanupWorkoutPlanCoverForSchedule(scheduleRows[0]);

    const [result] = await pool.query(
      `DELETE FROM workout_schedules
       WHERE id = ?
         AND workout_plan_type IN (${GLOBAL_WORKOUT_PLAN_TYPE_SQL_PLACEHOLDERS})`,
      [scheduleId, ...GLOBAL_WORKOUT_PLAN_TYPE_VALUES]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Global workout plan not found' });
    }

    const workoutLists = await loadGlobalWorkoutPlans();
    return res.json({
      message: 'Global workout plan deleted',
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to delete global workout plan:', err);
    return res.status(500).json({ error: 'Failed to delete global workout plan' });
  }
});

// Compatibility endpoint used by existing frontend workflow
router.get('/workout-planner', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    await ensureWorkoutPlannerOrderingColumns();

    let workoutLists = [];
    let planner = null;
    try {
      workoutLists = await loadSchedulesForUser(userId);
      const requestedPlanId = Number(req.query?.planId || 0);
      const availablePlanIds = new Set(
        workoutLists
          .map((plan) => Number(plan?.planId || 0))
          .filter((id) => id > 0)
      );
      const safeRequestedPlanId = requestedPlanId && availablePlanIds.has(requestedPlanId)
        ? requestedPlanId
        : 0;
      const fallbackPlanId = workoutLists.length ? Number(workoutLists[0].planId) : 0;
      const selectedId = safeRequestedPlanId || fallbackPlanId;
      planner = selectedId ? await buildPlannerFromSchedule(selectedId, userId) : null;
    } catch (processingError) {
      console.error('Workout planner processing failed:', processingError);
      return res.status(500).json({
        success: false,
        message: 'Failed to process workout planner data',
        error: process.env.NODE_ENV === 'development' ? (processingError?.message || 'Unknown error') : undefined,
      });
    }

    return res.json({
      planner: planner || normalizePlannerPayload({}),
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
      canCreateFeaturedPlans: isAdminUser(req),
    });
  } catch (err) {
    console.error('❌ Failed to load workout planner:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load workout planner',
      error: process.env.NODE_ENV === 'development' ? (err?.message || 'Unknown error') : undefined,
    });
  }
});

router.get('/workout-planner/provenance', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const schemaState = await ensureWorkoutPlannerOrderingColumns();
    if (!schemaState.hasSourceGlobalPlanId) {
      return res.json({
        sourceGlobalPlanId: null,
        sourceGlobalPlanName: '',
        adoptedPlanCount: 0,
        adoptedByUsers: [],
        adoptedPlans: [],
      });
    }

    const planId = Number(req.query?.planId || 0);
    const sourceGlobalPlanId = Number(req.query?.sourceGlobalPlanId || 0);
    if (!planId && !sourceGlobalPlanId) {
      return res.status(400).json({ error: 'planId or sourceGlobalPlanId is required' });
    }

    if (planId) {
      const [rows] = await pool.query(
        `SELECT ws.id, ws.user_id, ws.source_global_plan_id, ws.global_plan_adopted_at, src.title AS source_global_plan_name
         FROM workout_schedules ws
         LEFT JOIN workout_schedules src ON src.id = ws.source_global_plan_id
         WHERE ws.id = ?
           AND ws.user_id = ?
         LIMIT 1`,
        [planId, userId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Workout plan not found' });
      }

      const row = rows[0] || {};
      return res.json({
        planId: Number(row.id || 0),
        userId: Number(row.user_id || 0),
        sourceGlobalPlanId: row.source_global_plan_id != null ? Number(row.source_global_plan_id) : null,
        sourceGlobalPlanName: String(row.source_global_plan_name || '').trim(),
        globalPlanAdoptedAt: row.global_plan_adopted_at || null,
      });
    }

    const [adoptedPlans] = await pool.query(
      `SELECT ws.id, ws.user_id, ws.title, ws.source_global_plan_id, ws.global_plan_adopted_at, src.title AS source_global_plan_name
       FROM workout_schedules ws
       LEFT JOIN workout_schedules src ON src.id = ws.source_global_plan_id
       WHERE ws.source_global_plan_id = ?
       ORDER BY ws.id DESC`,
      [sourceGlobalPlanId]
    );

    const adoptedByUsers = Array.from(
      new Set(
        adoptedPlans
          .map((row) => Number(row?.user_id || 0))
          .filter((value) => value > 0)
      )
    );

    return res.json({
      sourceGlobalPlanId,
      sourceGlobalPlanName: String(adoptedPlans[0]?.source_global_plan_name || '').trim(),
      adoptedPlanCount: adoptedPlans.length,
      adoptedByUsers,
      adoptedPlans: adoptedPlans.map((row) => ({
        planId: Number(row?.id || 0),
        userId: Number(row?.user_id || 0),
        name: String(row?.title || '').trim(),
        sourceGlobalPlanId: row?.source_global_plan_id != null ? Number(row.source_global_plan_id) : null,
        sourceGlobalPlanName: String(row?.source_global_plan_name || '').trim(),
        globalPlanAdoptedAt: row?.global_plan_adopted_at || null,
      })),
    });
  } catch (err) {
    console.error('❌ Failed to query workout planner provenance:', err);
    return res.status(500).json({ error: 'Failed to query workout planner provenance' });
  }
});

const normalizeWorkoutPlanPublicationStatus = (statusValue, fallback = 'draft') => {
  const normalized = String(statusValue || '').trim().toLowerCase();
  if (['draft', 'active', 'archived'].includes(normalized)) {
    return normalized;
  }

  const normalizedFallback = String(fallback || 'draft').trim().toLowerCase();
  if (['draft', 'active', 'archived'].includes(normalizedFallback)) {
    return normalizedFallback;
  }

  return 'draft';
};

const validateWorkoutPlanPublicationStatusTransition = (currentStatus, nextStatus) => {
  const current = normalizeWorkoutPlanPublicationStatus(currentStatus, 'draft');
  const next = String(nextStatus || '').trim().toLowerCase();

  if (!['draft', 'active', 'archived'].includes(next)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid status "${next}". Allowed values: draft, active, archived.`,
    };
  }

  const allowedTransitions = {
    draft: ['draft', 'active'],
    active: ['active', 'draft', 'archived'],
    archived: ['draft', 'archived'],
  };

  const allowed = allowedTransitions[current] || [];
  if (!allowed.includes(next)) {
    return {
      ok: false,
      status: 400,
      error: `Status transition from "${current}" to "${next}" is not allowed.`,
    };
  }

  return { ok: true, current, next };
};

// Compatibility endpoint used by existing frontend workflow
router.put('/workout-planner', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const incomingPlanner = req.body?.planner;
    if (!incomingPlanner || typeof incomingPlanner !== 'object' || Array.isArray(incomingPlanner)) {
      return res.status(400).json({ error: 'planner object is required' });
    }

    const requestedPlanType = validateRequestedWorkoutPlanType(req, incomingPlanner?.metadata?.planType);
    if (!requestedPlanType.ok) {
      return res.status(requestedPlanType.status).json({ error: requestedPlanType.error });
    }
    if (isRawGlobalWorkoutPlanType(requestedPlanType.value)) {
      return res.status(403).json({
        error: 'Global workout templates must be managed from Admin/Trainer Global Workout Plans.',
      });
    }

    const normalizedPlanner = normalizePlannerPayload(incomingPlanner);
    const normalizedCategory = normalizeWorkoutPlanCategory(normalizedPlanner?.metadata?.category);
    if (normalizedPlanner?.metadata && Object.prototype.hasOwnProperty.call(normalizedPlanner.metadata, 'category') && normalizedCategory.isSet && !normalizedCategory.isValid) {
      return res.status(400).json({ error: normalizedCategory.error || getWorkoutPlanCategoryValidationError() });
    }
    const hasGoalTargetDateOverride = Object.prototype.hasOwnProperty.call(incomingPlanner?.metadata || {}, 'goalTargetDate');
    const goalTargetDateValidation = hasGoalTargetDateOverride
      ? normalizeWorkoutGoalTargetDate(incomingPlanner?.metadata?.goalTargetDate)
      : { isSet: false, isValid: true, value: null };
    if (hasGoalTargetDateOverride && !goalTargetDateValidation.isValid) {
      return res.status(400).json({ error: goalTargetDateValidation.error || 'Invalid goal target date. Use YYYY-MM-DD.' });
    }
    const hasPlanDurationWeeksOverride = Object.prototype.hasOwnProperty.call(incomingPlanner?.metadata || {}, 'planDurationWeeks');
    const planDurationWeeksValidation = hasPlanDurationWeeksOverride
      ? normalizePlanDurationWeeks(incomingPlanner?.metadata?.planDurationWeeks)
      : { isSet: false, isValid: true, value: null };
    if (hasPlanDurationWeeksOverride && !planDurationWeeksValidation.isValid) {
      return res.status(400).json({ error: planDurationWeeksValidation.error || 'Invalid plan duration in weeks. Use a positive integer or leave blank.' });
    }
    const planId = Number(normalizedPlanner?.planId || 0);

    await connection.beginTransaction();
    const schemaState = await ensureWorkoutPlannerOrderingColumns(connection);
    const linkedGoalId = schemaState.hasLinkedGoalId
      ? await resolveLinkedGoalIdForUser(connection, userId, normalizedPlanner?.metadata?.goalId)
      : null;

    const requestedStatusRaw = incomingPlanner?.metadata?.status ?? incomingPlanner?.status;

    let scheduleId = planId;
    if (scheduleId) {
      const [ownedRows] = await connection.query(
        'SELECT id, workout_plan_type, status FROM workout_schedules WHERE id = ? AND user_id = ? LIMIT 1',
        [scheduleId, userId]
      );
      if (!ownedRows.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Workout plan not found' });
      }

      if (isRawGlobalWorkoutPlanType(ownedRows[0]?.workout_plan_type)) {
        await connection.rollback();
        return res.status(403).json({
          error: 'Global workout templates must be managed from Admin/Trainer Global Workout Plans.',
        });
      }

      const immutablePlanType = resolveImmutableWorkoutPlanType({
        existingValue: ownedRows[0]?.workout_plan_type,
        requestedValue: requestedPlanType.isSet ? requestedPlanType.value : null,
      });
      if (!immutablePlanType.ok) {
        await connection.rollback();
        return res.status(immutablePlanType.status).json({ error: immutablePlanType.error });
      }

      if (schemaState.hasWorkoutPlanType) {
        const typeSupport = await ensureWorkoutPlanTypeSupportedBySchema(immutablePlanType.value, connection);
        if (!typeSupport.ok) {
          await connection.rollback();
          return res.status(typeSupport.status).json({ error: typeSupport.error });
        }
      }

      const currentScheduleStatus = normalizeWorkoutPlanPublicationStatus(ownedRows[0]?.status, 'draft');
      const targetStatus = normalizeWorkoutPlanPublicationStatus(requestedStatusRaw, currentScheduleStatus);
      const statusTransition = validateWorkoutPlanPublicationStatusTransition(currentScheduleStatus, targetStatus);
      if (!statusTransition.ok) {
        await connection.rollback();
        return res.status(statusTransition.status).json({ error: statusTransition.error });
      }

      if (immutablePlanType.value === MARKETPLACE_WORKOUT_PLAN_TYPE && statusTransition.next === 'active') {
        await connection.rollback();
        return res.status(403).json({
          error: 'MARKETPLACE plans support classification only right now. Publishing is disabled.',
        });
      }

      const updateFields = [
        'title = ?',
        'description = ?',
        'workout_type = ?',
        'estimated_duration_minutes = ?',
        'status = ?',
        'schedule_mode = ?',
      ];
      const updateParams = [
        sanitizeText(normalizedPlanner?.metadata?.name || '', 150) || 'Untitled Workout',
        sanitizeText(normalizedPlanner?.metadata?.description || '', 1000),
        sanitizeText(normalizedPlanner?.metadata?.type || 'Strength', 50) || 'Strength',
        parseNumber(normalizedPlanner?.metadata?.estimatedDuration) || 0,
        statusTransition.next,
        normalizedPlanner?.scheduleMode === 'week' ? 'week' : 'day',
      ];

      if (schemaState.hasWorkoutPlanType) {
        updateFields.push('workout_plan_type = ?');
        updateParams.push(immutablePlanType.value);
      }
      updateFields.push('category = ?');
      updateParams.push(normalizedCategory.isSet ? normalizedCategory.value : null);
      if (schemaState.hasLinkedGoalId) {
        updateFields.push('linked_goal_id = ?');
        updateParams.push(linkedGoalId);
      }
      if (schemaState.hasGoalTargetDate && hasGoalTargetDateOverride) {
        updateFields.push('goal_target_date = ?');
        updateParams.push(goalTargetDateValidation.value);
      }
      if (schemaState.hasPlanDurationWeeks && hasPlanDurationWeeksOverride) {
        updateFields.push('plan_duration_weeks = ?');
        updateParams.push(planDurationWeeksValidation.value);
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      await connection.query(
        `UPDATE workout_schedules
         SET ${updateFields.join(',\n           ')}
         WHERE id = ? AND user_id = ?`,
        [...updateParams, scheduleId, userId]
      );
    } else {
      const draftPlanType = requestedPlanType.isSet ? requestedPlanType.value : PERSONAL_WORKOUT_PLAN_TYPE;
      if (schemaState.hasWorkoutPlanType) {
        const typeSupport = await ensureWorkoutPlanTypeSupportedBySchema(draftPlanType, connection);
        if (!typeSupport.ok) {
          await connection.rollback();
          return res.status(typeSupport.status).json({ error: typeSupport.error });
        }
      }

      const targetStatus = normalizeWorkoutPlanPublicationStatus(requestedStatusRaw, 'draft');
      const statusTransition = validateWorkoutPlanPublicationStatusTransition('draft', targetStatus);
      if (!statusTransition.ok) {
        await connection.rollback();
        return res.status(statusTransition.status).json({ error: statusTransition.error });
      }

      if (draftPlanType === MARKETPLACE_WORKOUT_PLAN_TYPE && statusTransition.next === 'active') {
        await connection.rollback();
        return res.status(403).json({
          error: 'MARKETPLACE plans support classification only right now. Publishing is disabled.',
        });
      }

      let insertResult;
      const insertColumns = ['user_id', 'title', 'description', 'workout_type'];
      const insertValues = [
        userId,
        sanitizeText(normalizedPlanner?.metadata?.name || '', 150) || 'Untitled Workout',
        sanitizeText(normalizedPlanner?.metadata?.description || '', 1000),
        sanitizeText(normalizedPlanner?.metadata?.type || 'Strength', 50) || 'Strength',
      ];

      if (normalizedPlanner?.metadata && Object.prototype.hasOwnProperty.call(normalizedPlanner.metadata, 'category')) {
        insertColumns.push('category');
        insertValues.push(normalizedCategory.isSet ? normalizedCategory.value : null);
      }

      if (schemaState.hasWorkoutPlanType) {
        insertColumns.push('workout_plan_type');
        insertValues.push(draftPlanType);
      }
      if (schemaState.hasLinkedGoalId) {
        insertColumns.push('linked_goal_id');
        insertValues.push(linkedGoalId);
      }
      if (schemaState.hasGoalTargetDate) {
        insertColumns.push('goal_target_date');
        insertValues.push(goalTargetDateValidation.value);
      }
      if (schemaState.hasPlanDurationWeeks) {
        insertColumns.push('plan_duration_weeks');
        insertValues.push(planDurationWeeksValidation.value);
      }
      insertColumns.push('estimated_duration_minutes', 'status', 'visibility', 'schedule_mode');
      insertValues.push(
        parseNumber(normalizedPlanner?.metadata?.estimatedDuration) || 0,
        statusTransition.next,
        'private',
        normalizedPlanner?.scheduleMode === 'week' ? 'week' : 'day'
      );

      [insertResult] = await connection.query(
        `INSERT INTO workout_schedules
          (${insertColumns.join(', ')})
         VALUES (${insertColumns.map(() => '?').join(', ')})`,
        insertValues
      );
      scheduleId = insertResult.insertId;
    }

    await replaceScheduleGroupsAndExercises(connection, scheduleId, normalizedPlanner);
    await connection.commit();

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    const workoutLists = await loadSchedulesForUser(userId);
    const hasSavedExerciseList = await hasSavedExercisesForUser(userId);

    return res.json({
      message: 'Workout planner saved',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: hasSavedExerciseList,
      canCreateFeaturedPlans: isAdminUser(req),
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    if (Number(err?.statusCode || 0) === 400) {
      return res.status(400).json({ error: err?.message || 'Invalid workout day name.' });
    }
    console.error('❌ Failed to save workout planner:', err);
    return res.status(500).json({ error: 'Failed to save workout planner' });
  } finally {
    connection.release();
  }
});

router.delete('/workout-planner/:planId', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.planId || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const [scheduleRows] = await pool.query(
      'SELECT id, user_id, workout_plan_type FROM workout_schedules WHERE id = ? LIMIT 1',
      [scheduleId]
    );

    if (!scheduleRows.length) {
      return res.status(404).json({ error: 'Workout plan not found' });
    }

    const schedule = scheduleRows[0] || {};
    if (Number(schedule.user_id || 0) !== Number(userId)) {
      return res.status(404).json({ error: 'Workout plan not found' });
    }

    if (isRawGlobalWorkoutPlanType(schedule.workout_plan_type)) {
      return res.status(403).json({
        error: 'Global workout templates must be managed from Admin/Trainer Global Workout Plans.',
      });
    }

    await cleanupWorkoutPlanCoverForSchedule(schedule);

    const [result] = await pool.query(
      'DELETE FROM workout_schedules WHERE id = ? AND user_id = ?',
      [scheduleId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Workout plan not found' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    return res.json({
      message: 'Workout plan deleted',
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
    });
  } catch (err) {
    console.error('❌ Failed to delete workout planner:', err);
    return res.status(500).json({ error: 'Failed to delete workout planner' });
  }
});

// Lightweight unlock-check endpoint used by sidebar and planner gates
router.get('/has-saved-workout-list', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    const hasSavedList = await hasSavedExercisesForUser(userId);

    return res.json({
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: hasSavedList,
      workoutLists,
      message: hasSavedList
        ? 'User has a saved workout exercise list.'
        : 'Create and save a workout plan to unlock your exercise list.',
    });
  } catch (err) {
    console.error('❌ Failed to check saved workout list:', err);
    return res.status(500).json({ error: 'Failed to check saved workout list' });
  }
});
 
module.exports = router;