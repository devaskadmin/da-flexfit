const fs = require('fs');
const path = require('path');
const {
  buildGatewayHeaders,
  createSignature,
  createTimeoutSignal,
  resolveGatewayConfig,
  createRequestId,
} = require('./aiGatewayService');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');
const DEFAULT_LOCAL_AWS_RELATIVE_PATH = 'backend/workoutatlas-s3-data';

const CONTENT_ROOT = path.resolve(BACKEND_ROOT, 'workoutatlas-s3-data');
const LEGACY_EXERCISE_ROOT = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'assets', 'Excerises');

const DEFAULT_EXERCISE_IMAGE_NAME = 'default.JPG';
const DEFAULT_EXERCISE_STORAGE_KEY = 'APP/exercise-library/default.JPG';

const MEDIA_PROVIDER_LOCAL = 'LOCAL';
const MEDIA_PROVIDER_MINIO = 'MINIO';
const MEDIA_PROVIDER_AWS = 'AWS';
const DEFAULT_IMAGE_NAME = DEFAULT_EXERCISE_IMAGE_NAME;

const ALLOWED_MEDIA_PROVIDERS = new Set([
  MEDIA_PROVIDER_LOCAL,
  MEDIA_PROVIDER_MINIO,
  MEDIA_PROVIDER_AWS,
  'AZURE',
]);

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function normalizeProvider(provider) {
  const normalized = String(provider || '').trim().toUpperCase();
  if (!normalized) return MEDIA_PROVIDER_LOCAL;
  return ALLOWED_MEDIA_PROVIDERS.has(normalized) ? normalized : MEDIA_PROVIDER_LOCAL;
}

function defaultMediaPathForExercise(exerciseId) {
  const id = Number(exerciseId || 0);
  return `APP/exercise-library/${id}/images`;
}

function resolveLocalContentRoot() {
  const configuredPath = String(process.env.LOCAL_AWS_PATH || DEFAULT_LOCAL_AWS_RELATIVE_PATH).trim();
  if (!configuredPath) {
    return CONTENT_ROOT;
  }

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const candidateFromRepo = path.resolve(REPO_ROOT, configuredPath);
  if (fs.existsSync(candidateFromRepo)) {
    return candidateFromRepo;
  }

  const candidateFromBackend = path.resolve(BACKEND_ROOT, configuredPath);
  if (fs.existsSync(candidateFromBackend)) {
    return candidateFromBackend;
  }

  return candidateFromRepo;
}

function buildExerciseMediaFolderPath(exerciseId) {
  const id = Number(exerciseId || 0);
  if (!id) {
    return path.join(resolveLocalContentRoot(), 'APP', 'exercise-library', '0', 'images');
  }

  return path.join(resolveLocalContentRoot(), 'APP', 'exercise-library', String(id), 'images');
}

function isDefaultExerciseImageReference(value) {
  const raw = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw) return false;

  const normalized = raw.toLowerCase();
  return [
    'default.jpg',
    'default.jpeg',
    'default.png',
    'default.gif',
    'default/default.jpg',
    'default/default.jpeg',
    'default/default.png',
    'default/default.gif',
    'default.JPG',
    'default.jpeg',
    'app/exercise-library/default.JPG',
    'app/exercise-library/default.jpg',
    'app/exercise-library/default/default.jpg',
    'app/exercise-library/default/default.JPG',
    DEFAULT_EXERCISE_STORAGE_KEY.toLowerCase(),
  ].includes(normalized);
}

function normalizeMediaPath(value, exerciseId) {
  const provided = toSafeRelativePath(value);
  if (provided) {
    if (provided.toLowerCase() === 'exercise-library') {
      return defaultMediaPathForExercise(exerciseId);
    }
    return provided;
  }
  return defaultMediaPathForExercise(exerciseId);
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [trimmed];
  }
}

