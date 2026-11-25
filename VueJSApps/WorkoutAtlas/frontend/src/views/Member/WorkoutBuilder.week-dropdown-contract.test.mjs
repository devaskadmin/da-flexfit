import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.85.313.a5: Week selection in the Schedule Planner. Source-contract checks only.
// 0.85.316.4: the Week dropdown was replaced by horizontal week tabs; the contract below now covers the tabs.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, 'WorkoutBuilder.vue'), 'utf8');
const scriptStart = source.indexOf('<script setup');
const scriptEnd = source.indexOf('</script>');
const templateStart = source.indexOf('<template>', scriptEnd);
const styleStart = source.indexOf('<style');
const template = source.slice(templateStart, styleStart);
const script = source.slice(scriptStart, scriptEnd);
const plannerStart = template.indexOf('<section class="planner-shell">');
const plannerTemplate = template.slice(plannerStart);

test('the week tabs sit in the Schedule Planner above Add Day and the day cards and replace the dropdown (0.85.316.4)', () => {
  assert.equal(plannerStart > 0, true);
  const weekAt = plannerTemplate.indexOf('class="planner-week-tabs"');
  assert.equal(weekAt > 0, true);
  assert.equal(weekAt > plannerTemplate.indexOf('<h3>Schedule Planner</h3>'), true);
  assert.equal(weekAt < plannerTemplate.indexOf('id="planner-add-day-input"'), true);
  assert.equal(weekAt < plannerTemplate.indexOf('v-for="day in accordionGroupsWithExercises"'), true);
  assert.equal(plannerTemplate.includes('id="planner-week-select"'), false);
  assert.equal(/<select[^>]*v-model="selectedWeek"/s.test(plannerTemplate), false);
});

test('tabs come from the existing weeks, show at most four, and keep the stored value with a display label', () => {
  assert.match(plannerTemplate, /v-for="week in visibleWeekTabs"/);
  assert.match(plannerTemplate, /:key="getScheduleGroupId\(week\.value, 'week'\) \|\| week\.value"/);
  assert.match(plannerTemplate, /@click="selectWeekTab\(week\.value\)"/);
  assert.match(plannerTemplate, /\{\{ week\.label \}\}/);
  assert.match(script, /const weekOptions = computed\(\(\) => buildWeekOptions\(weekGroups\.value\)\)/);
  assert.match(script, /const WEEK_TABS_VISIBLE = 4;/);
  assert.match(script, /weekOptions\.value\.slice\(\s*effectiveWeekTabStart\.value,\s*effectiveWeekTabStart\.value \+ WEEK_TABS_VISIBLE\s*\)/);
  assert.equal(script.includes("'Week 1 (Default)'"), false);
});

test('arrows appear only above four weeks, are disabled at the ends and never change the selected week', () => {
  assert.match(script, /const showWeekTabArrows = computed\(\(\) => weekOptions\.value\.length > WEEK_TABS_VISIBLE\)/);
  assert.match(script, /const canShiftWeekTabsLeft = computed\(\(\) => effectiveWeekTabStart\.value > 0\)/);
  assert.match(script, /const canShiftWeekTabsRight = computed\(\(\) => effectiveWeekTabStart\.value < maxWeekTabStart\.value\)/);
  assert.match(plannerTemplate, /v-if="showWeekTabArrows"/);
  assert.match(plannerTemplate, /:disabled="!canShiftWeekTabsLeft"/);
  assert.match(plannerTemplate, /:disabled="!canShiftWeekTabsRight"/);
  const shiftStart = script.indexOf('const shiftWeekTabs = (step) => {');
  const shift = script.slice(shiftStart, script.indexOf('\n};', shiftStart));
  assert.equal(shift.includes('selectedWeek'), false);
  const selectStart = script.indexOf('const selectWeekTab = (week) => {');
  assert.match(script.slice(selectStart, script.indexOf('\n};', selectStart)), /selectedWeek\.value = week;/);
});

