const normalizeSessionStatus = (session) =>
  String(session?.sessionStatus || session?.status || '').trim().toLowerCase();

const parseStartedAtMs = (session) => {
  const startedAtMs = new Date(session?.startedAt || session?.sessionStartedAt || '').getTime();
  return Number.isFinite(startedAtMs) ? startedAtMs : null;
};

const getSessionId = (session) => Number(session?.id || 0);

const isSessionPaused = (status) => status === 'paused';

const isSessionRunning = (status) =>
  status === 'in_progress' || status === 'in-progress' || status === 'active';

const isSessionTerminal = (status) =>
  status === 'completed' || status === 'ended' || status === 'cancelled' || status === 'canceled';

const toElapsedFromStart = (startedAtMs, nowMs) => {
  if (!Number.isFinite(startedAtMs)) return 0;
  return Math.max(Math.floor((nowMs - startedAtMs) / 1000), 0);
};

const toPersistedElapsed = (session) => {
  const persisted = Number(session?.durationSeconds ?? session?.sessionDurationSeconds ?? 0);
  return Number.isFinite(persisted) ? Math.max(Math.floor(persisted), 0) : 0;
};

export const createSessionTimerSnapshot = (previousSnapshot, session, nowMs = Date.now()) => {
  const sessionId = getSessionId(session);
  if (!sessionId) return null;

  const status = normalizeSessionStatus(session);
  const startedAtMs = parseStartedAtMs(session);
  const elapsedFromStart = toElapsedFromStart(startedAtMs, nowMs);
  const persistedElapsed = toPersistedElapsed(session);

  // Start from the most reliable floor (persisted or timestamp-derived), then enforce monotonic behavior.
  let elapsedSeconds = Math.max(elapsedFromStart, persistedElapsed, 0);
  const previousElapsed = Math.max(Number(previousSnapshot?.elapsedSeconds || 0), 0);
  if (previousElapsed > elapsedSeconds) {
    elapsedSeconds = previousElapsed;
  }

  const isPaused = isSessionPaused(status);
  const isTerminal = isSessionTerminal(status);
  if (isPaused) {
    // Freeze at the known pause baseline; backend duration is authoritative when present.
    elapsedSeconds = Math.max(persistedElapsed, previousElapsed, elapsedFromStart);
  } else if (isTerminal) {
    // Completed/ended sessions must not continue ticking after recovery.
    elapsedSeconds = Math.max(persistedElapsed, previousElapsed);
  }

  return {
    sessionId,
    status,
    isPaused,
    shouldTick: isSessionRunning(status) && !isPaused,
    elapsedSeconds,
    startedAtMs,
    persistedElapsed,
    updatedAtMs: nowMs,
  };
};

export const upsertSessionTimerState = (stateById = {}, session, nowMs = Date.now()) => {
  const sessionId = getSessionId(session);
  if (!sessionId) return stateById;

  const previousSnapshot = stateById[sessionId] || null;
  const nextSnapshot = createSessionTimerSnapshot(previousSnapshot, session, nowMs);
  if (!nextSnapshot) return stateById;

  return {
    ...stateById,
    [sessionId]: nextSnapshot,
  };
};

export const removeSessionTimerState = (stateById = {}, sessionId) => {
  const normalizedId = Number(sessionId || 0);
  if (!normalizedId || !stateById[normalizedId]) {
    return stateById;
  }

  const nextState = { ...stateById };
  delete nextState[normalizedId];
  return nextState;
};

export const pruneSessionTimerState = (stateById = {}, keepSessionIds = []) => {
  const keep = new Set(
    (Array.isArray(keepSessionIds) ? keepSessionIds : [])
      .map((sessionId) => Number(sessionId || 0))
      .filter((sessionId) => Number.isInteger(sessionId) && sessionId > 0)
  );

  if (!keep.size) return {};

  const nextState = {};
  for (const [key, value] of Object.entries(stateById || {})) {
    const sessionId = Number(key || 0);
    if (keep.has(sessionId)) {
      nextState[sessionId] = value;
    }
  }
  return nextState;
};
