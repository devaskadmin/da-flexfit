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
