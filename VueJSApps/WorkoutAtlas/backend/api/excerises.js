//Varibles
const express = require('express');
const multer = require('multer');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');
const ImageUpload = require('../Components/ImageUpload/ImageUpload');
const {
  DEFAULT_IMAGE_NAME,
  MEDIA_PROVIDER_LOCAL,
  ensureExerciseMediaColumns,
  isDefaultExerciseImageReference,
  resolveExerciseMediaRow,
} = require('../services/mediaResolver');
const {
  putObjectViaGateway,
  deleteObjectViaGateway,
} = require('../services/aiGatewayService');

// ✅ DB Connect
const pool = require('../db');

let exerciseSchemaReady = false;
let exerciseYouTubeColumnReady = false;

const requireAuthUserId = (req, res) => {
  const userId = req?.session?.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
    return null;
  }
  return Number(userId);
};

const isAdminUser = (req) => {
  const role = String(req?.session?.user?.role || '').trim().toLowerCase();
  const roleSlug = String(req?.session?.user?.roleSlug || '').trim().toLowerCase();
  return role === 'admin' || role === 'administrator' || roleSlug === 'admin' || roleSlug === 'administrator';
};

const normalizeSessionRoleSlug = (req) => {
  const roleSlug = String(req?.session?.user?.roleSlug || '').trim().toLowerCase();
  if (roleSlug === 'administrator') return 'admin';
  if (roleSlug) return roleSlug;

  const role = String(req?.session?.user?.role || '').trim().toLowerCase();
  if (role === 'administrator') return 'admin';
  return role;
};

const isTrainerUser = (req) => normalizeSessionRoleSlug(req) === 'trainer';

const hasRoleInDb = async (userId, roleSlug) => {
  const safeUserId = Number(userId || 0);
  const safeRoleSlug = String(roleSlug || '').trim().toLowerCase();
  if (!safeUserId || !safeRoleSlug) return false;

  const [rows] = await pool.query(
    `SELECT 1
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?
       AND LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) = ?
     LIMIT 1`,
    [safeUserId, safeRoleSlug]
  );

  return Array.isArray(rows) && rows.length > 0;
};

const hasTrainerRoleInDb = async (userId) => hasRoleInDb(userId, 'trainer');

const EXERCISE_SCOPE = Object.freeze({
  SYSTEM: 'SYSTEM',
  SHARED: 'SHARED',
  CUSTOM: 'CUSTOM',
  TRAINER_SHARED: 'TRAINER_SHARED',
  PRIVATE: 'PRIVATE',
});

const EXERCISE_PUBLICATION_STATE = Object.freeze({
  RESTRICTED: 'RESTRICTED',
  DISCOVERABLE: 'DISCOVERABLE',
});

const EXERCISE_ALLOWED_WORKOUT_TYPES = Object.freeze(['Strength', 'Cardio', 'Other']);
const EXERCISE_ALLOWED_RECORDING_TYPES = Object.freeze(['Sets & Reps', 'Time & Distance', 'Custom']);
const EXERCISE_FIELD_LIMITS = Object.freeze({
  ExerciseTitle: 100,
  WorkoutType: 50,
  RecordingType: 50,
  MuscleGroup: 50,
  Equipment: 50,
  Instructions: 65535,
  YouTubeVideoURL: 255,
});

const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const parseAndNormalizeYouTubeUrl = (rawValue) => {
  const normalizedField = normalizeExerciseTextField({
    value: rawValue,
    fieldLabel: 'YouTube Video URL',
    maxLength: EXERCISE_FIELD_LIMITS.YouTubeVideoURL,
  });

  if (!normalizedField.valid) {
    return { valid: false, error: normalizedField.error };
  }

  const inputValue = String(normalizedField.value || '').trim();
  if (!inputValue) {
    return { valid: true, value: '', videoId: '' };
  }

  if (/[<>]/.test(inputValue) || /<\s*iframe/i.test(inputValue)) {
    return { valid: false, error: 'YouTube Video URL must be a valid YouTube link, not embedded HTML.' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(inputValue);
  } catch (_err) {
    return { valid: false, error: 'YouTube Video URL is not a valid URL.' };
  }

  const protocol = String(parsedUrl.protocol || '').toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { valid: false, error: 'YouTube Video URL must use http or https.' };
  }

  const host = String(parsedUrl.hostname || '').toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.has(host)) {
    return { valid: false, error: 'Only youtube.com and youtu.be links are supported.' };
  }

  const pathSegments = String(parsedUrl.pathname || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.trim())
    .filter(Boolean);

  let videoId = '';
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    videoId = String(pathSegments[0] || '').trim();
  } else {
    const primarySegment = String(pathSegments[0] || '').toLowerCase();
    if (primarySegment === 'watch') {
      videoId = String(parsedUrl.searchParams.get('v') || '').trim();
    } else if (primarySegment === 'shorts' || primarySegment === 'embed') {
      videoId = String(pathSegments[1] || '').trim();
    }
  }

  if (!YOUTUBE_VIDEO_ID_REGEX.test(videoId)) {
    return {
      valid: false,
      error: 'YouTube Video URL must include a valid YouTube video ID.',
    };
  }

  return {
    valid: true,
    value: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
  };
};

const EXERCISE_SEARCH_ESCAPE_CHAR = '!';
const MAX_EXERCISE_SEARCH_LENGTH = 100;
const MAX_EXERCISE_SEARCH_KEYWORDS = 5;

const normalizeExerciseSearchTerm = (value, maxLength = MAX_EXERCISE_SEARCH_LENGTH) => {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) return '';
  return normalizedValue.slice(0, Math.max(1, Number(maxLength) || MAX_EXERCISE_SEARCH_LENGTH));
};

const escapeSqlLikePattern = (value, escapeChar = EXERCISE_SEARCH_ESCAPE_CHAR) => {
  const normalizedValue = String(value ?? '');
  if (!normalizedValue) return '';

  return normalizedValue
    .split(escapeChar).join(`${escapeChar}${escapeChar}`)
    .split('%').join(`${escapeChar}%`)
    .split('_').join(`${escapeChar}_`);
};

const buildLiteralSubstringLikeParam = (value) => {
  const normalizedValue = normalizeExerciseSearchTerm(value).toLowerCase();
  if (!normalizedValue || normalizedValue === 'all') return '';
  return `%${escapeSqlLikePattern(normalizedValue)}%`;
};

const tokenizeExerciseSearchKeywords = (value, maxKeywords = MAX_EXERCISE_SEARCH_KEYWORDS) => {
  const normalizedValue = normalizeExerciseSearchTerm(value).toLowerCase();
  if (!normalizedValue || normalizedValue === 'all') return [];

  const boundedKeywordCount = Math.max(1, Number(maxKeywords) || MAX_EXERCISE_SEARCH_KEYWORDS);
  return normalizedValue
    .split(/\s+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, boundedKeywordCount);
};

const buildLiteralSubstringLikeParams = (value) => {
  return tokenizeExerciseSearchKeywords(value)
    .map((keyword) => `%${escapeSqlLikePattern(keyword)}%`)
    .filter(Boolean);
};

const normalizeUnicodeText = (value) => {
  const stringValue = String(value ?? '');

  try {
    return stringValue.normalize('NFC');
  } catch (_err) {
    return null;
  }
};

const containsDisallowedControlCharacters = (value, { allowNewlines = false, allowTabs = false } = {}) => {
  for (const char of String(value ?? '')) {
    const codePoint = char.charCodeAt(0);
    if (codePoint > 31 && codePoint !== 127) continue;
    if (allowNewlines && (char === '\n' || char === '\r')) continue;
    if (allowTabs && char === '\t') continue;
    return true;
  }

  return false;
};

const normalizeExerciseTextField = ({
  value,
  fieldLabel,
  maxLength,
  required = false,
  allowNewlines = false,
  allowTabs = false,
} = {}) => {
  const normalizedUnicode = normalizeUnicodeText(value);
  if (normalizedUnicode === null) {
    return { valid: false, error: `${fieldLabel} contains invalid Unicode text.` };
  }

  const trimmedValue = normalizedUnicode.trim();
  if (!trimmedValue) {
    if (required) {
      return { valid: false, error: `${fieldLabel} is required.` };
    }

    return { valid: true, value: '' };
  }

  if (trimmedValue.includes('\uFFFD')) {
    return { valid: false, error: `${fieldLabel} contains invalid Unicode text.` };
  }

  if (containsDisallowedControlCharacters(trimmedValue, { allowNewlines, allowTabs })) {
    return { valid: false, error: `${fieldLabel} contains unsupported control characters.` };
  }

  if (trimmedValue.length > maxLength) {
    return { valid: false, error: `${fieldLabel} must be ${maxLength} characters or fewer.` };
  }

  return { valid: true, value: trimmedValue };
};

const normalizeExerciseAllowedValue = ({
  value,
  fieldLabel,
  allowedValues = [],
  maxLength,
  required = false,
  fallbackValue = '',
} = {}) => {
  const normalizedField = normalizeExerciseTextField({
    value: String(value ?? '').trim() || fallbackValue,
    fieldLabel,
    maxLength,
    required,
  });

  if (!normalizedField.valid) return normalizedField;
  if (!normalizedField.value) return normalizedField;

  const normalizedKey = normalizedField.value.toLocaleLowerCase();
  const matchingValue = allowedValues.find((entry) => String(entry).trim().toLocaleLowerCase() === normalizedKey);
  if (!matchingValue) {
    return { valid: false, error: `Please choose a valid ${fieldLabel.toLowerCase()}.` };
  }

  return { valid: true, value: matchingValue };
};

const loadExerciseCatalogEquipmentOptions = async () => {
  const [rows] = await pool.query(
    `SELECT DISTINCT Equipment
     FROM exercises
     WHERE COALESCE(Equipment, '') <> ''
     ORDER BY Equipment ASC`
  );

  const options = [...new Set(rows.map((row) => String(row?.Equipment || '').trim()).filter(Boolean))];
  if (!options.some((value) => value.toLocaleLowerCase() === 'none')) {
    options.push('None');
  }

  return options.sort((left, right) => String(left).localeCompare(String(right)));
};

