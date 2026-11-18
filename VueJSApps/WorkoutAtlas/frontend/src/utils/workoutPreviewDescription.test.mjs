import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPreviewDescriptionDisplay,
  truncateTextAtWordBoundary,
} from './workoutPreviewDescription.mjs';

test('truncateTextAtWordBoundary leaves short text unchanged', () => {
  const input = 'Balanced wellness plan for everyday fitness.';
  const result = truncateTextAtWordBoundary(input, 140);

  assert.equal(result.text, input);
  assert.equal(result.isTruncated, false);
});

test('truncateTextAtWordBoundary truncates long text at word boundary with ellipsis', () => {
  const input = 'Maintain your health and improve everyday strength with a complete full body routine designed for consistency and long term progress across cardio, mobility, and resistance sessions each week.';
  const result = truncateTextAtWordBoundary(input, 80);

  assert.equal(result.isTruncated, true);
  assert.equal(result.text.endsWith('…'), true);
  assert.equal(result.text.includes('  '), false);
  assert.ok(result.text.length <= 81);
});

test('truncateTextAtWordBoundary safely truncates long unbroken tokens', () => {
  const input = 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const result = truncateTextAtWordBoundary(input, 32);

  assert.equal(result.isTruncated, true);
  assert.equal(result.text.endsWith('…'), true);
  assert.ok(result.text.length <= 33);
});

test('getPreviewDescriptionDisplay returns hidden state for empty descriptions', () => {
  const result = getPreviewDescriptionDisplay({ description: '   ', isMobile: true, isExpanded: false });

  assert.equal(result.shouldRender, false);
  assert.equal(result.showToggle, false);
});

test('getPreviewDescriptionDisplay returns full description without toggle on desktop', () => {
  const description = 'This full description should always remain visible on desktop.';
  const result = getPreviewDescriptionDisplay({ description, isMobile: false, isExpanded: false });

  assert.equal(result.shouldRender, true);
  assert.equal(result.text, description);
  assert.equal(result.showToggle, false);
  assert.equal(result.isExpanded, true);
});

test('getPreviewDescriptionDisplay returns collapsed mobile description with Show Details', () => {
  const description = 'This mobile description should collapse because it is intentionally long and contains enough words to trigger truncation at a word boundary for compact preview rendering.';
  const result = getPreviewDescriptionDisplay({ description, isMobile: true, isExpanded: false, maxChars: 100 });

  assert.equal(result.shouldRender, true);
  assert.equal(result.showToggle, true);
  assert.equal(result.isExpanded, false);
  assert.equal(result.toggleLabel, 'Show Details');
  assert.equal(result.text.endsWith('…'), true);
});

test('getPreviewDescriptionDisplay returns expanded mobile description with Show Less', () => {
  const description = 'This mobile description should collapse because it is intentionally long and contains enough words to trigger truncation at a word boundary for compact preview rendering.';
  const result = getPreviewDescriptionDisplay({ description, isMobile: true, isExpanded: true, maxChars: 100 });

  assert.equal(result.shouldRender, true);
  assert.equal(result.showToggle, true);
  assert.equal(result.isExpanded, true);
  assert.equal(result.toggleLabel, 'Show Less');
  assert.equal(result.text, description);
});
