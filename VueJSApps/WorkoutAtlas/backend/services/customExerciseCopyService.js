const path = require('path');

const {
  canReadExerciseForUser,
  getExerciseAccessProfile,
  buildLogicalMediaPath,
} = require('../api/excerises');
const {
  createRequestId,
  createSignature,
  createTimeoutSignal,
  resolveGatewayConfig,
  getGatewayUrl,
  buildGatewayHeaders,
  putObjectViaGateway,
  deleteObjectViaGateway,
} = require('./aiGatewayService');
const {
  isDefaultExerciseImageReference,
} = require('./mediaResolver');

const EXERCISE_SCOPE_CUSTOM = 'CUSTOM';
const EXERCISE_PUBLICATION_RESTRICTED = 'RESTRICTED';

const normalizeImageName = (value) => {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized) return '';

  const noQuery = normalized.split('?')[0];
  const baseName = path.basename(noQuery);
  if (!baseName || baseName.includes('..') || baseName.includes('/')) {
    return '';
  }

  if (isDefaultExerciseImageReference(baseName)) {
    return '';
  }

  return baseName;
};

const parseImageGallery = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value;
  }

  const raw = String(value).trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const extractImageNameFromImageUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw, 'http://localhost');
    const queryName = normalizeImageName(parsed.searchParams.get('name') || '');
    if (queryName) {
      return queryName;
    }

    const assetsMarker = '/assets/excerises/';
    const pathname = String(parsed.pathname || '').replace(/\\/g, '/');
    const markerIndex = pathname.toLowerCase().indexOf(assetsMarker);
    if (markerIndex >= 0) {
      const candidate = pathname.slice(markerIndex + assetsMarker.length);
      return normalizeImageName(candidate);
    }
  } catch (_) {
    // Fall back to strict filename normalization below.
  }

  return normalizeImageName(raw);
};

const buildExerciseMediaApiUrl = (exerciseId, imageName) => {
  const safeExerciseId = Number(exerciseId || 0);
  const safeName = normalizeImageName(imageName);
  if (!safeExerciseId || !safeName) {
    return '';
  }

  return `/api/media/exercises/${safeExerciseId}/image?name=${encodeURIComponent(safeName)}`;
};

const buildMockRequestForUser = ({ userId, roleSlug }) => ({
  session: {
    user: {
      id: Number(userId || 0),
      roleSlug: String(roleSlug || '').trim(),
      role: String(roleSlug || '').trim(),
    },
  },
});

const resolveRecipientRoleSlug = async (connection, userId) => {
  const safeUserId = Number(userId || 0);
  if (!safeUserId) return '';

  const [roleRows] = await connection.query(
    `SELECT LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) AS role_slug
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?
     ORDER BY ur.id ASC
     LIMIT 1`,
    [safeUserId]
  );

  const primaryRole = String(roleRows?.[0]?.role_slug || '').trim();
  if (primaryRole) {
    return primaryRole === 'administrator' ? 'admin' : primaryRole;
  }

  const [legacyRows] = await connection.query(
    `SELECT LOWER(TRIM(COALESCE(user_role, ''))) AS role_slug
     FROM user_profiles
     WHERE user_id = ?
     LIMIT 1`,
    [safeUserId]
  );

  const legacyRole = String(legacyRows?.[0]?.role_slug || '').trim();
  if (legacyRole) {
    return legacyRole === 'administrator' ? 'admin' : legacyRole;
  }

  return '';
};

const collectSourceMediaNames = (exerciseRow) => {
  const imageNames = new Set();

  const primary = normalizeImageName(exerciseRow?.PrimaryImage);
  if (primary) {
    imageNames.add(primary);
  }

  const gallery = parseImageGallery(exerciseRow?.ImageGallery);
  for (const entry of gallery) {
    const imageName = normalizeImageName(entry);
    if (imageName) {
      imageNames.add(imageName);
    }
  }

  const imageUrlName = extractImageNameFromImageUrl(exerciseRow?.ImageURL);
  if (imageUrlName) {
    imageNames.add(imageUrlName);
  }

  return [...imageNames];
};

const fetchObjectViaGateway = async ({ storageKey, appName = 'Workout-Atlas', fetchImpl = fetch }) => {
  const safeStorageKey = String(storageKey || '').trim();
  if (!safeStorageKey) {
    throw new Error('storageKey is required for gateway object reads.');
  }

  const gatewayConfig = resolveGatewayConfig(process.env);
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
  const requestId = createRequestId('wa-copy');
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
};