const validateAndNormalizeExerciseMutationInput = ({
  payload = {},
  matrix,
  equipmentOptions = [],
} = {}) => {
  const fieldErrors = {};
  const normalizedValues = {};

  const setFieldError = (field, message) => {
    if (!fieldErrors[field]) {
      fieldErrors[field] = message;
    }
  };

  const titleResult = normalizeExerciseTextField({
    value: payload.ExerciseTitle,
    fieldLabel: 'Exercise Name',
    maxLength: EXERCISE_FIELD_LIMITS.ExerciseTitle,
    required: true,
  });
  if (!titleResult.valid) {
    setFieldError('ExerciseTitle', titleResult.error);
  } else {
    normalizedValues.ExerciseTitle = titleResult.value;
  }

  const workoutTypeResult = normalizeExerciseAllowedValue({
    value: payload.WorkoutType,
    fieldLabel: 'Workout Type',
    allowedValues: EXERCISE_ALLOWED_WORKOUT_TYPES,
    maxLength: EXERCISE_FIELD_LIMITS.WorkoutType,
    required: true,
  });
  if (!workoutTypeResult.valid) {
    setFieldError('WorkoutType', workoutTypeResult.error);
  } else {
    normalizedValues.WorkoutType = workoutTypeResult.value;
  }

  const recordingTypeResult = normalizeExerciseAllowedValue({
    value: payload.RecordingType,
    fieldLabel: 'Recording Type',
    allowedValues: EXERCISE_ALLOWED_RECORDING_TYPES,
    maxLength: EXERCISE_FIELD_LIMITS.RecordingType,
    required: true,
  });
  if (!recordingTypeResult.valid) {
    setFieldError('RecordingType', recordingTypeResult.error);
  } else {
    normalizedValues.RecordingType = recordingTypeResult.value;
  }

  const equipmentResult = normalizeExerciseAllowedValue({
    value: payload.Equipment,
    fieldLabel: 'Equipment',
    allowedValues: equipmentOptions,
    maxLength: EXERCISE_FIELD_LIMITS.Equipment,
    required: true,
    fallbackValue: 'None',
  });
  if (!equipmentResult.valid) {
    setFieldError('Equipment', equipmentResult.error);
  } else {
    normalizedValues.Equipment = equipmentResult.value;
  }

  const muscleGroupResult = normalizeExerciseTextField({
    value: payload.MuscleGroup,
    fieldLabel: 'Muscle Group',
    maxLength: EXERCISE_FIELD_LIMITS.MuscleGroup,
    required: true,
  });
  if (!muscleGroupResult.valid) {
    setFieldError('MuscleGroup', muscleGroupResult.error);
  } else {
    const categorySelection = validateAndNormalizeExerciseCategorySelection({
      workoutType: normalizedValues.WorkoutType,
      muscleGroup: muscleGroupResult.value,
      matrix,
      allowStrengthAllDefault: true,
    });
    if (!categorySelection.valid) {
      setFieldError('MuscleGroup', 'Please choose a valid muscle group for the selected workout type.');
    } else {
      normalizedValues.MuscleGroup = categorySelection.value;
    }
  }

  const instructionsResult = normalizeExerciseTextField({
    value: payload.Instructions,
    fieldLabel: 'Instructions',
    maxLength: EXERCISE_FIELD_LIMITS.Instructions,
    allowNewlines: true,
    allowTabs: true,
  });
  if (!instructionsResult.valid) {
    setFieldError('Instructions', instructionsResult.error);
  } else {
    normalizedValues.Instructions = instructionsResult.value;
  }

  const youtubeUrlResult = parseAndNormalizeYouTubeUrl(payload.YouTubeVideoURL);
  if (!youtubeUrlResult.valid) {
    setFieldError('YouTubeVideoURL', youtubeUrlResult.error);
  } else {
    normalizedValues.YouTubeVideoURL = youtubeUrlResult.value;
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    values: normalizedValues,
  };
};

const normalizeExerciseScopeValue = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  return Object.values(EXERCISE_SCOPE).includes(normalized) ? normalized : '';
};

const normalizeExercisePublicationStateValue = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  return Object.values(EXERCISE_PUBLICATION_STATE).includes(normalized) ? normalized : '';
};

const isLegacyExerciseScope = (value) => {
  const normalized = normalizeExerciseScopeValue(value);
  return normalized === EXERCISE_SCOPE.PRIVATE || normalized === EXERCISE_SCOPE.TRAINER_SHARED;
};

const normalizeRequestedCreateScope = (value) => {
  const normalized = normalizeExerciseScopeValue(value);
  if (normalized === EXERCISE_SCOPE.TRAINER_SHARED) return EXERCISE_SCOPE.SHARED;
  if (normalized === EXERCISE_SCOPE.PRIVATE) return EXERCISE_SCOPE.CUSTOM;
  return normalized;
};

const resolveExercisePublicationState = (exercise = {}) => {
  const explicitPublication = normalizeExercisePublicationStateValue(exercise?.ExercisePublicationState);
  if (explicitPublication) return explicitPublication;

  const explicitScope = normalizeExerciseScopeValue(exercise?.ExerciseScope);
  if (explicitScope === EXERCISE_SCOPE.PRIVATE) {
    return EXERCISE_PUBLICATION_STATE.RESTRICTED;
  }

  return EXERCISE_PUBLICATION_STATE.DISCOVERABLE;
};

const getOwnerMatchSql = (alias = 'e') => `COALESCE(${alias}.OwnerTrainerID, ${alias}.CreatedByUserID, 0)`;

const getExerciseOwnerUserId = (exercise) => {
  const ownerTrainerId = Number(exercise?.OwnerTrainerID || 0);
  if (ownerTrainerId > 0) return ownerTrainerId;

  const createdByUserId = Number(exercise?.CreatedByUserID || 0);
  if (createdByUserId > 0) return createdByUserId;

  return 0;
};

const getExerciseAccessProfile = (exercise) => {
  const explicitScope = normalizeExerciseScopeValue(exercise?.ExerciseScope);
  const isSystemExercise = Number(exercise?.IsSystemExercise ?? 0) === 1;
  const isGlobalExercise = Number(exercise?.IsGlobalExercise ?? 1) === 1;
  const ownerUserId = getExerciseOwnerUserId(exercise);
  const createdByUserId = Number(exercise?.CreatedByUserID || 0);
  const publicationState = resolveExercisePublicationState(exercise);

  return {
    explicitScope,
    isSystemExercise,
    isGlobalExercise,
    ownerUserId,
    createdByUserId,
    publicationState,
  };
};

const getEffectiveExerciseGlobalFlag = (exercise) => {
  const profile = getExerciseAccessProfile(exercise);
  if (profile.explicitScope === EXERCISE_SCOPE.PRIVATE) return 0;
  if (
    profile.explicitScope === EXERCISE_SCOPE.SYSTEM
    || profile.explicitScope === EXERCISE_SCOPE.SHARED
    || profile.explicitScope === EXERCISE_SCOPE.TRAINER_SHARED
  ) {
    return 1;
  }
  if (profile.isSystemExercise) return 1;
  if (profile.explicitScope === EXERCISE_SCOPE.CUSTOM) return 0;
  return profile.isGlobalExercise ? 1 : 0;
};

const buildExerciseGlobalFlagSelect = (alias = 'e') => {
  const prefix = alias ? `${alias}.` : '';
  return `
  CASE
    WHEN COALESCE(${prefix}ExerciseScope, '') = 'PRIVATE' THEN 0
    WHEN COALESCE(${prefix}ExerciseScope, '') = 'CUSTOM' THEN 0
    WHEN COALESCE(${prefix}ExerciseScope, '') IN ('SYSTEM', 'SHARED', 'TRAINER_SHARED') THEN 1
    WHEN COALESCE(${prefix}IsSystemExercise, 0) = 1 THEN 1
    ELSE 0
  END AS IsGlobalExercise
`;
};

const canReadExerciseForUser = ({ req, exercise }) => {
  if (isAdminUser(req)) return true;

  const currentUserId = Number(req?.session?.user?.id || 0);
  if (!currentUserId) return false;

  const profile = getExerciseAccessProfile(exercise);
  if (profile.explicitScope === EXERCISE_SCOPE.SYSTEM || profile.isSystemExercise) {
    return true;
  }

  if (profile.explicitScope === EXERCISE_SCOPE.SHARED) {
    return true;
  }

  if (profile.explicitScope === EXERCISE_SCOPE.CUSTOM) {
    return profile.ownerUserId === currentUserId
      || profile.publicationState === EXERCISE_PUBLICATION_STATE.DISCOVERABLE;
  }

  if (profile.explicitScope === EXERCISE_SCOPE.PRIVATE || profile.explicitScope === EXERCISE_SCOPE.TRAINER_SHARED) {
    return profile.ownerUserId === currentUserId;
  }

  if (!profile.isGlobalExercise) {
    return profile.ownerUserId === currentUserId;
  }

  if (profile.ownerUserId > 0) {
    return profile.ownerUserId === currentUserId;
  }

  return false;
};

const canManageExercise = ({ req, exercise }) => {
  if (isAdminUser(req)) return true;

  const currentUserId = Number(req?.session?.user?.id || 0);
  if (!currentUserId || !exercise) return false;

  const profile = getExerciseAccessProfile(exercise);
  if (profile.explicitScope === EXERCISE_SCOPE.SYSTEM || profile.isSystemExercise) {
    return false;
  }

  if (
    profile.explicitScope === EXERCISE_SCOPE.SHARED
    || profile.explicitScope === EXERCISE_SCOPE.CUSTOM
    || profile.explicitScope === EXERCISE_SCOPE.PRIVATE
    || profile.explicitScope === EXERCISE_SCOPE.TRAINER_SHARED
  ) {
    return profile.ownerUserId === currentUserId;
  }

  if (!profile.isGlobalExercise) {
    return profile.ownerUserId === currentUserId;
  }

  if (profile.ownerUserId > 0) {
    return profile.ownerUserId === currentUserId;
  }

  return false;
};

const canDeleteExercise = ({ req, exercise }) => canManageExercise({ req, exercise });

const buildUserRoleExistsClause = (userIdSql, roleValues = []) => {
  const normalizedRoleValues = Array.isArray(roleValues)
    ? roleValues.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
    : [];
  if (!normalizedRoleValues.length) return '0 = 1';

  const roleListSql = normalizedRoleValues.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
  return `(
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${userIdSql}
        AND LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) IN (${roleListSql})
        AND COALESCE(r.is_active, 1) = 1
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.user_id = ${userIdSql}
        AND LOWER(TRIM(COALESCE(up.user_role, ''))) IN (${roleListSql})
      LIMIT 1
    )
  )`;
};

const buildExerciseCreatorIsTrainerClause = (alias = 'e') => buildUserRoleExistsClause(`${alias}.CreatedByUserID`, ['trainer']);
const buildExerciseCreatorIsAdminClause = (alias = 'e') => buildUserRoleExistsClause(`${alias}.CreatedByUserID`, ['admin', 'administrator']);

const buildExerciseVisibilityClause = (alias = 'e') => `(
  ${alias}.ExerciseScope = 'SYSTEM'
  OR COALESCE(${alias}.IsSystemExercise, 0) = 1
  OR (
    ${alias}.ExerciseScope = 'SHARED'
    AND COALESCE(${alias}.ExercisePublicationState, 'DISCOVERABLE') = 'DISCOVERABLE'
  )
  OR (
    ${alias}.ExerciseScope = 'CUSTOM'
    AND (
      (? = 1 AND ${getOwnerMatchSql(alias)} = ?)
      OR (
        COALESCE(${alias}.ExercisePublicationState, 'DISCOVERABLE') = 'DISCOVERABLE'
        AND (
          (? = 1 AND ${buildExerciseCreatorIsTrainerClause(alias)})
          OR (
            ? = 1
            AND NOT ${buildExerciseCreatorIsTrainerClause(alias)}
            AND NOT ${buildExerciseCreatorIsAdminClause(alias)}
          )
        )
      )
    )
  )
  OR (${alias}.ExerciseScope = 'PRIVATE' AND ${getOwnerMatchSql(alias)} = ?)
  OR (${alias}.ExerciseScope = 'TRAINER_SHARED' AND ${getOwnerMatchSql(alias)} = ?)
  OR (
    ${alias}.ExerciseScope IS NULL
    AND (
      COALESCE(${alias}.IsSystemExercise, 0) = 1
      OR ${getOwnerMatchSql(alias)} = ?
    )
  )
)`;

const appendExerciseVisibilityFilter = ({
  where,
  params,
  alias,
  userId,
  isAdmin,
  includeTrainerCustom = false,
  includeUserCustom = false,
  includeCustom = false,
  includeOwnedCustom = false,
}) => {
  if (isAdmin) return;
  const safeUserId = Number(userId || 0);
  const includeLegacyCustom = Boolean(includeCustom);
  where.push(buildExerciseVisibilityClause(alias));
  params.push(
    includeOwnedCustom ? 1 : 0,
    safeUserId,
    includeLegacyCustom || includeTrainerCustom ? 1 : 0,
    includeLegacyCustom || includeUserCustom ? 1 : 0,
    safeUserId,
    safeUserId,
    safeUserId
  );
};

const toTinyIntBoolean = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return 1;
  return 0;
};

