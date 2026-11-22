import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.85.313.a6: Add Week beside the Week dropdown. Source-contract checks only.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, 'WorkoutBuilder.vue'), 'utf8');
const scriptEnd = source.indexOf('</script>');
const script = source.slice(source.indexOf('<script setup'), scriptEnd);
const template = source.slice(source.indexOf('<template>', scriptEnd), source.indexOf('<style'));
const plannerTemplate = template.slice(template.indexOf('<section class="planner-shell">'));
const weekBlockStart = plannerTemplate.indexOf('class="planner-week-select"');
const weekBlock = plannerTemplate.slice(weekBlockStart, plannerTemplate.indexOf('class="planner-group-editor"'));
const addWeekBlock = script.slice(script.indexOf('const addWeek = () =>'), script.indexOf('const addWeek = () =>') + 600);

test('the Add Week button sits beside the Week dropdown, above Add Day and the day cards', () => {
  assert.equal(weekBlockStart > 0, true);
  const selectAt = weekBlock.indexOf('id="planner-week-select"');
  const buttonAt = weekBlock.indexOf('@click="addWeek"');
  assert.equal(selectAt > 0 && buttonAt > selectAt, true);
  assert.match(weekBlock, /\+ Add Week/);
  assert.equal(plannerTemplate.indexOf('@click="addWeek"') < plannerTemplate.indexOf('id="planner-add-day-input"'), true);
  assert.equal(plannerTemplate.indexOf('@click="addWeek"') < plannerTemplate.indexOf('v-for="day in accordionGroupsWithExercises"'), true);
});

test('the button is disabled unless Add Week is allowed, and the dropdown is never disabled', () => {
  assert.match(weekBlock, /:disabled="!canAddWeek"/);
  const selectTag = weekBlock.slice(weekBlock.indexOf('<select'), weekBlock.indexOf('</select>'));
  assert.equal(/disabled/.test(selectTag), false);
  assert.match(weekBlock, /v-model="selectedWeek"/);
});

test('eligibility checks only the selected week, through the selected week assignments', () => {
  const start = script.indexOf('const canAddWeek = computed');
  const block = script.slice(start, script.indexOf('const addWeek = () =>'));
  assert.match(block, /weekHasDayWithExercise\(\{/);
  assert.match(block, /week: selectedWeek\.value/);
  assert.match(block, /assignments: dayWeekAssignments\.value/);
  assert.match(block, /exercises: workoutExercises\.value/);
  assert.match(block, /countExercises: countUniqueWorkoutPlanExercises/);
  assert.match(block, /canModifyScheduleDayActions\.value/);
});

test('adding a week appends a generated name, selects it and touches nothing else', () => {
  assert.match(addWeekBlock, /if \(!canAddWeek\.value\) \{\s*return;\s*\}/);
  assert.match(addWeekBlock, /buildNextWeekName\(weekGroups\.value\)/);
  assert.match(addWeekBlock, /weekGroups\.value = \[\.\.\.weekGroups\.value, name\];/);
  assert.match(addWeekBlock, /syncGroupOrders\('week', weekGroups\.value\);/);
  assert.match(addWeekBlock, /selectedWeek\.value = name;/);
  const body = addWeekBlock.slice(0, addWeekBlock.indexOf('\n};'));
  assert.equal(/workoutExercises|dayGroups|dayWeekAssignments|fetch\(|persist|saveWorkout|router\./.test(body), false);
});

test('a new week gets no days or exercises: assignments are not edited by the handler', () => {
  const body = addWeekBlock.slice(0, addWeekBlock.indexOf('\n};'));
  assert.equal(body.includes('dayWeekAssignments'), false);
  assert.equal(body.includes('scheduleGroup'), false);
});

test('the new week is part of the unsaved-change snapshot and the save payload through weekGroups', () => {
  const payloadStart = script.indexOf('const plannerPayload = computed');
  const payload = script.slice(payloadStart, script.indexOf('}));', payloadStart));
  assert.match(payload, /weekGroups: weekGroups\.value/);
  assert.match(payload, /weekGroupOrders: buildOrderEntries\(weekGroups\.value\)/);
  const dirtyStart = script.indexOf('const buildPlannerDirtyState');
  const dirty = script.slice(dirtyStart, script.indexOf('const markPlannerStateCommitted', dirtyStart));
  assert.match(dirty, /weekGroups: Array\.isArray\(weekGroups\.value\)/);
});

test('day filtering is not added; earlier controls remain', () => {
  assert.equal(template.indexOf('Rename Week') > template.indexOf('</WorkoutMetadataForm>'), true);
  const cardsStart = script.indexOf('const accordionGroupsWithExercises');
  assert.equal(script.slice(cardsStart, cardsStart + 1500).includes('selectedWeek'), false);
  assert.equal(script.includes('const changeScheduleMode'), false);
  ['id="planner-add-day-input"', '@click="addScheduleGroup"', 'Add Exercise to End', 'v-if="showBottomScheduleGroupControls"', 'id="planner-week-select"'].forEach((needle) =>
    assert.equal(plannerTemplate.includes(needle), true, needle)
  );
});

test('nothing above Workout Plan Information is touched', () => {
  const formEnd = template.indexOf('</WorkoutMetadataForm>');
  assert.equal(formEnd > 0 && template.indexOf('@click="addWeek"') > formEnd, true);
  assert.equal(template.slice(0, formEnd).includes('addWeek'), false);
});
