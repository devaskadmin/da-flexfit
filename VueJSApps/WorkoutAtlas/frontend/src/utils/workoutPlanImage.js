import { API_BASE } from '@/config/env';

export const DEFAULT_WORKOUT_PLAN_IMAGE_NAME = 'default.JPG';
export const DEFAULT_WORKOUT_PLAN_IMAGE = `${API_BASE}/api/media/default-workout-plan-image?name=${encodeURIComponent(DEFAULT_WORKOUT_PLAN_IMAGE_NAME)}`;

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
  if (!event?.target) {
    return;
  }
  event.target.src = DEFAULT_WORKOUT_PLAN_IMAGE;
};
