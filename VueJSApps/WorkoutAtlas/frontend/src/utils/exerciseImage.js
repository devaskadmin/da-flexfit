import { API_BASE } from '@/config/env';

export const DEFAULT_EXERCISE_IMAGE_NAME = 'default.JPG';
export const DEFAULT_EXERCISE_IMAGE = `${API_BASE}/api/media/default-exercise-image?name=${encodeURIComponent(DEFAULT_EXERCISE_IMAGE_NAME)}`;

export const isDefaultExerciseImageReference = (value) => {
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
    'default.JPG'.toLowerCase(),
    'app/exercise-library/default.jpg',
    'app/exercise-library/default/default.jpg',
  ].includes(normalized);
};

const getDefaultExerciseImageUrl = (exerciseId = 0) => {
  const id = Number(exerciseId || 0);
  if (id > 0) {
    return buildExerciseImageUrl(id, DEFAULT_EXERCISE_IMAGE_NAME);
  }
  return DEFAULT_EXERCISE_IMAGE;
};

export const buildExerciseImageUrl = (exerciseId, imageName) => {
  const id = Number(exerciseId || 0);
  const normalizedName = String(imageName || '').trim();
  if (!id || !normalizedName) {
    return '';
  }
  return `${API_BASE}/api/media/exercises/${id}/image?name=${encodeURIComponent(normalizedName)}`;
};

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value) || value.startsWith('data:');

const isBackendMediaEndpoint = (value) => /\/api\/media\/exercises\/\d+\/image/i.test(String(value || ''));

const extractResolverImageName = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const noQuery = raw.split('?')[0].replace(/\\/g, '/');
  const fileName = noQuery.split('/').filter(Boolean).pop() || '';
  return fileName;
};

const parseExerciseId = (exercise) => {
  const id = Number(exercise?.ExerciseID || exercise?.exerciseId || 0);
  return id > 0 ? id : 0;
};

const normalizeExerciseImagePath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (isAbsoluteUrl(raw)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return `${API_BASE}${raw}`;
  }

  return `${API_BASE}/${raw.replace(/^\.\//, '')}`;
};

const parseImageGallery = (gallery) => {
  if (!gallery) return [];

  if (Array.isArray(gallery)) {
    return gallery;
  }

  if (typeof gallery === 'string') {
    const trimmed = gallery.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Some records may persist a single filename instead of JSON.
      return [trimmed];
    }
  }

  return [];
};

export const getExerciseImage = (exercise) => {
  if (!exercise || typeof exercise !== 'object') {
    return DEFAULT_EXERCISE_IMAGE;
  }

  const exerciseId = parseExerciseId(exercise);

  const resolvedFromBackend = normalizeExerciseImagePath(exercise.ResolvedImageURL || exercise.resolvedImageUrl || '');
  if (resolvedFromBackend) {
    return resolvedFromBackend;
  }

  const directPrimary = String(exercise.PrimaryImage || exercise.primaryImage || '').trim();
  if (exerciseId && directPrimary) {
    return buildExerciseImageUrl(exerciseId, directPrimary);
  }

  const directImage =
    exercise.ImageURL ||
    exercise.imageUrl ||
    exercise.image ||
    exercise.thumbnail ||
    '';

  if (isBackendMediaEndpoint(directImage)) {
    const normalizedDirectImage = normalizeExerciseImagePath(directImage);
    if (normalizedDirectImage) {
      return normalizedDirectImage;
    }
  }

  if (exerciseId && directImage) {
    const resolverImageName = extractResolverImageName(directImage);
    if (resolverImageName) {
      return buildExerciseImageUrl(exerciseId, resolverImageName);
    }
  }

  const normalizedDirectImage = normalizeExerciseImagePath(directImage);
  if (normalizedDirectImage) {
    return normalizedDirectImage;
  }

  const gallery = parseImageGallery(exercise.ImageGallery || exercise.imageGallery);
  if (gallery.length > 0) {
    if (exerciseId) {
      const resolverImageName = extractResolverImageName(gallery[0]);
      if (resolverImageName) {
        return buildExerciseImageUrl(exerciseId, resolverImageName);
      }
    }

    const normalizedGalleryImage = normalizeExerciseImagePath(gallery[0]);
    return normalizedGalleryImage || getDefaultExerciseImageUrl(exerciseId);
  }

  return getDefaultExerciseImageUrl(exerciseId);
};

export const getExerciseImageFromGallery = (gallery, exerciseId = 0) => {
  const images = parseImageGallery(gallery);
  if (images.length === 0) {
    return getDefaultExerciseImageUrl(exerciseId);
  }

  const id = Number(exerciseId || 0);
  if (id > 0) {
    const resolverImageName = extractResolverImageName(images[0]);
    if (resolverImageName) {
      return buildExerciseImageUrl(id, resolverImageName);
    }
  }

  return normalizeExerciseImagePath(images[0]) || getDefaultExerciseImageUrl(id);
};
