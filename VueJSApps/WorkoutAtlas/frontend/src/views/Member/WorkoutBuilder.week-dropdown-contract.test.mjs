import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.85.313.a5: Week selection dropdown in the Schedule Planner. Source-contract checks only.
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

test('the Week dropdown sits in the Schedule Planner above Add Day and the day cards', () => {
  assert.equal(plannerStart > 0, true);
  const weekAt = plannerTemplate.indexOf('id="planner-week-select"');
  assert.equal(weekAt > 0, true);
  assert.equal(weekAt > plannerTemplate.indexOf('<h3>Schedule Planner</h3>'), true);
  assert.equal(weekAt < plannerTemplate.indexOf('id="planner-add-day-input"'), true);
  assert.equal(weekAt < plannerTemplate.indexOf('v-for="day in accordionGroupsWithExercises"'), true);
  assert.match(plannerTemplate, /<select[^>]*id="planner-week-select"[^>]*v-model="selectedWeek"|<select[^>]*v-model="selectedWeek"[^>]*>/s);
});

test('options come from the existing weeks and show the stored value with a display label', () => {
  assert.match(plannerTemplate, /v-for="week in weekOptions"/);
  assert.match(plannerTemplate, /:value="week\.value"/);
  assert.match(plannerTemplate, /\{\{ week\.label \}\}/);
  assert.match(script, /const weekOptions = computed\(\(\) => buildWeekOptions\(weekGroups\.value\)\)/);
  assert.equal(script.includes("'Week 1 (Default)'"), false);
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
  assert.equal(plannerTemplate.replace('v-model="selectedWeek"', '').includes('selectedWeek'), false);
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

test('nothing above Workout Plan Information is touched by the dropdown', () => {
  const metadataFormAt = template.indexOf('</WorkoutMetadataForm>');
  assert.equal(metadataFormAt > 0 && template.indexOf('planner-week-select') > metadataFormAt, true);
  assert.equal(template.slice(0, metadataFormAt).includes('selectedWeek'), false);
});