test('the selected tab stays visible after a load, selection change or new week, using one small watcher', () => {
  assert.match(script, /watch\(\[selectedWeek, \(\) => weekOptions\.value\.length\], revealSelectedWeekTab\);/);
  const start = script.indexOf('const revealSelectedWeekTab = () => {');
  const body = script.slice(start, script.indexOf('\n};', start));
  assert.match(body, /weekTabStart\.value = index;/);
  assert.match(body, /weekTabStart\.value = index - WEEK_TABS_VISIBLE \+ 1;/);
});

test('selection defaults to Week 1 or the first week and is re-resolved on load and reset', () => {
  assert.match(script, /resolveSelectedWeek\(weeks, selectedWeek\.value\)/);
  const hydrateStart = script.indexOf('const hydratePlanner = (');
  const hydrate = script.slice(hydrateStart, script.indexOf('const clearSelection = async', hydrateStart));
  assert.match(hydrate, /selectedWeek\.value = resolveSelectedWeek\(weekGroups\.value\);/);
  const resetStart = script.indexOf('const resetPlannerDraft');
  const reset = script.slice(resetStart, resetStart + 1200);
  assert.match(reset, /selectedWeek\.value = '';/);
});

test('switching weeks never edits plan data or saves; the day cards are filtered only through visibleDayGroups (a8)', () => {
  // 0.85.313.a8: the one line that may combine selectedWeek with assignment data assigns a newly created day to the selected week.
  // 0.85.313.a8.1: the same handler also passes selectedWeek to the per-week duplicate check and unique-key helpers (read-only).
  const uses = script.split('\n')
    .filter((line) => line.includes('selectedWeek'))
    .filter((line) => !line.includes('dayWeekAssignments.value = assignDayToWeek('))
    .filter((line) => !/buildUniqueDayKey\(|buildDuplicateDayMessage\(/.test(line));
  uses.forEach((line) => {
    assert.equal(/workoutExercises|dayGroups|weekGroups\.value\s*=|dayWeekAssignments\.value\s*=|fetch\(|persist|save/i.test(line), false, line);
  });
  const cardsStart = script.indexOf('const accordionGroupsWithExercises');
  assert.equal(cardsStart > 0, true);
  const cards = script.slice(cardsStart, cardsStart + 1500);
  assert.equal(cards.includes('selectedWeek'), false);
  assert.equal(plannerTemplate.includes('selectedWeek'), false);
});

test('the selection is UI state only: not in the save payload, dirty snapshot or draft', () => {
  const payloadStart = script.indexOf('const plannerPayload = computed');
  assert.equal(script.slice(payloadStart, script.indexOf('}));', payloadStart)).includes('selectedWeek'), false);
  const dirtyStart = script.indexOf('const buildPlannerDirtyState');
  assert.equal(script.slice(dirtyStart, script.indexOf('const markPlannerStateCommitted', dirtyStart)).includes('selectedWeek'), false);
  const draftStart = script.indexOf('const storeUnsavedBuilderDraft');
  assert.equal(script.slice(draftStart, script.indexOf('const restoreUnsavedBuilderDraft', draftStart)).includes('selectedWeek'), false);
});

test('existing controls and the unsaved-change handling are unchanged', () => {
  ['id="planner-add-day-input"', '@click="addScheduleGroup"', 'Add Exercise to End', 'v-if="showBottomScheduleGroupControls"'].forEach((needle) =>
    assert.equal(plannerTemplate.includes(needle), true, needle)
  );
  assert.match(script, /dayWeekAssignments: serializeDayWeekAssignments\(dayWeekAssignments\.value\),/);
  assert.match(script, /settings: buildDayWeekAssignmentsSettings\(dayWeekAssignments\.value\),/);
  assert.equal(/Day View|Week View/.test(template), false);
  assert.equal(template.indexOf('Rename Week') > template.indexOf('</WorkoutMetadataForm>'), true);
});

test('nothing above Workout Plan Information is touched by the week tabs', () => {
  const metadataFormAt = template.indexOf('</WorkoutMetadataForm>');
  assert.equal(metadataFormAt > 0 && template.indexOf('planner-week-tabs') > metadataFormAt, true);
  assert.equal(template.slice(0, metadataFormAt).includes('selectedWeek'), false);
});
