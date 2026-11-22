import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.85.313.a4: Schedule Planner is unified (no Day View / Week View tabs). Source-contract checks only.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, 'WorkoutBuilder.vue'), 'utf8');
const templateEnd = source.indexOf('<script setup');
const template = source.slice(0, templateEnd > 0 ? templateEnd : source.indexOf('<style'));
const script = source.slice(source.indexOf('<script setup'), source.indexOf('<style'));
const plannerStart = template.indexOf('<section class="planner-shell">');
const plannerEnd = template.indexOf('planner-shell--publication');
const plannerTemplate = template.slice(plannerStart, plannerEnd);

test('the Day View and Week View tabs and the mode switch are gone', () => {
  assert.equal(plannerStart > 0 && plannerEnd > plannerStart, true);
  assert.equal(/Day View|Week View/.test(template), false);
  assert.equal(plannerTemplate.includes('planner-mode-toggle'), false);
  assert.equal(plannerTemplate.includes('planner-mode-btn'), false);
  assert.equal(source.includes('changeScheduleMode'), false);
});

test('the planner is still one Schedule Planner section of workout day cards', () => {
  assert.match(plannerTemplate, /<h3>Schedule Planner<\/h3>/);
  assert.match(plannerTemplate, /v-for="day in accordionGroupsWithExercises"/);
  assert.match(plannerTemplate, /'workout-day-card'/);
});

test('Add Day, Add Exercise and the bottom controls are preserved', () => {
  assert.match(plannerTemplate, /id="planner-add-day-input"/);
  assert.match(plannerTemplate, /@click="addScheduleGroup"/);
  assert.match(plannerTemplate, /Add Exercise<\/span>/);
  assert.match(plannerTemplate, /Add Exercise to End/);
  assert.match(plannerTemplate, /v-if="showBottomScheduleGroupControls"/);
  assert.match(plannerTemplate, /@click="addScheduleGroupBottom"/);
  assert.match(plannerTemplate, /Duplicate Day/);
  assert.match(plannerTemplate, /Delete Day/);
  assert.match(script, /const showBottomScheduleGroupControls = computed/);
});

test('no week dropdown or Rename Week control is added yet', () => {
  assert.equal(/Rename Week/i.test(template), false);
  assert.equal(/<select[^>]*week/i.test(plannerTemplate), false);
});

test('the builder never leaves day mode, so day cards are always shown', () => {
  assert.match(script, /const scheduleMode = ref\('day'\)/);
  const assignments = script.match(/scheduleMode\.value\s*=\s*[^;]+;/g) || [];
  assert.equal(assignments.length > 0, true);
  assignments.forEach((entry) => assert.equal(entry, "scheduleMode.value = 'day';"));
});

test('saving still sends both group sets, their orders, the assignments and every exercise', () => {
  const payloadStart = script.indexOf('const plannerPayload = computed');
  const payload = script.slice(payloadStart, script.indexOf('}));', payloadStart));
  ['dayGroups: dayGroups.value', 'weekGroups: weekGroups.value', 'dayGroupOrders', 'weekGroupOrders',
    'settings: buildDayWeekAssignmentsSettings(dayWeekAssignments.value)', 'exercises: workoutExercises.value',
  ].forEach((needle) => assert.equal(payload.includes(needle), true, needle));
});

test('legacy plans load with their week set, assignments and exercises restored', () => {
  const hydrateStart = script.indexOf('const hydratePlanner = (');
  const hydrate = script.slice(hydrateStart, script.indexOf('const clearSelection = async', hydrateStart));
  assert.match(hydrate, /weekGroups\.value = sortGroupsByOrder\(incomingWeekGroups, incomingWeekOrders\)/);
  assert.match(hydrate, /dayWeekAssignments\.value = readSavedDayWeekAssignments\(planner\)/);
  assert.match(hydrate, /appendMissingGroups\(dayGroups\.value\)/);
});

test('the Workout Plan Information form is not part of the planner section', () => {
  assert.equal(plannerTemplate.includes('Workout Plan Information'), false);
  assert.equal(fs.readFileSync(path.join(__dirname, '../../components/workout-builder/WorkoutMetadataForm.vue'), 'utf8').includes('Workout Plan Information'), true);
});
