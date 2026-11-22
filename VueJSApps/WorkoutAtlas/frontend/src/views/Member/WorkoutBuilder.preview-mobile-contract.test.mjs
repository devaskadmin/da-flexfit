import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewPath = path.join(__dirname, 'WorkoutBuilder.vue');
const source = fs.readFileSync(viewPath, 'utf8');

test('mobile preview exposes Show Details and Show Less controls', () => {
  assert.equal(source.includes('Show Details'), true);
  assert.equal(source.includes('Show Less'), true);
  assert.equal(source.includes('global-library-inline-preview__description-toggle'), true);
  assert.equal(source.includes('aria-expanded'), true);
});

test('mobile preview resets description expansion when plan context changes', () => {
  assert.equal(source.includes("() => globalLibraryViewPlan.value?.planId"), true);
  assert.equal(source.includes('previewDescriptionExpanded.value = false;'), true);
});

test('mobile compact metadata rendering uses label value entries', () => {
  assert.equal(source.includes('compactPreviewMetadataEntries'), true);
  assert.equal(source.includes('global-library-inline-preview__meta-grid--compact'), true);
  assert.equal(source.includes('global-library-inline-preview__meta-label'), true);
  assert.equal(source.includes('global-library-inline-preview__meta-value'), true);
});

test('Find Plans uses cards instead of the desktop table from 769px through 1024px', () => {
  const tabletStart = source.indexOf('@media (min-width: 769px) and (max-width: 1024px)');
  assert.notEqual(tabletStart, -1);
  const tabletBlock = source.slice(tabletStart, source.indexOf('@media (max-width: 420px)', tabletStart));
  assert.match(tabletBlock, /\.global-library-table-wrap\s*\{\s*display:\s*none;/);
  assert.match(tabletBlock, /\.global-library-mobile-list\s*\{[^}]*display:\s*grid;/);
  assert.match(tabletBlock, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
});

test('Find Plans card layout preserves long names and full-width action controls', () => {
  const tabletStart = source.indexOf('@media (min-width: 769px) and (max-width: 1024px)');
  assert.notEqual(tabletStart, -1);
  const tabletBlock = source.slice(tabletStart, source.indexOf('@media (max-width: 420px)', tabletStart));
  assert.match(tabletBlock, /\.global-library-mobile-card__name\s*\{[^}]*overflow-wrap:\s*anywhere;/);
  assert.match(tabletBlock, /\.global-library-mobile-card__actions \.global-plans-table__btn\s*\{[^}]*min-width:\s*0;/);
});

test('Find Plans card actions reuse existing preview and use-plan handlers', () => {
  assert.equal(source.includes('@click="openGlobalLibraryViewModal(plan)"'), true);
  assert.equal(source.includes('@click="selectTemplatePlan(plan)"'), true);
  assert.equal(source.includes('@click="viewGlobalPlanSummary(plan)"'), true);
  assert.equal(source.includes('@click="requestDeleteGlobalPlan(plan)"'), true);
});

test('Create and Edit plan expose a top Save control using the existing primary save handler', () => {
  const createRow = source.slice(source.indexOf('plan-info-action-row--create'), source.indexOf('class="collapsible-panel__body"', source.indexOf('plan-info-action-row--create')));
  assert.match(createRow, /plan-info-action-row__back/);
  assert.match(createRow, /plan-info-action-row__save/);
  assert.match(createRow, /@click="handlePrimarySave"/);
  assert.match(createRow, /fa-floppy-disk/);

  const editRow = source.slice(source.indexOf('aria-label="Edit mode navigation and save actions"'), source.indexOf('<WorkoutMetadataForm', source.indexOf('aria-label="Edit mode navigation and save actions"')));
  assert.match(editRow, /plan-info-action-row__back/);
  assert.match(editRow, /plan-info-action-row__save/);
  assert.match(editRow, /@click="handlePrimarySave"/);
  assert.match(editRow, /fa-floppy-disk/);
});

test('top plan action row is full-width with left Back and right green Save controls', () => {
  assert.match(source, /\.plan-info-action-row\s*\{[^}]*justify-content:\s*space-between;/s);
  assert.match(source, /\.plan-info-action-row\s*\{[^}]*width:\s*100%;/s);
  assert.match(source, /\.plan-info-action-row__save\s*\{[^}]*background:\s*#15803D;/s);
  assert.match(source, /\.plan-info-action-row__save\s*\{[^}]*color:\s*#FFFFFF;/s);
});

test('top plan action row uses identical aligned Back and Save control heights', () => {
  assert.match(source, /\.plan-info-action-row\s*\{[^}]*align-items:\s*center;/s);
  assert.match(source, /\.plan-info-action-row__back,\s*\.plan-info-action-row__save\s*\{[^}]*height:\s*32px;/s);
  assert.match(source, /\.plan-info-action-row__back,\s*\.plan-info-action-row__save\s*\{[^}]*min-height:\s*32px;/s);
  assert.match(source, /\.plan-info-action-row__back,\s*\.plan-info-action-row__save\s*\{[^}]*line-height:\s*32px;/s);
  assert.match(source, /\.plan-info-action-row__save\s*\{[^}]*margin-left:\s*auto;/s);
});

test('0.85.312 shows bottom Add Day or Add Week after one schedule and two exercises', () => {
  assert.match(source, /const showBottomScheduleGroupControls = computed/);
  assert.match(source, /visibleDayGroups\.value\.length < 1/);
  // 0.85.313.a8: the two-exercise rule now counts the exercises of the days shown for the selected week.
  assert.match(source, /countUniqueWorkoutPlanExercises\(workoutDaysWithExercises\.value\.flatMap\(\(day\) => day\.exercises\)\) >= 2/);
  // 0.85.312 requirement preserved: the exercises counted come from the days of the selected week, which are the visible day groups.
  assert.match(source, /const workoutDaysWithExercises = computed\(\(\) => \{\s*return visibleDayGroups\.value\.map/);
  assert.match(source, /<div v-if="showBottomScheduleGroupControls" class="planner-bottom-group-actions">/);
  assert.match(source, /v-model="newScheduleGroupNameBottom"/);
  assert.match(source, /@click="addScheduleGroupBottom"/);
});

test('0.85.312 bottom controls reuse schedule labels and existing validation handler', () => {
  assert.match(source, /scheduleGroupEditorLabel/);
  assert.match(source, /scheduleGroupInputPlaceholder/);
  assert.match(source, /scheduleGroupAddButtonLabel/);
  assert.match(source, /@keydown\.enter\.prevent="addScheduleGroupBottom"/);
  assert.match(source, /addScheduleGroupBottom.*addScheduleGroupFromValue/s);
});

test('0.85.313.a1 new plans initialize Week 1 as the default week', () => {
  assert.match(source, /const DEFAULT_NEW_PLAN_WEEK_NAME = 'Week 1';/);
  const createStart = source.indexOf('const createWorkoutPlan = async () => {');
  const createEnd = source.indexOf('const clearScheduleGroupEdit = () => {', createStart);
  assert.notEqual(createStart, -1);
  const createBlock = source.slice(createStart, createEnd);
  assert.match(createBlock, /weekGroups\.value = \[DEFAULT_NEW_PLAN_WEEK_NAME\];/);
  assert.match(createBlock, /syncGroupOrders\('week', weekGroups\.value\);/);
  assert.match(createBlock, /ensureAccordionSelectionForMode\('week'\);/);
  assert.match(createBlock, /scheduleMode\.value = 'day';\s*dayGroups\.value = \[\];/);
});

test('0.85.313.a1 default week is not injected into reset plans; loaded plans only initialize Week 1 when no weeks exist', () => {
  const hydrateStart = source.indexOf('const hydratePlanner = (');
  const hydrateEnd = source.indexOf('const clearSelection = async', hydrateStart);
  const hydrateBlock = source.slice(hydrateStart, hydrateEnd);
  assert.match(hydrateBlock, /if \(!weekGroups\.value\.length\) \{\s*weekGroups\.value = \[DEFAULT_NEW_PLAN_WEEK_NAME\];\s*\}/);
  assert.equal(hydrateBlock.split('DEFAULT_NEW_PLAN_WEEK_NAME').length - 1, 1);
  const resetStart = source.indexOf('const resetPlannerDraft = (');
  const resetEnd = source.indexOf('const clearActivePlanRouteQuery', resetStart);
  assert.equal(source.slice(resetStart, resetEnd).includes('DEFAULT_NEW_PLAN_WEEK_NAME'), false);
  assert.equal(source.split('DEFAULT_NEW_PLAN_WEEK_NAME').length - 1, 3);
});

test('0.85.313.a3.2 save payload always carries both day and week groups with their orders and assignments', () => {
  const payloadStart = source.indexOf('const plannerPayload = computed(() => ({');
  const payloadEnd = source.indexOf('const sendAiSuggestion = async', payloadStart);
  assert.notEqual(payloadStart, -1);
  const payloadBlock = source.slice(payloadStart, payloadEnd);
  assert.match(payloadBlock, /dayGroups: dayGroups\.value,/);
  assert.match(payloadBlock, /weekGroups: weekGroups\.value,/);
  assert.match(payloadBlock, /dayGroupOrders: buildOrderEntries\(dayGroups\.value\),/);
  assert.match(payloadBlock, /weekGroupOrders: buildOrderEntries\(weekGroups\.value\),/);
  assert.match(payloadBlock, /settings: buildDayWeekAssignmentsSettings\(dayWeekAssignments\.value\),/);
  assert.equal(/scheduleMode\.value === 'week' \?\s*(dayGroups|weekGroups)/.test(payloadBlock), false);
});

test('0.85.312 bottom Add control uses green background and white text', () => {
  assert.match(source, /\.planner-group-add--bottom\s*\{[^}]*border-color:\s*#15803D;/s);
  assert.match(source, /\.planner-group-add--bottom\s*\{[^}]*background:\s*#15803D;/s);
  assert.match(source, /\.planner-group-add--bottom\s*\{[^}]*color:\s*#FFFFFF;/s);
});