const normalizeExerciseCreatePayload = ({
  ExerciseTitle,
  MuscleGroup,
  Equipment,
  WorkoutType,
  RecordingType,
  Instructions,
  YouTubeVideoURL,
  ExerciseScope,
  ExercisePublicationState,
  CreateAsGlobalExercise,
  IsGlobalExercise,
  OwnerTrainerID,
}, { userId, isAdmin, role } = {}) => {
  const safeUserId = Number(userId || 0);
  const normalizedRole = String(role || '').trim().toLowerCase();
  const canCreateSystem = Boolean(isAdmin);
  const canCreateShared = Boolean(isAdmin || normalizedRole === 'trainer');
  const requestedScope = normalizeRequestedCreateScope(ExerciseScope);
  const requestedPublicationState = normalizeExercisePublicationStateValue(ExercisePublicationState);
  const requestedGlobalExercise = toTinyIntBoolean(CreateAsGlobalExercise ?? IsGlobalExercise);
  const requestedOwnerTrainerId = Number(OwnerTrainerID || 0);

  let exerciseScope = EXERCISE_SCOPE.CUSTOM;
  let ownerTrainerId = null;
  let createAsGlobalExercise = 0;
  let publicationState = requestedPublicationState || EXERCISE_PUBLICATION_STATE.DISCOVERABLE;

  if (requestedScope === EXERCISE_SCOPE.SYSTEM) {
    if (canCreateSystem) {
      exerciseScope = EXERCISE_SCOPE.SYSTEM;
      ownerTrainerId = null;
      createAsGlobalExercise = 1;
      publicationState = EXERCISE_PUBLICATION_STATE.DISCOVERABLE;
    }
  } else if (requestedScope === EXERCISE_SCOPE.SHARED && canCreateShared) {
    exerciseScope = EXERCISE_SCOPE.SHARED;
    ownerTrainerId = isAdmin ? (requestedOwnerTrainerId > 0 ? requestedOwnerTrainerId : null) : safeUserId;
    createAsGlobalExercise = 1;
    publicationState = EXERCISE_PUBLICATION_STATE.DISCOVERABLE;
  } else if (requestedScope === EXERCISE_SCOPE.CUSTOM) {
    exerciseScope = EXERCISE_SCOPE.CUSTOM;
    ownerTrainerId = null;
    createAsGlobalExercise = 0;
    publicationState = requestedPublicationState || EXERCISE_PUBLICATION_STATE.DISCOVERABLE;
  } else if (requestedGlobalExercise === 1 && canCreateSystem) {
    exerciseScope = EXERCISE_SCOPE.SYSTEM;
    ownerTrainerId = null;
    createAsGlobalExercise = 1;
    publicationState = EXERCISE_PUBLICATION_STATE.DISCOVERABLE;
  } else if (requestedGlobalExercise === 1 && canCreateShared) {
    exerciseScope = EXERCISE_SCOPE.SHARED;
    ownerTrainerId = isAdmin ? (requestedOwnerTrainerId > 0 ? requestedOwnerTrainerId : null) : safeUserId;
    createAsGlobalExercise = 1;
    publicationState = EXERCISE_PUBLICATION_STATE.DISCOVERABLE;
  }

  if (!canCreateSystem && !canCreateShared) {
    exerciseScope = EXERCISE_SCOPE.CUSTOM;
    ownerTrainerId = null;
    createAsGlobalExercise = 0;
    publicationState = requestedPublicationState || EXERCISE_PUBLICATION_STATE.DISCOVERABLE;
  }

  if (exerciseScope === EXERCISE_SCOPE.SHARED && ownerTrainerId <= 0 && normalizedRole === 'trainer') {
    ownerTrainerId = safeUserId;
  }

  return {
    ExerciseTitle: String(ExerciseTitle ?? '').trim(),
    MuscleGroup: String(MuscleGroup ?? '').trim(),
    Equipment: String(Equipment ?? '').trim() || 'None',
    WorkoutType: String(WorkoutType ?? '').trim(),
    RecordingType: String(RecordingType ?? '').trim(),
    Instructions: String(Instructions ?? '').trim(),
    YouTubeVideoURL: String(YouTubeVideoURL ?? '').trim(),
    ExerciseScope: exerciseScope,
    ExercisePublicationState: publicationState,
    OwnerTrainerID: ownerTrainerId,
    CreateAsGlobalExercise: createAsGlobalExercise,
    IsGlobalExercise: createAsGlobalExercise,
    CreatedByUserID: safeUserId,
    createAsGlobalExercise,
  };
};

const validateExerciseCreatePayload = (payload = {}) => {
  const requiredFields = [
    ['ExerciseTitle', 'Exercise Name'],
    ['MuscleGroup', 'Muscle Group'],
    ['Equipment', 'Equipment'],
    ['WorkoutType', 'Workout Type'],
    ['RecordingType', 'Recording Type'],
  ];

  const missingFields = requiredFields
    .filter(([key]) => !String(payload[key] ?? '').trim())
    .map(([, label]) => label);

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
};

const normalizeExerciseCategoryLabel = (value) => String(value ?? '').trim();

const normalizeExerciseCategoryKey = (value) => normalizeExerciseCategoryLabel(value).toLowerCase();

const CARDIO_MUSCLE_GROUP_OPTIONS = Object.freeze([
  'Core: Abs',
  'Legs: Calves',
  'Legs: Quadriceps',
  'Cardio: Full Body',
  'Cardio: General',
  'Legs: Hamstrings',
  'Legs: Glutes',
  'Legs: Full Lower Body',
  'Upper Body: Arms',
  'Upper Body: Back',
]);

const addCardioMuscleGroupOptionsToMatrix = (matrix = new Map()) => {
  const cardioKey = normalizeExerciseCategoryKey('Cardio');
  if (!matrix.has(cardioKey)) {
    matrix.set(cardioKey, new Map());
  }

  const cardioGroups = matrix.get(cardioKey);
  CARDIO_MUSCLE_GROUP_OPTIONS.forEach((label) => {
    cardioGroups.set(normalizeExerciseCategoryKey(label), label);
  });

  return matrix;
};

const buildWorkoutTypeMuscleGroupMatrix = (rows = []) => {
  const matrix = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const workoutTypeLabel = normalizeExerciseCategoryLabel(row?.WorkoutType);
    const muscleGroupLabel = normalizeExerciseCategoryLabel(row?.MuscleGroup);
    if (!workoutTypeLabel || !muscleGroupLabel) return;

    const workoutTypeKey = normalizeExerciseCategoryKey(workoutTypeLabel);
    if (!matrix.has(workoutTypeKey)) {
      matrix.set(workoutTypeKey, new Map());
    }

    matrix.get(workoutTypeKey).set(normalizeExerciseCategoryKey(muscleGroupLabel), muscleGroupLabel);
  });

  return addCardioMuscleGroupOptionsToMatrix(matrix);
};

const exerciseCatalogSupportsAllMuscleGroup = (matrix = new Map()) => {
  for (const scopedGroups of matrix.values()) {
    if (scopedGroups.has('all')) {
      return true;
    }
  }
  return false;
};

const getCatalogMuscleGroupsForWorkoutType = ({ workoutType, matrix, includeStrengthAll = false } = {}) => {
  const workoutTypeKey = normalizeExerciseCategoryKey(workoutType);
  const scopedGroups = matrix instanceof Map ? matrix.get(workoutTypeKey) : null;
  const options = scopedGroups ? [...scopedGroups.values()] : [];

  options.sort((left, right) => String(left).localeCompare(String(right)));

  if (
    workoutTypeKey === 'strength'
    && includeStrengthAll
    && exerciseCatalogSupportsAllMuscleGroup(matrix)
    && !options.some((value) => normalizeExerciseCategoryKey(value) === 'all')
  ) {
    options.unshift('All');
  }

  return options;
};

const validateAndNormalizeExerciseCategorySelection = ({
  workoutType,
  muscleGroup,
  matrix,
  allowStrengthAllDefault = false,
} = {}) => {
  const normalizedWorkoutType = normalizeExerciseCategoryLabel(workoutType);
  const normalizedMuscleGroup = normalizeExerciseCategoryLabel(muscleGroup);
  const allowedOptions = getCatalogMuscleGroupsForWorkoutType({
    workoutType: normalizedWorkoutType,
    matrix,
    includeStrengthAll: allowStrengthAllDefault,
  });

  if (!normalizedWorkoutType) {
    return {
      valid: false,
      value: normalizedMuscleGroup,
      allowedOptions,
      reason: 'missing-workout-type',
    };
  }

  if (!normalizedMuscleGroup) {
    if (
      normalizeExerciseCategoryKey(normalizedWorkoutType) === 'strength'
      && allowStrengthAllDefault
      && exerciseCatalogSupportsAllMuscleGroup(matrix)
    ) {
      return {
        valid: true,
        value: 'All',
        allowedOptions,
        defaulted: true,
      };
    }

    return {
      valid: false,
      value: normalizedMuscleGroup,
      allowedOptions,
      reason: 'missing-muscle-group',
    };
  }

  const selectedKey = normalizeExerciseCategoryKey(normalizedMuscleGroup);
  const matchingOption = allowedOptions.find((option) => normalizeExerciseCategoryKey(option) === selectedKey);
  if (matchingOption) {
    return {
      valid: true,
      value: matchingOption,
      allowedOptions,
    };
  }

  if (
    normalizeExerciseCategoryKey(normalizedWorkoutType) === 'strength'
    && allowStrengthAllDefault
    && selectedKey === 'all'
    && exerciseCatalogSupportsAllMuscleGroup(matrix)
  ) {
    return {
      valid: true,
      value: 'All',
      allowedOptions,
    };
  }

  return {
    valid: false,
    value: normalizedMuscleGroup,
    allowedOptions,
    reason: 'invalid-combination',
  };
};

const loadExerciseCatalogWorkoutTypeMuscleGroupMatrix = async () => {
  const [rows] = await pool.query(
    `SELECT DISTINCT WorkoutType, MuscleGroup
     FROM exercises
     WHERE COALESCE(WorkoutType, '') <> ''
       AND COALESCE(MuscleGroup, '') <> ''`
  );

  return buildWorkoutTypeMuscleGroupMatrix(rows);
};

const buildLogicalMediaPath = (exerciseId) => `APP/exercise-library/${Number(exerciseId || 0)}/images`;

const normalizeExerciseStorageKeyForDelete = ({ exerciseId, value }) => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  let normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '');

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsedUrl = new URL(normalized);
      normalized = String(parsedUrl.pathname || '').replace(/^\/+/, '');
    } catch (_) {
      return null;
    }
  }

  if (!normalized || normalized.includes('..')) {
    return null;
  }

  if (isProtectedExerciseStorageReference(normalized)) {
    return null;
  }

  const safeExerciseId = Number(exerciseId || 0);
  const folderPrefix = `APP/exercise-library/${safeExerciseId}/images`;
  const folderPath = `${folderPrefix}/`;

  if (normalized.toLowerCase() === folderPrefix.toLowerCase() || normalized.toLowerCase() === `${folderPath}`.toLowerCase()) {
    return folderPath;
  }

  const directMatch = normalized.match(/^APP\/exercise-library\/(\d+)\/images\/?(.*)$/i);
  if (directMatch) {
    const matchedId = Number(directMatch[1] || 0);
    if (!matchedId || matchedId !== safeExerciseId) {
      return null;
    }

    const suffix = String(directMatch[2] || '').trim();
    if (!suffix) {
      return folderPath;
    }

    return `${folderPrefix}/${suffix.replace(/^\/+/, '')}`;
  }

  if (!normalized.includes('/')) {
    return `${folderPrefix}/${normalized.replace(/^\/+/, '')}`;
  }

  return null;
};

