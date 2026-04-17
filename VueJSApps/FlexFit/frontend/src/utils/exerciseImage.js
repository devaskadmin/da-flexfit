export const EXERCISE_IMAGE_ROOT = '/assets/Excerises';
export const DEFAULT_EXERCISE_IMAGE = `${EXERCISE_IMAGE_ROOT}/default/default.jpg`;

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value) || value.startsWith('data:');

const normalizeExerciseImagePath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (isAbsoluteUrl(raw)) {
    return raw;
  }

  if (raw.startsWith(EXERCISE_IMAGE_ROOT)) {
    return raw;
  }

  if (raw.startsWith(`/${EXERCISE_IMAGE_ROOT.replace(/^\//, '')}`)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return raw;
  }

  if (raw.startsWith('assets/Excerises/')) {
    return `/${raw}`;
  }

  return `${EXERCISE_IMAGE_ROOT}/${raw.replace(/^\.\//, '')}`;
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

  const directImage =
    exercise.ImageURL ||
    exercise.imageUrl ||
    exercise.image ||
    exercise.thumbnail ||
    '';

  const normalizedDirectImage = normalizeExerciseImagePath(directImage);
  if (normalizedDirectImage) {
    return normalizedDirectImage;
  }

  const gallery = parseImageGallery(exercise.ImageGallery || exercise.imageGallery);
  if (gallery.length > 0) {
    const normalizedGalleryImage = normalizeExerciseImagePath(gallery[0]);
    return normalizedGalleryImage || DEFAULT_EXERCISE_IMAGE;
  }

  return DEFAULT_EXERCISE_IMAGE;
};

export const getExerciseImageFromGallery = (gallery) => {
  const images = parseImageGallery(gallery);
  if (images.length === 0) {
    return DEFAULT_EXERCISE_IMAGE;
  }

  return normalizeExerciseImagePath(images[0]) || DEFAULT_EXERCISE_IMAGE;
};
