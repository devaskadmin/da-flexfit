import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSessionTimerSnapshot,
  pruneSessionTimerState,
  removeSessionTimerState,
  upsertSessionTimerState,
} from './workoutSessionTimer.mjs';

const baseNow = Date.parse('2026-11-13T18:00:00.000Z');

const createSession = ({
  id,
  startedAtOffsetSeconds = 0,
  sessionStatus = 'in_progress',
  durationSeconds = 0,
}) => ({
  id,
  startedAt: new Date(baseNow - (startedAtOffsetSeconds * 1000)).toISOString(),
  sessionStatus,
  durationSeconds,
});

test('Session A and Session B maintain independent elapsed times', () => {
  const sessionA = createSession({ id: 101, startedAtOffsetSeconds: 1500, sessionStatus: 'in_progress' });
  const sessionB = createSession({ id: 202, startedAtOffsetSeconds: 720, sessionStatus: 'paused', durationSeconds: 720 });

  let state = {};
  state = upsertSessionTimerState(state, sessionA, baseNow);
  state = upsertSessionTimerState(state, sessionB, baseNow);

  assert.equal(state[101].elapsedSeconds, 1500);
  assert.equal(state[101].isPaused, false);
  assert.equal(state[202].elapsedSeconds, 720);
  assert.equal(state[202].isPaused, true);
});

test('Pausing Session A does not pause Session B', () => {
  const sessionA = createSession({ id: 11, startedAtOffsetSeconds: 300, sessionStatus: 'paused', durationSeconds: 300 });
  const sessionB = createSession({ id: 22, startedAtOffsetSeconds: 180, sessionStatus: 'in_progress' });

  let state = {};
  state = upsertSessionTimerState(state, sessionA, baseNow);
  state = upsertSessionTimerState(state, sessionB, baseNow);

  assert.equal(state[11].isPaused, true);
  assert.equal(state[11].shouldTick, false);
  assert.equal(state[22].isPaused, false);
  assert.equal(state[22].shouldTick, true);
});

test('Resuming Session A restores its own elapsed baseline', () => {
  const paused = createSession({ id: 31, startedAtOffsetSeconds: 600, sessionStatus: 'paused', durationSeconds: 600 });
  const resumed = createSession({ id: 31, startedAtOffsetSeconds: 600, sessionStatus: 'in_progress', durationSeconds: 600 });

  let state = {};
  state = upsertSessionTimerState(state, paused, baseNow);
  state = upsertSessionTimerState(state, resumed, baseNow + 5000);

  assert.equal(state[31].isPaused, false);
  assert.ok(state[31].elapsedSeconds >= 600);
});

test('Switching sessions does not reset another session timer', () => {
  const sessionA = createSession({ id: 41, startedAtOffsetSeconds: 120, sessionStatus: 'in_progress' });
  const sessionB = createSession({ id: 42, startedAtOffsetSeconds: 240, sessionStatus: 'in_progress' });

  let state = {};
  state = upsertSessionTimerState(state, sessionA, baseNow);
  const aBefore = state[41].elapsedSeconds;

  state = upsertSessionTimerState(state, sessionB, baseNow + 3000);
  state = upsertSessionTimerState(state, sessionA, baseNow + 6000);

  assert.ok(state[41].elapsedSeconds >= aBefore + 6);
  assert.ok(state[42].elapsedSeconds >= 243);
});

test('Refresh/recovery preserves persisted timer state floor', () => {
  const recovered = {
    id: 51,
    startedAt: new Date(baseNow - 300000).toISOString(),
    sessionStatus: 'in_progress',
    durationSeconds: 700,
  };

  const snapshot = createSessionTimerSnapshot(null, recovered, baseNow);
  assert.ok(snapshot.elapsedSeconds >= 700);
});

test('Repeated updates remain monotonic and do not duplicate elapsed jumps', () => {
  const session = createSession({ id: 61, startedAtOffsetSeconds: 90, sessionStatus: 'in_progress' });
  let state = {};

  state = upsertSessionTimerState(state, session, baseNow);
  const first = state[61].elapsedSeconds;

  state = upsertSessionTimerState(state, session, baseNow + 1000);
  const second = state[61].elapsedSeconds;

  state = upsertSessionTimerState(state, session, baseNow + 2000);
  const third = state[61].elapsedSeconds;

  assert.equal(second - first, 1);
  assert.equal(third - second, 1);
});

test('Ending Session A does not affect Session B', () => {
  const sessionA = createSession({ id: 71, startedAtOffsetSeconds: 450, sessionStatus: 'in_progress' });
  const sessionB = createSession({ id: 72, startedAtOffsetSeconds: 225, sessionStatus: 'in_progress' });

  let state = {};
  state = upsertSessionTimerState(state, sessionA, baseNow);
  state = upsertSessionTimerState(state, sessionB, baseNow);
  const bBefore = state[72].elapsedSeconds;

  state = removeSessionTimerState(state, 71);
  assert.equal(state[71], undefined);
  assert.equal(state[72].elapsedSeconds, bBefore);
});

test('Completed sessions do not continue accumulating', () => {
  const completed = createSession({ id: 81, startedAtOffsetSeconds: 1200, sessionStatus: 'completed', durationSeconds: 1200 });

  let state = {};
  state = upsertSessionTimerState(state, completed, baseNow);
  const first = state[81].elapsedSeconds;
  assert.equal(state[81].shouldTick, false);

  state = upsertSessionTimerState(state, completed, baseNow + 10000);
  const second = state[81].elapsedSeconds;

  assert.equal(second, first);
});

test('Prune keeps only expected session IDs', () => {
  const s1 = createSession({ id: 91, startedAtOffsetSeconds: 10 });
  const s2 = createSession({ id: 92, startedAtOffsetSeconds: 20 });
  const s3 = createSession({ id: 93, startedAtOffsetSeconds: 30 });

  let state = {};
  state = upsertSessionTimerState(state, s1, baseNow);
  state = upsertSessionTimerState(state, s2, baseNow);
  state = upsertSessionTimerState(state, s3, baseNow);

  const pruned = pruneSessionTimerState(state, [91, 93]);
  assert.ok(pruned[91]);
  assert.equal(pruned[92], undefined);
  assert.ok(pruned[93]);
});