const getExerciseRemoteDeleteTargets = ({ exerciseId, exercise }) => {
  const safeExerciseId = Number(exerciseId || 0);
  if (!safeExerciseId) {
    return [];
  }

  const candidateValues = [
    exercise?.PrimaryImage,
    exercise?.ImageURL,
    exercise?.MediaPath,
  ];

  const galleryValues = (() => {
    try {
      const parsed = JSON.parse(exercise?.ImageGallery || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  })();

  for (const entry of galleryValues) {
    candidateValues.push(entry);
  }

  const uniqueTargets = new Set();
  for (const value of candidateValues) {
    if (Array.isArray(value)) {
      for (const nestedValue of value) {
        const normalized = normalizeExerciseStorageKeyForDelete({ exerciseId: safeExerciseId, value: nestedValue });
        if (normalized) uniqueTargets.add(normalized);
      }
      continue;
    }

    const normalized = normalizeExerciseStorageKeyForDelete({ exerciseId: safeExerciseId, value });
    if (normalized) uniqueTargets.add(normalized);
  }

  const folderMarker = `${buildLogicalMediaPath(safeExerciseId)}/`;
  uniqueTargets.add(folderMarker);

  return [...uniqueTargets].sort();
};

const isGatewayObjectNotFound = (response) => {
  const gatewayResponse = response?.response || response || {};
  const errorCodes = [
    response?.error,
    response?.code,
    gatewayResponse?.error,
    gatewayResponse?.code,
  ].filter((value) => value !== undefined && value !== null);

  if (errorCodes.some((code) => String(code).trim().toUpperCase() === 'OBJECT_NOT_FOUND')) {
    return true;
  }

  const messages = [response?.message, gatewayResponse?.message].filter((value) => typeof value === 'string' && value.trim());
  return messages.some((message) => /object was not found\./i.test(String(message).trim()));
};

const isGatewayObjectNotFoundError = (error) => {
  if (!error) return false;

  const codeCandidates = [
    error?.gatewayErrorCode,
    error?.code,
    error?.gatewayBody?.error,
    error?.gatewayBody?.code,
  ].filter((value) => value !== undefined && value !== null);

  if (codeCandidates.some((code) => String(code).trim().toUpperCase() === 'OBJECT_NOT_FOUND')) {
    return true;
  }

  const message = String(error?.message || '').trim();
  return /object was not found\./i.test(message);
};

const deleteExerciseStoredMedia = async ({ exerciseId, exercise, requestId = null, deleteObject = deleteObjectViaGateway }) => {
  const targets = getExerciseRemoteDeleteTargets({ exerciseId, exercise });
  const results = [];

  for (const storageKey of targets) {
    let response;
    try {
      response = await deleteObject({
        storageKey,
        appName: 'Workout-Atlas',
        requestId,
      });
    } catch (error) {
      if (isGatewayObjectNotFoundError(error)) {
        continue;
      }
      if (!error.storageKey) {
        error.storageKey = storageKey;
      }
      throw error;
    }

    const gatewayResponse = response?.response || response;
    const gatewaySuccess = response?.success !== false && gatewayResponse?.success !== false;

    if (isGatewayObjectNotFound(response)) {
      continue;
    }

    if (!gatewaySuccess) {
      const detail = gatewayResponse?.message || response?.message || `Gateway delete failed for ${storageKey}.`;
      const error = new Error(detail);
      error.storageKey = storageKey;
      throw error;
    }
    results.push(storageKey);
  }

  return results;
};

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowedTypes.test(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  },
}).array('images', 2);

const CANONICAL_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const canonicalImageNameForSlot = (slotIndex, extension) => {
  const safeExt = CANONICAL_IMAGE_EXTENSIONS.has(String(extension || '').toLowerCase())
    ? String(extension || '').toLowerCase()
    : '.jpg';
  return slotIndex === 1 ? `exercise-2${safeExt}` : `exercise${safeExt}`;
};

const resolveValidatedImageExtension = (file = {}) => {
  const rawExt = path.extname(String(file?.originalname || file?.filename || '').trim()).toLowerCase();
  if (CANONICAL_IMAGE_EXTENSIONS.has(rawExt)) {
    return rawExt;
  }

  const mime = String(file?.mimetype || '').toLowerCase().trim();
  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };

  if (mimeToExt[mime]) {
    return mimeToExt[mime];
  }

  throw new Error('Unsupported image type. Allowed types: jpg, jpeg, png, gif, webp.');
};

const buildExerciseMediaApiUrl = (exerciseId, imageName) => {
  const safeId = Number(exerciseId || 0);
  const safeName = String(imageName || '').trim();
  if (!safeId || !safeName) {
    return '';
  }
  return `/api/media/exercises/${safeId}/image?name=${encodeURIComponent(safeName)}`;
};

const normalizeStoredImageName = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const noQuery = raw.split('?')[0].replace(/\\/g, '/');
  const fileName = path.basename(noQuery);
  if (!fileName || fileName.includes('..') || fileName.includes('/')) {
    return '';
  }

  if (isDefaultExerciseImageReference(fileName)) {
    return '';
  }

  return fileName;
};

