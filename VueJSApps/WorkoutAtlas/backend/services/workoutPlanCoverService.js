const {
  normalizePositivePlanId,
  WORKOUT_PLAN_STORAGE_ROOT,
  WORKOUT_PLAN_DEFAULT_IMAGE_FILE,
  buildWorkoutPlanImagesPrefix,
  buildWorkoutPlanCanonicalCoverStorageKey,
  assertCanonicalWorkoutPlanCoverStorageKeyForPlan,
  WORKOUT_PLAN_CANONICAL_COVER_FILE,
} = require('./workoutPlanCoverStorage');
const {
  resolveGatewayConfig,
  getGatewayUrl,
  buildGatewayHeaders,
  createRequestId,
  createSignature,
  createTimeoutSignal,
  putObjectViaGateway,
  deleteObjectViaGateway,
} = require('./aiGatewayService');

const GLOBAL_WORKOUT_PLAN_TYPE_VALUES = Object.freeze([
  'global',
  'featured',
  'community_shared',
]);

const PUBLISHED_GLOBAL_STATUSES = Object.freeze(['active', 'published', 'completed']);
const DISCOVERABLE_VISIBILITY_VALUES = Object.freeze(['public', 'private', 'unlisted']);

const WORKOUT_PLAN_COVER_ALLOWED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const DEFAULT_WORKOUT_PLAN_COVER_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function normalizeSessionRoleSlug(req = {}) {
  const roleSlug = String(req?.session?.user?.roleSlug || req?.session?.user?.role || '').trim().toLowerCase();
  if (roleSlug === 'administrator') return 'admin';
  if (roleSlug === 'admin') return 'admin';
  if (roleSlug === 'trainer') return 'trainer';
  return roleSlug;
}

