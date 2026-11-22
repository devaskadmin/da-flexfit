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
  readSavedDayWeekAssignments,
  buildDayWeekAssignmentsSettings,
  serializeDayWeekAssignments,
  buildWeekOptions,
  resolveSelectedWeek,
  weekHasDayWithExercise,
  buildNextWeekName,
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
  assert.match(hydrateBlock, /dayWeekAssignments\.value = readSavedDayWeekAssignments\(planner\);/);
  assert.match(hydrateBlock, /reconcileDayWeekAssignmentState\(\);/);
  assert.equal(/fetch\(|persistWorkout|saveWorkout|router\./.test(hydrateBlock), false);
});

test('saved assignments are read from planner.settings and malformed input is ignored', () => {
  assert.deepEqual(
    readSavedDayWeekAssignments({ settings: { dayWeekAssignments: { Monday: ' Week 2 ', '': 'Week 1', tuesday: 5, __proto__: 'x', constructor: 'y' } } }),
    { monday: 'Week 2' }
  );
  assert.deepEqual(readSavedDayWeekAssignments({}), {});
  assert.deepEqual(readSavedDayWeekAssignments(null), {});
  assert.deepEqual(readSavedDayWeekAssignments({ settings: { dayWeekAssignments: ['Week 1'] } }), {});
  assert.deepEqual(readSavedDayWeekAssignments({ settings: { dayWeekAssignments: 'Week 1' } }), {});
});

test('restored assignments keep valid weeks, drop stale ones and default unassigned days', () => {
  const saved = readSavedDayWeekAssignments({
    settings: { dayWeekAssignments: { monday: 'Week 2', tuesday: 'Gone', ghost: 'Week 1' } },
  });
  const result = reconcileDayWeekAssignments({
    dayGroups: ['Monday', 'Tuesday', 'Wednesday'],
    weekGroups: ['Week 1', 'Week 2'],
    assignments: saved,
  });
  assert.deepEqual(result.assignments, { monday: 'Week 2', tuesday: 'Week 1', wednesday: 'Week 1' });
});

test('save payload settings carry a copy of the assignments and dirty snapshot ignores key order', () => {
  const assignments = { monday: 'Week 2', friday: 'Week 1' };
  const settings = buildDayWeekAssignmentsSettings(assignments);
  assert.deepEqual(settings, { dayWeekAssignments: assignments });
  assert.notEqual(settings.dayWeekAssignments, assignments);
  assert.equal(
    serializeDayWeekAssignments({ friday: 'Week 1', monday: 'Week 2' }),
    serializeDayWeekAssignments({ monday: 'Week 2', friday: 'Week 1' })
  );
  assert.notEqual(serializeDayWeekAssignments({ monday: 'Week 1' }), serializeDayWeekAssignments({ monday: 'Week 2' }));
});

test('0.85.313.a3 builder sends assignments in the payload and tracks them for unsaved changes', () => {
  const payloadStart = source.indexOf('const plannerPayload = computed');
  const payloadBlock = source.slice(payloadStart, source.indexOf('}));', payloadStart));
  assert.match(payloadBlock, /settings: buildDayWeekAssignmentsSettings\(dayWeekAssignments\.value\),/);
  const dirtyStart = source.indexOf('return JSON.stringify({', source.indexOf('const buildPlannerDirtyState'));
  const dirtyBlock = source.slice(dirtyStart, source.indexOf('const markPlannerStateCommitted', dirtyStart));
  assert.match(dirtyBlock, /dayWeekAssignments: serializeDayWeekAssignments\(dayWeekAssignments\.value\),/);
});

test('week options come from existing weeks only and label Week 1 as the default', () => {
  assert.deepEqual(buildWeekOptions(['Week 1', 'Week 2']), [
    { value: 'Week 1', label: 'Week 1 (Default)' },
    { value: 'Week 2', label: 'Week 2' },
  ]);
  assert.deepEqual(buildWeekOptions(['Phase A', 'Phase B']), [
    { value: 'Phase A', label: 'Phase A' },
    { value: 'Phase B', label: 'Phase B' },
  ]);
  assert.deepEqual(buildWeekOptions(['Week 1', ' week 1 ', '', 'Week 2']).map((o) => o.value), ['Week 1', 'Week 2']);
  assert.deepEqual(buildWeekOptions([]), []);
  assert.deepEqual(buildWeekOptions(undefined), []);
});

test('the stored week name stays "Week 1"; only the label changes', () => {
  const [option] = buildWeekOptions(['Week 1']);
  assert.equal(option.value, 'Week 1');
  assert.equal(option.label, 'Week 1 (Default)');
  const weeks = ['Week 1'];
  buildWeekOptions(weeks);
  assert.deepEqual(weeks, ['Week 1']);
});

test('selected week is Week 1, else the first week, and an existing choice is kept', () => {
  assert.equal(resolveSelectedWeek(['Week 2', 'Week 1']), 'Week 1');
  assert.equal(resolveSelectedWeek(['Phase B', 'Phase A']), 'Phase B');
  assert.equal(resolveSelectedWeek(['Week 1', 'Week 2'], 'Week 2'), 'Week 2');
  assert.equal(resolveSelectedWeek(['Week 1', 'Week 2'], 'week 2'), 'Week 2');
  assert.equal(resolveSelectedWeek(['Week 1', 'Week 2'], 'Gone'), 'Week 1');
  assert.equal(resolveSelectedWeek(['Phase A'], 'Week 1'), 'Phase A');
  assert.equal(resolveSelectedWeek([], 'Week 1'), '');
});