const parseImageArrayInput = (value) => {
  const parsed = Array.isArray(value)
    ? value
    : (() => {
        const text = String(value || '').trim();
        if (!text) return [];
        try {
          const asJson = JSON.parse(text);
          return Array.isArray(asJson) ? asJson : [];
        } catch (_) {
          return [];
        }
      })();

  const unique = [];
  const seen = new Set();
  for (const entry of parsed) {
    const normalized = normalizeStoredImageName(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique.slice(0, 2);
};

const assignExistingImagesToSlots = (existingImages = []) => {
  const slots = [null, null];

  for (const imageName of existingImages) {
    if (!imageName) continue;

    const lower = imageName.toLowerCase();
    if (lower.startsWith('exercise-2.') && !slots[1]) {
      slots[1] = imageName;
      continue;
    }
    if (lower.startsWith('exercise.') && !slots[0]) {
      slots[0] = imageName;
      continue;
    }

    if (!slots[0]) {
      slots[0] = imageName;
    } else if (!slots[1]) {
      slots[1] = imageName;
    }
  }

  return slots;
};

const buildExerciseImageStorageKey = (exerciseId, imageName) => {
  const normalizedName = normalizeStoredImageName(imageName);
  if (!normalizedName) {
    return '';
  }

  const safeId = Number(exerciseId || 0);
  if (!safeId) {
    return '';
  }

  return `${buildLogicalMediaPath(safeId)}/${normalizedName}`;
};

const gatewayContentTypeForFilename = (filename = '') => {
  const ext = path.extname(String(filename || '').trim()).toLowerCase();
  const mapping = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mapping[ext] || 'application/octet-stream';
};

const createGatewayFolderMarker = () => Buffer.from('exercise-library-folder-marker');

async function ensureExerciseFolderMarker({ exerciseId, putObject = putObjectViaGateway }) {
  const safeId = Number(exerciseId || 0);
  if (!safeId) {
    throw new Error('ExerciseID is required before creating the remote folder marker.');
  }

  const storageKey = `${buildLogicalMediaPath(safeId)}/`;
  const response = await putObject({
    storageKey,
    contentType: 'application/octet-stream',
    dataBase64: createGatewayFolderMarker().toString('base64'),
    appName: 'Workout-Atlas',
  });

  const gatewayResponse = response?.response || response;
  const gatewaySuccess = response?.success !== false && gatewayResponse?.success !== false;

  if (!gatewaySuccess) {
    const message = gatewayResponse?.message || response?.message || `Gateway marker creation failed for ${storageKey}.`;
    throw new Error(`Exercise folder marker creation failed for ${storageKey}: ${message}`);
  }

  return response;
}

async function uploadImageToGatewayStorage({ exerciseId, file, slotIndex = 0, isFolderMarker = false }) {
  const safeId = Number(exerciseId || 0);
  if (!safeId) {
    throw new Error('ExerciseID is required before uploading the image object.');
  }

  if (isFolderMarker) {
    await ensureExerciseFolderMarker({ exerciseId: safeId });
    return { storageKey: `${buildLogicalMediaPath(safeId)}/`, fileName: '' };
  }

  const validatedExtension = resolveValidatedImageExtension(file);
  const safeFileName = canonicalImageNameForSlot(slotIndex, validatedExtension);
  const originalName = String(file?.originalname || file?.filename || safeFileName).trim();

  if (isDefaultExerciseImageReference(safeFileName) || isDefaultExerciseImageReference(originalName)) {
    throw new Error('The default exercise image is reserved and cannot be replaced or uploaded as a custom exercise file.');
  }

  const storageKey = `${buildLogicalMediaPath(safeId)}/${safeFileName}`;
  const fileBuffer = Buffer.isBuffer(file?.buffer) ? file.buffer : Buffer.from(file?.buffer || '', 'binary');

  if (!fileBuffer.length) {
    throw new Error('The uploaded image content is empty.');
  }

  await putObjectViaGateway({
    storageKey,
    contentType: gatewayContentTypeForFilename(safeFileName),
    dataBase64: fileBuffer.toString('base64'),
    appName: 'Workout-Atlas',
  });

  return { storageKey, fileName: safeFileName };
}

const getExerciseOwnership = async (exerciseId) => {
  const [rows] = await pool.query(
    `SELECT ExerciseID, ExerciseTitle, ImageURL, ImageGallery, CreatedByUserID,
            OwnerTrainerID, SourceExerciseID, ExerciseScope, ExercisePublicationState,
            YouTubeVideoURL,
            ${buildExerciseGlobalFlagSelect('')},
            COALESCE(IsSystemExercise, 0) AS IsSystemExercise
     FROM exercises
     WHERE ExerciseID = ?
     LIMIT 1`,
    [exerciseId]
  );

  return rows?.[0] || null;
};

const isProtectedExerciseStorageReference = (value) => {
  if (Array.isArray(value)) {
    return value.some((entry) => isProtectedExerciseStorageReference(entry));
  }

  const candidate = String(value || '').trim();
  if (!candidate) return false;
  return ImageUpload.isProtectedDefaultExerciseImage
    ? ImageUpload.isProtectedDefaultExerciseImage(candidate)
    : isDefaultExerciseImageReference(candidate);
};

const hasExerciseHistoryReferences = async (exerciseId) => {
  const [logRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM workout_log WHERE ExerciseID = ? LIMIT 1',
    [exerciseId]
  );
  const [scheduleRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM workout_schedule_exercises WHERE exercise_id = ? LIMIT 1',
    [exerciseId]
  );

  const workoutLogCount = Number(logRows?.[0]?.total || 0);
  const scheduleCount = Number(scheduleRows?.[0]?.total || 0);
  return workoutLogCount > 0 || scheduleCount > 0;
};

const ensureExerciseSchema = async () => {
  if (exerciseSchemaReady) return;

  // Ensure exercises.CreatedByUserID exists for "My Exercises" filtering.
  const [createdByCol] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND COLUMN_NAME = 'CreatedByUserID'
     LIMIT 1`
  );

  if (!Array.isArray(createdByCol) || createdByCol.length === 0) {
    await pool.query(
      `ALTER TABLE exercises
       ADD COLUMN CreatedByUserID BIGINT UNSIGNED NULL AFTER ExerciseID`
    );
  }

  const [isGlobalCol] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND COLUMN_NAME = 'IsGlobalExercise'
     LIMIT 1`
  );

  if (!Array.isArray(isGlobalCol) || isGlobalCol.length === 0) {
    await pool.query(
      `ALTER TABLE exercises
       ADD COLUMN IsGlobalExercise TINYINT(1) NOT NULL DEFAULT 1 AFTER CreatedByUserID`
    );

    // Existing custom exercises should remain custom after migration.
    await pool.query(
      `UPDATE exercises
       SET IsGlobalExercise = 0
       WHERE CreatedByUserID IS NOT NULL`
    );
  }

  const [exerciseScopeCol] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND COLUMN_NAME = 'ExerciseScope'
     LIMIT 1`
  );

  if (!Array.isArray(exerciseScopeCol) || exerciseScopeCol.length === 0) {
    await pool.query(
      `ALTER TABLE exercises
       ADD COLUMN ExerciseScope ENUM('SYSTEM','TRAINER_SHARED','PRIVATE') NULL AFTER IsGlobalExercise`
    );
  }

  const [ownerTrainerCol] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND COLUMN_NAME = 'OwnerTrainerID'
     LIMIT 1`
  );

  if (!Array.isArray(ownerTrainerCol) || ownerTrainerCol.length === 0) {
    await pool.query(
      `ALTER TABLE exercises
       ADD COLUMN OwnerTrainerID BIGINT UNSIGNED NULL AFTER ExerciseScope`
    );
  }

  const [sourceExerciseCol] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND COLUMN_NAME = 'SourceExerciseID'
     LIMIT 1`
  );

  if (!Array.isArray(sourceExerciseCol) || sourceExerciseCol.length === 0) {
    await pool.query(
      `ALTER TABLE exercises
       ADD COLUMN SourceExerciseID BIGINT UNSIGNED NULL AFTER OwnerTrainerID`
    );
  }

  const [scopeOwnerIndex] = await pool.query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND INDEX_NAME = 'idx_exercises_scope_owner'
     LIMIT 1`
  );

  if (!Array.isArray(scopeOwnerIndex) || scopeOwnerIndex.length === 0) {
    await pool.query(
      `CREATE INDEX idx_exercises_scope_owner ON exercises (ExerciseScope, OwnerTrainerID)`
    );
  }

  const [ownerScopeIndex] = await pool.query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND INDEX_NAME = 'idx_exercises_owner_scope'
     LIMIT 1`
  );

  if (!Array.isArray(ownerScopeIndex) || ownerScopeIndex.length === 0) {
    await pool.query(
      `CREATE INDEX idx_exercises_owner_scope ON exercises (OwnerTrainerID, ExerciseScope)`
    );
  }

  const [sourceIndex] = await pool.query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND INDEX_NAME = 'idx_exercises_source'
     LIMIT 1`
  );

  if (!Array.isArray(sourceIndex) || sourceIndex.length === 0) {
    await pool.query(
      `CREATE INDEX idx_exercises_source ON exercises (SourceExerciseID)`
    );
  }

  // Ensure favorites table exists for per-user exercise favorites.
  // Removed foreign key constraint to avoid errno 150 - exercises table may not have proper primary key setup
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_favorite_exercises (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      exercise_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY ux_user_favorite_exercise (user_id, exercise_id),
      KEY idx_ufe_user (user_id),
      KEY idx_ufe_exercise (exercise_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureExerciseMediaColumns(pool);

  exerciseSchemaReady = true;
};

const ensureExerciseYouTubeColumnAvailable = async () => {
  if (exerciseYouTubeColumnReady) return;

  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND COLUMN_NAME = 'YouTubeVideoURL'
     LIMIT 1`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error('Exercise YouTube support requires migration 0.85.133 to add exercises.YouTubeVideoURL.');
    error.statusCode = 400;
    throw error;
  }

  exerciseYouTubeColumnReady = true;
};

const mapExerciseRowsWithUserFlags = (rows = [], userId = null, isAdmin = false) => {
  const currentUserId = Number(userId || 0);
  const canAdminManage = Boolean(isAdmin);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...resolveExerciseMediaRow(row),
    IsFavorite: Number(row.IsFavorite || 0),
    IsGlobalExercise: getEffectiveExerciseGlobalFlag(row),
    IsSystemExercise: Number(row.IsSystemExercise ?? 0) === 1 ? 1 : 0,
    IsOwnedByCurrentUser: currentUserId > 0 && getExerciseOwnerUserId(row) === currentUserId ? 1 : 0,
    CanEdit: (() => {
      if (canAdminManage) return 1;
      return canManageExercise({ req: { session: { user: { id: currentUserId, role: '' } } }, exercise: row }) ? 1 : 0;
    })(),
    CanDelete: (() => {
      if (canAdminManage) return 1;
      return canDeleteExercise({ req: { session: { user: { id: currentUserId, role: '' } } }, exercise: row }) ? 1 : 0;
    })(),
  }));
};

const fetchExercisesForView = async ({
  view = 'all',
  userId,
  isAdmin = false,
  includeCustom = false,
  includeTrainerCustom = false,
  includeUserCustom = false,
}) => {
  const normalizedView = String(view || 'all').toLowerCase();

  const baseSelect = `
    SELECT
      e.*,
      ${buildExerciseGlobalFlagSelect('e')},
      CASE WHEN ufe.user_id IS NULL THEN 0 ELSE 1 END AS IsFavorite
    FROM exercises e
    LEFT JOIN user_favorite_exercises ufe
      ON ufe.exercise_id = e.ExerciseID
      AND ufe.user_id = ?
  `;

  if (normalizedView === 'mine' || normalizedView === 'my') {
    const mineWhere = [];
    const mineParams = [userId];

    if (isAdmin) {
      mineWhere.push('e.CreatedByUserID = ?');
      mineParams.push(userId);
      mineWhere.push(`(
        e.ExerciseScope IN ('PRIVATE', 'CUSTOM', 'TRAINER_SHARED', 'SHARED')
        OR (
          e.ExerciseScope IS NULL
          AND COALESCE(e.IsSystemExercise, 0) = 0
          AND COALESCE(e.CreatedByUserID, 0) = ?
        )
      )`);
      mineParams.push(userId);
    } else {
      mineWhere.push(`${getOwnerMatchSql('e')} = ?`);
      mineParams.push(userId);

      if (Number(userId || 0) > 0) {
        mineWhere.push(`(
          e.ExerciseScope IN ('PRIVATE', 'CUSTOM', 'SHARED')
          OR (
            e.ExerciseScope = 'TRAINER_SHARED'
            AND ${getOwnerMatchSql('e')} = ?
          )
          OR (
            e.ExerciseScope IS NULL
            AND COALESCE(e.IsSystemExercise, 0) = 0
            AND ${getOwnerMatchSql('e')} = ?
          )
        )`);
        mineParams.push(userId, userId);
      }
    }

    const [rows] = await pool.query(
      `${baseSelect}
       WHERE ${mineWhere.join(' AND ')}
       ORDER BY e.ExerciseTitle ASC`,
      mineParams
    );
    return mapExerciseRowsWithUserFlags(rows, userId, isAdmin);
  }

  if (normalizedView === 'favorites' || normalizedView === 'favourites') {
    const [rows] = await pool.query(
      `SELECT e.*,
        ${buildExerciseGlobalFlagSelect('e')},
        1 AS IsFavorite
       FROM exercises e
       INNER JOIN user_favorite_exercises ufe
         ON ufe.exercise_id = e.ExerciseID
       WHERE ufe.user_id = ?
         AND ${buildExerciseVisibilityClause('e')}
       ORDER BY e.ExerciseTitle ASC`,
      [userId, 1, userId, 1, 1, userId, userId, userId]
    );
    console.log('Favorites rows:', rows.length);
    return mapExerciseRowsWithUserFlags(rows, userId, isAdmin);
  }

  let rows;
  if (isAdmin) {
    [rows] = await pool.query(
      `${baseSelect}
       ORDER BY e.ExerciseTitle ASC`,
      [userId]
    );
  } else {
    [rows] = await pool.query(
      `${baseSelect}
       WHERE ${buildExerciseVisibilityClause('e')}
       ORDER BY e.ExerciseTitle ASC`,
      [
        userId,
        0,
        userId,
        includeCustom || includeTrainerCustom ? 1 : 0,
        includeCustom || includeUserCustom ? 1 : 0,
        userId,
        userId,
        userId,
      ]
    );
  }

  return mapExerciseRowsWithUserFlags(rows, userId, isAdmin);
};

const fetchExercisePage = async ({
  view = 'all',
  ownership = 'all',
  userId,
  isAdmin = false,
  search = '',
  workoutType = '',
  muscleGroup = '',
  equipment = '',
  page = 1,
  pageSize = 5,
  includeCustom = false,
  includeTrainerCustom = false,
  includeUserCustom = false,
}) => {
  const normalizedView = String(view || 'all').trim().toLowerCase();
  const normalizedOwnership = String(ownership || 'all').trim().toLowerCase();
  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 5));
  const includeDiscoverableCustom = Boolean(includeCustom);
  const includeDiscoverableTrainerCustom = includeDiscoverableCustom || Boolean(includeTrainerCustom);
  const includeDiscoverableUserCustom = includeDiscoverableCustom || Boolean(includeUserCustom);
  const baseWhere = [];
  const baseParams = [userId];

  appendExerciseVisibilityFilter({
    where: baseWhere,
    params: baseParams,
    alias: 'e',
    userId,
    isAdmin,
    includeTrainerCustom: normalizedView === 'all' ? includeDiscoverableTrainerCustom : true,
    includeUserCustom: normalizedView === 'all' ? includeDiscoverableUserCustom : true,
    includeOwnedCustom: normalizedView === 'mine' || normalizedView === 'my' || normalizedOwnership === 'mine' || normalizedOwnership === 'my' || normalizedView === 'favorites' || normalizedView === 'favourites',
  });

  if (normalizedView === 'mine' || normalizedView === 'my') {
    baseWhere.push('e.CreatedByUserID = ?');
    baseParams.push(userId);
  } else if (normalizedView === 'favorites' || normalizedView === 'favourites') {
    baseWhere.push('ufe.user_id IS NOT NULL');
  }

  if (normalizedOwnership === 'mine' || normalizedOwnership === 'my') {
    baseWhere.push(`${getOwnerMatchSql('e')} = ?`);
    baseParams.push(userId);
  }

  const where = [...baseWhere];
  const params = [...baseParams];

  const addTextFilter = (column, value, partial = false) => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    if (!normalizedValue || normalizedValue === 'all') return;

    if (partial) {
      const likeValues = buildLiteralSubstringLikeParams(value);
      if (!likeValues.length) return;
      likeValues.forEach((likeValue) => {
        where.push(`LOWER(COALESCE(${column}, '')) LIKE ? ESCAPE '${EXERCISE_SEARCH_ESCAPE_CHAR}'`);
        params.push(likeValue);
      });
      return;
    }

    where.push(`LOWER(COALESCE(${column}, '')) = ?`);
    params.push(normalizedValue);
  };

  addTextFilter('e.ExerciseTitle', search, true);
  addTextFilter('e.WorkoutType', workoutType);
  addTextFilter('e.MuscleGroup', muscleGroup);
  addTextFilter('e.Equipment', equipment);

  const fromSql = `
    FROM exercises e
    LEFT JOIN user_favorite_exercises ufe
      ON ufe.exercise_id = e.ExerciseID
      AND ufe.user_id = ?
  `;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total ${fromSql} ${whereSql}`,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);
  const offset = (normalizedPage - 1) * normalizedPageSize;
  const [rows] = await pool.query(
    `SELECT
       e.*,
       ${buildExerciseGlobalFlagSelect('e')},
       CASE WHEN ufe.user_id IS NULL THEN 0 ELSE 1 END AS IsFavorite
     ${fromSql}
     ${whereSql}
     ORDER BY e.ExerciseTitle ASC
     LIMIT ? OFFSET ?`,
    [...params, normalizedPageSize, offset]
  );

  const optionWhereSql = baseWhere.length ? `WHERE ${baseWhere.join(' AND ')}` : '';
  const [optionRows] = await pool.query(
    `SELECT DISTINCT e.WorkoutType, e.MuscleGroup, e.Equipment
     ${fromSql}
     ${optionWhereSql}`,
    baseParams
  );
  const uniqueSorted = (key) => [...new Set(optionRows.map((row) => row[key]).filter(Boolean))]
    .sort((left, right) => String(left).localeCompare(String(right)));

  return {
    items: mapExerciseRowsWithUserFlags(rows, userId, isAdmin),
    total,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalPages: Math.ceil(total / normalizedPageSize),
    filters: {
      workoutTypes: uniqueSorted('WorkoutType'),
      muscleGroups: uniqueSorted('MuscleGroup'),
      equipment: uniqueSorted('Equipment'),
    },
  };
};

