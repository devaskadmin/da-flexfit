const normalizeWorkoutSessionStatus = (status) => String(status || '').trim().toLowerCase();

const isCompletedWorkoutStatus = (status) => normalizeWorkoutSessionStatus(status) === 'completed';

const normalizeSessionDurationSeconds = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
};

const buildFallbackSessionKey = (session = {}) => {
  const workoutDate = String(session?.workoutDate || '').trim();
  const startedAt = String(session?.sessionStartedAt || '').trim();
  const completedAt = String(session?.sessionCompletedAt || '').trim();
  const planName = String(session?.planName || '').trim().toLowerCase();
  const dayName = String(session?.workoutDayName || '').trim().toLowerCase();
  const duration = normalizeSessionDurationSeconds(session?.sessionDurationSeconds);
  return `${workoutDate}|${startedAt}|${completedAt}|${planName}|${dayName}|${duration}`;
};

const buildSessionDeduplicationKey = (session = {}) => {
  const numericSessionId = Number(session?.sessionId || 0);
  if (Number.isInteger(numericSessionId) && numericSessionId > 0) {
    return `id:${numericSessionId}`;
  }

  return `legacy:${buildFallbackSessionKey(session)}`;
};

const buildDailyWorkoutDurationSummary = (sessions = []) => {
  const normalizedSessions = Array.isArray(sessions) ? sessions : [];
  const includedSessionKeys = new Set();

  let totalDurationSeconds = 0;
  let includedCompletedSessionCount = 0;

  for (const session of normalizedSessions) {
    if (!isCompletedWorkoutStatus(session?.sessionStatus)) {
      continue;
    }

    const persistedDurationSeconds = normalizeSessionDurationSeconds(session?.sessionDurationSeconds);
    if (persistedDurationSeconds <= 0) {
      continue;
    }

    const dedupeKey = buildSessionDeduplicationKey(session);
    if (includedSessionKeys.has(dedupeKey)) {
      continue;
    }

    includedSessionKeys.add(dedupeKey);
    includedCompletedSessionCount += 1;
    totalDurationSeconds += persistedDurationSeconds;
  }

  return {
    totalDurationSeconds,
    includedCompletedSessionCount,
  };
};

module.exports = {
  buildDailyWorkoutDurationSummary,
  normalizeSessionDurationSeconds,
  isCompletedWorkoutStatus,
};