function toSafeRelativePath(value) {
  const trimmed = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed || trimmed.includes('..')) {
    return '';
  }
  return trimmed;
}

function toSafeFileName(value) {
  const baseName = path.basename(String(value || '').trim());
  if (!baseName || baseName.includes('..')) {
    return '';
  }
  return baseName;
}

function pickPrimaryImageFromRow(row = {}) {
  const explicitPrimary = toSafeRelativePath(row.PrimaryImage);
  if (explicitPrimary) {
    if (isDefaultExerciseImageReference(explicitPrimary)) {
      return DEFAULT_EXERCISE_IMAGE_NAME;
    }
    return explicitPrimary;
  }

  const gallery = parseJsonArray(row.ImageGallery);
  if (gallery.length > 0) {
    const galleryCandidate = toSafeRelativePath(gallery[0]);
    if (galleryCandidate && !isDefaultExerciseImageReference(galleryCandidate)) {
      return galleryCandidate;
    }
  }

  const imageUrl = String(row.ImageURL || '').trim();
  if (imageUrl) {
    const withoutQuery = imageUrl.split('?')[0];
    const marker = '/assets/Excerises/';
    const markerIndex = withoutQuery.toLowerCase().indexOf(marker.toLowerCase());
    if (markerIndex >= 0) {
      const relative = withoutQuery.slice(markerIndex + marker.length);
      const legacyPath = toSafeRelativePath(relative);
      if (legacyPath && !isDefaultExerciseImageReference(legacyPath)) {
        return legacyPath;
      }
    }

    const fallbackName = toSafeFileName(withoutQuery);
    if (fallbackName && !isDefaultExerciseImageReference(fallbackName)) {
      return fallbackName;
    }
  }

  return DEFAULT_EXERCISE_IMAGE_NAME;
}

function buildExerciseImageUrl(exerciseId, imageName) {
  const id = Number(exerciseId || 0);
  const safeName = toSafeRelativePath(imageName) || DEFAULT_EXERCISE_IMAGE_NAME;
  const resolvedName = isDefaultExerciseImageReference(safeName)
    ? DEFAULT_EXERCISE_IMAGE_NAME
    : safeName;
  return `/api/media/exercises/${id}/image?name=${encodeURIComponent(resolvedName)}`;
}

function buildExerciseImagePath(exercise = {}) {
  const id = Number(exercise.ExerciseID || exercise.exerciseId || 0);
  const providerFromEnv = normalizeProvider(process.env.MEDIA_PROVIDER || MEDIA_PROVIDER_LOCAL);
  const mediaProvider = normalizeProvider(exercise.MediaProvider || exercise.mediaProvider || providerFromEnv);
  const mediaPath = normalizeMediaPath(exercise.MediaPath || exercise.mediaPath, id);
  const rawName = exercise.PrimaryImage || exercise.primaryImage || DEFAULT_EXERCISE_IMAGE_NAME;
  const safeName = toSafeRelativePath(rawName) || DEFAULT_EXERCISE_IMAGE_NAME;
  const normalizedName = isDefaultExerciseImageReference(safeName)
    ? DEFAULT_EXERCISE_IMAGE_NAME
    : safeName;
  const safeFileName = toSafeFileName(normalizedName) || 'default.JPG';
  const localRoot = resolveLocalContentRoot();

  if (isDefaultExerciseImageReference(normalizedName)) {
    return {
      exerciseId: id,
      mediaProvider,
      mediaPath: 'APP/exercise-library',
      imageName: DEFAULT_EXERCISE_IMAGE_NAME,
      storageRelativePath: DEFAULT_EXERCISE_STORAGE_KEY,
      localFilePath: path.join(localRoot, DEFAULT_EXERCISE_STORAGE_KEY),
      publicUrl: buildExerciseImageUrl(id, DEFAULT_EXERCISE_IMAGE_NAME),
    };
  }

  return {
    exerciseId: id,
    mediaProvider,
    mediaPath,
    imageName: safeFileName,
    storageRelativePath: `${mediaPath}/${safeFileName}`,
    localFilePath: path.join(localRoot, mediaPath, safeFileName),
    publicUrl: buildExerciseImageUrl(id, safeFileName),
  };
}