const normalizeFallbackExercises = (rawList = []) => {
  if (!Array.isArray(rawList)) return [];

  return rawList.map((item, index) => {
    const primaryImage = Array.isArray(item?.images) && item.images[0] ? item.images[0] : DEFAULT_IMAGE_NAME;
    return resolveExerciseMediaRow({
      ExerciseID: index + 1,
      ExerciseTitle: item?.name || 'Exercise',
      MuscleGroup: Array.isArray(item?.primaryMuscles) && item.primaryMuscles.length ? item.primaryMuscles[0] : 'General',
      Equipment: item?.equipment || 'body only',
      WorkoutType: item?.category || 'general',
      RecordingType: item?.category === 'cardio' ? 'Cardio' : 'Strength',
      Instructions: Array.isArray(item?.instructions) ? item.instructions.join(' ') : '',
      ImageGallery: JSON.stringify(item?.images || []),
      PrimaryImage: primaryImage,
      ImageURL: primaryImage ? `/assets/Excerises/${primaryImage}` : '',
      MediaProvider: MEDIA_PROVIDER_LOCAL,
      MediaPath: buildLogicalMediaPath(index + 1),
      CreatedByUserID: null,
      IsGlobalExercise: 1,
      IsSystemExercise: 1,
      IsFavorite: 0,
      IsOwnedByCurrentUser: 0,
      CanEdit: 0,
      CanDelete: 0,
    });
  });
};

const readFallbackExercises = () => {
  const fallbackPath = path.resolve(__dirname, '..', 'data', 'exercises.json');
  const content = fs.readFileSync(fallbackPath, 'utf8');
  const parsed = JSON.parse(content);
  return normalizeFallbackExercises(parsed);
};

const readQueryBooleanFlag = (value) => String(value || '').trim().toLowerCase() === 'true';

const resolveExerciseDiscoveryFiltersFromQuery = (query = {}) => {
  const includeCustom = readQueryBooleanFlag(query?.includeCustom);
  return {
    includeCustom,
    includeTrainerCustom: includeCustom || readQueryBooleanFlag(query?.includeTrainerCustom),
    includeUserCustom: includeCustom || readQueryBooleanFlag(query?.includeUserCustom),
  };
};

