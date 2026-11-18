import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatLocalDateLabel,
  formatLocalDateTimeLabel,
  normalizeDateInputValue,
  parseLocalDateValue,
  toLocalDateInputValue,
} from './workoutLogDateFormat.mjs';

test('normalizeDateInputValue preserves date-only strings', () => {
  assert.equal(normalizeDateInputValue('2026-11-18'), '2026-11-18');
});

test('normalizeDateInputValue safely normalizes ISO timestamp input', () => {
  const normalized = normalizeDateInputValue('2026-11-18T05:00:00.000Z');
  assert.match(normalized, /^\d{4}-\d{2}-\d{2}$/);
});

test('formatLocalDateLabel returns readable calendar text for date-only input', () => {
  const label = formatLocalDateLabel('2026-11-18');
  assert.ok(label.length > 8);
  assert.equal(label.includes('T'), false);
});

test('formatLocalDateLabel handles invalid values', () => {
  assert.equal(formatLocalDateLabel('not-a-date'), 'Date unavailable');
});

test('toLocalDateInputValue returns YYYY-MM-DD format', () => {
  const value = toLocalDateInputValue(new Date(2026, 10, 18, 13, 45, 0));
  assert.equal(value, '2026-11-18');
});

test('parseLocalDateValue parses date-only and datetime values', () => {
  const dateOnly = parseLocalDateValue('2026-11-18');
  const dateTime = parseLocalDateValue('2026-11-18T05:00:00.000Z');

  assert.ok(dateOnly instanceof Date);
  assert.ok(dateTime instanceof Date);
});

test('formatLocalDateTimeLabel returns readable local date-time', () => {
  const label = formatLocalDateTimeLabel('2026-11-18T05:00:00.000Z');
  assert.ok(label.length > 8);
  assert.equal(label.includes('T'), false);
});
