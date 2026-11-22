import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureDefaultWorkoutWeek,
  normalizeWeekAssignments,
  validateAdditionalWeekCreation,
} from './workoutWeekAssignments.mjs';

test('ensureDefaultWorkoutWeek initializes and reuses Week 1', () => {
  assert.deepEqual(ensureDefaultWorkoutWeek([]), ['Week 1']);
  assert.deepEqual(ensureDefaultWorkoutWeek(['Week 1', 'Week 2']), ['Week 1', 'Week 2']);
  assert.deepEqual(ensureDefaultWorkoutWeek(['Custom Week']), ['Week 1', 'Custom Week']);
});

test('normalizeWeekAssignments assigns unassigned days to Week 1 without overwriting valid assignments', () => {
  const assignments = normalizeWeekAssignments(
    { Monday: 'Week 2', Friday: 'Missing Week' },
    ['Monday', 'Friday', 'Wednesday'],
    ['Week 1', 'Week 2'],
  );
  assert.deepEqual(assignments, { Monday: 'Week 2', Friday: 'Week 1', Wednesday: 'Week 1' });
});

test('additional week validation requires a day and exercise in selected week', () => {
  assert.equal(validateAdditionalWeekCreation({ weekName: '', dayGroups: ['Monday'], weekAssignments: { Monday: 'Week 1' }, exercises: [{ scheduleGroup: 'Monday' }] }).ok, false);
  assert.equal(validateAdditionalWeekCreation({ weekName: 'Week 1', dayGroups: [], weekAssignments: {}, exercises: [] }).ok, false);
  assert.equal(validateAdditionalWeekCreation({ weekName: 'Week 1', dayGroups: ['Monday'], weekAssignments: { Monday: 'Week 1' }, exercises: [] }).ok, false);
  assert.equal(validateAdditionalWeekCreation({ weekName: 'Week 1', dayGroups: ['Monday'], weekAssignments: { Monday: 'Week 1' }, exercises: [{ scheduleGroup: 'Monday' }] }).ok, true);
});
