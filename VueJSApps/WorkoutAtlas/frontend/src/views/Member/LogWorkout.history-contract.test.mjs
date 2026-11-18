import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const logWorkoutPath = path.resolve(process.cwd(), 'src/views/Member/LogWorkout.vue');

test('opening history tab does not force workout-log session writes', async () => {
  const source = await readFile(logWorkoutPath, 'utf8');

  const openHistoryTabMatch = source.match(/const openHistoryTab = async \(\) => \{([\s\S]*?)\n\};/);
  assert.ok(openHistoryTabMatch, 'openHistoryTab definition should exist');

  const openHistoryBody = openHistoryTabMatch[1];
  assert.ok(
    !openHistoryBody.includes('flushWorkoutSetProgressPersistence'),
    'openHistoryTab must not trigger flushWorkoutSetProgressPersistence()'
  );

  assert.ok(
    openHistoryBody.includes("activeTab.value = 'workoutHistory'"),
    'openHistoryTab should still switch to workoutHistory tab'
  );
  assert.ok(
    openHistoryBody.includes('loadWorkoutHistory();'),
    'openHistoryTab should load history data'
  );
});