const copyExerciseMediaObjects = async ({
  sourceExerciseId,
  targetExerciseId,
  mediaNames,
  fetchImpl = fetch,
  putObject = putObjectViaGateway,
}) => {
  const copiedStorageKeys = [];
  const copiedMediaNames = [];

  for (const mediaName of mediaNames) {
    const safeName = normalizeImageName(mediaName);
    if (!safeName) {
      continue;
    }

    const sourceStorageKey = `${buildLogicalMediaPath(sourceExerciseId)}/${safeName}`;
    const targetStorageKey = `${buildLogicalMediaPath(targetExerciseId)}/${safeName}`;

    const objectData = await fetchObjectViaGateway({
      storageKey: sourceStorageKey,
      appName: 'Workout-Atlas',
      fetchImpl,
    });

    await putObject({
      storageKey: targetStorageKey,
      contentType: objectData.contentType || 'application/octet-stream',
      dataBase64: objectData.dataBase64,
      appName: 'Workout-Atlas',
    });

    copiedStorageKeys.push(targetStorageKey);
    copiedMediaNames.push(safeName);
  }

  return {
    copiedStorageKeys,
    copiedMediaNames,
  };
};

const rollbackToSavepoint = async (connection, savepointName) => {
  try {
    await connection.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
  } catch (_) {
    // Best effort: caller transaction may have already rolled back.
  }
};

const releaseSavepoint = async (connection, savepointName) => {
  try {
    await connection.query(`RELEASE SAVEPOINT ${savepointName}`);
  } catch (_) {
    // Best effort: savepoint may already be released by caller commit/rollback.
  }
};

const cleanupCopiedMedia = async ({ storageKeys, deleteObject = deleteObjectViaGateway, requestId = null }) => {
  const uniqueKeys = [...new Set((Array.isArray(storageKeys) ? storageKeys : []).filter(Boolean))];
  for (const storageKey of uniqueKeys) {
    try {
      await deleteObject({
        storageKey,
        appName: 'Workout-Atlas',
        requestId,
      });
    } catch (_) {
      // Best effort cleanup: the caller rollback already protects DB consistency.
    }
  }
};

