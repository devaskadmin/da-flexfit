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
