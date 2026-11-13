import { API_BASE } from '@/config/env';

export const DEFAULT_WORKOUT_PLAN_IMAGE_NAME = 'default.JPG';
export const DEFAULT_WORKOUT_PLAN_IMAGE = `${API_BASE}/api/media/default-workout-plan-image?name=${encodeURIComponent(DEFAULT_WORKOUT_PLAN_IMAGE_NAME)}`;
const INLINE_WORKOUT_PLAN_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%230f172a'/%3E%3Cstop offset='100%25' stop-color='%231e293b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='12' fill='url(%23bg)'/%3E%3Cpath d='M18 66l16-17 12 12 14-18 18 23H18z' fill='%23475569'/%3E%3Ccircle cx='35' cy='33' r='7' fill='%2364748b'/%3E%3C/svg%3E";

const normalizeCandidate = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized || /^(null|undefined)$/i.test(normalized)) {
    return '';
  }
  return normalized;
};

export const buildWorkoutPlanCoverImageUrl = (planId, revision = 0) => {
  const normalizedPlanId = String(planId || '').trim();
  if (!normalizedPlanId) {
    return DEFAULT_WORKOUT_PLAN_IMAGE;
  }

  const rev = Number(revision || 0);
  const revQuery = Number.isFinite(rev) && rev > 0 ? `?v=${rev}` : '';
  return `${API_BASE}/api/media/workout-plans/${encodeURIComponent(normalizedPlanId)}/cover${revQuery}`;
};

export const applyWorkoutPlanImageFallback = (event) => {
  const target = event?.target;
  if (!target) {
    return;
  }

  const currentSrc = normalizeCandidate(target.currentSrc || target.src);
  const defaultSrc = normalizeCandidate(DEFAULT_WORKOUT_PLAN_IMAGE);
  const hasTriedDefault = target.dataset.waWorkoutPlanFallbackDefault === '1';
  const usingDefault = defaultSrc && currentSrc === defaultSrc;

  if (!hasTriedDefault && !usingDefault && defaultSrc) {
    target.dataset.waWorkoutPlanFallbackDefault = '1';
    target.src = defaultSrc;
    return;
  }

  // Final fallback avoids broken-image icon loops when the default asset is unavailable.
  if (currentSrc !== INLINE_WORKOUT_PLAN_PLACEHOLDER) {
    target.dataset.waWorkoutPlanFallbackFinal = '1';
    target.onerror = null;
    target.src = INLINE_WORKOUT_PLAN_PLACEHOLDER;
  }
};
