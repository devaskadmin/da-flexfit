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

test('Create and Edit Plan expose a top Save button using the existing primary save handler', () => {
  assert.equal(source.includes('plan-info-action-row--create'), true);
  assert.equal(source.includes('plan-info-action-row__save'), true);
  assert.equal(source.includes('@click="handlePrimarySave"'), true);

  const createStart = source.indexOf('plan-info-action-row--create');
  const createEnd = source.indexOf('<div class="collapsible-panel__body">', createStart);
  const createBlock = source.slice(createStart, createEnd);
  assert.match(createBlock, /plan-info-action-row__back/);
  assert.match(createBlock, /plan-info-action-row__save/);
  assert.match(createBlock, /@click="handlePrimarySave"/);

  const editStart = source.indexOf('v-if="isViewEditMode" class="plan-info-action-row"');
  const editEnd = source.indexOf('<WorkoutMetadataForm', editStart);
  const editBlock = source.slice(editStart, editEnd);
  assert.match(editBlock, /plan-info-action-row__back/);
  assert.match(editBlock, /plan-info-action-row__save/);
  assert.match(editBlock, /@click="handlePrimarySave"/);
});

test('top plan action row stays full width and preserves desktop/mobile single-row layout', () => {
  const rowStart = source.indexOf('.plan-info-action-row {');
  assert.notEqual(rowStart, -1);
  const rowBlock = source.slice(rowStart, source.indexOf('.plan-info-action-row__back {', rowStart));
  assert.match(rowBlock, /width:\s*100%;/);
  assert.match(rowBlock, /justify-content:\s*space-between;/);
  assert.match(rowBlock, /flex-wrap:\s*nowrap;/);

  const mobileStart = source.indexOf('@media (max-width: 768px)');
  assert.notEqual(mobileStart, -1);
  const mobileBlock = source.slice(mobileStart, source.indexOf('.planner-mode-pill-wrap', mobileStart));
  assert.match(mobileBlock, /\.plan-info-action-row\s*\{[^}]*justify-content:\s*space-between;/);
  assert.match(mobileBlock, /\.plan-info-action-row\s*\{[^}]*flex-wrap:\s*nowrap;/);

  const saveStart = source.indexOf('.plan-info-action-row__save {');
  const saveBlock = source.slice(saveStart, source.indexOf('.plan-info-action-row__save:hover', saveStart));
  assert.match(saveBlock, /background:\s*#15803D;/);
  assert.match(saveBlock, /color:\s*#FFFFFF;/);
  assert.doesNotMatch(saveBlock, /margin-left:\s*auto;/);
  assert.match(rowBlock, /justify-content:\s*space-between;/);
});

test('bottom Add Day and Add Week controls restore below the schedule and reuse existing handlers', () => {
  assert.equal(source.includes('bottomScheduleControlsVisible'), true);
  assert.equal(source.includes('class="planner-bottom-group-actions"'), true);
  assert.equal(source.includes('@click="addScheduleGroupBottom"'), true);
  assert.equal(source.includes('v-model="newScheduleGroupNameBottom"'), true);
  assert.equal(source.includes('scheduleModeLabelLower'), true);

  assert.match(source, /bottomScheduleControlsVisible\s*=\s*computed/);
  assert.match(source, /activeGroups\.value\.length\s*>\s*0/);
  assert.match(source, /countUniqueWorkoutPlanExercises\(workoutExercises\.value\)\s*>=\s*2/);

  const bottomStart = source.indexOf('class="planner-bottom-group-actions"');
  const bottomBlock = source.slice(bottomStart, source.indexOf('<p v-if="plannerMessage"', bottomStart));
  assert.match(bottomBlock, /v-model="newScheduleGroupNameBottom"/);
  assert.match(bottomBlock, /@click="addScheduleGroupBottom"/);
  assert.match(bottomBlock, /scheduleGroupEditorLabel/);
  assert.match(bottomBlock, /scheduleGroupAddButtonLabel/);
});

test('bottom schedule controls remain outside collapsed accordions and use green Add styling', () => {
  const bottomStart = source.indexOf('class="planner-bottom-group-actions"');
  assert.notEqual(bottomStart, -1);
  const bottomBlock = source.slice(bottomStart, source.indexOf('<p v-if="plannerMessage"', bottomStart));
  assert.doesNotMatch(bottomBlock, /v-if="day\.isExpanded"/);
  assert.match(source, /\.planner-group-add\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*#16a34a\s*0%,\s*#15803d\s*100%\)/);
  assert.match(source, /\.planner-group-add\s*\{[^}]*color:\s*#fff;/);

  const responsiveStart = source.indexOf('.planner-bottom-group-actions__editor {');
  assert.notEqual(responsiveStart, -1);
  const responsiveBlock = source.slice(responsiveStart, source.indexOf('.planner-group-add--bottom', responsiveStart));
  assert.match(responsiveBlock, /grid-template-columns:\s*(minmax\(0,\s*1fr\)\s*auto|1fr)/);
});

test('top Back and Save buttons share identical 36px dimensions and full-width spacing', () => {
  const rowStart = source.indexOf('.plan-info-action-row {');
  assert.notEqual(rowStart, -1);
  const rowBlock = source.slice(rowStart, source.indexOf('.plan-info-action-row__back,', rowStart));
  assert.match(rowBlock, /width:\s*100%;/);
  assert.match(rowBlock, /display:\s*flex;/);
  assert.match(rowBlock, /justify-content:\s*space-between;/);
  assert.match(rowBlock, /align-items:\s*center;/);
  assert.match(rowBlock, /margin:\s*12px\s*0;/);

  const sharedStart = source.indexOf('.plan-info-action-row__back,');
  assert.notEqual(sharedStart, -1);
  const sharedBlock = source.slice(sharedStart, source.indexOf('.plan-info-action-row__back {', sharedStart));
  assert.match(sharedBlock, /height:\s*36px;/);
  assert.match(sharedBlock, /min-height:\s*36px;/);
  assert.match(sharedBlock, /padding:\s*0\s*12px;/);
  assert.match(sharedBlock, /border-radius:\s*6px;/);
  assert.match(sharedBlock, /font-size:\s*0\.74rem;/);
  assert.match(sharedBlock, /align-items:\s*center;/);
});
