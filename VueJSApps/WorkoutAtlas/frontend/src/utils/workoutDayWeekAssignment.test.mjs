import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reconcileDayWeekAssignments,
  renameDayInAssignments,
  renameWeekInAssignments,
  copyDayAssignment,
  resolveDefaultWeek,
} from './workoutDayWeekAssignment.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '../views/Member/WorkoutBuilder.vue'), 'utf8');

test('default week prefers Week 1, then the first existing week, then none', () => {
  assert.equal(resolveDefaultWeek(['Phase A', 'week 1']), 'week 1');
  assert.equal(resolveDefaultWeek(['Phase A', 'Phase B']), 'Phase A');
  assert.equal(resolveDefaultWeek([]), '');
});

test('unassigned days default to Week 1', () => {
  const result = reconcileDayWeekAssignments({ dayGroups: ['Monday', 'Tuesday'], weekGroups: ['Week 1', 'Week 2'] });
  assert.deepEqual(result.assignments, { monday: 'Week 1', tuesday: 'Week 1' });
  assert.equal(result.defaultedCount, 2);
});

test('unassigned days default to the first existing week when Week 1 is absent', () => {
  const result = reconcileDayWeekAssignments({ dayGroups: ['Push'], weekGroups: ['Phase A', 'Phase B'] });
  assert.deepEqual(result.assignments, { push: 'Phase A' });
});

test('valid assignments and custom week names are preserved', () => {
  const assignments = { monday: 'Phase B', tuesday: 'Phase A' };
  const result = reconcileDayWeekAssignments({
    dayGroups: ['Monday', 'Tuesday', 'Friday'],
    weekGroups: ['Phase A', 'Phase B'],
    assignments,
  });
  assert.deepEqual(result.assignments, { monday: 'Phase B', tuesday: 'Phase A', friday: 'Phase A' });
});

test('stale entries are dropped and invalid weeks fall back to the default', () => {
  const result = reconcileDayWeekAssignments({
    dayGroups: ['Monday'],
    weekGroups: ['Week 1'],
    assignments: { monday: 'Removed Week', ghost: 'Week 1' },
  });
  assert.deepEqual(result.assignments, { monday: 'Week 1' });
});

test('each day is assigned once even if names differ only by case', () => {
  const result = reconcileDayWeekAssignments({ dayGroups: ['Monday', 'monday', ' MONDAY '], weekGroups: ['Week 1'] });
  assert.deepEqual(Object.keys(result.assignments), ['monday']);
});

test('reconciliation is idempotent and returns the same object when unchanged', () => {
  const first = reconcileDayWeekAssignments({ dayGroups: ['Monday'], weekGroups: ['Week 1'] });
  const second = reconcileDayWeekAssignments({ dayGroups: ['Monday'], weekGroups: ['Week 1'], assignments: first.assignments });
  assert.equal(second.changed, false);
  assert.equal(second.assignments, first.assignments);
  assert.equal(second.defaultedCount, 0);
});

test('no day cards or weeks are invented and inputs are not mutated', () => {
  const days = ['Monday'];
  const weeks = ['Week 1'];
  const result = reconcileDayWeekAssignments({ dayGroups: days, weekGroups: weeks });
  assert.deepEqual(days, ['Monday']);
  assert.deepEqual(weeks, ['Week 1']);
  assert.deepEqual(Object.keys(result.assignments), ['monday']);
  assert.deepEqual(reconcileDayWeekAssignments({ dayGroups: ['Monday'], weekGroups: [] }).assignments, {});
});

test('rename and copy keep a day or week assignment', () => {
  assert.deepEqual(renameDayInAssignments({ monday: 'Week 2' }, 'Monday', 'Leg Day'), { 'leg day': 'Week 2' });
  assert.deepEqual(renameWeekInAssignments({ monday: 'Week 2', friday: 'Week 1' }, 'Week 2', 'Deload'), { monday: 'Deload', friday: 'Week 1' });
  assert.deepEqual(copyDayAssignment({ monday: 'Week 2' }, 'Monday', 'Monday Copy'), { monday: 'Week 2', 'monday copy': 'Week 2' });
});

test('WorkoutBuilder wires the day-to-week mapping without touching exercises or saving', () => {
  assert.match(source, /from '@\/utils\/workoutDayWeekAssignment\.mjs'/);
  assert.equal(source.includes('assignUnassignedExercisesToDefaultWeek'), false);
  assert.match(source, /const dayWeekAssignments = ref\(\{\}\)/);

  const reconcileStart = source.indexOf('const reconcileDayWeekAssignmentState');
  const reconcileEnd = source.indexOf('};', reconcileStart);
  const reconcileBlock = source.slice(reconcileStart, reconcileEnd);
  assert.notEqual(reconcileStart, -1);
  assert.equal(/workoutExercises|fetch\(|scheduleGroup|dayGroups\.value\s*=|weekGroups\.value\s*=/.test(reconcileBlock), false);

  const hydrateStart = source.indexOf('const hydratePlanner = (');
  const hydrateEnd = source.indexOf('const clearSelection = async', hydrateStart);
  const hydrateBlock = source.slice(hydrateStart, hydrateEnd);
  assert.match(hydrateBlock, /dayWeekAssignments\.value = \{\};/);
  assert.match(hydrateBlock, /reconcileDayWeekAssignmentState\(\);/);
  assert.equal(/fetch\(|persistWorkout|saveWorkout|router\./.test(hydrateBlock), false);
});

test('day-to-week mapping is not part of the saved payload or dirty state', () => {
  const dirtyStart = source.indexOf('return JSON.stringify({', source.indexOf('const buildPlannerDirtyState'));
  const dirtyBlock = source.slice(dirtyStart, source.indexOf('const markPlannerStateCommitted', dirtyStart));
  assert.equal(dirtyBlock.includes('dayWeekAssignments'), false);
});
