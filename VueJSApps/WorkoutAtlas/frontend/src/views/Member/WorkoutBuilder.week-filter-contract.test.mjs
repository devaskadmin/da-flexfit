import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.85.313.a8: week filtering of the day cards and day assignment. Source-contract checks only.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, 'WorkoutBuilder.vue'), 'utf8');
const scriptStart = source.indexOf('<script setup');
const scriptEnd = source.indexOf('</script>');
const templateStart = source.indexOf('<template>', scriptEnd);
const styleStart = source.indexOf('<style');
const template = source.slice(templateStart, styleStart);
const script = source.slice(scriptStart, scriptEnd);
const plannerTemplate = template.slice(template.indexOf('<section class="planner-shell">'));

const bodyOf = (text, startMarker, endMarker) => {
  const start = text.indexOf(startMarker);
  assert.equal(start >= 0, true, `missing ${startMarker}`);
  return text.slice(start, text.indexOf(endMarker, start));
};

test('visibleDayGroups filters the active days by the selected week through the shared helper', () => {
  const body = bodyOf(script, 'const visibleDayGroups = computed', '\n});');
  assert.match(body, /getDaysForWeek\(/);
  assert.match(body, /dayGroups: activeGroups\.value/);
  assert.match(body, /assignments: dayWeekAssignments\.value/);
  assert.match(body, /week: selectedWeek\.value/);
});

test('the day cards are built from the visible days only', () => {
  const body = bodyOf(script, 'const workoutDaysWithExercises = computed', '\n});');
  assert.match(body, /visibleDayGroups\.value\.map/);
  assert.equal(body.includes('activeGroups'), false);
  assert.match(plannerTemplate, /v-for="day in accordionGroupsWithExercises"/);
  assert.match(plannerTemplate, /v-if="visibleDayGroups\.length === 0"/);
  assert.match(plannerTemplate, /\{\{ plannerEmptyStateText \}\}/);
});

test('new days are assigned to the selected week from the shared handler used by top and bottom Add Day', () => {
  const body = bodyOf(script, 'const addScheduleGroupFromValue', '\nconst addScheduleGroup =');
  assert.match(body, /dayWeekAssignments\.value = assignDayToWeek\(dayWeekAssignments\.value, groupKeyName, selectedWeek\.value\)/);
  assert.match(bodyOf(script, 'const addScheduleGroup = ', '\nconst addScheduleGroupBottom'), /addScheduleGroupFromValue\(/);
  assert.match(bodyOf(script, 'const addScheduleGroupBottom = ', '\nconst setActiveDay'), /addScheduleGroupFromValue\(/);
  assert.match(plannerTemplate, /@click="addScheduleGroup"/);
  assert.match(plannerTemplate, /@click="addScheduleGroupBottom"/);
});

test('identical day names are rejected only inside the same week, with a message naming that week (a8.1)', () => {
  const body = bodyOf(script, 'const addScheduleGroupFromValue', '\nconst addScheduleGroup =');
  assert.match(body, /findDayWithLabelInWeek\(/);
  assert.match(body, /buildDuplicateDayMessage\(\{ name, week: selectedWeek\.value \}\)/);
  assert.match(body, /buildUniqueDayKey\(/);
});

test('switching weeks changes only the display: no plan data, saves or selected day are touched', () => {
  const watcher = bodyOf(script, 'watch(selectedWeek, (week) => {', '\n});');
  const withoutViewState = watcher.replace(/visibleDayGroups/g, '');
  assert.equal(/dayGroups|weekGroups|workoutExercises|dayWeekAssignments|selectedScheduleGroup|fetch\(|save|persist/i.test(withoutViewState), false);
  assert.match(watcher, /setExpandedGroupId\('day'/);
  assert.match(watcher, /cancelWeekRename\(\)/);
});

test('the save payload still carries every week, day, assignment and exercise', () => {
  const payload = bodyOf(script, 'const plannerPayload = computed', '}));');
  assert.equal(payload.includes('visibleDayGroups'), false);
  assert.match(payload, /dayGroups/);
  assert.match(payload, /weekGroups/);
  assert.match(payload, /dayWeekAssignments|buildDayWeekAssignmentsSettings/);
  assert.match(payload, /exercises/);
});

test('expanded and selected days come from the visible days only', () => {
  const body = bodyOf(script, 'const ensureAccordionSelectionForMode', '\n};');
  assert.match(body, /visibleDayGroups\.value/);
  assert.match(body, /candidates\.some\(/);
});

test('move, first/last and multi-day checks follow the visible days', () => {
  assert.match(script, /moveDayAmongVisible\(/);
  assert.match(script, /const hasMultipleScheduleGroups = computed\(\(\) => visibleDayGroups\.value\.length > 1\)/);
  const first = bodyOf(script, 'const isFirstScheduleGroup', '\n};');
  const last = bodyOf(script, 'const isLastScheduleGroup', '\n};');
  assert.match(first, /visibleDayGroups/);
  assert.match(last, /visibleDayGroups/);
});

test('bottom Add Day / Add Week controls look at the visible days and their exercises', () => {
  const body = bodyOf(script, 'const showBottomScheduleGroupControls', '\n});');
  assert.match(body, /visibleDayGroups\.value\.length < 1/);
  assert.match(body, /workoutDaysWithExercises\.value\.flatMap/);
});

test('renaming a week only moves the selection when the renamed week is the selected one', () => {
  const body = bodyOf(script, 'const saveWeekRename', '\n};');
  assert.match(body, /normalizeGroupKey\(selectedWeek\.value\) === normalizeGroupKey\(oldName\)/);
  assert.match(body, /selectedWeek\.value = validation\.value;/);
});

test('Add Week, Rename Week and the day-card actions are still in place', () => {
  ['@click="addWeek"', 'startWeekRename', 'saveWeekRename', 'duplicateScheduleGroup(day.name)', 'moveScheduleGroupUp(day.name)', 'moveScheduleGroupDown(day.name)', 'Add Exercise to End']
    .forEach((needle) => assert.equal(plannerTemplate.includes(needle), true, needle));
  assert.match(script, /const canAddWeek = computed/);
});

test('the day-card view filter is not wired into the preview', () => {
  const body = bodyOf(script, 'const plannerGroupsWithExercises', '\n});');
  assert.equal(body.includes('visibleDayGroups'), false);
});
