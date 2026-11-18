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
