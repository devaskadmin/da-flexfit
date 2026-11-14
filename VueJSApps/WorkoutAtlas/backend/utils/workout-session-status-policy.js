const WORKOUT_HISTORY_VISIBLE_STATUSES = Object.freeze([
  'in_progress',
  'in-progress',
  'active',
  'paused',
  'completed',
  'ended',
  'cancelled',
  'canceled',
]);

const MISSED_EXERCISE_ELIGIBLE_SESSION_STATUSES = Object.freeze([
  'ended',
  'ended_early',
]);

const normalizeWorkoutSessionStatus = (status) =>
  String(status || '').trim().toLowerCase();

const isWorkoutHistoryVisibleStatus = (status) =>
  WORKOUT_HISTORY_VISIBLE_STATUSES.includes(normalizeWorkoutSessionStatus(status));

const isMissedExerciseEligibleSessionStatus = (status) =>
  MISSED_EXERCISE_ELIGIBLE_SESSION_STATUSES.includes(normalizeWorkoutSessionStatus(status));

const isSetCompleted = (setEntry = {}) =>
  Boolean(setEntry?.done ?? setEntry?.completed ?? false);

const isMissedExerciseEligible = ({ sessionId, sessionStatus, sets } = {}) => {
  if (!Number.isInteger(Number(sessionId)) || Number(sessionId) <= 0) {
    return false;
  }

  if (!isMissedExerciseEligibleSessionStatus(sessionStatus)) {
    return false;
  }

  if (!Array.isArray(sets) || sets.length === 0) {
    return false;
  }

  return sets.some((setEntry) => !isSetCompleted(setEntry));
};

module.exports = {
  WORKOUT_HISTORY_VISIBLE_STATUSES,
  MISSED_EXERCISE_ELIGIBLE_SESSION_STATUSES,
  normalizeWorkoutSessionStatus,
  isWorkoutHistoryVisibleStatus,
  isMissedExerciseEligibleSessionStatus,
  isMissedExerciseEligible,
};
