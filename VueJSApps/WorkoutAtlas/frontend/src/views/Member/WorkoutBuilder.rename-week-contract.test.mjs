import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.85.313.a7: Rename Week menu beside the Week dropdown. Source-contract checks only.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, 'WorkoutBuilder.vue'), 'utf8');
const scriptEnd = source.indexOf('</script>');
const script = source.slice(source.indexOf('<script setup'), scriptEnd);
const template = source.slice(source.indexOf('<template>', scriptEnd), source.indexOf('<style'));
const plannerTemplate = template.slice(template.indexOf('<section class="planner-shell">'));
const weekBlock = plannerTemplate.slice(
  plannerTemplate.indexOf('class="planner-week-select"'),
  plannerTemplate.indexOf('class="planner-group-editor"')
);

const sliceFn = (startMarker, endMarker) => {
  const start = script.indexOf(startMarker);
  assert.equal(start > 0, true, startMarker);
  return script.slice(start, script.indexOf(endMarker, start));
};
const saveRename = sliceFn('const saveWeekRename = () => {', 'const isFirstScheduleGroup');

test('a three-dot menu with Rename Week sits beside the Week dropdown, inside the planner', () => {
  const selectAt = weekBlock.indexOf('id="planner-week-select"');
  const menuAt = weekBlock.indexOf('planner-week-menu-wrap');
  assert.equal(selectAt > 0 && menuAt > selectAt, true);
  assert.match(weekBlock, /fa-ellipsis-vertical/);
  assert.match(weekBlock, /Rename Week/);
  assert.match(weekBlock, /@click="startWeekRename"/);
  assert.match(weekBlock, /@click\.stop="toggleWeekMenu"/);
  assert.match(weekBlock, /:disabled="!canRenameWeek"/);
});

test('the menu and editor are disabled outside create/edit mode or without a selected week', () => {
  assert.match(script, /const canRenameWeek = computed\(\(\) => canModifyScheduleDayActions\.value && Boolean\(selectedWeek\.value\)\)/);
  assert.match(sliceFn('const toggleWeekMenu = () => {', 'const cancelWeekRename'), /if \(!canRenameWeek\.value\) \{\s*return;\s*\}/);
  assert.match(sliceFn('const startWeekRename = () => {', 'const handleWeekRenameInput'), /if \(!canRenameWeek\.value\) \{\s*return;\s*\}/);
});

test('the editor reuses the inline day-rename look and keys: Enter saves, Escape cancels, Save and Cancel buttons', () => {
  const editor = weekBlock.slice(weekBlock.indexOf('v-if="isRenamingWeek"'));
  assert.match(editor, /day-title-inline-input/);
  assert.match(editor, /day-title-inline-btn--save/);
  assert.match(editor, /day-title-inline-btn--cancel/);
  assert.match(editor, /day-title-inline-error/);
  assert.match(editor, /:maxlength="WORKOUT_DAY_NAME_MAX_LENGTH"/);
  assert.match(editor, /@keydown\.enter\.prevent="saveWeekRename"/);
  assert.match(editor, /@keydown\.esc\.prevent="cancelWeekRename"/);
  assert.match(editor, /\{\{ weekRenameError \}\}/);
});

test('names are validated with the same rules as day names, with duplicate and empty checks', () => {
  assert.match(script, /const validateWorkoutDayName = \(rawValue, noun = scheduleModeLabelLower\.value\)/);
  assert.match(saveRename, /validateWorkoutDayName\(weekRenameDraft\.value, 'week'\)/);
  assert.match(saveRename, /renameWeekInPlan\(\{/);
  assert.match(saveRename, /if \(!result\.ok\) \{\s*weekRenameError\.value = result\.message;\s*return;\s*\}/);
  // Allowed characters stay the day rules (letters, numbers, spaces, ampersand, apostrophe, hyphen, parentheses).
  assert.match(script, /const WORKOUT_DAY_NAME_ALLOWED_PATTERN = \/\^\[A-Za-z0-9&'\(\) -\]\+\$\//);
});

test('a successful rename keeps identity, order, assignments and the selection, and touches no days or exercises', () => {
  assert.match(saveRename, /transferScheduleGroupIdentity\('week', oldName, validation\.value\)/);
  assert.match(saveRename, /weekGroups\.value = result\.weekGroups;/);
  assert.match(saveRename, /dayWeekAssignments\.value = result\.assignments;/);
  assert.match(saveRename, /syncGroupOrders\('week', weekGroups\.value\);/);
  assert.match(saveRename, /selectedWeek\.value = validation\.value;/);
  assert.equal(/workoutExercises|dayGroups|scheduleGroup|fetch\(|persist|router\./.test(saveRename), false);
});

test('rename state is UI only: reset on load and reset, and not in the payload, dirty snapshot or draft', () => {
  const hydrate = sliceFn('const hydratePlanner = (', 'const clearSelection = async');
  assert.match(hydrate, /isRenamingWeek\.value = false;/);
  const reset = script.slice(script.indexOf('const resetPlannerDraft'), script.indexOf('const resetPlannerDraft') + 2000);
  assert.match(reset, /isRenamingWeek\.value = false;/);
  const payloadStart = script.indexOf('const plannerPayload = computed');
  const payload = script.slice(payloadStart, script.indexOf('}));', payloadStart));
  const dirtyStart = script.indexOf('const buildPlannerDirtyState');
  const dirty = script.slice(dirtyStart, script.indexOf('const markPlannerStateCommitted', dirtyStart));
  [payload, dirty].forEach((block) => {
    assert.equal(/weekRename|isWeekMenuOpen|isRenamingWeek/.test(block), false);
  });
  assert.match(payload, /weekGroups: weekGroups\.value/);
  assert.match(payload, /weekGroupOrders: buildOrderEntries\(weekGroups\.value\)/);
});

test('the week menu closes on an outside click', () => {
  const close = sliceFn('const closeDayMenu = (e) => {', 'const toggleDayMenu');
  assert.match(close, /closest\('\.planner-week-menu-wrap'\)/);
  assert.match(close, /isWeekMenuOpen\.value = false;/);
});

test('day filtering is not added; the dropdown, Add Week and existing controls remain', () => {
  const cardsStart = script.indexOf('const accordionGroupsWithExercises');
  assert.equal(script.slice(cardsStart, cardsStart + 1500).includes('selectedWeek'), false);
  ['id="planner-week-select"', '@click="addWeek"', 'id="planner-add-day-input"', '@click="addScheduleGroup"', 'Add Exercise to End', 'Rename Day'].forEach((needle) =>
    assert.equal(plannerTemplate.includes(needle), true, needle)
  );
  const selectTag = weekBlock.slice(weekBlock.indexOf('<select'), weekBlock.indexOf('</select>'));
  assert.equal(/disabled/.test(selectTag), false);
});

test('nothing above Workout Plan Information is touched', () => {
  const formEnd = template.indexOf('</WorkoutMetadataForm>');
  assert.equal(formEnd > 0, true);
  assert.equal(/Rename Week|planner-week-menu|isRenamingWeek/.test(template.slice(0, formEnd)), false);
});