// PUT update exercise with image support
router.put('/get-exercise/:id', memoryUpload, async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();
    await ensureExerciseYouTubeColumnAvailable();

    const exerciseId = Number(req.params.id || 0);
    if (!exerciseId) {
      return res.status(400).json({ success: false, message: 'Invalid exercise id' });
    }

    const existingExercise = await getExerciseOwnership(exerciseId);
    if (!existingExercise) {
      return res.status(404).json({ success: false, message: 'Exercise not found' });
    }

    if (!canManageExercise({ req, exercise: existingExercise })) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this exercise' });
    }

    const {
      ExerciseTitle = '',
      MuscleGroup = '',
      Equipment = '',
      WorkoutType = '',
      RecordingType = '',
      Instructions = '',
      YouTubeVideoURL = '',
      Duration = null,
      Calories = null,
      Distance = null,
      Speed = null,
      'Laps-Rep': LapsRep = null,
    } = req.body;

    const normalizedExistingImages = parseImageArrayInput(req.body?.existingImages || '[]');
    const newFiles = Array.isArray(req.files) ? req.files.filter((file) => file && file.buffer) : [];

    const slots = assignExistingImagesToSlots(normalizedExistingImages);
    const availableSlotIndexes = [0, 1].filter((slotIndex) => !slots[slotIndex]);

    if (newFiles.length > availableSlotIndexes.length) {
      return res.status(400).json({
        success: false,
        error: 'Please remove an existing image before uploading a replacement. Maximum 2 images are allowed.',
      });
    }

    const uploadedImageNames = [];
    try {
      for (let index = 0; index < newFiles.length; index += 1) {
        const slotIndex = availableSlotIndexes[index];
        const uploadResult = await uploadImageToGatewayStorage({
          exerciseId,
          file: newFiles[index],
          slotIndex,
        });
        slots[slotIndex] = uploadResult.fileName;
        uploadedImageNames.push(uploadResult.fileName);
      }
    } catch (uploadErr) {
      await Promise.allSettled(
        uploadedImageNames.map((imageName) => deleteObjectViaGateway({
          storageKey: buildExerciseImageStorageKey(exerciseId, imageName),
          appName: 'Workout-Atlas',
          requestId: req?.authRequestId || req?.headers?.['x-request-id'] || null,
        }))
      );
      throw uploadErr;
    }

    const imageGallery = slots.filter(Boolean).slice(0, 2);
    const primaryImage = imageGallery[0] || '';

    const catalogMatrix = await loadExerciseCatalogWorkoutTypeMuscleGroupMatrix();
    const equipmentOptions = await loadExerciseCatalogEquipmentOptions();
    const validatedInput = validateAndNormalizeExerciseMutationInput({
      payload: {
        ExerciseTitle,
        MuscleGroup,
        Equipment,
        WorkoutType,
        RecordingType,
        Instructions,
        YouTubeVideoURL,
      },
      matrix: catalogMatrix,
      equipmentOptions,
    });

    if (!validatedInput.valid) {
      return res.status(400).json({
        success: false,
        error: Object.values(validatedInput.fieldErrors)[0],
        fieldErrors: validatedInput.fieldErrors,
      });
    }

    const clean = {
      ExerciseTitle: validatedInput.values.ExerciseTitle,
      MuscleGroup: validatedInput.values.MuscleGroup,
      Equipment: validatedInput.values.Equipment,
      WorkoutType: validatedInput.values.WorkoutType,
      RecordingType: validatedInput.values.RecordingType,
      ImageURL: sanitizeText(buildExerciseMediaApiUrl(exerciseId, primaryImage), 255),
      PrimaryImage: sanitizeText(primaryImage, 255),
      MediaProvider: MEDIA_PROVIDER_LOCAL,
      MediaPath: buildLogicalMediaPath(exerciseId),
      Instructions: validatedInput.values.Instructions,
      YouTubeVideoURL: validatedInput.values.YouTubeVideoURL
        ? sanitizeText(validatedInput.values.YouTubeVideoURL, EXERCISE_FIELD_LIMITS.YouTubeVideoURL)
        : null,
      ImageGallery: JSON.stringify(imageGallery),
      Duration: parseNumber(Duration),
      Calories: parseNumber(Calories),
      Distance: parseNumber(Distance, true),
      Speed: parseNumber(Speed, true),
      LapsReps: parseNumber(LapsRep),
    };

    const adminEditing = isAdminUser(req);
    const trainerEditing = isTrainerUser(req);
    const hasExplicitScopeField = Object.prototype.hasOwnProperty.call(req.body || {}, 'ExerciseScope');
    const hasExplicitPublicationField = Object.prototype.hasOwnProperty.call(req.body || {}, 'ExercisePublicationState');
    const requestedScope = normalizeRequestedCreateScope(req.body?.ExerciseScope);
    const requestedPublicationState = normalizeExercisePublicationStateValue(req.body?.ExercisePublicationState);
    const hasScopeDirective = hasExplicitScopeField
      || hasExplicitPublicationField
      || Object.prototype.hasOwnProperty.call(req.body || {}, 'CreateAsGlobalExercise')
      || Object.prototype.hasOwnProperty.call(req.body || {}, 'IsGlobalExercise');

    const existingScope = normalizeExerciseScopeValue(existingExercise?.ExerciseScope);
    const existingPublicationState = resolveExercisePublicationState(existingExercise);

    let scopeColumns = null;
    if (hasScopeDirective) {
      if (hasExplicitScopeField && !requestedScope) {
        return res.status(400).json({ success: false, message: 'Invalid ExerciseScope value.' });
      }

      if (hasExplicitPublicationField && !requestedPublicationState) {
        return res.status(400).json({ success: false, message: 'Invalid ExercisePublicationState value.' });
      }

      if (!adminEditing && requestedScope === EXERCISE_SCOPE.SYSTEM) {
        return res.status(403).json({ success: false, message: 'Only administrators may assign SYSTEM exercises.' });
      }

      if (!adminEditing && requestedScope === EXERCISE_SCOPE.SHARED && !trainerEditing) {
        return res.status(403).json({ success: false, message: 'Only admins or trainers may assign SHARED exercises.' });
      }

      if (!adminEditing && trainerEditing && requestedScope === EXERCISE_SCOPE.SHARED && existingExercise.CreatedByUserID !== currentUserId && Number(existingExercise.OwnerTrainerID || 0) !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Trainers may only manage their own SHARED exercises.' });
      }

      if (!adminEditing && !trainerEditing && requestedScope && requestedScope !== EXERCISE_SCOPE.CUSTOM && !(existingScope === EXERCISE_SCOPE.PRIVATE && requestedScope === EXERCISE_SCOPE.PRIVATE)) {
        return res.status(403).json({ success: false, message: 'Users may only manage CUSTOM exercises.' });
      }

      if (requestedPublicationState && requestedPublicationState !== EXERCISE_PUBLICATION_STATE.RESTRICTED && requestedPublicationState !== EXERCISE_PUBLICATION_STATE.DISCOVERABLE) {
        return res.status(400).json({ success: false, message: 'Invalid ExercisePublicationState value.' });
      }

      if (requestedScope === EXERCISE_SCOPE.SYSTEM) {
        scopeColumns = {
          ExerciseScope: EXERCISE_SCOPE.SYSTEM,
          OwnerTrainerID: null,
          IsGlobalExercise: 1,
          ExercisePublicationState: EXERCISE_PUBLICATION_STATE.DISCOVERABLE,
        };
      } else if (requestedScope === EXERCISE_SCOPE.SHARED) {
        const requestedOwnerTrainerId = Number(req.body?.OwnerTrainerID || existingExercise.OwnerTrainerID || existingExercise.CreatedByUserID || 0);
        if (adminEditing && requestedOwnerTrainerId > 0) {
          const ownerIsTrainer = await hasTrainerRoleInDb(requestedOwnerTrainerId);
          if (!ownerIsTrainer) {
            return res.status(400).json({ success: false, message: 'The selected owner must be a valid trainer.' });
          }
        }

        scopeColumns = {
          ExerciseScope: EXERCISE_SCOPE.SHARED,
          OwnerTrainerID: adminEditing ? (requestedOwnerTrainerId > 0 ? requestedOwnerTrainerId : null) : currentUserId,
          IsGlobalExercise: 1,
          ExercisePublicationState: EXERCISE_PUBLICATION_STATE.DISCOVERABLE,
        };
      } else if (requestedScope === EXERCISE_SCOPE.CUSTOM) {
        scopeColumns = {
          ExerciseScope: EXERCISE_SCOPE.CUSTOM,
          OwnerTrainerID: null,
          IsGlobalExercise: 0,
          ExercisePublicationState: requestedPublicationState || existingPublicationState || EXERCISE_PUBLICATION_STATE.DISCOVERABLE,
        };
      } else if (existingScope && isLegacyExerciseScope(existingScope)) {
        scopeColumns = {
          ExerciseScope: existingScope,
          OwnerTrainerID: existingExercise.OwnerTrainerID || null,
          IsGlobalExercise: existingScope === EXERCISE_SCOPE.TRAINER_SHARED ? 1 : 0,
          ExercisePublicationState: existingScope === EXERCISE_SCOPE.PRIVATE
            ? EXERCISE_PUBLICATION_STATE.RESTRICTED
            : EXERCISE_PUBLICATION_STATE.DISCOVERABLE,
        };
      }
    }

    let updateResult;
    if (adminEditing) {
      const scopeSql = scopeColumns
        ? `, ExerciseScope = ?, OwnerTrainerID = ?, IsGlobalExercise = ?, ExercisePublicationState = ?`
        : '';
      const scopeParams = scopeColumns
        ? [scopeColumns.ExerciseScope, scopeColumns.OwnerTrainerID, scopeColumns.IsGlobalExercise, scopeColumns.ExercisePublicationState]
        : [];

      [updateResult] = await pool.query(
        `UPDATE exercises SET
          ExerciseTitle = ?,
          MuscleGroup = ?,
          Equipment = ?,
          WorkoutType = ?,
          RecordingType = ?,
          ImageURL = ?,
          MediaProvider = ?,
          MediaPath = ?,
          PrimaryImage = ?,
          YouTubeVideoURL = ?,
          Instructions = ?,
          ImageGallery = ?,
          Duration = ?,
          Calories = ?,
          Distance = ?,
          Speed = ?,
          \`Laps-Rep\` = ?${scopeSql}
         WHERE ExerciseID = ?`,
        [
          clean.ExerciseTitle,
          clean.MuscleGroup,
          clean.Equipment,
          clean.WorkoutType,
          clean.RecordingType,
          clean.ImageURL,
          clean.MediaProvider,
          clean.MediaPath,
          clean.PrimaryImage,
          clean.YouTubeVideoURL,
          clean.Instructions,
          clean.ImageGallery,
          clean.Duration,
          clean.Calories,
          clean.Distance,
          clean.Speed,
          clean.LapsReps,
          ...scopeParams,
          exerciseId,
        ]
      );
    } else {
      const scopeSql = scopeColumns
        ? `, ExerciseScope = ?, OwnerTrainerID = ?, IsGlobalExercise = ?, ExercisePublicationState = ?`
        : '';
      const scopeParams = scopeColumns
        ? [scopeColumns.ExerciseScope, scopeColumns.OwnerTrainerID, scopeColumns.IsGlobalExercise, scopeColumns.ExercisePublicationState]
        : [];

      [updateResult] = await pool.query(
        `UPDATE exercises SET
          ExerciseTitle = ?,
          MuscleGroup = ?,
          Equipment = ?,
          WorkoutType = ?,
          RecordingType = ?,
          ImageURL = ?,
          MediaProvider = ?,
          MediaPath = ?,
          PrimaryImage = ?,
          YouTubeVideoURL = ?,
          Instructions = ?,
          ImageGallery = ?,
          Duration = ?,
          Calories = ?,
          Distance = ?,
          Speed = ?,
          \`Laps-Rep\` = ?${scopeSql}
         WHERE ExerciseID = ?`,
        [
          clean.ExerciseTitle,
          clean.MuscleGroup,
          clean.Equipment,
          clean.WorkoutType,
          clean.RecordingType,
          clean.ImageURL,
          clean.MediaProvider,
          clean.MediaPath,
          clean.PrimaryImage,
          clean.YouTubeVideoURL,
          clean.Instructions,
          clean.ImageGallery,
          clean.Duration,
          clean.Calories,
          clean.Distance,
          clean.Speed,
          clean.LapsReps,
          ...scopeParams,
          exerciseId,
        ]
      );
    }

    if (!updateResult.affectedRows) {
      return res.status(404).json({ error: 'Exercise not found or no changes made' });
    }

    // Red-X image removals in the editor only update exercise metadata.
    // Physical object deletion is intentionally reserved for full exercise deletion.

    return res.status(200).json({
      success: true,
      message: 'Exercise updated successfully',
    });
  } catch (updateErr) {
    console.error('❌ Update error:', updateErr);
    const errorMessage = updateErr.code === 'ER_DUP_ENTRY'
      ? 'An exercise with this name already exists'
      : updateErr.message || 'Update failed';
    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// POST new exercise with image
router.post('/save-exercises', memoryUpload, async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();
    await ensureExerciseYouTubeColumnAvailable();

    const adminCreating = isAdminUser(req);
    const trainerCreating = isTrainerUser(req);
    const memberCreating = !adminCreating && !trainerCreating;
    const hasExplicitScopeField = Object.prototype.hasOwnProperty.call(req.body || {}, 'ExerciseScope');
    const hasExplicitPublicationField = Object.prototype.hasOwnProperty.call(req.body || {}, 'ExercisePublicationState');
    const normalizedInput = normalizeExerciseCreatePayload(req.body, {
      userId: currentUserId,
      isAdmin: adminCreating,
      role: normalizeSessionRoleSlug(req),
    });

    const requestedScope = normalizeRequestedCreateScope(req.body?.ExerciseScope);
    const requestedOwnerTrainerId = Number(req.body?.OwnerTrainerID || normalizedInput.OwnerTrainerID || 0);
    const requestedPublicationState = normalizeExercisePublicationStateValue(req.body?.ExercisePublicationState);

    if (hasExplicitScopeField && !requestedScope) {
      return res.status(400).json({ error: 'Invalid ExerciseScope value.' });
    }

    if (hasExplicitPublicationField && !requestedPublicationState) {
      return res.status(400).json({ error: 'Invalid ExercisePublicationState value.' });
    }

    if (requestedScope === EXERCISE_SCOPE.SYSTEM && !adminCreating) {
      return res.status(403).json({ error: 'Only administrators may create SYSTEM exercises.' });
    }

    if (requestedScope === EXERCISE_SCOPE.SHARED && !adminCreating && !trainerCreating) {
      return res.status(403).json({ error: 'Only admins or trainers may create SHARED exercises.' });
    }

    if (memberCreating && requestedScope && requestedScope !== EXERCISE_SCOPE.CUSTOM) {
      return res.status(403).json({ error: 'Users may create CUSTOM exercises only.' });
    }

    if (requestedScope === EXERCISE_SCOPE.SHARED && adminCreating && requestedOwnerTrainerId > 0) {
      const ownerIsTrainer = await hasTrainerRoleInDb(requestedOwnerTrainerId);
      if (!ownerIsTrainer) {
        return res.status(400).json({ error: 'The selected owner must be a valid trainer for SHARED exercises.' });
      }
    }

    if (requestedScope === EXERCISE_SCOPE.SHARED && trainerCreating) {
      const ownerIsTrainer = await hasTrainerRoleInDb(currentUserId);
      if (!ownerIsTrainer) {
        return res.status(403).json({ error: 'Only approved trainers may create SHARED exercises.' });
      }
    }

    if (requestedPublicationState && requestedPublicationState !== normalizedInput.ExercisePublicationState && normalizedInput.ExerciseScope !== EXERCISE_SCOPE.CUSTOM) {
      return res.status(400).json({ error: 'SYSTEM and SHARED exercises must remain DISCOVERABLE.' });
    }

    const validation = validateExerciseCreatePayload(normalizedInput);
    if (!validation.valid) {
      return res.status(400).json({
        error: `Missing required fields: ${validation.missingFields.join(', ')}`,
      });
    }

    const catalogMatrix = await loadExerciseCatalogWorkoutTypeMuscleGroupMatrix();
    const equipmentOptions = await loadExerciseCatalogEquipmentOptions();
    const validatedInput = validateAndNormalizeExerciseMutationInput({
      payload: normalizedInput,
      matrix: catalogMatrix,
      equipmentOptions,
    });
    if (!validatedInput.valid) {
      return res.status(400).json({
        error: Object.values(validatedInput.fieldErrors)[0],
        fieldErrors: validatedInput.fieldErrors,
      });
    }
    normalizedInput.ExerciseTitle = validatedInput.values.ExerciseTitle;
    normalizedInput.MuscleGroup = validatedInput.values.MuscleGroup;
    normalizedInput.Equipment = validatedInput.values.Equipment;
    normalizedInput.WorkoutType = validatedInput.values.WorkoutType;
    normalizedInput.RecordingType = validatedInput.values.RecordingType;
    normalizedInput.Instructions = validatedInput.values.Instructions;
    normalizedInput.YouTubeVideoURL = validatedInput.values.YouTubeVideoURL;

    const {
      ExerciseTitle,
      MuscleGroup,
      Equipment,
      WorkoutType,
      RecordingType,
      Instructions,
      YouTubeVideoURL,
      CreateAsGlobalExercise,
      ExerciseScope,
      ExercisePublicationState,
      OwnerTrainerID,
      CreatedByUserID,
    } = normalizedInput;

    const [existing] = await pool.query('SELECT ExerciseID FROM exercises WHERE ExerciseTitle = ?', [ExerciseTitle]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Exercise title already exists' });
    }

    const [insertResult] = await pool.query(
      `INSERT INTO exercises
      (CreatedByUserID, IsGlobalExercise, IsSystemExercise, ExerciseScope, ExercisePublicationState, OwnerTrainerID, SourceExerciseID, ExerciseTitle, MuscleGroup, Equipment, WorkoutType, RecordingType, ImageURL, MediaProvider, MediaPath, PrimaryImage, YouTubeVideoURL, Instructions, ImageGallery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        CreatedByUserID,
        CreateAsGlobalExercise,
        0,
        ExerciseScope,
        ExercisePublicationState,
        OwnerTrainerID,
        null,
        ExerciseTitle,
        MuscleGroup,
        Equipment,
        WorkoutType,
        RecordingType,
        '',
        MEDIA_PROVIDER_LOCAL,
        buildLogicalMediaPath(0),
        '',
        YouTubeVideoURL ? sanitizeText(YouTubeVideoURL, EXERCISE_FIELD_LIMITS.YouTubeVideoURL) : null,
        Instructions || '',
        JSON.stringify([])
      ]
    );

    const insertedExerciseId = Number(insertResult?.insertId || 0);
    if (!insertedExerciseId) {
      return res.status(500).json({ error: 'Failed to create exercise row.' });
    }

    try {
      const files = Array.isArray(req.files) ? req.files : [];
      const uploadedFiles = [];

      if (files.length > 0) {
        for (let index = 0; index < files.length && index < 2; index += 1) {
          const file = files[index];
          if (!file || !file.buffer) {
            continue;
          }

          const uploadResult = await uploadImageToGatewayStorage({
            exerciseId: insertedExerciseId,
            file,
            slotIndex: uploadedFiles.length,
          });
          uploadedFiles.push(uploadResult.fileName);
        }
      } else {
        await ensureExerciseFolderMarker({
          exerciseId: insertedExerciseId,
        });
      }

      const finalGallery = uploadedFiles.slice(0, 2);
      const primaryImage = finalGallery[0] || '';
      const mediaPath = buildLogicalMediaPath(insertedExerciseId);

      await pool.query(
        `UPDATE exercises
         SET MediaPath = ?,
             ImageURL = ?,
             PrimaryImage = ?,
             ImageGallery = ?
         WHERE ExerciseID = ?`,
        [
          mediaPath,
          buildExerciseMediaApiUrl(insertedExerciseId, primaryImage),
          primaryImage,
          JSON.stringify(finalGallery),
          insertedExerciseId,
        ]
      );
    } catch (uploadErr) {
      await pool.query('DELETE FROM exercises WHERE ExerciseID = ?', [insertedExerciseId]);
      throw uploadErr;
    }

    res.status(201).json({ message: 'Exercise created successfully' });
  } catch (insertErr) {
    console.error('❌ Insert failed:', insertErr);
    const message = insertErr?.message || 'Server error';
    res.status(500).json({ error: message });
  }
});

// ✅ Fetch exercises with fallback
// Legacy endpoint kept for backward compatibility
router.get('/get-exercises', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();
    const adminUser = isAdminUser(req);

    const discoveryFilters = resolveExerciseDiscoveryFiltersFromQuery(req.query);

    const rows = await fetchExercisesForView({
      view: req.query?.view || 'all',
      userId: currentUserId,
      isAdmin: adminUser,
      ...discoveryFilters,
    });
    if (Array.isArray(rows) && rows.length > 0) {
      return res.status(200).json(rows);
    }

    const fallbackRows = readFallbackExercises();
    return res.status(200).json(fallbackRows);
  } catch (err) {
    console.error('❌ Failed to fetch exercises from DB. Falling back to JSON:', err?.message || err);
    try {
      const fallbackRows = readFallbackExercises();
      return res.status(200).json(fallbackRows);
    } catch (fallbackErr) {
      console.error('❌ Fallback exercise load failed:', fallbackErr?.message || fallbackErr);
      return res.status(500).json({ error: 'Failed to fetch exercises' });
    }
  }
});

// New canonical endpoint: filtered exercise view for all / mine / favorites
router.get('/exercises', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();
    const adminUser = isAdminUser(req);

    const discoveryFilters = resolveExerciseDiscoveryFiltersFromQuery(req.query);

    if (req.query?.paginated === '1') {
      const result = await fetchExercisePage({
        view: req.query?.view || 'all',
        ownership: req.query?.ownership || 'all',
        userId: currentUserId,
        isAdmin: adminUser,
        search: req.query?.search,
        workoutType: req.query?.workoutType,
        muscleGroup: req.query?.muscleGroup,
        equipment: req.query?.equipment,
        page: req.query?.page,
        pageSize: req.query?.pageSize,
        ...discoveryFilters,
      });
      return res.status(200).json(result);
    }

    const rows = await fetchExercisesForView({
      view: req.query?.view || 'all',
      userId: currentUserId,
      isAdmin: adminUser,
      ...discoveryFilters,
    });
    if (Array.isArray(rows) && rows.length > 0) {
      return res.status(200).json(rows);
    }

    // Keep parity with legacy behavior: if DB is empty, show seeded JSON library for "all" view.
    const requestedView = String(req.query?.view || 'all').toLowerCase();
    if (requestedView === 'all') {
      const fallbackRows = readFallbackExercises();
      return res.status(200).json(fallbackRows);
    }

    return res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch /api/exercises:', err?.message || err);
    try {
      const requestedView = String(req.query?.view || 'all').toLowerCase();
      if (requestedView === 'all') {
        const fallbackRows = readFallbackExercises();
        return res.status(200).json(fallbackRows);
      }
    } catch (fallbackErr) {
      console.error('❌ Fallback exercise load failed for /api/exercises:', fallbackErr?.message || fallbackErr);
    }

    return res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

router.get('/exercises/my', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();
    const adminUser = isAdminUser(req);

    const requestedScope = String(req.query?.scope || '').trim().toLowerCase();
    if (requestedScope === 'admin-global') {
      if (!adminUser) {
        return res.status(403).json({ error: 'Only administrators may view admin global exercises.' });
      }

      const [rows] = await pool.query(
        `SELECT
           e.*,
           ${buildExerciseGlobalFlagSelect('e')},
           CASE WHEN ufe.user_id IS NULL THEN 0 ELSE 1 END AS IsFavorite
         FROM exercises e
         LEFT JOIN user_favorite_exercises ufe
           ON ufe.exercise_id = e.ExerciseID
           AND ufe.user_id = ?
         WHERE e.CreatedByUserID = ?
           AND (
             e.ExerciseScope = 'SYSTEM'
             OR COALESCE(e.IsSystemExercise, 0) = 1
           )
         ORDER BY e.ExerciseTitle ASC`,
        [currentUserId, currentUserId]
      );

      return res.status(200).json(mapExerciseRowsWithUserFlags(rows, currentUserId, adminUser));
    }

    const rows = await fetchExercisesForView({ view: 'mine', userId: currentUserId, isAdmin: adminUser });
    return res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch /api/exercises/my:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch my exercises' });
  }
});

router.get('/exercises/favorites', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();
    const adminUser = isAdminUser(req);

    const rows = await fetchExercisesForView({ view: 'favorites', userId: currentUserId, isAdmin: adminUser });
    return res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch /api/exercises/favorites:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch favorite exercises' });
  }
});

router.post('/exercises/:id/favorite', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();
    const adminUser = isAdminUser(req);

    const exerciseId = Number(req.params.id || 0);
    if (!exerciseId) {
      return res.status(400).json({ error: 'Invalid exercise id' });
    }

    const exerciseRow = await getExerciseOwnership(exerciseId);
    if (!exerciseRow) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    if (!canReadExerciseForUser({ req, exercise: exerciseRow }) && !adminUser) {
      return res.status(403).json({ error: 'Unauthorized to favorite this exercise' });
    }

    await pool.query(
      `INSERT INTO user_favorite_exercises (user_id, exercise_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
      [currentUserId, exerciseId]
    );

    return res.status(200).json({ message: 'Exercise favorited' });
  } catch (err) {
    console.error('❌ Failed to favorite exercise:', err?.message || err);
    return res.status(500).json({ error: 'Failed to favorite exercise' });
  }
});