async function copyCustomExerciseForRecipient({
  sourceExerciseId,
  recipientUserId,
  connection,
  requestId = null,
  fetchImpl = fetch,
  putObject = putObjectViaGateway,
  deleteObject = deleteObjectViaGateway,
  onCopyCreated = null,
}) {
  const safeSourceExerciseId = Number(sourceExerciseId || 0);
  const safeRecipientUserId = Number(recipientUserId || 0);

  if (!connection || typeof connection.query !== 'function') {
    throw new Error('An active transaction connection is required.');
  }
  if (!safeSourceExerciseId) {
    throw new Error('sourceExerciseId is required.');
  }
  if (!safeRecipientUserId) {
    throw new Error('recipientUserId is required.');
  }

  const savepointName = `sp_copy_custom_ex_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  await connection.query(`SAVEPOINT ${savepointName}`);

  let copiedExerciseId = 0;
  let copiedStorageKeys = [];

  try {
    const [sourceRows] = await connection.query(
      `SELECT
         ExerciseID,
         ExerciseTitle,
         MuscleGroup,
         Equipment,
         WorkoutType,
         RecordingType,
         Instructions,
         Duration,
         Calories,
         Distance,
         Speed,
         \`Laps-Rep\` AS LapsRep,
         ImageURL,
         ImageGallery,
         PrimaryImage,
         YouTubeVideoURL,
         MediaProvider,
         MediaPath,
         CreatedByUserID,
         OwnerTrainerID,
         SourceExerciseID,
         ExerciseScope,
         ExercisePublicationState,
         IsGlobalExercise,
         COALESCE(IsSystemExercise, 0) AS IsSystemExercise
       FROM exercises
       WHERE ExerciseID = ?
       LIMIT 1`,
      [safeSourceExerciseId]
    );

    const sourceExercise = sourceRows?.[0] || null;
    if (!sourceExercise) {
      const error = new Error('Source exercise not found.');
      error.statusCode = 404;
      throw error;
    }

    const sourceProfile = getExerciseAccessProfile(sourceExercise);
    if (sourceProfile.explicitScope !== EXERCISE_SCOPE_CUSTOM) {
      const error = new Error('Only CUSTOM exercises can be copied with this service.');
      error.statusCode = 400;
      throw error;
    }

    const recipientRoleSlug = await resolveRecipientRoleSlug(connection, safeRecipientUserId);
    const recipientReq = buildMockRequestForUser({
      userId: safeRecipientUserId,
      roleSlug: recipientRoleSlug,
    });

    if (!canReadExerciseForUser({ req: recipientReq, exercise: sourceExercise })) {
      const error = new Error('Recipient is not authorized to read the source exercise.');
      error.statusCode = 403;
      throw error;
    }

    const [insertResult] = await connection.query(
      `INSERT INTO exercises (
         CreatedByUserID,
         IsGlobalExercise,
         IsSystemExercise,
         ExerciseScope,
         ExercisePublicationState,
         OwnerTrainerID,
         SourceExerciseID,
         ExerciseTitle,
         MuscleGroup,
         Equipment,
         WorkoutType,
         RecordingType,
         ImageURL,
         MediaProvider,
         MediaPath,
         PrimaryImage,
         YouTubeVideoURL,
         Instructions,
         ImageGallery,
         Duration,
         Calories,
         Distance,
         Speed,
         \`Laps-Rep\`
       )
      VALUES (?, 0, 0, ?, ?, NULL, ?, ?, ?, ?, ?, ?, '', ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        safeRecipientUserId,
        EXERCISE_SCOPE_CUSTOM,
        EXERCISE_PUBLICATION_RESTRICTED,
        safeSourceExerciseId,
        String(sourceExercise.ExerciseTitle || '').trim(),
        String(sourceExercise.MuscleGroup || '').trim(),
        String(sourceExercise.Equipment || '').trim(),
        String(sourceExercise.WorkoutType || '').trim(),
        String(sourceExercise.RecordingType || '').trim(),
        String(sourceExercise.MediaProvider || 'LOCAL').trim() || 'LOCAL',
        buildLogicalMediaPath(0),
        String(sourceExercise.YouTubeVideoURL || '').trim() || null,
        String(sourceExercise.Instructions || '').trim(),
        JSON.stringify([]),
        sourceExercise.Duration ?? null,
        sourceExercise.Calories ?? null,
        sourceExercise.Distance ?? null,
        sourceExercise.Speed ?? null,
        sourceExercise.LapsRep ?? null,
      ]
    );

    copiedExerciseId = Number(insertResult?.insertId || 0);
    if (!copiedExerciseId) {
      throw new Error('Failed to create recipient exercise copy.');
    }

    const sourceMediaNames = collectSourceMediaNames(sourceExercise);
    if (sourceMediaNames.length > 0) {
      const mediaCopyResult = await copyExerciseMediaObjects({
        sourceExerciseId: safeSourceExerciseId,
        targetExerciseId: copiedExerciseId,
        mediaNames: sourceMediaNames,
        fetchImpl,
        putObject,
      });

      copiedStorageKeys = mediaCopyResult.copiedStorageKeys;
      const copiedMediaNames = mediaCopyResult.copiedMediaNames;
      const primaryImage = copiedMediaNames[0] || '';

      await connection.query(
        `UPDATE exercises
         SET MediaPath = ?,
             ImageURL = ?,
             PrimaryImage = ?,
             ImageGallery = ?
         WHERE ExerciseID = ?
         LIMIT 1`,
        [
          buildLogicalMediaPath(copiedExerciseId),
          buildExerciseMediaApiUrl(copiedExerciseId, primaryImage),
          primaryImage,
          JSON.stringify(copiedMediaNames),
          copiedExerciseId,
        ]
      );
    } else {
      await connection.query(
        `UPDATE exercises
         SET MediaPath = ?
         WHERE ExerciseID = ?
         LIMIT 1`,
        [buildLogicalMediaPath(copiedExerciseId), copiedExerciseId]
      );
    }

    if (typeof onCopyCreated === 'function') {
      await onCopyCreated({
        sourceExerciseId: safeSourceExerciseId,
        copiedExerciseId,
        copiedStorageKeys: [...copiedStorageKeys],
      });
    }

    await releaseSavepoint(connection, savepointName);
    return copiedExerciseId;
  } catch (error) {
    await cleanupCopiedMedia({
      storageKeys: copiedStorageKeys,
      deleteObject,
      requestId,
    });

    await rollbackToSavepoint(connection, savepointName);
    throw error;
  }
}

module.exports = {
  copyCustomExerciseForRecipient,
  collectSourceMediaNames,
  buildExerciseMediaApiUrl,
};