test('0.85.313.a5 builder keeps the week selection as UI-only state', () => {
  assert.match(source, /const selectedWeek = ref\(''\)/);
  assert.match(source, /const weekOptions = computed\(\(\) => buildWeekOptions\(weekGroups\.value\)\)/);
  const payloadStart = source.indexOf('const plannerPayload = computed');
  const payloadBlock = source.slice(payloadStart, source.indexOf('}));', payloadStart));
  assert.equal(payloadBlock.includes('selectedWeek'), false);
  const dirtyStart = source.indexOf('const buildPlannerDirtyState');
  const dirtyBlock = source.slice(dirtyStart, source.indexOf('const markPlannerStateCommitted', dirtyStart));
  assert.equal(dirtyBlock.includes('selectedWeek'), false);
  const storeStart = source.indexOf('const storeUnsavedBuilderDraft');
  const storeBlock = source.slice(storeStart, source.indexOf('const restoreUnsavedBuilderDraft', storeStart));
  assert.equal(storeBlock.includes('selectedWeek'), false);
});

const ex = (name, scheduleGroup) => ({ exerciseId: name.length * 7, name, scheduleGroup });

test('Add Week is allowed only when the selected week has a day with an exercise', () => {
  const base = { dayGroups: ['Monday', 'Tuesday'], assignments: { monday: 'Week 1', tuesday: 'Week 1' } };
  assert.equal(weekHasDayWithExercise({ ...base, week: 'Week 1', exercises: [ex('Squat', 'Monday')] }), true);
  assert.equal(weekHasDayWithExercise({ ...base, week: 'Week 1', exercises: [] }), false);
  assert.equal(weekHasDayWithExercise({ ...base, week: 'Week 1', exercises: [ex('Squat', 'Friday')] }), false);
  assert.equal(weekHasDayWithExercise({ ...base, week: '', exercises: [ex('Squat', 'Monday')] }), false);
  assert.equal(weekHasDayWithExercise({ ...base, week: 'Week 1', exercises: null }), false);
  assert.equal(weekHasDayWithExercise(), false);
});

test('Add Week looks only at the selected week, not the whole plan', () => {
  const state = {
    dayGroups: ['Monday', 'Tuesday', 'Wednesday'],
    assignments: { monday: 'Week 1', tuesday: 'Week 2', wednesday: 'Week 2' },
    exercises: [ex('Squat', 'Monday'), ex('Bench', 'Tuesday')],
  };
  assert.equal(weekHasDayWithExercise({ ...state, week: 'Week 1' }), true);
  assert.equal(weekHasDayWithExercise({ ...state, week: 'Week 2' }), true);
  // Week 2 has no exercise in any of its days, even though the plan does.
  const emptyWeek2 = { ...state, exercises: [ex('Squat', 'Monday')] };
  assert.equal(weekHasDayWithExercise({ ...emptyWeek2, week: 'Week 2' }), false);
  // A week with no assigned day is never eligible.
  assert.equal(weekHasDayWithExercise({ ...state, week: 'Week 3' }), false);
  // Selected-week matching ignores case.
  assert.equal(weekHasDayWithExercise({ ...state, week: 'week 1' }), true);
});

test('Add Week uses the caller exercise counting rule and ignores unnamed exercises', () => {
  const count = (list) => list.filter((item) => item.name).length;
  const input = { week: 'Week 1', dayGroups: ['Monday'], assignments: { monday: 'Week 1' }, countExercises: count };
  assert.equal(weekHasDayWithExercise({ ...input, exercises: [{ scheduleGroup: 'Monday' }] }), false);
  assert.equal(weekHasDayWithExercise({ ...input, exercises: [ex('Squat', 'Monday')] }), true);
});

test('Add Week ignores inherited assignment keys and does not mutate its inputs', () => {
  const assignments = { monday: 'Week 1' };
  const exercises = [ex('Squat', 'constructor')];
  assert.equal(weekHasDayWithExercise({ week: 'Week 1', dayGroups: ['constructor'], assignments, exercises }), false);
  assert.deepEqual(assignments, { monday: 'Week 1' });
  assert.equal(exercises.length, 1);
});

test('the next week name is the first unused Week N from 2', () => {
  assert.equal(buildNextWeekName(['Week 1']), 'Week 2');
  assert.equal(buildNextWeekName(['Week 1', 'Week 2']), 'Week 3');
  assert.equal(buildNextWeekName(['Week 1', 'week 2', 'Week 3']), 'Week 4');
  assert.equal(buildNextWeekName(['Week 1', 'Week 3']), 'Week 2');
  assert.equal(buildNextWeekName(['Phase A', 'Phase B']), 'Week 2');
  assert.equal(buildNextWeekName([]), 'Week 2');
  assert.equal(buildNextWeekName(undefined), 'Week 2');
});

test('adding a week leaves existing weeks, days, exercises and assignments alone', () => {
  const weeks = ['Week 1'];
  const assignments = { monday: 'Week 1' };
  const exercises = [ex('Squat', 'Monday')];
  const next = [...weeks, buildNextWeekName(weeks)];
  assert.deepEqual(next, ['Week 1', 'Week 2']);
  const result = reconcileDayWeekAssignments({ dayGroups: ['Monday'], weekGroups: next, assignments });
  assert.equal(result.changed, false);
  assert.deepEqual(result.assignments, { monday: 'Week 1' });
  assert.equal(weekHasDayWithExercise({ week: 'Week 2', dayGroups: ['Monday'], assignments: result.assignments, exercises }), false);
  assert.deepEqual(weeks, ['Week 1']);
});