function resolveExerciseMediaRow(row = {}) {
  const id = Number(row.ExerciseID || row.exerciseId || 0);
  const providerFromEnv = normalizeProvider(process.env.MEDIA_PROVIDER || MEDIA_PROVIDER_LOCAL);
  const mediaProvider = normalizeProvider(row.MediaProvider || providerFromEnv);
  const mediaPath = normalizeMediaPath(row.MediaPath, id);
  const primaryImage = pickPrimaryImageFromRow(row);
  const resolvedUrl = buildExerciseImageUrl(id, primaryImage);

  return {
    ...row,
    MediaProvider: mediaProvider,
    MediaPath: mediaPath,
    PrimaryImage: primaryImage,
    ResolvedImageURL: resolvedUrl,
  };
}

function shouldUseGateway() {
  const raw = String(process.env.USE_GW || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function shouldTraceMedia() {
  const raw = String(process.env.MEDIA_TRACE || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function buildPublicGatewayUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('PUBLIC_GATEWAY_URL is not configured.');
  }

  return `${trimmed}/api/gateway`;
}

function extractGatewayContentType(payload, fallbackType) {
  const candidates = [
    payload?.contentType,
    payload?.mimeType,
    payload?.content_type,
    payload?.data?.contentType,
    payload?.data?.mimeType,
    payload?.payload?.contentType,
    payload?.payload?.mimeType,
  ];

  const resolved = candidates.find((value) => String(value || '').trim());
  return String(resolved || fallbackType || 'application/octet-stream').trim();
}

function extractGatewayBase64(payload) {
  const candidates = [
    payload?.dataBase64,
    payload?.objectBase64,
    payload?.base64,
    payload?.bodyBase64,
    payload?.contentBase64,
    payload?.data?.dataBase64,
    payload?.data?.objectBase64,
    payload?.data?.base64,
    payload?.payload?.dataBase64,
    payload?.payload?.objectBase64,
    payload?.payload?.base64,
  ];

  const resolved = candidates.find((value) => typeof value === 'string' && value.trim());
  return String(resolved || '').trim();
}

function buildExerciseStorageKey(exercise = {}, requestedImageName = '') {
  const id = Number(exercise.ExerciseID || exercise.exerciseId || 0);
  const mediaPath = normalizeMediaPath(exercise.MediaPath || exercise.mediaPath, id);
  const rawImageName = toSafeRelativePath(requestedImageName || exercise.PrimaryImage || exercise.primaryImage) || DEFAULT_EXERCISE_IMAGE_NAME;
  const normalizedFileName = toSafeFileName(rawImageName) || DEFAULT_EXERCISE_IMAGE_NAME;
  const imageName = isDefaultExerciseImageReference(rawImageName) ? DEFAULT_EXERCISE_IMAGE_NAME : normalizedFileName;

  if (isDefaultExerciseImageReference(imageName)) {
    return DEFAULT_EXERCISE_STORAGE_KEY;
  }

  return `${mediaPath}/${imageName}`.replace(/\/+/g, '/').replace(/\/{2,}/g, '/');
}

async function fetchObjectViaGateway(storageKey) {
  const publicGatewayUrl = String(process.env.PUBLIC_GATEWAY_URL || '').trim();
  const gatewayConfig = resolveGatewayConfig(process.env);
  const gatewayUrl = buildPublicGatewayUrl(publicGatewayUrl);

  if (!publicGatewayUrl) {
    throw new Error('PUBLIC_GATEWAY_URL is not configured.');
  }

  if (!gatewayConfig.hmacSecret) {
    throw new Error('Gateway authentication is not configured.');
  }

  const requestPayload = {
    appName: 'Workout-Atlas',
    type: 'LOCAL_CLOUD',
    payload: {
      action: 'GET_OBJECT',
      storageKey,
    },
  };

  const serializedBody = JSON.stringify(requestPayload);
  const requestId = createRequestId('wa-media');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createSignature(
    gatewayConfig.hmacSecret,
    'POST',
    gatewayConfig.gatewayPath || '/api/gateway',
    timestamp,
    requestId,
    serializedBody
  );

  const timeout = createTimeoutSignal(gatewayConfig.timeoutMs);
  try {
    const gatewayResponse = await fetch(gatewayUrl, {
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

    const rawText = await gatewayResponse.text();
    let parsedBody = {};
    try {
      parsedBody = rawText ? JSON.parse(rawText) : {};
    } catch (_) {
      parsedBody = {};
    }

    const gatewayData = parsedBody?.data && typeof parsedBody.data === 'object'
      ? parsedBody.data
      : parsedBody;

    const ok = gatewayResponse.ok && gatewayData?.success !== false && parsedBody?.success !== false;
    if (!ok) {
      const err = new Error(
        String(
          gatewayData?.message ||
          parsedBody?.error?.message ||
          parsedBody?.message ||
          parsedBody?.detail ||
          `Gateway HTTP ${gatewayResponse.status}`
        ).trim()
      );
      err.statusCode = gatewayResponse.status >= 400 ? gatewayResponse.status : 502;
      throw err;
    }

    const base64Data = extractGatewayBase64(gatewayData);
    if (!base64Data) {
      const err = new Error('Gateway object response did not include base64 data.');
      err.statusCode = 502;
      throw err;
    }

    const objectBuffer = Buffer.from(base64Data, 'base64');
    const responseType = extractGatewayContentType(gatewayData, detectMimeType(storageKey));

    return {
      buffer: objectBuffer,
      contentType: responseType,
      contentLength: objectBuffer.length,
    };
  } finally {
    timeout.clear();
  }
}

function getLocalImageCandidates(exercise = {}, requestedImageName = '') {
  const id = Number(exercise.ExerciseID || exercise.exerciseId || 0);
  const relativeName = toSafeRelativePath(requestedImageName || exercise.PrimaryImage || exercise.primaryImage) || DEFAULT_EXERCISE_IMAGE_NAME;
  const baseName = toSafeFileName(relativeName);
  const localPath = buildExerciseImagePath({
    ExerciseID: id,
    MediaProvider: exercise.MediaProvider,
    MediaPath: exercise.MediaPath,
    PrimaryImage: relativeName,
  });

  const candidates = [];

  if (localPath.localFilePath) {
    candidates.push(localPath.localFilePath);
  }

  if (baseName) {
    const localBaseName = buildExerciseImagePath({
      ExerciseID: id,
      MediaProvider: exercise.MediaProvider,
      MediaPath: exercise.MediaPath,
      PrimaryImage: baseName,
    });
    candidates.push(localBaseName.localFilePath);
  }

  if (!isDefaultExerciseImageReference(relativeName)) {
    candidates.push(path.join(LEGACY_EXERCISE_ROOT, relativeName));
    candidates.push(path.join(resolveLocalContentRoot(), DEFAULT_EXERCISE_STORAGE_KEY));
  }

  candidates.push(path.join(resolveLocalContentRoot(), DEFAULT_EXERCISE_STORAGE_KEY));
  candidates.push(path.join(LEGACY_EXERCISE_ROOT, DEFAULT_EXERCISE_IMAGE_NAME));
  candidates.push(path.join(LEGACY_EXERCISE_ROOT, 'default', 'default.jpg'));

  return Array.from(new Set(candidates));
}

function detectMimeType(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

async function streamExerciseImage(res, exerciseOrRow, imageName) {
  const inputIsObject = exerciseOrRow && typeof exerciseOrRow === 'object';
  const resolvedExercise = inputIsObject
    ? resolveExerciseMediaRow(exerciseOrRow)
    : resolveExerciseMediaRow({
        ExerciseID: exerciseOrRow,
        PrimaryImage: imageName,
      });
  const effectiveImageName = imageName || resolvedExercise.PrimaryImage;

  if (shouldTraceMedia()) {
    console.log(`[MEDIA] ExerciseID=${resolvedExercise.ExerciseID}`);
    console.log(`[MEDIA] Path=${resolvedExercise.MediaPath}`);
    console.log(`[MEDIA] Image=${effectiveImageName}`);
  }

  const storageKey = buildExerciseStorageKey(resolvedExercise, effectiveImageName);
  console.log(`[MEDIA] STORAGE_KEY=${storageKey}`);

  try {
    const gatewayObject = await fetchObjectViaGateway(storageKey);
    console.log('MEDIA SOURCE: GATEWAY_S3');
    res.setHeader('content-type', gatewayObject.contentType);
    res.setHeader('content-length', gatewayObject.contentLength);
    res.setHeader('cache-control', 'no-store, max-age=0');
    res.end(gatewayObject.buffer);
    return;
  } catch (gatewayError) {
    const safeGatewayError = String(gatewayError?.message || gatewayError || '').trim();
    if (shouldTraceMedia()) {
      console.warn('[MEDIA] Gateway retrieval failed; using temporary local filesystem fallback.', safeGatewayError);
    }
    console.warn(`MEDIA SOURCE: LOCAL_FALLBACK${safeGatewayError ? ` (Gateway error: ${safeGatewayError})` : ''}`);
  }

  // Temporary Stage 2A fallback: if gateway/S3 retrieval fails, read from local media path.
  const candidates = getLocalImageCandidates(resolvedExercise, effectiveImageName);
  const primaryLocal = buildExerciseImagePath({
    ExerciseID: resolvedExercise.ExerciseID,
    MediaProvider: resolvedExercise.MediaProvider,
    MediaPath: resolvedExercise.MediaPath,
    PrimaryImage: effectiveImageName,
  }).localFilePath;
  const match = candidates.find((candidate) => fs.existsSync(candidate));

  if (!match) {
    const err = new Error(`Exercise image not found in local content repository. Attempted: ${primaryLocal}`);
    err.statusCode = 404;
    throw err;
  }

  const stat = fs.statSync(match);
  res.setHeader('content-type', detectMimeType(match));
  res.setHeader('content-length', stat.size);
  res.setHeader('cache-control', 'no-store, max-age=0');

  fs.createReadStream(match).pipe(res);
}

async function ensureExerciseMediaColumns(pool) {
  const statements = [
    "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS MediaProvider VARCHAR(20) NOT NULL DEFAULT 'LOCAL' AFTER IsGlobalExercise",
    "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS MediaPath VARCHAR(255) NOT NULL DEFAULT 'APP/exercise-library/0/images' AFTER MediaProvider",
    "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS PrimaryImage VARCHAR(255) NULL AFTER MediaPath",
    "ALTER TABLE exercises ADD COLUMN IsSystemExercise BOOLEAN NOT NULL DEFAULT FALSE AFTER PrimaryImage",
  ];

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (error) {
      if (error?.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }
}

module.exports = {
  MEDIA_PROVIDER_LOCAL,
  DEFAULT_IMAGE_NAME,
  DEFAULT_EXERCISE_IMAGE_NAME,
  DEFAULT_EXERCISE_STORAGE_KEY,
  isDefaultExerciseImageReference,
  resolveLocalContentRoot,
  buildExerciseMediaFolderPath,
  ensureExerciseMediaColumns,
  resolveExerciseMediaRow,
  streamExerciseImage,
  toSafeRelativePath,
  buildExerciseStorageKey,
};