router.delete('/exercises/:id/favorite', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

    const exerciseId = Number(req.params.id || 0);
    if (!exerciseId) {
      return res.status(400).json({ error: 'Invalid exercise id' });
    }

    await pool.query(
      'DELETE FROM user_favorite_exercises WHERE user_id = ? AND exercise_id = ?',
      [currentUserId, exerciseId]
    );

    return res.status(200).json({ message: 'Exercise removed from favorites' });
  } catch (err) {
    console.error('❌ Failed to remove favorite exercise:', err?.message || err);
    return res.status(500).json({ error: 'Failed to remove favorite exercise' });
  }
});

router.delete('/delete-exercise/:id', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();
    const adminUser = isAdminUser(req);

    const exerciseId = Number(req.params.id || 0);
    if (!exerciseId) {
      return res.status(400).json({ error: 'Invalid exercise id' });
    }

    const exerciseRow = await getExerciseOwnership(exerciseId);
    if (!exerciseRow) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    if (Number(exerciseRow?.IsSystemExercise || 0) === 1 && !adminUser) {
      return res.status(403).json({ success: false, message: 'Only administrators may delete system exercises.' });
    }

    if (isProtectedExerciseStorageReference(exerciseRow?.PrimaryImage)
      || isProtectedExerciseStorageReference(exerciseRow?.ImageURL)
      || isProtectedExerciseStorageReference(exerciseRow?.ImageGallery)) {
      return res.status(403).json({ success: false, message: 'The default exercise image is protected and cannot be deleted.' });
    }

    if (!canDeleteExercise({ req, exercise: exerciseRow })) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this exercise' });
    }

    const hasReferences = await hasExerciseHistoryReferences(exerciseId);
    if (hasReferences) {
      return res.status(409).json({
        success: false,
        message: 'Exercise is referenced by workout history or schedules and cannot be safely deleted while preserving historical data.'
      });
    }

    try {
      await deleteExerciseStoredMedia({
        exerciseId,
        exercise: exerciseRow,
        requestId: req?.authRequestId || req?.headers?.['x-request-id'] || null,
      });
    } catch (storageError) {
      console.error('❌ Exercise remote storage cleanup failed before DB deletion:', storageError?.message || storageError);
      console.error('❌ Exercise remote storage cleanup diagnostics:', JSON.stringify({
        requestId: storageError?.gatewayRequestId || req?.authRequestId || req?.headers?.['x-request-id'] || null,
        action: storageError?.gatewayAction || 'DELETE_OBJECT',
        storageKey: storageError?.storageKey || null,
        statusCode: storageError?.gatewayHttpStatus || storageError?.statusCode || null,
        errorCode: storageError?.gatewayErrorCode || storageError?.code || null,
        message: storageError?.message || null,
        stage: storageError?.gatewayRequestId ? 'after_gateway_response' : 'before_gateway_response',
      }));
      return res.status(502).json({
        success: false,
        message: 'Exercise storage cleanup failed. The database record was preserved.',
        error: storageError?.message || 'Gateway deletion failed.',
      });
    }

    const conn = await pool.getConnection();
    let deleteResult;
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM user_favorite_exercises WHERE exercise_id = ?', [exerciseId]);
      [deleteResult] = await conn.query('DELETE FROM exercises WHERE ExerciseID = ? LIMIT 1', [exerciseId]);
      if (!deleteResult.affectedRows) {
        await conn.rollback();
        return res.status(404).json({ error: 'Exercise not found' });
      }
      await conn.commit();
    } catch (dbDeleteError) {
      await conn.rollback();
      throw dbDeleteError;
    } finally {
      conn.release();
    }

    try {
      const imageList = JSON.parse(exerciseRow.ImageGallery || '[]');
      if (Array.isArray(imageList) && imageList.length) {
        const removableImages = imageList.filter((image) => !isProtectedExerciseStorageReference(image));
        if (removableImages.length) {
          ImageUpload.deleteImagesFromDisk(exerciseRow.ExerciseTitle, removableImages);
        }
      }
    } catch (_) {
      // No-op: image cleanup is best-effort.
    }

    return res.status(200).json({ message: 'Exercise deleted successfully' });
  } catch (err) {
    console.error('❌ Failed to delete exercise:', err?.message || err);
    return res.status(500).json({ error: 'Failed to delete exercise' });
  }
});

// Check exercises
router.get('/check-exercises', async (req, res) => {
  const currentUserId = requireAuthUserId(req, res);
  if (!currentUserId) return;

  const { exerciseId, date } = req.query;
  const [rows] = await pool.query(
    `SELECT * FROM workout_log WHERE UserID = ? AND ExerciseID = ? AND WorkoutDate = ?`,
    [currentUserId, exerciseId, date]
  );
  res.json({ exists: rows.length > 0, data: rows[0] });
});

module.exports = router;
module.exports.buildLogicalMediaPath = buildLogicalMediaPath;
module.exports.getExerciseRemoteDeleteTargets = getExerciseRemoteDeleteTargets;
module.exports.deleteExerciseStoredMedia = deleteExerciseStoredMedia;
module.exports.ensureExerciseFolderMarker = ensureExerciseFolderMarker;
module.exports.normalizeExerciseCreatePayload = normalizeExerciseCreatePayload;
module.exports.validateExerciseCreatePayload = validateExerciseCreatePayload;
module.exports.buildWorkoutTypeMuscleGroupMatrix = buildWorkoutTypeMuscleGroupMatrix;
module.exports.validateAndNormalizeExerciseCategorySelection = validateAndNormalizeExerciseCategorySelection;
module.exports.canonicalImageNameForSlot = canonicalImageNameForSlot;
module.exports.resolveValidatedImageExtension = resolveValidatedImageExtension;
module.exports.normalizeStoredImageName = normalizeStoredImageName;
module.exports.assignExistingImagesToSlots = assignExistingImagesToSlots;
module.exports.normalizeExerciseScopeValue = normalizeExerciseScopeValue;
module.exports.getExerciseAccessProfile = getExerciseAccessProfile;
module.exports.getExerciseOwnerUserId = getExerciseOwnerUserId;
module.exports.getEffectiveExerciseGlobalFlag = getEffectiveExerciseGlobalFlag;
module.exports.canReadExerciseForUser = canReadExerciseForUser;
module.exports.canManageExercise = canManageExercise;
module.exports.canDeleteExercise = canDeleteExercise;
module.exports.normalizeExerciseSearchTerm = normalizeExerciseSearchTerm;
module.exports.escapeSqlLikePattern = escapeSqlLikePattern;
module.exports.buildLiteralSubstringLikeParam = buildLiteralSubstringLikeParam;
module.exports.tokenizeExerciseSearchKeywords = tokenizeExerciseSearchKeywords;
module.exports.buildLiteralSubstringLikeParams = buildLiteralSubstringLikeParams;
module.exports.fetchExercisePage = fetchExercisePage;
module.exports.EXERCISE_ALLOWED_WORKOUT_TYPES = EXERCISE_ALLOWED_WORKOUT_TYPES;
module.exports.EXERCISE_ALLOWED_RECORDING_TYPES = EXERCISE_ALLOWED_RECORDING_TYPES;
module.exports.EXERCISE_FIELD_LIMITS = EXERCISE_FIELD_LIMITS;
module.exports.MAX_EXERCISE_SEARCH_KEYWORDS = MAX_EXERCISE_SEARCH_KEYWORDS;
module.exports.normalizeExerciseTextField = normalizeExerciseTextField;
module.exports.normalizeExerciseAllowedValue = normalizeExerciseAllowedValue;
module.exports.validateAndNormalizeExerciseMutationInput = validateAndNormalizeExerciseMutationInput;