async function hasRoleInDb(pool, userId, roleCandidates = []) {
  const normalizedCandidates = (Array.isArray(roleCandidates) ? roleCandidates : [roleCandidates])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  if (!normalizedCandidates.length) {
    return false;
  }

  const placeholders = normalizedCandidates.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT 1
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?
       AND r.is_active = 1
       AND LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) IN (${placeholders})
     LIMIT 1`,
    [userId, ...normalizedCandidates]
  );

  return Boolean(Array.isArray(rows) && rows.length > 0);
}

async function resolvePlanManagerRole(req, pool, userId) {
  const sessionRole = normalizeSessionRoleSlug(req);
  if (sessionRole === 'admin' || sessionRole === 'trainer') {
    return sessionRole;
  }

  if (await hasRoleInDb(pool, userId, ['admin', 'administrator'])) {
    return 'admin';
  }

  if (await hasRoleInDb(pool, userId, ['trainer'])) {
    return 'trainer';
  }

  return null;
}

function isGlobalWorkoutPlanType(workoutPlanType) {
  const normalized = String(workoutPlanType || '').trim().toLowerCase();
  return GLOBAL_WORKOUT_PLAN_TYPE_VALUES.includes(normalized);
}

function isPublishedGlobalPlanStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return PUBLISHED_GLOBAL_STATUSES.includes(normalized);
}

function isDiscoverableGlobalPlanVisibility(visibility) {
  const normalized = String(visibility || '').trim().toLowerCase();
  return DISCOVERABLE_VISIBILITY_VALUES.includes(normalized);
}

function getWorkoutPlanCoverPlaceholderDescriptor() {
  return {
    mediaProvider: 'LOCAL',
    mediaPath: WORKOUT_PLAN_STORAGE_ROOT,
    imageName: WORKOUT_PLAN_DEFAULT_IMAGE_FILE,
  };
}

function getWorkoutPlanCoverDescriptor(planId) {
  const safePlanId = normalizePositivePlanId(planId);
  return {
    mediaProvider: 'AWS',
    mediaPath: buildWorkoutPlanImagesPrefix(safePlanId),
    imageName: WORKOUT_PLAN_CANONICAL_COVER_FILE,
  };
}

function assertValidWorkoutPlanCoverFile(file, options = {}) {
  const maxFileSizeBytes = Number(options.maxFileSizeBytes || DEFAULT_WORKOUT_PLAN_COVER_MAX_FILE_SIZE_BYTES);
  if (!file || typeof file !== 'object') {
    const error = new Error('Cover image file is required.');
    error.statusCode = 400;
    throw error;
  }

  const mimeType = String(file.mimetype || '').trim().toLowerCase();
  if (!WORKOUT_PLAN_COVER_ALLOWED_MIME_TYPES.includes(mimeType)) {
    const error = new Error('Unsupported image type. Allowed types: jpg, jpeg, png, gif, webp.');
    error.statusCode = 400;
    throw error;
  }

  const byteSize = Number(file.size || 0);
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    const error = new Error('Cover image file is empty.');
    error.statusCode = 400;
    throw error;
  }

  if (maxFileSizeBytes > 0 && byteSize > maxFileSizeBytes) {
    const error = new Error(`Cover image exceeds the ${Math.round(maxFileSizeBytes / (1024 * 1024))}MB upload limit.`);
    error.statusCode = 413;
    throw error;
  }

  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    const error = new Error('Cover image binary data is missing.');
    error.statusCode = 400;
    throw error;
  }

  return {
    mimeType,
    byteSize,
  };
}

async function getWorkoutPlanCoverRow(pool, planId) {
  const safePlanId = normalizePositivePlanId(planId);

  const [rows] = await pool.query(
    `SELECT
      id,
      user_id,
      workout_plan_type,
      status,
      visibility,
      cover_image_storage_key,
      cover_image_content_type,
      cover_image_updated_at
     FROM workout_schedules
     WHERE id = ?
     LIMIT 1`,
    [safePlanId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0];
}

async function canReadWorkoutPlanCover({ req, pool, plan }) {
  const userId = Number(req?.session?.user?.id || 0);
  if (!userId) {
    return { ok: false, statusCode: 401, error: 'Unauthorized. Please log in.' };
  }

  const ownerUserId = Number(plan?.user_id || 0);
  const isOwner = ownerUserId > 0 && ownerUserId === userId;
  const isGlobal = isGlobalWorkoutPlanType(plan?.workout_plan_type);

  if (!isGlobal) {
    if (isOwner) {
      return { ok: true };
    }
    return { ok: false, statusCode: 404, error: 'Workout plan cover not found.' };
  }

  if (isOwner) {
    return { ok: true };
  }

  const managerRole = await resolvePlanManagerRole(req, pool, userId);
  if (managerRole === 'admin') {
    return { ok: true };
  }

  if (isPublishedGlobalPlanStatus(plan?.status) && isDiscoverableGlobalPlanVisibility(plan?.visibility)) {
    return { ok: true };
  }

  return { ok: false, statusCode: 404, error: 'Workout plan cover not found.' };
}

async function canManageWorkoutPlanCover({ req, pool, plan }) {
  const userId = Number(req?.session?.user?.id || 0);
  if (!userId) {
    return { ok: false, statusCode: 401, error: 'User not logged in' };
  }

  const ownerUserId = Number(plan?.user_id || 0);
  const isOwner = ownerUserId > 0 && ownerUserId === userId;
  const isGlobal = isGlobalWorkoutPlanType(plan?.workout_plan_type);

  if (!isGlobal) {
    if (isOwner) {
      return { ok: true, userId, role: 'owner' };
    }
    return { ok: false, statusCode: 404, error: 'Workout schedule not found' };
  }

  const managerRole = await resolvePlanManagerRole(req, pool, userId);
  if (managerRole === 'admin') {
    return { ok: true, userId, role: 'admin' };
  }

  if (managerRole === 'trainer') {
    if (!isOwner) {
      return {
        ok: false,
        statusCode: 403,
        error: 'You can only manage global workout plans that you created.',
      };
    }
    return { ok: true, userId, role: 'trainer' };
  }

  return {
    ok: false,
    statusCode: 403,
    error: 'Administrator or approved trainer access required',
  };
}

function resolveCanonicalCoverStorageKeyForPlan(planId, coverImageStorageKey) {
  return assertCanonicalWorkoutPlanCoverStorageKeyForPlan(planId, coverImageStorageKey);
}

async function saveWorkoutPlanCoverMetadata(pool, planId, storageKey, contentType) {
  const safePlanId = normalizePositivePlanId(planId);

  const [result] = await pool.query(
    `UPDATE workout_schedules
     SET cover_image_storage_key = ?,
         cover_image_content_type = ?,
         cover_image_updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
     LIMIT 1`,
    [storageKey, contentType, safePlanId]
  );

  return Number(result?.affectedRows || 0) > 0;
}

async function clearWorkoutPlanCoverMetadata(pool, planId) {
  const safePlanId = normalizePositivePlanId(planId);

  const [result] = await pool.query(
    `UPDATE workout_schedules
     SET cover_image_storage_key = NULL,
         cover_image_content_type = NULL,
         cover_image_updated_at = NULL
     WHERE id = ?
     LIMIT 1`,
    [safePlanId]
  );

  return Number(result?.affectedRows || 0) > 0;
}

async function uploadWorkoutPlanCover({
  req,
  pool,
  plan,
  file,
  putObject = putObjectViaGateway,
}) {
  const safePlanId = normalizePositivePlanId(plan?.id);
  const { mimeType } = assertValidWorkoutPlanCoverFile(file);

  const storageKey = buildWorkoutPlanCanonicalCoverStorageKey(safePlanId);

  await putObject({
    storageKey,
    contentType: mimeType,
    dataBase64: file.buffer.toString('base64'),
    appName: 'Workout-Atlas',
  });

  const saved = await saveWorkoutPlanCoverMetadata(pool, safePlanId, storageKey, mimeType);
  if (!saved) {
    const error = new Error('Workout schedule not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    planId: safePlanId,
    storageKey,
    contentType: mimeType,
  };
}

async function fetchWorkoutPlanCoverObjectViaGateway({
  storageKey,
  appName = 'Workout-Atlas',
  env = process.env,
  fetchImpl = fetch,
}) {
  const safeStorageKey = String(storageKey || '').trim();
  if (!safeStorageKey) {
    const error = new Error('storageKey is required for gateway object reads.');
    error.statusCode = 400;
    throw error;
  }

  const gatewayConfig = resolveGatewayConfig(env);
  const gatewayUrl = getGatewayUrl(gatewayConfig);
  const requestPayload = {
    appName,
    type: 'LOCAL_CLOUD',
    payload: {
      action: 'GET_OBJECT',
      storageKey: safeStorageKey,
    },
  };

  const serializedBody = JSON.stringify(requestPayload);
  const requestId = createRequestId('wa-cover-copy');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createSignature(
    gatewayConfig.hmacSecret,
    'POST',
    gatewayConfig.gatewayPath,
    timestamp,
    requestId,
    serializedBody
  );

  const timeout = createTimeoutSignal(gatewayConfig.timeoutMs);
  try {
    const response = await (fetchImpl || fetch)(gatewayUrl, {
      method: 'POST',
      headers: buildGatewayHeaders({
        requestId,
        timestamp,
        signature,
        apiToken: gatewayConfig.apiToken,
      }),
      body: serializedBody,
      signal: timeout.signal,
    });

    const rawText = await response.text();
    let parsedBody = {};
    try {
      parsedBody = rawText ? JSON.parse(rawText) : {};
    } catch (_) {
      parsedBody = {};
    }

    const gatewayData = parsedBody?.data && typeof parsedBody.data === 'object'
      ? parsedBody.data
      : parsedBody;

    const ok = response.ok && gatewayData?.success !== false && parsedBody?.success !== false;
    if (!ok) {
      const detail = String(
        gatewayData?.message
        || parsedBody?.error?.message
        || parsedBody?.message
        || parsedBody?.detail
        || `Gateway HTTP ${response.status}`
      ).trim();

      const error = new Error(detail || `Gateway read failed for ${safeStorageKey}.`);
      error.statusCode = response.status >= 400 ? response.status : 502;
      error.storageKey = safeStorageKey;
      throw error;
    }

    const dataBase64 = String(
      gatewayData?.dataBase64
      || gatewayData?.objectBase64
      || gatewayData?.base64
      || gatewayData?.data?.dataBase64
      || ''
    ).trim();

    if (!dataBase64) {
      const error = new Error(`Gateway read response did not include object data for ${safeStorageKey}.`);
      error.statusCode = 502;
      error.storageKey = safeStorageKey;
      throw error;
    }

    return {
      contentType: String(
        gatewayData?.contentType
        || gatewayData?.mimeType
        || gatewayData?.data?.contentType
        || 'application/octet-stream'
      ).trim(),
      dataBase64,
    };
  } finally {
    timeout.clear();
  }
}

async function cloneWorkoutPlanCoverToPlan({
  pool,
  sourcePlan,
  destinationPlanId,
  fetchObject = fetchWorkoutPlanCoverObjectViaGateway,
  putObject = putObjectViaGateway,
}) {
  const sourcePlanId = normalizePositivePlanId(sourcePlan?.id);
  const targetPlanId = normalizePositivePlanId(destinationPlanId);
  const sourceStorageKeyRaw = String(sourcePlan?.cover_image_storage_key || '').trim();

  if (!sourceStorageKeyRaw) {
    return {
      copied: false,
      hadSourceCover: false,
      sourcePlanId,
      destinationPlanId: targetPlanId,
    };
  }

  const sourceStorageKey = resolveCanonicalCoverStorageKeyForPlan(sourcePlanId, sourceStorageKeyRaw);
  const destinationStorageKey = buildWorkoutPlanCanonicalCoverStorageKey(targetPlanId);

  const objectData = await fetchObject({
    storageKey: sourceStorageKey,
    appName: 'Workout-Atlas',
  });

  const resolvedContentType = String(
    sourcePlan?.cover_image_content_type
    || objectData?.contentType
    || 'application/octet-stream'
  ).trim() || 'application/octet-stream';

  await putObject({
    storageKey: destinationStorageKey,
    contentType: resolvedContentType,
    dataBase64: objectData.dataBase64,
    appName: 'Workout-Atlas',
  });

  const saved = await saveWorkoutPlanCoverMetadata(pool, targetPlanId, destinationStorageKey, resolvedContentType);
  if (!saved) {
    const error = new Error('Workout schedule not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    copied: true,
    hadSourceCover: true,
    sourcePlanId,
    destinationPlanId: targetPlanId,
    sourceStorageKey,
    destinationStorageKey,
    contentType: resolvedContentType,
  };
}

async function deleteWorkoutPlanCover({
  pool,
  plan,
  deleteObject = deleteObjectViaGateway,
}) {
  const safePlanId = normalizePositivePlanId(plan?.id);
  const rawStorageKey = String(plan?.cover_image_storage_key || '').trim();
  if (!rawStorageKey) {
    return {
      planId: safePlanId,
      deleted: false,
      hadCover: false,
    };
  }

  const storageKey = resolveCanonicalCoverStorageKeyForPlan(safePlanId, rawStorageKey);

  await deleteObject({
    storageKey,
    appName: 'Workout-Atlas',
  });

  const updated = await clearWorkoutPlanCoverMetadata(pool, safePlanId);
  if (!updated) {
    const error = new Error('Workout schedule not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    planId: safePlanId,
    deleted: true,
    hadCover: true,
    storageKey,
  };
}

module.exports = {
  GLOBAL_WORKOUT_PLAN_TYPE_VALUES,
  PUBLISHED_GLOBAL_STATUSES,
  DISCOVERABLE_VISIBILITY_VALUES,
  WORKOUT_PLAN_COVER_ALLOWED_MIME_TYPES,
  DEFAULT_WORKOUT_PLAN_COVER_MAX_FILE_SIZE_BYTES,
  normalizeSessionRoleSlug,
  hasRoleInDb,
  resolvePlanManagerRole,
  isGlobalWorkoutPlanType,
  isPublishedGlobalPlanStatus,
  isDiscoverableGlobalPlanVisibility,
  getWorkoutPlanCoverPlaceholderDescriptor,
  getWorkoutPlanCoverDescriptor,
  assertValidWorkoutPlanCoverFile,
  getWorkoutPlanCoverRow,
  canReadWorkoutPlanCover,
  canManageWorkoutPlanCover,
  resolveCanonicalCoverStorageKeyForPlan,
  saveWorkoutPlanCoverMetadata,
  clearWorkoutPlanCoverMetadata,
  uploadWorkoutPlanCover,
  cloneWorkoutPlanCoverToPlan,
  deleteWorkoutPlanCover,
};
