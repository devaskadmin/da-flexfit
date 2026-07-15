import { API_BASE } from '@/config/env';

export const DEFAULT_EXERCISE_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"%3E%3Crect width="640" height="360" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23475569" font-family="Arial,sans-serif" font-size="26"%3EExercise%20Image%3C/text%3E%3C/svg%3E';

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
    return normalizedGalleryImage || DEFAULT_EXERCISE_IMAGE;
  }

  return DEFAULT_EXERCISE_IMAGE;
};

export const getExerciseImageFromGallery = (gallery, exerciseId = 0) => {
  const images = parseImageGallery(gallery);
  if (images.length === 0) {
    return DEFAULT_EXERCISE_IMAGE;
  }

  const id = Number(exerciseId || 0);
  if (id > 0) {
    const resolverImageName = extractResolverImageName(images[0]);
    if (resolverImageName) {
      return buildExerciseImageUrl(id, resolverImageName);
    }
  }

  return normalizeExerciseImagePath(images[0]) || DEFAULT_EXERCISE_IMAGE;
};
