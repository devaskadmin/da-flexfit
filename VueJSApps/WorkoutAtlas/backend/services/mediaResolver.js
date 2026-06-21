const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');
const DEFAULT_LOCAL_AWS_RELATIVE_PATH = 'backend/AWS-S3-CONTENT';

const CONTENT_ROOT = path.resolve(BACKEND_ROOT, 'AWS-S3-CONTENT');
const LEGACY_EXERCISE_ROOT = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'assets', 'Excerises');

const MEDIA_PROVIDER_LOCAL = 'LOCAL';
const MEDIA_PROVIDER_MINIO = 'MINIO';
const MEDIA_PROVIDER_AWS = 'AWS';
const DEFAULT_IMAGE_NAME = 'default/default.jpg';

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
    return explicitPrimary;
  }

  const gallery = parseJsonArray(row.ImageGallery);
  if (gallery.length > 0) {
    const galleryCandidate = toSafeRelativePath(gallery[0]);
    if (galleryCandidate) {
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
      if (legacyPath) {
        return legacyPath;
      }
    }

    const fallbackName = toSafeFileName(withoutQuery);
    if (fallbackName) {
      return fallbackName;
    }
  }

  return DEFAULT_IMAGE_NAME;
}

function buildExerciseImageUrl(exerciseId, imageName) {
  const id = Number(exerciseId || 0);
  const safeName = toSafeRelativePath(imageName) || DEFAULT_IMAGE_NAME;
  return `/api/media/exercises/${id}/image?name=${encodeURIComponent(safeName)}`;
}

function buildExerciseImagePath(exercise = {}) {
  const id = Number(exercise.ExerciseID || exercise.exerciseId || 0);
  const providerFromEnv = normalizeProvider(process.env.MEDIA_PROVIDER || MEDIA_PROVIDER_LOCAL);
  const mediaProvider = normalizeProvider(exercise.MediaProvider || exercise.mediaProvider || providerFromEnv);
  const mediaPath = normalizeMediaPath(exercise.MediaPath || exercise.mediaPath, id);
  const safeName = toSafeRelativePath(exercise.PrimaryImage || exercise.primaryImage || DEFAULT_IMAGE_NAME) || DEFAULT_IMAGE_NAME;
  const safeFileName = toSafeFileName(safeName) || '1.jpg';
  const localRoot = resolveLocalContentRoot();

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

function normalizeGatewayUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

async function proxyImageViaGateway(res, exerciseId, imageName) {
  const gatewayBase = normalizeGatewayUrl(process.env.PUBLIC_GATEWAY_URL);
  if (!gatewayBase) {
    throw new Error('USE_GW=true but PUBLIC_GATEWAY_URL is not configured.');
  }

  const gatewayResponse = await axios.get(`${gatewayBase}/api/media/exercises/${exerciseId}/image`, {
    params: { name: imageName },
    responseType: 'stream',
    timeout: 12000,
    validateStatus: () => true,
  });

  if (gatewayResponse.status < 200 || gatewayResponse.status >= 300) {
    const err = new Error(`Gateway image request failed with status ${gatewayResponse.status}`);
    err.statusCode = gatewayResponse.status;
    throw err;
  }

  const passthroughHeaders = ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'];
  for (const headerName of passthroughHeaders) {
    const headerValue = gatewayResponse.headers?.[headerName];
    if (headerValue) {
      res.setHeader(headerName, headerValue);
    }
  }

  gatewayResponse.data.pipe(res);
}

function getLocalImageCandidates(exercise = {}, requestedImageName = '') {
  const id = Number(exercise.ExerciseID || exercise.exerciseId || 0);
  const relativeName = toSafeRelativePath(requestedImageName || exercise.PrimaryImage || exercise.primaryImage) || DEFAULT_IMAGE_NAME;
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

  candidates.push(path.join(LEGACY_EXERCISE_ROOT, relativeName));

  if (relativeName !== DEFAULT_IMAGE_NAME) {
    candidates.push(path.join(LEGACY_EXERCISE_ROOT, DEFAULT_IMAGE_NAME));
  }

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

  if (shouldUseGateway() && normalizeProvider(resolvedExercise.MediaProvider) !== MEDIA_PROVIDER_LOCAL) {
    await proxyImageViaGateway(res, resolvedExercise.ExerciseID, effectiveImageName);
    return;
  }

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
  res.setHeader('cache-control', 'public, max-age=300');

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
  ensureExerciseMediaColumns,
  resolveExerciseMediaRow,
  streamExerciseImage,
  toSafeRelativePath,
};
